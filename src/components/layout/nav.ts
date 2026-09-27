import { BarChart3, CalendarRange, Download, FolderOpen, GraduationCap, LayoutDashboard, Rocket, Settings, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  description: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, description: 'Your day at a glance' },
  { to: '/planner', label: 'Planner', icon: CalendarRange, description: 'Tasks, tests, labs, deadlines' },
  { to: '/academics', label: 'Academics', icon: GraduationCap, description: 'Subjects, units and concepts' },
  { to: '/career', label: 'Career', icon: Rocket, description: 'DSA, aptitude, projects, internships' },
  { to: '/stats', label: 'Statistics', icon: BarChart3, description: 'Progress and productivity' },
  { to: '/files', label: 'Files', icon: FolderOpen, description: 'Certificates, notes, documents' },
  { to: '/export', label: 'Export', icon: Download, description: 'PDF and Excel reports' },
]

export const SETTINGS_NAV: NavItem = { to: '/settings', label: 'Settings', icon: Settings, description: 'Profile, theme, account' }
