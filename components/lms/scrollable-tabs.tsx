import { cn } from '@/lib/utils'

/** Horizontal scroll wrapper for tab strips on small screens. */
export function ScrollableTabs({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        '-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]',
        className,
      )}
    >
      {children}
    </div>
  )
}
