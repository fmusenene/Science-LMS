import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { STATUS_LABEL, type RequisitionStatus } from '@/lib/types'

const STATUS_STYLE: Record<RequisitionStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  prepared: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  in_progress: 'bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200',
  completed: 'bg-success-muted text-success',
  not_done: 'bg-destructive/10 text-destructive',
  rejected: 'bg-destructive/10 text-destructive',
  cancelled: 'bg-muted text-muted-foreground',
}

export function StatusBadge({
  status,
  className,
}: {
  status: RequisitionStatus
  className?: string
}) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_STYLE[status], className)}>
      {STATUS_LABEL[status]}
    </Badge>
  )
}
