/** Keeps portal chrome styles stable while the next page chunk loads. */
export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-4 py-2" aria-hidden>
      <div className="h-8 w-48 max-w-full rounded-md bg-muted" />
      <div className="h-4 w-72 max-w-full rounded-md bg-muted/70" />
      <div className="mt-8 space-y-3">
        <div className="h-10 w-full rounded-md bg-muted/60" />
        <div className="h-10 w-full rounded-md bg-muted/50" />
        <div className="h-10 w-full rounded-md bg-muted/40" />
        <div className="h-10 w-5/6 rounded-md bg-muted/30" />
      </div>
    </div>
  )
}
