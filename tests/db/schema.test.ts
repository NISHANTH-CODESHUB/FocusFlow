import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'

const ALICE = '11111111-1111-1111-1111-111111111111'
const BOB = '22222222-2222-2222-2222-222222222222'

const root = join(__dirname, '..', '..')
const migrationsDir = join(root, 'supabase', 'migrations')

let db: PGlite

/** Run statements as an authenticated user (RLS enforced). */
async function as<T = Record<string, unknown>>(userId: string | null, sql: string, params: unknown[] = []) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? 'authenticated' : 'anon'}`)
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? ''])
    return tx.query<T>(sql, params)
  })
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: {} })
  await db.exec(readFileSync(join(__dirname, 'supabase-stubs.sql'), 'utf8'))
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
  }
  await db.query(
    `insert into auth.users (id, email, raw_user_meta_data) values ($1, 'alice@test.dev', '{"full_name":"Alice"}'), ($2, 'bob@test.dev', '{}')`,
    [ALICE, BOB],
  )
}, 60_000)

describe('profiles', () => {
  it('are created on signup with the metadata name', async () => {
    const { rows } = await as<{ full_name: string | null }>(ALICE, 'select full_name from profiles')
    expect(rows).toEqual([{ full_name: 'Alice' }])
  })

  it('are only visible to their owner', async () => {
    const { rows } = await as(BOB, 'select id from profiles')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ id: BOB })
  })
})

describe('row level security', () => {
  let aliceSubject: string
  let aliceItem: string

  beforeAll(async () => {
    aliceSubject = (
      await as<{ id: string }>(ALICE, `insert into subjects (name) values ('Operating Systems') returning id`)
    ).rows[0].id
    aliceItem = (
      await as<{ id: string }>(ALICE, `insert into items (title, category) values ('OS lab record', 'lab') returning id`)
    ).rows[0].id
  })

  it('defaults user_id to the caller', async () => {
    const { rows } = await as<{ user_id: string }>(ALICE, 'select user_id from subjects')
    expect(rows).toEqual([{ user_id: ALICE }])
  })

  it('hides other users rows', async () => {
    for (const table of ['subjects', 'items', 'units', 'concepts', 'files', 'skills', 'achievements']) {
      const { rows } = await as(BOB, `select * from ${table}`)
      expect(rows, table).toHaveLength(0)
    }
  })

  it('blocks updates and deletes on other users rows', async () => {
    const upd = await as(BOB, `update items set title = 'pwned' where id = $1`, [aliceItem])
    const del = await as(BOB, `delete from subjects where id = $1`, [aliceSubject])
    expect(upd.affectedRows).toBe(0)
    expect(del.affectedRows).toBe(0)
  })

  it('rejects inserting rows owned by someone else', async () => {
    await expect(as(BOB, `insert into items (user_id, title) values ($1, 'forged')`, [ALICE])).rejects.toThrow(
      /row-level security/,
    )
  })

  it('rejects attaching children to another users parent', async () => {
    // Bob knows Alice's subject id but cannot hang a unit off it.
    await expect(as(BOB, `insert into units (subject_id, title) values ($1, 'Unit 1')`, [aliceSubject])).rejects.toThrow(
      /foreign key/,
    )
  })

  it('denies anonymous access entirely', async () => {
    await expect(as(null, 'select * from items')).rejects.toThrow(/permission denied/)
  })
})

describe('items', () => {
  it('stamps completed_at and progress when completed, clears when reopened', async () => {
    const id = (await as<{ id: string }>(ALICE, `insert into items (title) values ('Finish DBMS assignment') returning id`))
      .rows[0].id
    const done = await as<{ completed_at: string | null; progress: number }>(
      ALICE,
      `update items set status = 'completed' where id = $1 returning completed_at, progress`,
      [id],
    )
    expect(done.rows[0].completed_at).not.toBeNull()
    expect(done.rows[0].progress).toBe(100)

    const reopened = await as<{ completed_at: string | null }>(
      ALICE,
      `update items set status = 'in_progress' where id = $1 returning completed_at`,
      [id],
    )
    expect(reopened.rows[0].completed_at).toBeNull()
  })

  it('validates date ordering and progress bounds', async () => {
    await expect(
      as(ALICE, `insert into items (title, start_at, due_at) values ('x', now(), now() - interval '1 day')`),
    ).rejects.toThrow(/check constraint/)
    await expect(as(ALICE, `insert into items (title, progress) values ('x', 120)`)).rejects.toThrow(/check constraint/)
  })

  it('detaches from a subject when the subject is deleted', async () => {
    const subject = (await as<{ id: string }>(ALICE, `insert into subjects (name) values ('Temp') returning id`)).rows[0].id
    const item = (
      await as<{ id: string }>(ALICE, `insert into items (title, subject_id) values ('Temp test', $1) returning id`, [subject])
    ).rows[0].id
    await as(ALICE, `delete from subjects where id = $1`, [subject])
    const { rows } = await as<{ subject_id: string | null; user_id: string }>(
      ALICE,
      `select subject_id, user_id from items where id = $1`,
      [item],
    )
    expect(rows[0]).toEqual({ subject_id: null, user_id: ALICE })
  })
})

describe('academic hierarchy', () => {
  it('cascades subject → units → concepts and tracks concept completion', async () => {
    const subject = (await as<{ id: string }>(ALICE, `insert into subjects (name) values ('DBMS') returning id`)).rows[0].id
    const unit = (
      await as<{ id: string }>(ALICE, `insert into units (subject_id, title) values ($1, 'Normalization') returning id`, [
        subject,
      ])
    ).rows[0].id
    const concept = await as<{ id: string; completed_at: string | null }>(
      ALICE,
      `insert into concepts (unit_id, title, status) values ($1, 'BCNF', 'completed') returning id, completed_at`,
      [unit],
    )
    expect(concept.rows[0].completed_at).not.toBeNull()

    await as(ALICE, `delete from subjects where id = $1`, [subject])
    const { rows } = await as(ALICE, `select id from concepts where id = $1`, [concept.rows[0].id])
    expect(rows).toHaveLength(0)
  })
})

describe('files & storage', () => {
  it('requires storage paths under the owners folder', async () => {
    await expect(
      as(ALICE, `insert into files (name, storage_path) values ('cv.pdf', $1)`, [`${BOB}/cv.pdf`]),
    ).rejects.toThrow(/check constraint/)
    const ok = await as(ALICE, `insert into files (name, storage_path, folder) values ('cv.pdf', $1, 'resume') returning id`, [
      `${ALICE}/resume/cv.pdf`,
    ])
    expect(ok.rows).toHaveLength(1)
  })

  it('limits storage objects to the owners folder', async () => {
    await as(ALICE, `insert into storage.objects (bucket_id, name) values ('user-files', $1)`, [`${ALICE}/a.pdf`])
    await expect(
      as(ALICE, `insert into storage.objects (bucket_id, name) values ('user-files', $1)`, [`${BOB}/evil.pdf`]),
    ).rejects.toThrow(/row-level security/)
    const { rows } = await as(BOB, `select * from storage.objects`)
    expect(rows).toHaveLength(0)
  })

  it('creates a private bucket', async () => {
    const { rows } = await db.query<{ public: boolean }>(`select public from storage.buckets where id = 'user-files'`)
    expect(rows[0].public).toBe(false)
  })
})
