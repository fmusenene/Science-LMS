'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/lms/page-header'
import { PaginationBar, paginate } from '@/components/lms/pagination-bar'
import { ScrollableTabs } from '@/components/lms/scrollable-tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useLms } from '@/lib/lms-store'
import { isExpiringSoon, isLowStock, totalReserved } from '@/lib/scheduling'
import { CATEGORY_LABEL, type ItemCategory, type MovementKind } from '@/lib/types'
import { cn } from '@/lib/utils'

export default function InventoryPage() {
  const { data, can, adjustStock, saveItem } = useLms()
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'all' | ItemCategory | 'alerts'>('all')
  const [page, setPage] = useState(1)
  const [stockOpen, setStockOpen] = useState(false)
  const [itemOpen, setItemOpen] = useState(false)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [delta, setDelta] = useState(0)
  const [kind, setKind] = useState<MovementKind>('receipt')
  const [reason, setReason] = useState('')

  const canEdit = can('inventory.manage')

  const emptyItemForm = () => ({
    name: '',
    code: '',
    category: 'apparatus' as ItemCategory,
    unit: 'pcs',
    onHand: 0,
    reorderLevel: 0,
    storageLocation: '',
    hazardClass: '',
    concentration: '',
    expiryDate: '',
    notes: '',
  })

  const rows = useMemo(() => {
    let list = data.items
    if (tab === 'alerts') list = list.filter((i) => isLowStock(i) || isExpiringSoon(i))
    else if (tab !== 'all') list = list.filter((i) => i.category === tab)
    if (q.trim()) {
      const n = q.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(n) ||
          i.code.toLowerCase().includes(n) ||
          i.storageLocation.toLowerCase().includes(n),
      )
    }
    return list
  }, [data.items, tab, q])

  const paged = useMemo(() => paginate(rows, page), [rows, page])

  const selected = data.items.find((i) => i.id === selectedId)

  const [form, setForm] = useState(emptyItemForm)

  return (
    <div>
      <PageHeader
        title="Store & inventory"
        description="Apparatus (returnable), chemicals and reagents with reorder levels, hazard classes and movements."
        actions={
          canEdit ? (
            <Button
              onClick={() => {
                setEditingItemId(null)
                setForm(emptyItemForm())
                setItemOpen(true)
              }}
            >
              Add item
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
          placeholder="Search name, code, location…"
          className="max-w-sm"
        />
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as typeof tab)
          setPage(1)
        }}
      >
        <ScrollableTabs>
          <TabsList className="h-auto min-w-max flex-nowrap">
            <TabsTrigger value="all" className="px-2.5 py-1.5">
              All
            </TabsTrigger>
            <TabsTrigger value="apparatus" className="px-2.5 py-1.5">
              Apparatus
            </TabsTrigger>
            <TabsTrigger value="chemical" className="px-2.5 py-1.5">
              Chemicals
            </TabsTrigger>
            <TabsTrigger value="reagent" className="px-2.5 py-1.5">
              Reagents
            </TabsTrigger>
            <TabsTrigger value="alerts" className="px-2.5 py-1.5">
              Alerts
            </TabsTrigger>
          </TabsList>
        </ScrollableTabs>
        <TabsContent value={tab} className="mt-4">
          <div className="rounded-xl ring-1 ring-foreground/10">
            <div className="divide-y divide-border md:hidden">
              {paged.items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">No items found.</p>
              ) : (
                paged.items.map((item) => {
                  const reserved = totalReserved(data.requisitions, item.id)
                  const low = isLowStock(item)
                  const expiring = isExpiringSoon(item)
                  return (
                    <div key={item.id} className="space-y-2 px-4 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.code} · {CATEGORY_LABEL[item.category]}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          {low ? <Badge variant="destructive">Low</Badge> : null}
                          {expiring ? (
                            <Badge className="border-transparent bg-warning-muted text-warning-foreground">
                              Expiring
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <p className="text-sm">
                        On hand{' '}
                        <span className={cn('num font-medium', low && 'text-destructive')}>
                          {item.onHand} {item.unit}
                        </span>
                        <span className="text-muted-foreground">
                          {' '}
                          · reserved {reserved} · reorder {item.reorderLevel}
                        </span>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{item.storageLocation}</p>
                      {canEdit ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-9"
                            onClick={() => {
                              setEditingItemId(item.id)
                              setForm({
                                name: item.name,
                                code: item.code,
                                category: item.category,
                                unit: item.unit,
                                onHand: item.onHand,
                                reorderLevel: item.reorderLevel,
                                storageLocation: item.storageLocation,
                                hazardClass: item.hazardClass ?? '',
                                concentration: item.concentration ?? '',
                                expiryDate: item.expiryDate ?? '',
                                notes: item.notes ?? '',
                              })
                              setItemOpen(true)
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-9"
                            onClick={() => {
                              setSelectedId(item.id)
                              setDelta(0)
                              setKind('receipt')
                              setReason('')
                              setStockOpen(true)
                            }}
                          >
                            Adjust
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>On hand</TableHead>
                  <TableHead>Reserved</TableHead>
                  <TableHead>Reorder</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((item) => {
                  const reserved = totalReserved(data.requisitions, item.id)
                  const low = isLowStock(item)
                  const expiring = isExpiringSoon(item)
                  return (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {item.code}
                            {item.hazardClass ? ` · ${item.hazardClass}` : ''}
                            {item.concentration ? ` · ${item.concentration}` : ''}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{CATEGORY_LABEL[item.category]}</TableCell>
                      <TableCell>
                        <span className={cn('num font-medium', low && 'text-destructive')}>
                          {item.onHand} {item.unit}
                        </span>
                        {low ? (
                          <Badge variant="destructive" className="ml-2">
                            Low
                          </Badge>
                        ) : null}
                        {expiring ? (
                          <Badge className="ml-1 border-transparent bg-warning-muted text-warning-foreground">
                            Expiring
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="num">
                        {reserved} {item.unit}
                      </TableCell>
                      <TableCell className="num">
                        {item.reorderLevel} {item.unit}
                      </TableCell>
                      <TableCell className="max-w-[12rem] truncate text-muted-foreground">
                        {item.storageLocation}
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditingItemId(item.id)
                                setForm({
                                  name: item.name,
                                  code: item.code,
                                  category: item.category,
                                  unit: item.unit,
                                  onHand: item.onHand,
                                  reorderLevel: item.reorderLevel,
                                  storageLocation: item.storageLocation,
                                  hazardClass: item.hazardClass ?? '',
                                  concentration: item.concentration ?? '',
                                  expiryDate: item.expiryDate ?? '',
                                  notes: item.notes ?? '',
                                })
                                setItemOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedId(item.id)
                                setDelta(0)
                                setKind('receipt')
                                setReason('')
                                setStockOpen(true)
                              }}
                            >
                              Adjust
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
          </div>
          <PaginationBar
            page={paged.page}
            totalPages={paged.totalPages}
            total={paged.total}
            start={paged.start}
            end={paged.end}
            onPageChange={setPage}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={stockOpen} onOpenChange={setStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust stock: {selected?.name}</DialogTitle>
            <DialogDescription>
              Current on hand: {selected?.onHand} {selected?.unit}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1">
              <Label>Movement type</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={kind}
                onChange={(e) => setKind(e.target.value as MovementKind)}
              >
                <option value="receipt">Receipt / delivery</option>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return</option>
                <option value="consumption">Manual consumption</option>
                <option value="breakage">Breakage write-off</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Quantity change (signed)</Label>
              <Input
                type="number"
                value={delta}
                onChange={(e) => setDelta(Number(e.target.value) || 0)}
              />
              <p className="text-xs text-muted-foreground">Use negative values for write-offs.</p>
            </div>
            <div className="space-y-1">
              <Label>Reason</Label>
              <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="GRN / explanation" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!selectedId || !delta || !reason.trim()) {
                  toast.error('Quantity and reason are required')
                  return
                }
                adjustStock(selectedId, delta, kind, reason.trim())
                setStockOpen(false)
                toast.success('Stock updated')
              }}
            >
              Save movement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItemId ? 'Edit inventory item' : 'Add inventory item'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Code</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <select
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value as ItemCategory })}
              >
                <option value="apparatus">Apparatus</option>
                <option value="chemical">Chemical</option>
                <option value="reagent">Reagent</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Unit</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>On hand</Label>
              <Input
                type="number"
                value={form.onHand}
                disabled={Boolean(editingItemId)}
                onChange={(e) => setForm({ ...form, onHand: Number(e.target.value) || 0 })}
              />
              {editingItemId ? (
                <p className="text-[11px] text-muted-foreground">Use Adjust to change stock levels.</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Reorder level</Label>
              <Input
                type="number"
                value={form.reorderLevel}
                onChange={(e) => setForm({ ...form, reorderLevel: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Storage location</Label>
              <Input
                value={form.storageLocation}
                onChange={(e) => setForm({ ...form, storageLocation: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Hazard class</Label>
              <Input
                value={form.hazardClass}
                placeholder="e.g. Corrosive"
                onChange={(e) => setForm({ ...form, hazardClass: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Concentration</Label>
              <Input
                value={form.concentration}
                placeholder="e.g. 0.1 M"
                onChange={(e) => setForm({ ...form, concentration: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Expiry date</Label>
              <Input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!form.name.trim() || !form.code.trim()) {
                  toast.error('Name and code are required')
                  return
                }
                saveItem({
                  id: editingItemId ?? undefined,
                  ...form,
                  // Keep existing on-hand when editing; stock changes go through Adjust.
                  onHand: editingItemId
                    ? (data.items.find((i) => i.id === editingItemId)?.onHand ?? form.onHand)
                    : form.onHand,
                  consumable: form.category !== 'apparatus',
                  hazardClass: form.hazardClass || undefined,
                  concentration: form.concentration || undefined,
                  expiryDate: form.expiryDate || undefined,
                  notes: form.notes || undefined,
                })
                setItemOpen(false)
                toast.success(editingItemId ? 'Item updated' : 'Item added to store register')
              }}
            >
              {editingItemId ? 'Save changes' : 'Create item'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
