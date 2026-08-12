'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import {
  permissionGroups,
  type PermissionId,
} from '@/lib/permissions'
import type { AppRole } from '@/lib/types'

const emptyForm = {
  name: '',
  description: '',
  permissions: [] as PermissionId[],
}

export default function RolesPage() {
  const { data, saveRole, deleteRole } = useLms()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AppRole | null>(null)
  const [form, setForm] = useState(emptyForm)
  const groups = useMemo(() => permissionGroups(), [])

  const rows = useMemo(
    () => [...data.roles].sort((a, b) => Number(b.system) - Number(a.system) || a.name.localeCompare(b.name)),
    [data.roles],
  )

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const openEdit = (role: AppRole) => {
    setEditing(role)
    setForm({
      name: role.name,
      description: role.description,
      permissions: [...role.permissions],
    })
    setOpen(true)
  }

  const togglePermission = (id: PermissionId, checked: boolean) => {
    setForm((prev) => ({
      ...prev,
      permissions: checked
        ? prev.permissions.includes(id)
          ? prev.permissions
          : [...prev.permissions, id]
        : prev.permissions.filter((p) => p !== id),
    }))
  }

  const toggleGroup = (ids: PermissionId[], checked: boolean) => {
    setForm((prev) => {
      const set = new Set(prev.permissions)
      for (const id of ids) {
        if (checked) set.add(id)
        else set.delete(id)
      }
      return { ...prev, permissions: [...set] }
    })
  }

  return (
    <div>
      <PageHeader
        title="Roles & permissions"
        description="Create roles and assign the screens and actions each role can access."
        actions={<Button onClick={openCreate}>Add role</Button>}
      />

      <div className="overflow-hidden rounded-xl ring-1 ring-foreground/10">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Permissions</TableHead>
              <TableHead>Users</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((role) => {
              const assigned = data.users.filter((u) => u.roleId === role.id).length
              return (
                <TableRow key={role.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{role.name}</p>
                      {role.system ? <Badge variant="secondary">System</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{role.description}</p>
                  </TableCell>
                  <TableCell className="num">{role.permissions.length}</TableCell>
                  <TableCell className="num">{assigned}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(role)}>
                      Edit
                    </Button>
                    {!role.system ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          const result = deleteRole(role.id)
                          if (!result.ok) {
                            toast.error(result.error)
                            return
                          }
                          toast.success('Role deleted')
                        }}
                      >
                        Delete
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg md:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit role' : 'Create role'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-1">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Senior Attendant"
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <Label>Permissions</Label>
                <p className="text-xs text-muted-foreground">
                  {form.permissions.length} selected
                </p>
              </div>
              {groups.map(({ group, items }) => {
                const ids = items.map((i) => i.id)
                const allChecked = ids.every((id) => form.permissions.includes(id))
                const someChecked = !allChecked && ids.some((id) => form.permissions.includes(id))
                return (
                  <div key={group} className="rounded-lg border border-border/80 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <Checkbox
                        checked={allChecked}
                        indeterminate={someChecked}
                        onCheckedChange={(checked) => toggleGroup(ids, checked)}
                      />
                      <p className="text-sm font-medium">{group}</p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <label
                          key={item.id}
                          className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-muted/50"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={form.permissions.includes(item.id)}
                            onCheckedChange={(checked) => togglePermission(item.id, checked)}
                          />
                          <span>
                            <span className="block text-sm font-medium">{item.label}</span>
                            <span className="block text-[11px] text-muted-foreground">
                              {item.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.name.trim()) {
                  toast.error('Role name is required')
                  return
                }
                if (form.permissions.length === 0) {
                  toast.error('Select at least one permission')
                  return
                }
                saveRole({
                  id: editing?.id,
                  name: form.name.trim(),
                  description: form.description.trim(),
                  permissions: form.permissions,
                })
                setOpen(false)
                toast.success(editing ? 'Role updated' : 'Role created')
              }}
            >
              Save role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
