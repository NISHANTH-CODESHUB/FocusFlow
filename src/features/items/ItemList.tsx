import type { Item } from '@/types/database'
import { useAttachmentCounts, useSubjectNames } from './hooks'
import { ItemRow } from './ItemRow'

interface ItemListProps {
  items: Item[]
  compact?: boolean
  hideCategory?: boolean
  limit?: number
}

/** A plain list of item rows with subject names and attachment counts resolved. */
export function ItemList({ items, compact, hideCategory, limit }: ItemListProps) {
  const subjects = useSubjectNames()
  const attachments = useAttachmentCounts()
  const shown = limit ? items.slice(0, limit) : items
  return (
    <div className="-mx-2 flex flex-col">
      {shown.map((it) => (
        <ItemRow
          key={it.id}
          item={it}
          compact={compact}
          hideCategory={hideCategory}
          subjectName={it.subject_id ? subjects.get(it.subject_id) : undefined}
          attachments={attachments.get(it.id)}
        />
      ))}
    </div>
  )
}
