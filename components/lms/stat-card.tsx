import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'warning' | 'success' | 'danger'
  href?: string
}) {
  const card = (
    <Card
      size="sm"
      className={cn(
        'h-full shadow-none',
        href && 'transition-colors hover:bg-muted/40 hover:ring-1 hover:ring-border',
      )}
    >
      <CardHeader className="pb-0">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            'num text-2xl font-semibold',
            tone === 'warning' && 'text-warning-foreground',
            tone === 'success' && 'text-success',
            tone === 'danger' && 'text-destructive',
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  )

  if (!href) return card
  return (
    <Link
      href={href}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {card}
    </Link>
  )
}
