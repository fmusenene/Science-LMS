'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLms } from '@/lib/lms-store'
import { activeBookings, formatDate, formatSlot } from '@/lib/scheduling'
import type { Lab } from '@/lib/types'

type LabForm = {
  id?: string
  name: string
  code: string
  location: string
  capacity: number
  specialisation: string
  hasFumeHood: boolean
  hasGasSupply: boolean
  notes: string
}

const emptyForm = (): LabForm => ({
  name: '',
  code: '',
  location: '',
  capacity: 30,
  specialisation: '',
  hasFumeHood: false,
  hasGasSupply: false,
  notes: '',
})

export default function LabsPage() {
  const { data, can, saveLab, deleteLab, userById } = useLms()
  const canEdit = can('labs.manage')
  const [form, setForm] = useState<LabForm | null>(null)

  const upcoming = activeBookings(data.requisitions)
    .filter((r) => r.slot.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.slot.date.localeCompare(b.slot.date) || a.slot.start.localeCompare(b.slot.start))

  const openCreate = () => {
    const nextNum = data.labs.length + 1
    setForm({
      ...emptyForm(),
      name: `Laboratory ${nextNum}`,
      code: `LAB-${String(nextNum).padStart(2, '0')}`,
      location: 'Science Block',
      specialisation: 'Multipurpose',
    })
  }

  const openEdit = (lab: Lab) => {
    setForm({
      id: lab.id,
      name: lab.name,
      code: lab.code,
      location: lab.location,
      capacity: lab.capacity,
      specialisation: lab.specialisation,
      hasFumeHood: lab.hasFumeHood,
      hasGasSupply: lab.hasGasSupply,
      notes: lab.notes ?? '',
    })
  }

  return (
    <div>
      <PageHeader
        title="Laboratories"
        description="Add rooms, set student capacity, and track live booking load for each laboratory."
        actions={
          canEdit ? (
            <Button onClick={openCreate}>Add laboratory</Button>
          ) : null
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.labs.map((lab) => {
          const bookings = upcoming.filter((r) => r.labId === lab.id)
          return (
            <Card key={lab.id} className="shadow-none">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle>{lab.name}</CardTitle>
                    <CardDescription>
                      {lab.code} · {lab.location}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary">{lab.specialisation}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Capacity</p>
                    <p className="num text-lg font-semibold">{lab.capacity}</p>
                  </div>
                  <div className="rounded-lg bg-muted/60 px-3 py-2">
                    <p className="text-xs text-muted-foreground">Upcoming</p>
                    <p className="num text-lg font-semibold">{bookings.length}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {lab.hasFumeHood ? <Badge variant="outline">Fume hood</Badge> : null}
                  {lab.hasGasSupply ? <Badge variant="outline">Gas supply</Badge> : null}
                </div>
                {lab.notes ? <p className="text-xs text-muted-foreground">{lab.notes}</p> : null}
                {bookings.slice(0, 3).map((b) => (
                  <p key={b.id} className="text-xs text-muted-foreground">
                    {formatDate(b.slot.date)} {formatSlot(b.slot)} — {b.reference} (
                    {userById(b.teacherId)?.name})
                  </p>
                ))}
                {canEdit ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(lab)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const result = deleteLab(lab.id)
                        if (!result.ok) {
                          toast.error(result.error)
                          return
                        }
                        toast.success(`${lab.name} deleted`)
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Dialog open={!!form} onOpenChange={(o) => !o && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? 'Edit laboratory' : 'Add laboratory'}</DialogTitle>
            <DialogDescription>
              {form?.id
                ? 'Update room details, capacity and facilities.'
                : 'Register a new laboratory room for practical bookings.'}
            </DialogDescription>
          </DialogHeader>
          {form ? (
            <div className="grid gap-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Laboratory 7"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="LAB-07"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Location</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Specialisation</Label>
                <Input
                  value={form.specialisation}
                  onChange={(e) => setForm({ ...form, specialisation: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.hasFumeHood}
                    onChange={(e) => setForm({ ...form, hasFumeHood: e.target.checked })}
                  />
                  Fume hood
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={form.hasGasSupply}
                    onChange={(e) => setForm({ ...form, hasGasSupply: e.target.checked })}
                  />
                  Gas supply
                </label>
              </div>
              <div className="space-y-1">
                <Label>Notes</Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form?.name.trim() || !form.code.trim()) {
                  toast.error('Name and code are required')
                  return
                }
                saveLab({
                  id: form.id,
                  name: form.name.trim(),
                  code: form.code.trim(),
                  location: form.location.trim(),
                  capacity: form.capacity,
                  specialisation: form.specialisation.trim(),
                  hasFumeHood: form.hasFumeHood,
                  hasGasSupply: form.hasGasSupply,
                  notes: form.notes.trim(),
                })
                toast.success(form.id ? `${form.name} updated` : `${form.name} added`)
                setForm(null)
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
