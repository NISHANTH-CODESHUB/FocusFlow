const FRIENDLY: Array<[RegExp, string]> = [
  [/failed to fetch|network ?error|load failed/i, 'Network error — check your connection and try again.'],
  [/jwt expired|invalid jwt|session.*(expired|missing)/i, 'Your session has expired. Please sign in again.'],
  [/row-level security/i, "You don't have permission to do that."],
  [/duplicate key value.*skills_user_id_name/i, 'You already track a skill with that name.'],
  [/duplicate key/i, 'That already exists.'],
  [/violates check constraint/i, 'Some values are out of range. Please review the form.'],
  [/violates foreign key/i, 'A linked record no longer exists. Refresh and try again.'],
  [/payload too large|exceeded the maximum allowed size|entity too large/i, 'That file is too large (max 50 MB).'],
  [/invalid login credentials/i, 'Incorrect email or password.'],
  [/email not confirmed/i, 'Please confirm your email address first — check your inbox.'],
  [/user already registered/i, 'An account with this email already exists. Try signing in.'],
  [/bucket not found/i, 'File storage is not set up yet. Run the database migration first.'],
]

export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!error) return fallback
  let raw: string | undefined
  if (typeof error === 'string') raw = error
  else if (typeof error === 'object') {
    const e = error as { message?: unknown; error_description?: unknown }
    raw = typeof e.message === 'string' ? e.message : typeof e.error_description === 'string' ? e.error_description : undefined
  }
  if (!raw) return fallback
  for (const [pattern, friendly] of FRIENDLY) if (pattern.test(raw)) return friendly
  return raw
}
