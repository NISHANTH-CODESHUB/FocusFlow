/**
 * POST /api/chat — streams an assistant reply grounded in the caller's data.
 *
 * Runs server-side (Vercel function in production, Vite middleware in dev) so
 * the Groq API key never reaches the browser. The caller's Supabase access
 * token is verified, and their data is read *with that token*, so Row Level
 * Security limits the snapshot to their own rows.
 */
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { z } from 'zod'
import type { Concept, Database, Item, Skill, Subject, Unit } from '../../src/types/database'
import { buildStudentContext, safeTimeZone, SYSTEM_PROMPT } from './context'

export interface ChatEnv {
  GROQ_API_KEY?: string
  /** Defaults to the best model on Groq's free tier. */
  GROQ_MODEL?: string
  /** Only for tests / proxies. */
  GROQ_BASE_URL?: string
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
}

export const DEFAULT_MODEL = 'openai/gpt-oss-120b'
const MAX_MESSAGES = 12
const MAX_MESSAGE_CHARS = 4_000

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(MAX_MESSAGE_CHARS) }))
    .min(1)
    .max(50),
  timeZone: z.string().optional(),
})

const json = (status: number, error: string) =>
  new Response(JSON.stringify({ error }), { status, headers: { 'content-type': 'application/json' } })

export async function handleChat(request: Request, env: ChatEnv): Promise<Response> {
  if (request.method !== 'POST') return json(405, 'Method not allowed')

  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
  const supabaseKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY
  if (!env.GROQ_API_KEY) return json(503, 'The AI assistant isn’t set up yet: add GROQ_API_KEY to the server environment.')
  if (!supabaseUrl || !supabaseKey) return json(503, 'The server is missing its Supabase settings.')

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, 'Please sign in to use the assistant.')

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return json(400, 'Invalid request.')
  }
  const history = body.messages.slice(-MAX_MESSAGES)
  if (history[history.length - 1]!.role !== 'user') return json(400, 'The last message must be from the user.')

  // Every query below runs as the signed-in user (RLS applies).
  const db = createClient<Database>(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data: userData, error: authError } = await db.auth.getUser(token)
  if (authError || !userData.user) return json(401, 'Your session has expired. Please sign in again.')

  const [profile, items, subjects, units, concepts, skills] = await Promise.all([
    db.from('profiles').select('full_name, institution, program, graduation_year').eq('id', userData.user.id).maybeSingle(),
    db.from('items').select('*').order('due_at', { ascending: true }).limit(1000),
    db.from('subjects').select('*').limit(200),
    db.from('units').select('*').limit(1000),
    db.from('concepts').select('*').limit(2000),
    db.from('skills').select('*').limit(200),
  ])
  const failed = [items, subjects, units, concepts, skills].find((r) => r.error)
  if (failed?.error) return json(502, 'Couldn’t load your FocusFlow data. Please try again.')

  const snapshot = buildStudentContext(
    {
      profile: profile.data ?? null,
      items: (items.data ?? []) as Item[],
      subjects: (subjects.data ?? []) as Subject[],
      units: (units.data ?? []) as Unit[],
      concepts: (concepts.data ?? []) as Concept[],
      skills: (skills.data ?? []) as Skill[],
    },
    { now: new Date(), timeZone: safeTimeZone(body.timeZone) },
  )

  const groq = new Groq({ apiKey: env.GROQ_API_KEY, ...(env.GROQ_BASE_URL ? { baseURL: env.GROQ_BASE_URL } : {}), maxRetries: 1 })

  let completion: Awaited<ReturnType<typeof startStream>>
  try {
    completion = await startStream(groq, env.GROQ_MODEL || DEFAULT_MODEL, `${SYSTEM_PROMPT}\n\n<student_data>\n${snapshot}\n</student_data>`, history)
  } catch (err) {
    return json(...describeGroqError(err))
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const text = chunk.choices[0]?.delta?.content
          if (text) controller.enqueue(encoder.encode(text))
          if (chunk.choices[0]?.finish_reason === 'length') controller.enqueue(encoder.encode('\n\n_(Answer cut short — ask me to continue.)_'))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n⚠️ ${describeGroqError(err)[1]}`))
      } finally {
        controller.close()
      }
    },
    cancel() {
      completion.controller.abort()
    },
  })

  return new Response(stream, {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' },
  })
}

function startStream(groq: Groq, model: string, system: string, history: Array<{ role: 'user' | 'assistant'; content: string }>) {
  return groq.chat.completions.create({
    model,
    stream: true,
    messages: [{ role: 'system', content: system }, ...history],
    // Keep reasoning short and hidden: the free tier counts it toward per-minute tokens.
    reasoning_effort: 'low',
    include_reasoning: false,
    max_completion_tokens: 2048,
    temperature: 0.6,
  })
}

function describeGroqError(err: unknown): [number, string] {
  if (err instanceof Groq.RateLimitError) return [429, 'The free AI limit was reached for now. Wait a minute and try again (daily limits reset every 24 hours).']
  if (err instanceof Groq.AuthenticationError || err instanceof Groq.PermissionDeniedError) return [503, 'The AI key on the server is invalid. Check GROQ_API_KEY.']
  if (err instanceof Groq.BadRequestError) return [400, 'The AI service rejected this request. Try a shorter question or start a new chat.']
  if (err instanceof Groq.APIConnectionError) return [502, 'Couldn’t reach the AI service. Check your connection and try again.']
  if (err instanceof Groq.APIError) return [502, 'The AI service had a problem. Please try again.']
  return [500, 'Something went wrong while answering. Please try again.']
}
