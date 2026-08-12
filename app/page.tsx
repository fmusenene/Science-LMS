'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlaskConicalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/lms/theme-toggle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useLms } from '@/lib/lms-store'
import { firstAccessiblePath } from '@/lib/permissions'

export default function LoginPage() {
  const { currentUser, login, data, can } = useLms()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const schoolName = data.settings.schoolName
  const schoolTagline = data.settings.schoolTagline

  useEffect(() => {
    if (currentUser) router.replace(firstAccessiblePath(can))
  }, [currentUser, router, can])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const result = await login(email, password)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success('Signed in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[radial-gradient(ellipse_120%_80%_at_10%_-10%,_oklch(0.92_0.04_250),_transparent_55%),radial-gradient(ellipse_90%_70%_at_90%_10%,_oklch(0.94_0.05_80),_transparent_50%),var(--background)] dark:bg-[radial-gradient(ellipse_120%_80%_at_10%_-10%,_oklch(0.28_0.04_250),_transparent_55%),radial-gradient(ellipse_90%_70%_at_90%_10%,_oklch(0.26_0.04_80),_transparent_50%),var(--background)]">
      <div className="absolute top-4 right-4 z-10 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-dvh max-w-6xl flex-col justify-center gap-10 px-4 py-12 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:px-8">
        <div className="max-w-xl space-y-5">
          <Badge variant="secondary" className="rounded-md">
            School Science Department
          </Badge>
          <div className="flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FlaskConicalIcon className="size-6" />
            </div>
            <div className="min-w-0">
              <p className="font-heading text-2xl font-semibold tracking-tight break-words sm:text-4xl">
                {schoolName}
              </p>
              <p className="text-sm text-muted-foreground break-words">{schoolTagline}</p>
            </div>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">
            Keep track of apparatus, chemicals and reagents across all labs. Book practical lessons
            without double booking rooms, and close every session with a proper stock check.
          </p>
          <ul className="grid gap-2 text-sm text-foreground/80 sm:grid-cols-2">
            <li className="rounded-lg bg-card/70 px-3 py-2 ring-1 ring-foreground/8">
              Sign in once with roles your admin manages
            </li>
            <li className="rounded-lg bg-card/70 px-3 py-2 ring-1 ring-foreground/8">
              Spot room clashes and overlapping stock needs
            </li>
            <li className="rounded-lg bg-card/70 px-3 py-2 ring-1 ring-foreground/8">
              Follow each request from draft to completed
            </li>
            <li className="rounded-lg bg-card/70 px-3 py-2 ring-1 ring-foreground/8">
              Record what was used and any breakages after class
            </li>
          </ul>
        </div>

        <Card className="w-full max-w-md shadow-sm lg:shrink-0">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use your staff email and password. Sessions expire after 5 minutes of inactivity.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.ac"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? 'Signing in…' : 'Sign in'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Demo accounts: <span className="text-foreground">admin@school.ac</span>,{' '}
                <span className="text-foreground">attendant@school.ac</span>,{' '}
                <span className="text-foreground">teacher@school.ac</span> (ask your admin for the
                shared demo password).
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
