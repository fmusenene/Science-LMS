'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import { DEMO_PASSWORD, type User } from '@/lib/types'

export default function UsersPage() {
  const { data, roleById, saveUser, toggleUserActive } = useLms()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)
  const [q, setQ] = useState('')
  const defaultRoleId = data.roles.find((r) => r.id === 'role-teacher')?.id ?? data.roles[0]?.id ?? ''
  const [form, setForm] = useState({
    name: '',
    email: '',
    roleId: defaultRoleId,
    department: '',
    staffNo: '',
    password: DEMO_PASSWORD,
    active: true,
  })

  const rows = useMemo(() => {
    let list = data.users
    if (q.trim()) {
      const n = q.toLowerCase()
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(n) ||
          u.email.toLowerCase().includes(n) ||
          u.staffNo.toLowerCase().includes(n) ||
          (roleById(u.roleId)?.name.toLowerCase().includes(n) ?? false),
      )
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [data.users, q, roleById])

  const openCreate = () => {
    setEditing(null)
    setForm({
      name: '',
      email: '',
      roleId: defaultRoleId,
      department: '',
      staffNo: '',
      password: DEMO_PASSWORD,
      active: true,
    })
    setOpen(true)
  }

  const openEdit = (user: User) => {
    setEditing(user)
    setForm({
      name: user.name,
      email: user.email,
      roleId: user.roleId,
      department: user.department ?? '',
      staffNo: user.staffNo,
      password: '',
      active: user.active,
    })
    setOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="User management"
        description="Create staff accounts and assign an admin-managed role to control what they can see."
        actions={<Button onClick={openCreate}>Add user</Button>}
      />

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search users…"
        className="mb-4 max-w-sm"
      />

      <div className="rounded-xl ring-1 ring-foreground/10">
        {/* Mobile cards */}
        <div className="divide-y divide-border md:hidden">
          {rows.map((user) => (
            <div key={user.id} className="space-y-3 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                </div>
                {user.active ? (
                  <Badge className="shrink-0 border-transparent bg-success-muted text-success">Active</Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {roleById(user.roleId)?.name ?? '—'} · {user.staffNo}
                {user.department ? ` · ${user.department}` : ''}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    toggleUserActive(user.id)
                    toast.success(user.active ? 'User deactivated' : 'User reactivated')
                  }}
                >
                  {user.active ? 'Deactivate' : 'Activate'}
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Staff no.</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <p className="font-medium">{user.name}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </TableCell>
                  <TableCell>{roleById(user.roleId)?.name ?? '—'}</TableCell>
                  <TableCell className="num">{user.staffNo}</TableCell>
                  <TableCell>{user.department ?? '—'}</TableCell>
                  <TableCell>
                    {user.active ? (
                      <Badge className="border-transparent bg-success-muted text-success">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => openEdit(user)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        toggleUserActive(user.id)
                        toast.success(user.active ? 'User deactivated' : 'User reactivated')
                      }}
                    >
                      {user.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit user' : 'Create user'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Role</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.roleId}
                onChange={(e) => setForm({ ...form, roleId: e.target.value })}
              >
                {data.roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Staff no.</Label>
                <Input
                  value={form.staffNo}
                  onChange={(e) => setForm({ ...form, staffNo: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Department</Label>
                <Input
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{editing ? 'Password (leave blank to keep)' : 'Password'}</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={editing ? '••••••••' : DEMO_PASSWORD}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.name.trim() || !form.email.trim() || !form.staffNo.trim()) {
                  toast.error('Name, email and staff number are required')
                  return
                }
                if (!form.roleId) {
                  toast.error('Select a role')
                  return
                }
                if (!editing && !form.password.trim()) {
                  toast.error('Password is required for new users')
                  return
                }
                saveUser({
                  id: editing?.id,
                  name: form.name.trim(),
                  email: form.email.trim(),
                  roleId: form.roleId,
                  department: form.department.trim() || undefined,
                  staffNo: form.staffNo.trim(),
                  active: form.active,
                  password: form.password.trim() || undefined,
                })
                setOpen(false)
                toast.success(editing ? 'User updated' : 'User created')
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
