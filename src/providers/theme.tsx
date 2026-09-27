import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const KEY = 'focusflow-theme'
const ThemeContext = createContext<ThemeState | null>(null)

function readTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY)
    return t === 'light' || t === 'dark' ? t : 'system'
  } catch {
    return 'system'
  }
}

const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readTheme)
  const [system, setSystem] = useState<'light' | 'dark'>(() => (systemDark() ? 'dark' : 'light'))
  const resolved = theme === 'system' ? system : theme

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }, [resolved])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    try {
      localStorage.setItem(KEY, t)
    } catch {
      /* storage unavailable — theme still applies for this session */
    }
  }, [])

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
