/**
 * Seeds realistic demo data into the local emulator through the public API
 * (so RLS and triggers apply exactly as they would for a real user).
 *
 *   npm run local:backend      # in one terminal
 *   npm run local:seed         # in another
 *
 * Demo account (emulator only): demo@studentos.test / Student123
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const EMAIL = process.env.SEED_EMAIL ?? 'demo@studentos.test'
const PASSWORD = process.env.SEED_PASSWORD ?? 'Student123'

const sb = createClient(URL, 'local-emulator-anon-key', { auth: { persistSession: false } })

const signIn = await sb.auth.signInWithPassword({ email: EMAIL, password: PASSWORD })
const auth = signIn.error ? await sb.auth.signUp({ email: EMAIL, password: PASSWORD, options: { data: { full_name: 'Nishanth Demo' } } }) : signIn
if (auth.error || !auth.data.user) throw auth.error ?? new Error('Could not sign in')
const { count } = await sb.from('subjects').select('*', { count: 'exact', head: true })
if (count) console.log(`${EMAIL} already has data — skipping. Run "npm run local:backend:reset" for a clean slate.`)
else await seed(auth.data.user.id)

async function seed(userId: string) {
  console.log(`Seeding as ${EMAIL}`)

  const day = 86_400_000
  const at = (offsetDays: number, hour = 10) => {
    const d = new Date(Date.now() + offsetDays * day)
    d.setHours(hour, 0, 0, 0)
    return d.toISOString()
  }
  const dateOnly = (offsetDays: number) => at(offsetDays).slice(0, 10)
  const midnight = (offsetDays: number) => at(offsetDays, 0)

  async function insert<T = { id: string }>(table: string, rows: object[]): Promise<T[]> {
    const { data, error } = await sb.from(table).insert(rows).select()
    if (error) throw new Error(`${table}: ${error.message}`)
    return data as T[]
  }

  await sb.from('profiles').update({ institution: 'State Institute of Technology', program: 'B.Tech CSE', graduation_year: 2027 }).eq('id', userId)

  /* Academics */
  const [dbms, cn, daa] = await insert('subjects', [
    { name: 'Database Management Systems', code: 'CS302', semester: 'Sem 5', credits: 4, color: 'emerald', position: 1, instructor: 'Dr. Rao' },
    { name: 'Computer Networks', code: 'CS303', semester: 'Sem 5', credits: 3, color: 'amber', position: 2 },
    { name: 'Design & Analysis of Algorithms', code: 'CS304', semester: 'Sem 5', credits: 4, color: 'violet', position: 3 },
  ])

  const syllabus: Array<[string, string, Array<[string, 'not_started' | 'learning' | 'completed', number?]>]> = [
    [dbms!.id, 'Unit 1: ER model & relational algebra', [['ER diagrams', 'completed', -12], ['Relational algebra', 'completed', -9], ['Keys & constraints', 'completed', -6]]],
    [dbms!.id, 'Unit 2: Normalization', [['Functional dependencies', 'completed', -3], ['1NF, 2NF, 3NF', 'learning'], ['BCNF', 'not_started'], ['Lossless decomposition', 'not_started']]],
    [dbms!.id, 'Unit 3: Transactions', [['ACID properties', 'learning'], ['Serializability', 'not_started'], ['Two-phase locking', 'not_started']]],
    [cn!.id, 'Unit 1: Physical & data link layer', [['OSI vs TCP/IP', 'completed', -20], ['Framing & error detection', 'completed', -2], ['Sliding window', 'learning']]],
    [cn!.id, 'Unit 2: Network layer', [['IPv4 addressing & subnetting', 'learning'], ['Routing algorithms', 'not_started']]],
    [daa!.id, 'Unit 1: Asymptotic analysis', [['Big-O, Θ, Ω', 'completed', -25], ['Master theorem', 'completed', -1]]],
    [daa!.id, 'Unit 2: Divide & conquer', [['Merge sort', 'completed', 0], ['Quick sort analysis', 'learning'], ['Strassen multiplication', 'not_started']]],
  ]
  for (const [i, [subjectId, title, concepts]] of syllabus.entries()) {
    const [unit] = await insert('units', [{ subject_id: subjectId, title, position: i }])
    await insert(
      'concepts',
      concepts.map(([t, status, doneOffset], position) => ({
        unit_id: unit!.id,
        title: t,
        status,
        position,
        completed_at: status === 'completed' ? at(doneOffset ?? 0, 18) : null,
        revision_date: status === 'learning' ? dateOnly(position % 2 ? 0 : 3) : null,
      })),
    )
  }

  /* Planner items */
  const done = (offset: number) => ({ status: 'completed', completed_at: at(offset, 20) })
  await insert('items', [
    { title: 'DBMS unit test 2', category: 'test', priority: 'high', due_at: at(4, 9), subject_id: dbms!.id, details: { syllabus: 'Units 2-3', venue: 'Hall A', max_marks: 30 } },
    { title: 'CN lab — socket programming', category: 'lab', due_at: at(2, 14), subject_id: cn!.id, details: { experiment: 'Exp 6 — TCP echo server', record_submitted: 'pending' } },
    { title: 'DAA assignment 3', category: 'assignment', priority: 'high', due_at: midnight(-1), all_day: true, subject_id: daa!.id, progress: 60, status: 'in_progress' },
    { title: 'Submit DBMS mini project proposal', category: 'assignment', due_at: midnight(0), all_day: true, subject_id: dbms!.id, priority: 'urgent' },
    { title: 'Revise normalization notes', category: 'task', due_at: midnight(0), all_day: true, subject_id: dbms!.id },
    { title: 'Pay hostel fees', category: 'task', due_at: midnight(6), all_day: true, priority: 'medium' },
    { title: 'Portfolio website', category: 'project', status: 'in_progress', progress: 70, start_at: midnight(-30), due_at: midnight(20), all_day: true, details: { tech_stack: ['Next.js', 'Tailwind'], repo_url: 'https://github.com/example/portfolio' } },
    { title: 'Library management system', category: 'project', ...done(-15), details: { tech_stack: ['Java', 'MySQL'] } },
    { title: 'Smart India Hackathon', category: 'hackathon', start_at: midnight(18), due_at: midnight(19), all_day: true, details: { organizer: 'MoE Innovation Cell', mode: 'offline', team: 'Team Byte' } },
    { title: 'College coding fest', category: 'hackathon', ...done(-40), due_at: midnight(-40), all_day: true, details: { result: 'Finalist', organizer: 'ACM chapter' } },
    { title: 'Google DevFest', category: 'event', due_at: midnight(11), all_day: true, details: { venue: 'City convention centre' } },
    { title: 'SDE Intern — Acme Corp', category: 'internship', status: 'in_progress', due_at: midnight(5), all_day: true, details: { company: 'Acme Corp', role: 'SDE Intern', stage: 'interview', location: 'Bengaluru' } },
    { title: 'Backend Intern — Globex', category: 'internship', status: 'in_progress', details: { company: 'Globex', role: 'Backend Intern', stage: 'applied', location: 'Remote' } },
    { title: 'ML Intern — Initech', category: 'internship', due_at: midnight(9), all_day: true, details: { company: 'Initech', role: 'ML Intern', stage: 'wishlist' } },
    { title: 'Frontend Intern — Hooli', category: 'internship', status: 'cancelled', details: { company: 'Hooli', role: 'Frontend Intern', stage: 'rejected' } },
    { title: 'AWS Cloud Practitioner', category: 'certification', status: 'in_progress', progress: 55, due_at: midnight(25), all_day: true, details: { issuer: 'Amazon Web Services' } },
    { title: 'Python for Data Science (NPTEL)', category: 'certification', ...done(-35), details: { issuer: 'NPTEL', issued_on: dateOnly(-35), credential_id: 'NPTEL24CS99' } },
    { title: 'Quantitative aptitude — Time & Work', category: 'aptitude', ...done(-5), details: { section: 'quantitative', topic: 'Time & Work' } },
    { title: 'Mock test 1', category: 'aptitude', ...done(-8), details: { section: 'logical_reasoning', score: 34, total: 50 } },
    { title: 'Mock test 2', category: 'aptitude', ...done(-1), details: { section: 'verbal', score: 41, total: 50 } },
    { title: 'Data interpretation practice', category: 'aptitude', due_at: midnight(3), all_day: true, details: { section: 'data_interpretation' } },
  ])

  const dsa: Array<[string, string, 'easy' | 'medium' | 'hard', number | null]> = [
    ['Two Sum', 'Arrays', 'easy', -13],
    ['Best Time to Buy and Sell Stock', 'Arrays', 'easy', -11],
    ['Longest Substring Without Repeating Characters', 'Sliding Window', 'medium', -9],
    ['Valid Parentheses', 'Stack & Queue', 'easy', -7],
    ['Merge Intervals', 'Arrays', 'medium', -6],
    ['Binary Tree Level Order Traversal', 'Trees', 'medium', -4],
    ['Number of Islands', 'Graphs', 'medium', -3],
    ['Coin Change', 'Dynamic Programming', 'medium', -2],
    ['Search in Rotated Sorted Array', 'Binary Search', 'medium', -1],
    ['Kth Largest Element', 'Heaps', 'medium', 0],
    ['Median of Two Sorted Arrays', 'Binary Search', 'hard', null],
    ['Word Ladder', 'Graphs', 'hard', null],
    ['Edit Distance', 'Dynamic Programming', 'hard', null],
  ]
  await insert(
    'items',
    dsa.map(([title, topic, difficulty, doneOffset]) => ({
      title,
      category: 'dsa',
      details: { topic, difficulty, platform: 'leetcode' },
      ...(doneOffset === null ? { status: 'todo' } : done(doneOffset)),
    })),
  )

  /* Skills & achievements */
  await insert('skills', [
    { name: 'React', area: 'Frontend', level: 'intermediate', progress: 65 },
    { name: 'SQL', area: 'Database', level: 'intermediate', progress: 70 },
    { name: 'Java', area: 'Language', level: 'advanced', progress: 80 },
    { name: 'Docker', area: 'DevOps & Cloud', level: 'beginner', progress: 25, target_date: dateOnly(45) },
    { name: 'System design basics', area: 'Core CS', level: 'beginner', progress: 15 },
  ])
  await insert('achievements', [
    { title: 'Finalist — College coding fest', kind: 'Competition', achieved_on: dateOnly(-40) },
    { title: 'Merit scholarship 2025–26', kind: 'Scholarship', achieved_on: dateOnly(-120) },
  ])

  console.log('Done. Sign in with the demo account to explore.')
}
