'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BeakerIcon,
  CalendarDaysIcon,
  ClipboardListIcon,
  FlaskConicalIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MenuIcon,
  PackageIcon,
  ScrollTextIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react'
import { toast } from 'sonner'
import { NotificationBell } from '@/components/lms/notification-bell'
import { IdleLogout } from '@/components/lms/idle-logout'
import { ThemeToggle } from '@/components/lms/theme-toggle'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLms } from '@/lib/lms-store'
import type { PermissionId } from '@/lib/permissions'
import { cn } from '@/lib/utils'

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Show if the user has any of these permissions. */
  anyOf: PermissionId[]
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon, anyOf: ['dashboard.view'] },
  {
    href: '/requisitions',
    label: 'Requisitions',
    icon: ClipboardListIcon,
    anyOf: ['requisitions.view_own', 'requisitions.view_all', 'requisitions.create'],
  },
  { href: '/schedule', label: 'Lab Schedule', icon: CalendarDaysIcon, anyOf: ['schedule.view'] },
  { href: '/inventory', label: 'Store & Inventory', icon: PackageIcon, anyOf: ['inventory.view'] },
  { href: '/labs', label: 'Laboratories', icon: FlaskConicalIcon, anyOf: ['labs.view'] },
  { href: '/sessions', label: 'Session Logs', icon: BeakerIcon, anyOf: ['sessions.view'] },
  { href: '/users', label: 'Users', icon: UsersIcon, anyOf: ['users.manage'] },
  { href: '/roles', label: 'Roles & Permissions', icon: KeyRoundIcon, anyOf: ['roles.manage'] },
  { href: '/settings', label: 'Settings', icon: SettingsIcon, anyOf: [] },
  { href: '/audit', label: 'Audit Log', icon: ScrollTextIcon, anyOf: ['audit.view'] },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data, currentUser, currentRole, can, signOut, resetDemoData } = useLms()
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [, startTransition] = useTransition()

  const items = NAV.filter(
    (item) => item.anyOf.length === 0 || item.anyOf.some((p) => can(p)),
  )
  const prefetchKey = items.map((i) => i.href).join('|')

  // Warm route JS so sidebar clicks open immediately (esp. first visit in dev).
  useEffect(() => {
    if (!currentUser) return
    const hrefs = [...items.map((i) => i.href), '/requisitions/new', '/settings']
    for (const href of hrefs) {
      try {
        router.prefetch(href)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- items derived from prefetchKey
  }, [router, currentUser, prefetchKey])

  if (!currentUser) return null

  const roleLabel = currentRole?.name ?? 'No role'
  const brandName = data.settings.schoolName
  const brandTagline = data.settings.schoolTagline

  const handleSignOut = () => {
    signOut()
    startTransition(() => {
      router.replace('/')
    })
  }

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <IdleLogout />
      <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarBrand name={brandName} tagline={brandTagline} />
        <SidebarNav items={items} pathname={pathname} onNavigate={() => undefined} />
        <SidebarFooter
          name={currentUser.name}
          roleLabel={roleLabel}
          avatarUrl={currentUser.avatarUrl}
          onSignOut={handleSignOut}
        />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[min(18rem,88vw)] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex min-w-0 items-center justify-between gap-2 px-4 py-4">
              <SidebarBrand name={brandName} tagline={brandTagline} compact />
              <Button
                variant="ghost"
                size="icon"
                className="min-h-9 min-w-9 shrink-0 text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={() => setMobileOpen(false)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
            <SidebarNav items={items} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            <SidebarFooter
              name={currentUser.name}
              roleLabel={roleLabel}
              avatarUrl={currentUser.avatarUrl}
              onSignOut={handleSignOut}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="min-h-9 min-w-9 shrink-0 md:hidden"
              aria-label="Open sidebar"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon className="size-4" />
            </Button>
            <UserAvatar name={currentUser.name} avatarUrl={currentUser.avatarUrl} className="hidden sm:flex" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{brandName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {roleLabel} · {currentUser.name}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              className="min-h-9 min-w-9 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:hidden"
              aria-label="Sign out"
              onClick={handleSignOut}
            >
              <LogOutIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:inline-flex"
              onClick={handleSignOut}
            >
              <LogOutIcon data-icon="inline-start" />
              Sign out
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl min-w-0 flex-1 bg-background px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-border/70 px-4 py-3 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <span>
              Shared database on this server so teacher and admin see the same requisitions.
              Idle sessions sign out after 5 minutes.
            </span>
            {can('settings.manage') ? (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                onClick={() => {
                  resetDemoData()
                  toast.success('System reset. Store inventory restored.')
                }}
              >
                Reset to clean system
              </Button>
            ) : null}
          </div>
          <Separator className="sr-only" />
        </footer>
      </div>
    </div>
  )
}

function SidebarBrand({
  name,
  tagline,
  compact = false,
}: {
  name: string
  tagline: string
  compact?: boolean
}) {
  return (
    <div className={cn('min-w-0', compact ? 'px-0' : 'px-5 py-5')}>
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <FlaskConicalIcon className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-heading text-sm font-semibold tracking-tight">{name}</p>
          <p className="truncate text-[11px] text-sidebar-foreground/65">
            {tagline || 'Laboratory Management'}
          </p>
        </div>
      </div>
    </div>
  )
}

function SidebarNav({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[]
  pathname: string
  onNavigate: () => void
}) {
  return (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-4">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
              active
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground/75 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground',
            )}
          >
            <Icon className="size-4 shrink-0 opacity-90" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

function UserAvatar({
  name,
  avatarUrl,
  className,
  size = 'sm',
}: {
  name: string
  avatarUrl?: string
  className?: string
  size?: 'sm' | 'md'
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return (
    <div
      className={cn(
        'shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-foreground/10',
        size === 'sm' ? 'flex size-8' : 'flex size-9',
        className,
      )}
    >
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt="" className="size-full object-cover" />
      ) : (
        initials
      )}
    </div>
  )
}

function SidebarFooter({
  name,
  roleLabel,
  avatarUrl,
  onSignOut,
}: {
  name: string
  roleLabel: string
  avatarUrl?: string
  onSignOut: () => void
}) {
  return (
    <div className="mt-auto space-y-3 border-t border-sidebar-border p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={name} avatarUrl={avatarUrl} size="md" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{name}</p>
            <p className="text-xs text-sidebar-foreground/65">{roleLabel}</p>
          </div>
        </div>
        <ThemeToggle
          variant="ghost"
          className="shrink-0 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-destructive hover:bg-destructive/15 hover:text-destructive"
        onClick={onSignOut}
      >
        <LogOutIcon data-icon="inline-start" />
        Sign out
      </Button>
    </div>
  )
}
