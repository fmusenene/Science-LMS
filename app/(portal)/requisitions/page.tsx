'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useMemo, useState, useTransition } from 'react'
import { ChevronRightIcon } from 'lucide-react'
import { PageHeader } from '@/components/lms/page-header'
import { PaginationBar, paginate } from '@/components/lms/pagination-bar'
import { ScrollableTabs } from '@/components/lms/scrollable-tabs'
import { StatusBadge } from '@/components/lms/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import { formatDate, formatSlot } from '@/lib/scheduling'
import type { RequisitionStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

const FILTERS: { id: string; label: string; statuses?: RequisitionStatus[] }[] = [
  { id: 'all', label: 'All' },
  { id: 'queue', label: 'Awaiting review', statuses: ['submitted'] },
  { id: 'live', label: 'Reserved / live', statuses: ['approved', 'prepared', 'in_progress'] },
  { id: 'closed', label: 'Closed', statuses: ['completed', 'not_done', 'rejected', 'cancelled'] },
  { id: 'draft', label: 'Drafts', statuses: ['draft'] },
]

function RequisitionsPageInner() {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const searchParams = useSearchParams()
  const { data, currentUser, can, labById, userById } = useLms()
  const [q, setQ] = useState('')
  const canApprove = can('requisitions.approve')
  const seeAll = can('requisitions.view_all')
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam && FILTERS.some((f) => f.id === tabParam) ? tabParam : canApprove ? 'queue' : 'all'
  const [tab, setTab] = useState(initialTab)
  const [page, setPage] = useState(1)

  const visibleRequisitions = useMemo(() => {
    if (seeAll) return data.requisitions
    return data.requisitions.filter((r) => r.teacherId === currentUser?.id)
  }, [data.requisitions, seeAll, currentUser?.id])

  const rows = useMemo(() => {
    let list = visibleRequisitions
    const filter = FILTERS.find((f) => f.id === tab)
    if (filter?.statuses) list = list.filter((r) => filter.statuses!.includes(r.status))
    if (q.trim()) {
      const needle = q.toLowerCase()
      list = list.filter(
        (r) =>
          r.reference.toLowerCase().includes(needle) ||
          r.topic.toLowerCase().includes(needle) ||
          r.subject.toLowerCase().includes(needle) ||
          userById(r.teacherId)?.name.toLowerCase().includes(needle),
      )
    }
    return [...list].sort(
      (a, b) => b.slot.date.localeCompare(a.slot.date) || a.slot.start.localeCompare(b.slot.start),
    )
  }, [visibleRequisitions, tab, q, userById])

  const paged = useMemo(() => paginate(rows, page), [rows, page])

  // Must match what the user can actually see in the Awaiting review tab.
  const queueCount = visibleRequisitions.filter((r) => r.status === 'submitted').length

  const openReq = (id: string) => {
    startTransition(() => {
      router.push(`/requisitions/${id}`)
    })
  }

  const onTabChange = (v: string) => {
    setTab(v)
    setPage(1)
    startTransition(() => {
      router.replace(`/requisitions?tab=${v}`, { scroll: false })
    })
  }

  return (
    <div>
      <PageHeader
        title="Practical requisitions"
        description={
          canApprove
            ? 'Open Awaiting review, pick a submitted request, then Approve & reserve stock on the detail page.'
            : 'Your lesson plans and apparatus checklists. Awaiting review lists only your submitted requests.'
        }
        actions={
          can('requisitions.create') ? (
            <Button nativeButton={false} render={<Link href="/requisitions/new" />}>
              New requisition
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search reference, topic, teacher…"
          className="max-w-sm"
        />
        {seeAll ? (
          <p className="text-sm text-muted-foreground">
            System-wide review queue:{' '}
            <span className="num font-medium text-foreground">{queueCount}</span>
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Your submitted requests:{' '}
            <span className="num font-medium text-foreground">{queueCount}</span>
          </p>
        )}
      </div>

      <Tabs value={tab} onValueChange={onTabChange}>
        <ScrollableTabs>
          <TabsList className="h-auto min-w-max flex-nowrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.id} value={f.id} className="px-2.5 py-1.5">
                {f.label}
                {f.id === 'queue' && queueCount > 0 ? (
                  <span className="ml-1.5 rounded-md bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">
                    {queueCount}
                  </span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </ScrollableTabs>
        <TabsContent value={tab} className="mt-4">
          <div className="rounded-xl ring-1 ring-foreground/10">
            {/* Mobile cards */}
            <div className="divide-y divide-border md:hidden">
              {paged.total === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No requisitions match this view.
                </p>
              ) : (
                paged.items.map((req) => (
                  <button
                    key={req.id}
                    type="button"
                    onClick={() => openReq(req.id)}
                    className="flex w-full flex-col gap-2 px-4 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted/70"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-primary">{req.reference}</p>
                        <p className="truncate font-medium">{req.topic}</p>
                        <p className="text-xs text-muted-foreground">
                          {req.subject} · {req.form}
                        </p>
                      </div>
                      <StatusBadge status={req.status} className="shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {labById(req.labId)?.name} · {formatDate(req.slot.date)} · {formatSlot(req.slot)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userById(req.teacherId)?.name} · {req.studentCount} students
                    </p>
                  </button>
                ))
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Practical</TableHead>
                  <TableHead>Lab / Slot</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Students</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Open</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.total === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      No requisitions match this view.
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.items.map((req) => (
                    <TableRow
                      key={req.id}
                      role="link"
                      tabIndex={0}
                      aria-label={`Open requisition ${req.reference}`}
                      onClick={() => openReq(req.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          openReq(req.id)
                        }
                      }}
                      className={cn(
                        'group cursor-pointer border-l-2 border-l-transparent',
                        'transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out',
                        'hover:-translate-y-px hover:border-l-primary hover:bg-primary/[0.06]',
                        'hover:shadow-[0_6px_16px_-8px_rgba(0,0,0,0.18)]',
                        'focus-visible:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      )}
                    >
                      <TableCell>
                        <span className="font-medium text-primary transition-colors duration-200 group-hover:underline">
                          {req.reference}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium transition-colors duration-200 group-hover:text-foreground">
                            {req.topic}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {req.subject} · {req.form}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{labById(req.labId)?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(req.slot.date)} · {formatSlot(req.slot)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{userById(req.teacherId)?.name}</TableCell>
                      <TableCell className="num">{req.studentCount}</TableCell>
                      <TableCell>
                        <StatusBadge status={req.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <ChevronRightIcon
                          className={cn(
                            'size-4 opacity-0 transition-all duration-200 ease-out',
                            'group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:opacity-100',
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            </div>
          </div>
          <PaginationBar
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            start={paged.start}
            end={paged.end}
            onPageChange={setPage}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default function RequisitionsPage() {
  return (
    <Suspense
      fallback={
        <div className="animate-pulse space-y-4 py-2" aria-busy="true">
          <div className="h-8 w-48 max-w-full rounded-md bg-muted" />
          <div className="h-4 w-72 max-w-full rounded-md bg-muted/70" />
          <div className="mt-6 h-10 w-full rounded-md bg-muted/50" />
          <div className="h-10 w-full rounded-md bg-muted/40" />
        </div>
      }
    >
      <RequisitionsPageInner />
    </Suspense>
  )
}
