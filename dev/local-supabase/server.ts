/**
 * Local Supabase emulator for development and end-to-end testing.
 *
 * Runs the real migrations in an embedded Postgres (PGlite) and exposes the
 * subset of the GoTrue (auth), PostgREST (rest) and Storage HTTP APIs that
 * FocusFlow uses. Every data request executes as the `authenticated` role with
 * `auth.uid()` set from the JWT, so Row Level Security is enforced exactly as
 * in production.
 *
 *   npm run local:backend           # http://localhost:54321
 *   VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=local-anon-key npm run dev
 *
 * NOT for production: passwords are hashed with scrypt but there is no rate
 * limiting, email delivery or key management.
 */
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite, type Transaction } from '@electric-sql/pglite'

const PORT = Number(process.env.PORT ?? 54321)
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const DATA_DIR = process.env.LOCAL_SUPABASE_DIR ?? join(ROOT, '.local-supabase')
const SECRET = 'local-dev-jwt-secret-do-not-use-in-production'
const TOKEN_TTL = 3600

if (process.argv.includes('--reset')) rmSync(DATA_DIR, { recursive: true, force: true })
mkdirSync(join(DATA_DIR, 'objects'), { recursive: true })

/* ---------------------------------- DB ----------------------------------- */

const fresh = !existsSync(join(DATA_DIR, 'pgdata'))
const db = await PGlite.create(join(DATA_DIR, 'pgdata'))
if (fresh) {
  await db.exec(readFileSync(join(ROOT, 'tests', 'db', 'supabase-stubs.sql'), 'utf8'))
  await db.exec(`alter table auth.users add column if not exists password_hash text; alter table auth.users add column if not exists created_at timestamptz default now();`)
  await db.exec(`alter table storage.objects add column if not exists mimetype text; alter table storage.objects add column if not exists size bigint;`)
  for (const f of readdirSync(join(ROOT, 'supabase', 'migrations')).sort()) {
    await db.exec(readFileSync(join(ROOT, 'supabase', 'migrations', f), 'utf8'))
  }
  console.log('Applied migrations to a fresh database')
}

const TABLES = new Set(['profiles', 'subjects', 'units', 'concepts', 'items', 'skills', 'achievements', 'files'])
const IDENT = /^[a-z_][a-z0-9_]*$/

/** Runs fn inside a transaction as the given user, with RLS active. */
async function asUser<T>(userId: string | null, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return fn(tx)
  })
}

/* ---------------------------------- JWT ---------------------------------- */

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString('base64url')
function sign(payload: Record<string, unknown>): string {
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}
function verify(token: string): { sub: string; email: string } | null {
  const [head, body, sig] = token.split('.')
  if (!head || !body || !sig) return null
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
  if (payload.exp * 1000 < Date.now()) return null
  return payload
}

/* ---------------------------------- Auth --------------------------------- */

interface UserRow {
  id: string
  email: string
  raw_user_meta_data: Record<string, unknown>
  password_hash: string
  created_at: string
}

const refreshTokens = new Map<string, string>() // token -> user id

function hashPassword(pw: string): string {
  const salt = randomBytes(16)
  return `${salt.toString('hex')}:${scryptSync(pw, salt, 32).toString('hex')}`
}
function checkPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  const actual = scryptSync(pw, Buffer.from(salt!, 'hex'), 32)
  return timingSafeEqual(actual, Buffer.from(hash!, 'hex'))
}

function publicUser(u: UserRow) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.created_at,
    confirmed_at: u.created_at,
    last_sign_in_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [{ id: u.id, user_id: u.id, provider: 'email', identity_data: { sub: u.id, email: u.email } }],
    created_at: u.created_at,
    updated_at: new Date().toISOString(),
  }
}

function session(u: UserRow) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL
  const refresh = randomBytes(24).toString('hex')
  refreshTokens.set(refresh, u.id)
  return {
    access_token: sign({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp, iat: exp - TOKEN_TTL }),
    token_type: 'bearer',
    expires_in: TOKEN_TTL,
    expires_at: exp,
    refresh_token: refresh,
    user: publicUser(u),
  }
}

async function findUser(where: 'email' | 'id', value: string): Promise<UserRow | undefined> {
  const { rows } = await db.query<UserRow>(`select id, email, raw_user_meta_data, password_hash, created_at::text from auth.users where ${where} = $1`, [value])
  return rows[0]
}

const authError = (status: number, code: string, msg: string) => ({ status, body: { code: status, error_code: code, msg, message: msg } })

async function handleAuth(method: string, path: string, url: URL, body: Record<string, any>, userId: string | null): Promise<{ status: number; body: unknown }> {
  if (method === 'POST' && path === '/signup') {
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) return authError(400, 'validation_failed', 'Unable to validate email address: invalid format')
    if (String(body.password ?? '').length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.')
    if (await findUser('email', email)) return authError(422, 'user_already_exists', 'User already registered')
    const id = randomUUID()
    await db.query(`insert into auth.users (id, email, raw_user_meta_data, password_hash) values ($1, $2, $3, $4)`, [id, email, JSON.stringify(body.data ?? {}), hashPassword(body.password)])
    return { status: 200, body: session((await findUser('id', id))!) }
  }
  if (method === 'POST' && path === '/token') {
    const grant = url.searchParams.get('grant_type')
    if (grant === 'password') {
      const u = await findUser('email', String(body.email ?? '').trim().toLowerCase())
      if (!u || !checkPassword(String(body.password ?? ''), u.password_hash)) return authError(400, 'invalid_credentials', 'Invalid login credentials')
      return { status: 200, body: session(u) }
    }
    if (grant === 'refresh_token') {
      const id = refreshTokens.get(body.refresh_token)
      if (!id) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
      refreshTokens.delete(body.refresh_token)
      return { status: 200, body: session((await findUser('id', id))!) }
    }
  }
  if (path === '/user') {
    if (!userId) return authError(401, 'no_authorization', 'This endpoint requires a valid Bearer token')
    if (method === 'PUT') {
      if (body.password) await db.query(`update auth.users set password_hash = $2 where id = $1`, [userId, hashPassword(body.password)])
      if (body.data) await db.query(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb where id = $1`, [userId, JSON.stringify(body.data)])
    }
    return { status: 200, body: publicUser((await findUser('id', userId))!) }
  }
  if (method === 'POST' && path === '/logout') return { status: 204, body: null }
  if (method === 'POST' && path === '/recover') return { status: 200, body: {} }
  return authError(404, 'not_found', `Unsupported auth endpoint ${method} ${path}`)
}

/* -------------------------------- PostgREST ------------------------------- */

function buildWhere(url: URL, params: unknown[]): string {
  const clauses: string[] = []
  for (const [col, raw] of url.searchParams) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(col)) continue
    if (!IDENT.test(col)) throw Object.assign(new Error(`Invalid column ${col}`), { code: 'PGRST100' })
    const dot = raw.indexOf('.')
    const op = raw.slice(0, dot)
    const value = raw.slice(dot + 1)
    if (op === 'is') {
      clauses.push(`${col} is ${value === 'null' ? 'null' : value === 'true' ? 'true' : 'false'}`)
    } else if (op === 'in') {
      params.push(value.replace(/^\(|\)$/g, '').split(',').map((v) => v.replace(/^"|"$/g, '')))
      clauses.push(`${col}::text = any($${params.length}::text[])`)
    } else {
      const sqlOp = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'like', ilike: 'ilike' }[op]
      if (!sqlOp) throw Object.assign(new Error(`Unsupported operator ${op}`), { code: 'PGRST100' })
      params.push(value)
      clauses.push(`${col}::text ${sqlOp} $${params.length}`)
    }
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : ''
}

function buildOrder(url: URL): string {
  const order = url.searchParams.get('order')
  if (!order) return ''
  const parts = order.split(',').map((p) => {
    const [col, dir, nulls] = p.split('.')
    if (!col || !IDENT.test(col)) throw Object.assign(new Error(`Invalid order ${p}`), { code: 'PGRST100' })
    return `${col} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`
  })
  return `order by ${parts.join(', ')}`
}

async function handleRest(req: IncomingMessage, url: URL, table: string, raw: string, userId: string | null): Promise<{ status: number; body: unknown; headers?: Record<string, string> }> {
  if (!TABLES.has(table)) return { status: 404, body: { code: '42P01', message: `relation "public.${table}" does not exist` } }
  const prefer = String(req.headers.prefer ?? '')
  const wantsObject = String(req.headers.accept ?? '').includes('vnd.pgrst.object+json')
  const minimal = prefer.includes('return=minimal') || (req.method !== 'GET' && req.method !== 'HEAD' && !prefer.includes('return=representation'))
  const params: unknown[] = []
  let sql: string

  if (req.method === 'GET' || req.method === 'HEAD') {
    const where = buildWhere(url, params)
    const limit = url.searchParams.get('limit')
    const offset = url.searchParams.get('offset')
    sql = `select * from public.${table} ${where} ${buildOrder(url)} ${limit ? `limit ${Number(limit)}` : ''} ${offset ? `offset ${Number(offset)}` : ''}`
  } else if (req.method === 'POST') {
    // supabase-js sends `Prefer: missing=default`: keys a row omits take the
    // column default, so each row is inserted with only its own columns.
    const payload = JSON.parse(raw || '[]')
    const rows: Array<Record<string, unknown>> = Array.isArray(payload) ? payload : [payload]
    if (rows.some((r) => Object.keys(r).some((c) => !IDENT.test(c)))) throw Object.assign(new Error('Invalid column'), { code: 'PGRST204' })
    const inserted = await asUser(userId, async (tx) => {
      const out: unknown[] = []
      for (const row of rows) {
        const cols = Object.keys(row)
        const stmt = cols.length
          ? `insert into public.${table} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_record(null::public.${table}, $1::json) returning *`
          : `insert into public.${table} default values returning *`
        const res = await tx.query<{ body: unknown }>(`with pgrst as (${stmt}) select row_to_json(pgrst) as body from pgrst`, cols.length ? [JSON.stringify(row)] : [])
        out.push(res.rows[0]!.body)
      }
      return out
    })
    if (minimal) return { status: 201, body: null }
    if (wantsObject) return inserted.length === 1 ? { status: 201, body: inserted[0] } : { status: 406, body: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: null, hint: null } }
    return { status: 201, body: inserted }
  } else if (req.method === 'PATCH') {
    const payload = JSON.parse(raw || '{}')
    const cols = Object.keys(payload)
    if (!cols.length || cols.some((c) => !IDENT.test(c))) throw Object.assign(new Error('Invalid patch'), { code: 'PGRST204' })
    params.push(JSON.stringify(payload))
    const where = buildWhere(url, params)
    sql = `update public.${table} set (${cols.join(', ')}) = (select ${cols.join(', ')} from json_populate_record(null::public.${table}, $1::json)) ${where} returning *`
  } else if (req.method === 'DELETE') {
    sql = `delete from public.${table} ${buildWhere(url, params)} returning *`
  } else {
    return { status: 405, body: { message: 'Method not allowed' } }
  }

  const rows = await asUser(userId, async (tx) => {
    const res = await tx.query<{ body: unknown[] }>(`with pgrst as (${sql}) select coalesce(json_agg(pgrst), '[]'::json) as body from pgrst`, params)
    return res.rows[0]!.body
  })

  if (minimal) return { status: 204, body: null }
  if (wantsObject) {
    if (rows.length !== 1) return { status: 406, body: { code: 'PGRST116', details: `The result contains ${rows.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' } }
    return { status: 200, body: rows[0] }
  }
  const total = prefer.includes('count=exact') ? rows.length : '*'
  return { status: 200, body: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${total}` } }
}

/* --------------------------------- Storage -------------------------------- */

const objectFile = (bucket: string, name: string) => join(DATA_DIR, 'objects', Buffer.from(`${bucket}/${name}`).toString('base64url'))
const signToken = (path: string, exp: number) => `${exp}.${createHmac('sha256', SECRET).update(`${path}:${exp}`).digest('base64url')}`

async function handleStorage(req: IncomingMessage, url: URL, rawBody: Buffer, userId: string | null, res: ServerResponse): Promise<{ status: number; body: unknown } | null> {
  const path = decodeURIComponent(url.pathname.replace(/^\/storage\/v1/, ''))
  // Signed download (no auth header — the token is the credential)
  let m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/)
  if (m && req.method === 'GET') {
    const [, bucket, name] = m
    const [exp, sig] = String(url.searchParams.get('token') ?? '').split('.')
    if (!exp || Number(exp) * 1000 < Date.now() || signToken(`${bucket}/${name}`, Number(exp)) !== `${exp}.${sig}`) return { status: 400, body: { statusCode: '400', error: 'InvalidJWT', message: 'invalid signature' } }
    const { rows } = await db.query<{ mimetype: string | null }>(`select mimetype from storage.objects where bucket_id = $1 and name = $2`, [bucket, name])
    if (!rows[0] || !existsSync(objectFile(bucket!, name!))) return { status: 404, body: { statusCode: '404', error: 'not_found', message: 'Object not found' } }
    const download = url.searchParams.get('download')
    res.writeHead(200, {
      'content-type': rows[0].mimetype ?? 'application/octet-stream',
      ...(download !== null ? { 'content-disposition': `attachment; filename="${encodeURIComponent(download || name!.split('/').pop()!)}"` } : {}),
      'access-control-allow-origin': '*',
    })
    res.end(readFileSync(objectFile(bucket!, name!)))
    return null
  }
  if (!userId) return { status: 400, body: { statusCode: '403', error: 'Unauthorized', message: 'invalid jwt' } }

  m = path.match(/^\/object\/sign\/([^/]+)\/(.+)$/)
  if (m && req.method === 'POST') {
    const [, bucket, name] = m
    const found = await asUser(userId, (tx) => tx.query(`select 1 from storage.objects where bucket_id = $1 and name = $2`, [bucket, name]))
    if (!found.rows.length) return { status: 400, body: { statusCode: '404', error: 'not_found', message: 'Object not found' } }
    const { expiresIn } = JSON.parse(rawBody.toString() || '{}')
    const exp = Math.floor(Date.now() / 1000) + Number(expiresIn ?? 60)
    return { status: 200, body: { signedURL: `/object/sign/${bucket}/${encodeURI(name!)}?token=${signToken(`${bucket}/${name}`, exp)}` } }
  }

  m = path.match(/^\/object\/([^/]+)\/(.+)$/)
  if (m && req.method === 'POST') {
    const [, bucket, name] = m
    const form = await new Request('http://local', { method: 'POST', headers: req.headers as Record<string, string>, body: new Uint8Array(rawBody) }).formData()
    const file = form.get('') as File | null
    if (!file) return { status: 400, body: { statusCode: '400', error: 'invalid', message: 'No file' } }
    if (file.size > 50 * 1024 * 1024) return { status: 413, body: { statusCode: '413', error: 'Payload too large', message: 'The object exceeded the maximum allowed size' } }
    const id = randomUUID()
    try {
      await asUser(userId, (tx) => tx.query(`insert into storage.objects (id, bucket_id, name, mimetype, size) values ($1, $2, $3, $4, $5)`, [id, bucket, name, file.type || null, file.size]))
    } catch (e) {
      const msg = (e as Error).message
      if (/row-level security/.test(msg)) return { status: 400, body: { statusCode: '403', error: 'Unauthorized', message: 'new row violates row-level security policy' } }
      if (/foreign key/.test(msg)) return { status: 400, body: { statusCode: '404', error: 'Bucket not found', message: 'Bucket not found' } }
      throw e
    }
    writeFileSync(objectFile(bucket!, name!), Buffer.from(await file.arrayBuffer()))
    return { status: 200, body: { Id: id, Key: `${bucket}/${name}` } }
  }

  m = path.match(/^\/object\/([^/]+)$/)
  if (m && req.method === 'DELETE') {
    const [, bucket] = m
    const { prefixes } = JSON.parse(rawBody.toString() || '{}') as { prefixes: string[] }
    const deleted = await asUser(userId, (tx) => tx.query<{ name: string }>(`delete from storage.objects where bucket_id = $1 and name = any($2::text[]) returning name`, [bucket, prefixes ?? []]))
    for (const r of deleted.rows) rmSync(objectFile(bucket!, r.name), { force: true })
    return { status: 200, body: deleted.rows.map((r) => ({ name: r.name, bucket_id: bucket })) }
  }
  return { status: 404, body: { statusCode: '404', error: 'not_found', message: `Unsupported storage endpoint ${req.method} ${path}` } }
}

/* --------------------------------- Server --------------------------------- */

function send(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'content-range', ...headers })
  res.end(body === null || status === 204 ? undefined : JSON.stringify(body))
}

function pgError(e: unknown) {
  const err = e as { code?: string; message?: string; detail?: string; hint?: string }
  const status = err.code === '42501' ? 403 : err.code === '23505' ? 409 : err.code?.startsWith('PGRST') ? 400 : 400
  return { status, body: { code: err.code ?? 'XX000', message: err.message ?? 'Unknown error', details: err.detail ?? null, hint: err.hint ?? null } }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': String(req.headers['access-control-request-headers'] ?? '*'),
      'access-control-max-age': '86400',
    })
    return res.end()
  }
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const raw = Buffer.concat(chunks)
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const bearer = String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
  const claims = bearer ? verify(bearer) : null
  const userId = claims?.sub ?? null
  const started = Date.now()

  try {
    if (url.pathname.startsWith('/auth/v1')) {
      const body = raw.length ? JSON.parse(raw.toString()) : {}
      const out = await handleAuth(req.method!, url.pathname.slice('/auth/v1'.length), url, body, userId)
      send(res, out.status, out.body)
    } else if (url.pathname.startsWith('/rest/v1/')) {
      const out = await handleRest(req, url, url.pathname.slice('/rest/v1/'.length), raw.toString(), userId)
      send(res, out.status, req.method === 'HEAD' ? null : out.body, out.headers)
    } else if (url.pathname.startsWith('/storage/v1/')) {
      const out = await handleStorage(req, url, raw, userId, res)
      if (out) send(res, out.status, out.body)
    } else {
      send(res, 404, { message: 'Not found' })
    }
  } catch (e) {
    const out = pgError(e)
    send(res, out.status, out.body)
  }
  if (!process.env.QUIET) console.log(`${req.method} ${url.pathname}${url.search ? '?' + url.searchParams.toString().slice(0, 80) : ''} → ${res.statusCode} (${Date.now() - started}ms)`)
})

server.listen(PORT, () => console.log(`Local Supabase emulator on http://localhost:${PORT} (data in ${DATA_DIR})`))
