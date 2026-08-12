'use client'

import { PageHeader } from '@/components/lms/page-header'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import { formatDateTime } from '@/lib/scheduling'

export default function AuditPage() {
  const { data, userById } = useLms()
  const rows = [...data.audit].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="System configuration, approvals, stock movements and session closures."
      />

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {formatDateTime(entry.createdAt)}
                </TableCell>
                <TableCell>{userById(entry.actorId)?.name ?? entry.actorId}</TableCell>
                <TableCell>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{entry.action}</code>
                </TableCell>
                <TableCell className="font-medium">{entry.target}</TableCell>
                <TableCell className="max-w-md text-muted-foreground">{entry.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
