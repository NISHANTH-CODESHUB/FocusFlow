/**
 * Drives the local Supabase emulator through the real supabase-js client:
 * auth, PostgREST CRUD, RLS isolation between users and the storage flow.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Database } from '@/types/database'

const PORT = 54400 + Math.floor(Math.random() * 500)
const URL = `http://localhost:${PORT}`
let server: ChildProcess
let dir: string

const client = () =>
  createClient<Database>(URL, 'local-anon-key', { auth: { persistSession: false, autoRefreshToken: false } })

async function signUp(email: string): Promise<{ sb: SupabaseClient<Database>; id: string }> {
  const sb = client()
  const { data, error } = await sb.auth.signUp({ email, password: 'Passw0rd!', options: { data: { full_name: email.split('@')[0] } } })
  if (error) throw error
  return { sb, id: data.user!.id }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'focusflow-emulator-'))
  server = spawn(process.execPath, ['dev/local-supabase/server.ts'], {
    env: { ...process.env, PORT: String(PORT), LOCAL_SUPABASE_DIR: dir, QUIET: '1' },
    stdio: ['ignore', 'pipe', 'inherit'],
  })
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('emulator did not start')), 60_000)
    server.stdout!.on('data', (d: Buffer) => {
      if (d.toString().includes('Local Supabase emulator on')) {
        clearTimeout(timer)
        resolve()
      }
    })
    server.on('exit', (code) => reject(new Error(`emulator exited with ${code}`)))
  })
}, 90_000)

afterAll(() => {
  server?.kill()
  try {
    rmSync(dir, { recursive: true, force: true })
  } catch {
    /* PGlite may still hold files briefly on Windows */
  }
})

describe('auth', () => {
  it('signs up, signs in, rejects bad passwords and duplicate emails', async () => {
    await signUp('ada@test.dev')
    const sb = client()
    const ok = await sb.auth.signInWithPassword({ email: 'ada@test.dev', password: 'Passw0rd!' })
    expect(ok.error).toBeNull()
    expect(ok.data.user?.user_metadata.full_name).toBe('ada')

    const bad = await client().auth.signInWithPassword({ email: 'ada@test.dev', password: 'nope' })
    expect(bad.error?.message).toMatch(/invalid login credentials/i)

    const dup = await client().auth.signUp({ email: 'ada@test.dev', password: 'Passw0rd!' })
    expect(dup.error?.message).toMatch(/already registered/i)
  })

  it('persists data across sign-out and sign-in', async () => {
    const { sb } = await signUp('grace@test.dev')
    await sb.from('items').insert({ title: 'Persist me' })
    await sb.auth.signOut()
    const again = client()
    await again.auth.signInWithPassword({ email: 'grace@test.dev', password: 'Passw0rd!' })
    const { data } = await again.from('items').select('*')
    expect(data?.map((i) => i.title)).toEqual(['Persist me'])
  })
})

describe('data isolation', () => {
  let alice: Awaited<ReturnType<typeof signUp>>
  let bob: Awaited<ReturnType<typeof signUp>>

  beforeAll(async () => {
    alice = await signUp('alice@test.dev')
    bob = await signUp('bob@test.dev')
  })

  it('creates the profile on signup', async () => {
    const { data } = await alice.sb.from('profiles').select('*').eq('id', alice.id).maybeSingle()
    expect(data?.full_name).toBe('alice')
  })

  it('supports the full CRUD cycle used by the app', async () => {
    const created = await alice.sb
      .from('items')
      .insert({ title: 'DBMS test', category: 'test', details: { syllabus: 'Units 1-3' }, tags: ['sem5'] })
      .select()
      .single()
    expect(created.error).toBeNull()
    expect(created.data).toMatchObject({ user_id: alice.id, status: 'todo', details: { syllabus: 'Units 1-3' }, tags: ['sem5'] })

    const updated = await alice.sb.from('items').update({ status: 'completed' }).eq('id', created.data!.id).select().single()
    expect(updated.data).toMatchObject({ status: 'completed', progress: 100 })
    expect(updated.data!.completed_at).toBeTruthy()

    const listed = await alice.sb.from('items').select('*').order('created_at').order('id').range(0, 999)
    expect(listed.data).toHaveLength(1)

    const del = await alice.sb.from('items').delete().eq('id', created.data!.id)
    expect(del.error).toBeNull()
    expect((await alice.sb.from('items').select('*')).data).toHaveLength(0)
  })

  it('never exposes or lets another user modify rows', async () => {
    const subject = (await alice.sb.from('subjects').insert({ name: 'Operating Systems' }).select().single()).data!
    expect((await bob.sb.from('subjects').select('*')).data).toEqual([])

    const hijack = await bob.sb.from('subjects').update({ name: 'pwned' }).eq('id', subject.id).select()
    expect(hijack.data).toEqual([])
    const forged = await bob.sb.from('units').insert({ subject_id: subject.id, title: 'Unit 1' })
    expect(forged.error).not.toBeNull()

    const still = await alice.sb.from('subjects').select('*').eq('id', subject.id).single()
    expect(still.data?.name).toBe('Operating Systems')
  })

  it('rejects anonymous access', async () => {
    const { error } = await client().from('items').select('*')
    expect(error?.message).toMatch(/permission denied/)
  })

  it('stores files privately and cleans up', async () => {
    const path = `${alice.id}/certificates/${crypto.randomUUID()}-cert.pdf`
    const blob = new Blob(['%PDF-1.4 fake certificate'], { type: 'application/pdf' })
    const up = await alice.sb.storage.from('user-files').upload(path, blob, { contentType: 'application/pdf' })
    expect(up.error).toBeNull()

    // Bob can neither sign nor overwrite Alice's object, nor upload into her folder.
    expect((await bob.sb.storage.from('user-files').createSignedUrl(path, 60)).error).not.toBeNull()
    const intrude = await bob.sb.storage.from('user-files').upload(`${alice.id}/evil.pdf`, blob)
    expect(intrude.error).not.toBeNull()

    const signed = await alice.sb.storage.from('user-files').createSignedUrl(path, 60, { download: 'cert.pdf' })
    expect(signed.error).toBeNull()
    const res = await fetch(signed.data!.signedUrl)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('content-disposition')).toContain('cert.pdf')
    expect(await res.text()).toContain('fake certificate')

    const meta = await alice.sb.from('files').insert({ name: 'cert.pdf', storage_path: path, folder: 'certificates', size_bytes: blob.size }).select().single()
    expect(meta.error).toBeNull()
    const forgedMeta = await bob.sb.from('files').insert({ name: 'x', storage_path: path })
    expect(forgedMeta.error).not.toBeNull()

    const removed = await alice.sb.storage.from('user-files').remove([path])
    expect(removed.data).toHaveLength(1)
    expect((await fetch(signed.data!.signedUrl)).status).toBe(404)
  })
})
