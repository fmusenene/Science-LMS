'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLms } from '@/lib/lms-store'
import type { PeriodConfig, SystemSettings } from '@/lib/types'
import { cn } from '@/lib/utils'

function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 7)}`
}

/** Compress an image file to a small JPEG data URL for localStorage. */
function fileToAvatarDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file (JPG, PNG or WebP).'))
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      reject(new Error('Image must be under 4 MB.'))
      return
    }
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Could not load that image.'))
      img.onload = () => {
        const max = 256
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Canvas unavailable in this browser.'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = String(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export default function SettingsPage() {
  const { data, currentUser, can, saveSettings, updateMyProfile } = useLms()
  const canManageSystem = can('settings.manage')
  const [draft, setDraft] = useState<SystemSettings>(data.settings)
  const [dirty, setDirty] = useState(false)

  const [displayName, setDisplayName] = useState(currentUser?.name ?? '')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarUrl ?? '')
  const [profileDirty, setProfileDirty] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(data.settings)) as SystemSettings)
    setDirty(false)
  }, [data.settings])

  useEffect(() => {
    setDisplayName(currentUser?.name ?? '')
    setAvatarPreview(currentUser?.avatarUrl ?? '')
    setPassword('')
    setConfirmPassword('')
    setProfileDirty(false)
  }, [currentUser?.id, currentUser?.name, currentUser?.avatarUrl])

  const update = (next: SystemSettings) => {
    setDraft(next)
    setDirty(true)
  }

  const save = () => {
    if (!canManageSystem) return
    if (!draft.schoolName.trim()) {
      toast.error('School name is required')
      return
    }
    if (!draft.periods.length) {
      toast.error('Add at least one timetable period')
      return
    }
    for (const p of draft.periods) {
      if (!p.label.trim() || !p.start || !p.end) {
        toast.error('Every period needs a label, start and end time')
        return
      }
      if (p.start >= p.end) {
        toast.error(`Period "${p.label}" end time must be after start time`)
        return
      }
    }
    if (!draft.subjects.some((s) => s.trim())) {
      toast.error('Add at least one subject')
      return
    }
    if (!draft.forms.some((f) => f.trim())) {
      toast.error('Add at least one form / class')
      return
    }
    if (!draft.notDoneReasons.some((r) => r.label.trim())) {
      toast.error('Add at least one not-done reason')
      return
    }
    saveSettings({
      ...draft,
      schoolName: draft.schoolName.trim(),
      schoolTagline: draft.schoolTagline.trim(),
      subjects: draft.subjects.map((s) => s.trim()).filter(Boolean),
      forms: draft.forms.map((f) => f.trim()).filter(Boolean),
      periods: draft.periods.map((p) => ({
        ...p,
        label: p.label.trim(),
      })),
      notDoneReasons: draft.notDoneReasons
        .map((r) => ({ ...r, label: r.label.trim() }))
        .filter((r) => r.label),
    })
    setDirty(false)
    toast.success('Settings saved')
  }

  const saveProfile = () => {
    if (!displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    if (password && password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    const result = updateMyProfile({
      name: displayName.trim(),
      password: password || undefined,
      avatarUrl: avatarPreview || null,
    })
    if (!result.ok) {
      toast.error(result.error)
      return
    }
    setPassword('')
    setConfirmPassword('')
    setProfileDirty(false)
    toast.success('Profile saved')
  }

  const onPickAvatar = async (file: File | null) => {
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setAvatarPreview(dataUrl)
      setProfileDirty(true)
      toast.message('Photo ready — click Save profile to keep it')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const initials = (currentUser?.name ?? '?')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div>
      <PageHeader
        title="Settings"
        description={
          canManageSystem
            ? 'Update your profile photo and configure school-wide catalogues.'
            : 'Update your profile photo, display name and password.'
        }
        actions={
          canManageSystem ? (
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button
                variant="outline"
                className="w-full sm:w-auto"
                disabled={!dirty}
                onClick={() => {
                  setDraft(JSON.parse(JSON.stringify(data.settings)) as SystemSettings)
                  setDirty(false)
                }}
              >
                Discard system
              </Button>
              <Button className="w-full sm:w-auto" disabled={!dirty} onClick={save}>
                Save system settings
              </Button>
            </div>
          ) : null
        }
      />

      <Tabs defaultValue="profile">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="profile">My profile</TabsTrigger>
          {canManageSystem ? (
            <>
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="periods">Periods</TabsTrigger>
              <TabsTrigger value="subjects">Subjects</TabsTrigger>
              <TabsTrigger value="forms">Forms</TabsTrigger>
              <TabsTrigger value="reasons">Not-done reasons</TabsTrigger>
            </>
          ) : null}
        </TabsList>

        <TabsContent value="profile" className="mt-4 space-y-4">
          <Section
            title="Profile photo"
            hint="Each account can upload their own image. It appears in the sidebar and header."
          >
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <div
                className={cn(
                  'flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full',
                  'bg-muted text-lg font-semibold text-muted-foreground ring-1 ring-foreground/10',
                )}
              >
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="" className="size-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="space-y-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? 'Processing…' : 'Upload photo'}
                  </Button>
                  {avatarPreview ? (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setAvatarPreview('')
                        setProfileDirty(true)
                      }}
                    >
                      Remove photo
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG or WebP up to 4 MB. Stored on this device with your account.
                </p>
              </div>
            </div>
          </Section>

          <Section title="Account details" hint="Visible name and optional password change.">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Display name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => {
                    setDisplayName(e.target.value)
                    setProfileDirty(true)
                  }}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Email</Label>
                <Input value={currentUser?.email ?? ''} disabled />
              </div>
              <div className="space-y-1">
                <Label>New password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  placeholder="Leave blank to keep current"
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setProfileDirty(true)
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>Confirm password</Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    setProfileDirty(true)
                  }}
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                disabled={!profileDirty}
                onClick={() => {
                  setDisplayName(currentUser?.name ?? '')
                  setAvatarPreview(currentUser?.avatarUrl ?? '')
                  setPassword('')
                  setConfirmPassword('')
                  setProfileDirty(false)
                }}
              >
                Discard
              </Button>
              <Button disabled={!profileDirty || uploading} onClick={saveProfile}>
                Save profile
              </Button>
            </div>
          </Section>
        </TabsContent>

        {canManageSystem ? (
          <>
            <TabsContent value="general" className="mt-4 space-y-4">
              <Section title="School identity" hint="Shown in the app header and login branding.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label>School / system name</Label>
                    <Input
                      value={draft.schoolName}
                      onChange={(e) => update({ ...draft, schoolName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Tagline</Label>
                    <Input
                      value={draft.schoolTagline}
                      onChange={(e) => update({ ...draft, schoolTagline: e.target.value })}
                    />
                  </div>
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="periods" className="mt-4 space-y-4">
              <Section
                title="Timetable periods"
                hint="Rename periods and set their start/end times. Used by the lab schedule and requisition booking."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update({
                        ...draft,
                        periods: [
                          ...draft.periods,
                          {
                            id: newId('p'),
                            label: `Period ${draft.periods.length + 1}`,
                            start: '08:00',
                            end: '09:00',
                          },
                        ],
                      })
                    }
                  >
                    Add period
                  </Button>
                }
              >
                <div className="space-y-2">
                  {draft.periods.map((period, idx) => (
                    <PeriodRow
                      key={period.id}
                      period={period}
                      onChange={(next) => {
                        const periods = [...draft.periods]
                        periods[idx] = next
                        update({ ...draft, periods })
                      }}
                      onRemove={() => {
                        if (draft.periods.length <= 1) {
                          toast.error('Keep at least one period')
                          return
                        }
                        update({
                          ...draft,
                          periods: draft.periods.filter((p) => p.id !== period.id),
                        })
                      }}
                    />
                  ))}
                </div>
              </Section>
            </TabsContent>

            <TabsContent value="subjects" className="mt-4">
              <StringListEditor
                title="Subjects"
                hint="Available when teachers create practical requisitions."
                items={draft.subjects}
                placeholder="e.g. Chemistry"
                onChange={(subjects) => update({ ...draft, subjects })}
              />
            </TabsContent>

            <TabsContent value="forms" className="mt-4">
              <StringListEditor
                title="Forms / classes"
                hint="Class levels offered for practical bookings."
                items={draft.forms}
                placeholder="e.g. Form 1"
                onChange={(forms) => update({ ...draft, forms })}
              />
            </TabsContent>

            <TabsContent value="reasons" className="mt-4 space-y-4">
              <Section
                title="Incomplete session reasons"
                hint="Shown when logging a practical as Not Done."
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update({
                        ...draft,
                        notDoneReasons: [
                          ...draft.notDoneReasons,
                          { id: newId('reason'), label: 'New reason' },
                        ],
                      })
                    }
                  >
                    Add reason
                  </Button>
                }
              >
                <div className="space-y-2">
                  {draft.notDoneReasons.map((reason, idx) => (
                    <div key={reason.id} className="flex items-center gap-2">
                      <Input
                        value={reason.label}
                        onChange={(e) => {
                          const notDoneReasons = [...draft.notDoneReasons]
                          notDoneReasons[idx] = { ...reason, label: e.target.value }
                          update({ ...draft, notDoneReasons })
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (draft.notDoneReasons.length <= 1) {
                            toast.error('Keep at least one reason')
                            return
                          }
                          update({
                            ...draft,
                            notDoneReasons: draft.notDoneReasons.filter((r) => r.id !== reason.id),
                          })
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </Section>
            </TabsContent>
          </>
        ) : null}
      </Tabs>
    </div>
  )
}

function Section({
  title,
  hint,
  action,
  children,
}: {
  title: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-xl ring-1 ring-foreground/10">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          {hint ? <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function PeriodRow({
  period,
  onChange,
  onRemove,
}: {
  period: PeriodConfig
  onChange: (next: PeriodConfig) => void
  onRemove: () => void
}) {
  return (
    <div className="grid gap-2 rounded-lg border border-border/80 p-3 sm:grid-cols-[1fr_7rem_7rem_auto] sm:items-end">
      <div className="space-y-1">
        <Label>Label</Label>
        <Input
          value={period.label}
          onChange={(e) => onChange({ ...period, label: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>Start</Label>
        <Input
          type="time"
          value={period.start}
          onChange={(e) => onChange({ ...period, start: e.target.value })}
        />
      </div>
      <div className="space-y-1">
        <Label>End</Label>
        <Input
          type="time"
          value={period.end}
          onChange={(e) => onChange({ ...period, end: e.target.value })}
        />
      </div>
      <Button size="sm" variant="ghost" onClick={onRemove}>
        Remove
      </Button>
    </div>
  )
}

function StringListEditor({
  title,
  hint,
  items,
  placeholder,
  onChange,
}: {
  title: string
  hint: string
  items: string[]
  placeholder: string
  onChange: (items: string[]) => void
}) {
  return (
    <Section
      title={title}
      hint={hint}
      action={
        <Button size="sm" variant="outline" onClick={() => onChange([...items, ''])}>
          Add
        </Button>
      }
    >
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <Input
              value={item}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...items]
                next[idx] = e.target.value
                onChange(next)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (items.length <= 1) {
                  toast.error(`Keep at least one ${title.toLowerCase().replace(/s$/, '')}`)
                  return
                }
                onChange(items.filter((_, i) => i !== idx))
              }}
            >
              Remove
            </Button>
          </div>
        ))}
      </div>
    </Section>
  )
}
