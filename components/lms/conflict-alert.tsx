import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertTriangleIcon, InfoIcon } from 'lucide-react'
import type { ConflictIssue } from '@/lib/scheduling'

export function ConflictAlert({ issues }: { issues: ConflictIssue[] }) {
  if (!issues.length) return null

  const labErrors = issues.filter((i) => i.level === 'error' && i.code === 'lab_double_booked')
  const otherErrors = issues.filter((i) => i.level === 'error' && i.code !== 'lab_double_booked')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <div className="space-y-2">
      {labErrors.length > 0 ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
          <AlertTriangleIcon />
          <AlertTitle>Lab already booked</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {labErrors.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium">
              Choose another laboratory, period, or date. Submit is disabled until this is clear.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {otherErrors.length > 0 ? (
        <Alert variant="destructive" className="border-destructive/40 bg-destructive/10">
          <AlertTriangleIcon />
          <AlertTitle>
            {otherErrors.some((i) => i.code === 'insufficient_stock')
              ? 'Not enough stock'
              : otherErrors.some((i) => i.code === 'over_capacity')
                ? 'Over lab capacity'
                : 'Cannot submit'}
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {otherErrors.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
            <p className="mt-2 text-sm font-medium">
              Fix the items above, then submit again. The request will not be sent until this is clear.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}
      {warnings.length > 0 ? (
        <Alert className="border-warning/40 bg-warning-muted text-warning-foreground">
          <InfoIcon />
          <AlertTitle>Stock advisories</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 list-disc space-y-1 pl-4">
              {warnings.map((issue, idx) => (
                <li key={`${issue.code}-${idx}`}>{issue.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
