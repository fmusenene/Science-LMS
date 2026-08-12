'use client'

import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

export const PAGE_SIZE = 10

export function paginate<T>(items: T[], page: number, pageSize = PAGE_SIZE) {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), totalPages)
  const start = (current - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    page: current,
    totalPages,
    total,
    start: total === 0 ? 0 : start + 1,
    end: Math.min(start + pageSize, total),
  }
}

type PaginationBarProps = {
  page: number
  totalPages: number
  total: number
  start: number
  end: number
  onPageChange: (page: number) => void
}

export function PaginationBar({
  page,
  totalPages,
  total,
  start,
  end,
  onPageChange,
}: PaginationBarProps) {
  if (total <= PAGE_SIZE) return null

  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-muted-foreground">
        Showing <span className="num font-medium text-foreground">{start}</span> to{' '}
        <span className="num font-medium text-foreground">{end}</span> of{' '}
        <span className="num font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-1 self-end sm:self-auto">
        <Button
          size="sm"
          variant="outline"
          className="min-h-9 min-w-9"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <span className="num px-2 text-sm tabular-nums text-muted-foreground">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline"
          className="min-h-9 min-w-9"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
