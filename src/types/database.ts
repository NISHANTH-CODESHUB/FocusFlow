// Mirrors supabase/migrations in the shape produced by `supabase gen types typescript`.
// Regenerate with: npx supabase gen types typescript --project-id <ref> > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type Timestamps = { created_at: string; updated_at: string }

export type ItemCategory =
  | 'task'
  | 'test'
  | 'lab'
  | 'assignment'
  | 'project'
  | 'hackathon'
  | 'event'
  | 'internship'
  | 'dsa'
  | 'aptitude'
  | 'certification'
  | 'custom'
export type ItemPriority = 'low' | 'medium' | 'high' | 'urgent'
export type ItemStatus = 'todo' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled'
export type ConceptStatus = 'not_started' | 'learning' | 'completed'
export type SkillLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type FileFolder = 'certificates' | 'academic' | 'projects' | 'resume' | 'important' | 'study' | 'other'

type ProfileRow = Timestamps & {
  id: string
  full_name: string | null
  institution: string | null
  program: string | null
  graduation_year: number | null
}

type SubjectRow = Timestamps & {
  id: string
  user_id: string
  name: string
  code: string | null
  semester: string | null
  instructor: string | null
  credits: number | null
  color: string
  description: string | null
  archived: boolean
  position: number
}

type UnitRow = Timestamps & {
  id: string
  user_id: string
  subject_id: string
  title: string
  description: string | null
  position: number
}

type ConceptRow = Timestamps & {
  id: string
  user_id: string
  unit_id: string
  title: string
  status: ConceptStatus
  notes: string | null
  revision_date: string | null
  resource_url: string | null
  position: number
  completed_at: string | null
}

type ItemRow = Timestamps & {
  id: string
  user_id: string
  title: string
  description: string | null
  category: ItemCategory
  priority: ItemPriority
  status: ItemStatus
  start_at: string | null
  due_at: string | null
  all_day: boolean
  progress: number
  notes: string | null
  tags: string[]
  details: Json
  subject_id: string | null
  completed_at: string | null
}

type SkillRow = Timestamps & {
  id: string
  user_id: string
  name: string
  area: string
  level: SkillLevel
  progress: number
  target_date: string | null
  notes: string | null
}

type AchievementRow = Timestamps & {
  id: string
  user_id: string
  title: string
  description: string | null
  kind: string
  achieved_on: string
  url: string | null
  item_id: string | null
}

type FileRow = Timestamps & {
  id: string
  user_id: string
  name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  folder: FileFolder
  description: string | null
  tags: string[]
  subject_id: string | null
  unit_id: string | null
  concept_id: string | null
  item_id: string | null
}

/** Server-managed columns are optional on insert; ids of the owner are defaulted by auth.uid(). */
type Insertable<Row, Required extends keyof Row> = Pick<Row, Required> &
  Partial<Omit<Row, Required | 'created_at' | 'updated_at'>>
type Updatable<Row> = Partial<Omit<Row, 'id' | 'user_id' | 'created_at' | 'updated_at'>>

type Table<Row, Required extends keyof Row, Rel = []> = {
  Row: Row
  Insert: Insertable<Row, Required>
  Update: Updatable<Row>
  Relationships: Rel
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<ProfileRow, 'id'>
      subjects: Table<SubjectRow, 'name'>
      units: Table<
        UnitRow,
        'subject_id' | 'title',
        [
          {
            foreignKeyName: 'units_subject_id_user_id_fkey'
            columns: ['subject_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'subjects'
            referencedColumns: ['id', 'user_id']
          },
        ]
      >
      concepts: Table<
        ConceptRow,
        'unit_id' | 'title',
        [
          {
            foreignKeyName: 'concepts_unit_id_user_id_fkey'
            columns: ['unit_id', 'user_id']
            isOneToOne: false
            referencedRelation: 'units'
            referencedColumns: ['id', 'user_id']
          },
        ]
      >
      items: Table<ItemRow, 'title'>
      skills: Table<SkillRow, 'name'>
      achievements: Table<AchievementRow, 'title'>
      files: Table<FileRow, 'name' | 'storage_path'>
    }
    Views: Record<never, never>
    Functions: Record<never, never>
    Enums: {
      item_category: ItemCategory
      item_priority: ItemPriority
      item_status: ItemStatus
      concept_status: ConceptStatus
      skill_level: SkillLevel
      file_folder: FileFolder
    }
    CompositeTypes: Record<never, never>
  }
}

type PublicTables = Database['public']['Tables']
export type Tables<T extends keyof PublicTables> = PublicTables[T]['Row']
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]['Insert']
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]['Update']

export type Profile = Tables<'profiles'>
export type Subject = Tables<'subjects'>
export type Unit = Tables<'units'>
export type Concept = Tables<'concepts'>
export type Item = Tables<'items'>
export type Skill = Tables<'skills'>
export type Achievement = Tables<'achievements'>
export type FileRecord = Tables<'files'>
