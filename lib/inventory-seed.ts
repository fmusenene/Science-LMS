import type { InventoryItem, ItemCategory } from './types'

type ItemSeed = Omit<InventoryItem, 'id' | 'consumable'>

function daysFromNow(n: number) {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() + n)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const apparatusSeed: ItemSeed[] = [
  { name: 'Beaker 250 mL', code: 'AP-001', category: 'apparatus', unit: 'pcs', onHand: 96, reorderLevel: 30, storageLocation: 'Store A, Shelf 1' },
  { name: 'Beaker 100 mL', code: 'AP-002', category: 'apparatus', unit: 'pcs', onHand: 74, reorderLevel: 30, storageLocation: 'Store A, Shelf 1' },
  { name: 'Conical Flask 250 mL', code: 'AP-003', category: 'apparatus', unit: 'pcs', onHand: 58, reorderLevel: 24, storageLocation: 'Store A, Shelf 1' },
  { name: 'Measuring Cylinder 100 mL', code: 'AP-004', category: 'apparatus', unit: 'pcs', onHand: 42, reorderLevel: 20, storageLocation: 'Store A, Shelf 2' },
  { name: 'Measuring Cylinder 50 mL', code: 'AP-005', category: 'apparatus', unit: 'pcs', onHand: 38, reorderLevel: 20, storageLocation: 'Store A, Shelf 2' },
  { name: 'Test Tube 150 mm', code: 'AP-006', category: 'apparatus', unit: 'pcs', onHand: 240, reorderLevel: 100, storageLocation: 'Store A, Shelf 3' },
  { name: 'Test Tube Rack', code: 'AP-007', category: 'apparatus', unit: 'pcs', onHand: 44, reorderLevel: 16, storageLocation: 'Store A, Shelf 3' },
  { name: 'Boiling Tube', code: 'AP-008', category: 'apparatus', unit: 'pcs', onHand: 88, reorderLevel: 40, storageLocation: 'Store A, Shelf 3' },
  { name: 'Bunsen Burner', code: 'AP-009', category: 'apparatus', unit: 'pcs', onHand: 34, reorderLevel: 20, storageLocation: 'Store A, Cabinet 1' },
  { name: 'Tripod Stand', code: 'AP-010', category: 'apparatus', unit: 'pcs', onHand: 36, reorderLevel: 20, storageLocation: 'Store A, Cabinet 1' },
  { name: 'Wire Gauze', code: 'AP-011', category: 'apparatus', unit: 'pcs', onHand: 52, reorderLevel: 24, storageLocation: 'Store A, Cabinet 1' },
  { name: 'Retort Stand with Clamp', code: 'AP-012', category: 'apparatus', unit: 'pcs', onHand: 28, reorderLevel: 16, storageLocation: 'Store A, Cabinet 2' },
  { name: 'Thermometer -10–110 °C', code: 'AP-013', category: 'apparatus', unit: 'pcs', onHand: 22, reorderLevel: 24, storageLocation: 'Store A, Drawer 1' },
  { name: 'Glass Funnel 75 mm', code: 'AP-014', category: 'apparatus', unit: 'pcs', onHand: 40, reorderLevel: 18, storageLocation: 'Store A, Shelf 2' },
  { name: 'Evaporating Dish', code: 'AP-015', category: 'apparatus', unit: 'pcs', onHand: 30, reorderLevel: 15, storageLocation: 'Store A, Shelf 4' },
  { name: 'Crucible with Lid', code: 'AP-016', category: 'apparatus', unit: 'pcs', onHand: 18, reorderLevel: 12, storageLocation: 'Store A, Shelf 4' },
  { name: 'Pipette 25 mL', code: 'AP-017', category: 'apparatus', unit: 'pcs', onHand: 26, reorderLevel: 16, storageLocation: 'Store A, Drawer 2' },
  { name: 'Burette 50 mL', code: 'AP-018', category: 'apparatus', unit: 'pcs', onHand: 24, reorderLevel: 12, storageLocation: 'Store A, Drawer 2' },
  { name: 'Pipette Filler', code: 'AP-019', category: 'apparatus', unit: 'pcs', onHand: 20, reorderLevel: 10, storageLocation: 'Store A, Drawer 2' },
  { name: 'Spatula', code: 'AP-020', category: 'apparatus', unit: 'pcs', onHand: 48, reorderLevel: 20, storageLocation: 'Store A, Drawer 3' },
  { name: 'Watch Glass', code: 'AP-021', category: 'apparatus', unit: 'pcs', onHand: 60, reorderLevel: 24, storageLocation: 'Store A, Shelf 4' },
  { name: 'Petri Dish', code: 'AP-022', category: 'apparatus', unit: 'pcs', onHand: 70, reorderLevel: 30, storageLocation: 'Store B, Shelf 1' },
  { name: 'Microscope (compound)', code: 'AP-023', category: 'apparatus', unit: 'pcs', onHand: 18, reorderLevel: 10, storageLocation: 'Store B, Cabinet M' },
  { name: 'Microscope Slide', code: 'AP-024', category: 'apparatus', unit: 'pcs', onHand: 400, reorderLevel: 150, storageLocation: 'Store B, Drawer 1' },
  { name: 'Cover Slip', code: 'AP-025', category: 'apparatus', unit: 'pcs', onHand: 500, reorderLevel: 200, storageLocation: 'Store B, Drawer 1' },
  { name: 'Dissecting Kit', code: 'AP-026', category: 'apparatus', unit: 'pcs', onHand: 20, reorderLevel: 10, storageLocation: 'Store B, Cabinet D' },
  { name: 'Stopwatch', code: 'AP-027', category: 'apparatus', unit: 'pcs', onHand: 16, reorderLevel: 8, storageLocation: 'Store B, Drawer 2' },
  { name: 'Meter Rule', code: 'AP-028', category: 'apparatus', unit: 'pcs', onHand: 40, reorderLevel: 16, storageLocation: 'Store C, Shelf 1' },
  { name: 'Spring Balance 5 N', code: 'AP-029', category: 'apparatus', unit: 'pcs', onHand: 22, reorderLevel: 10, storageLocation: 'Store C, Shelf 1' },
  { name: 'Ammeter', code: 'AP-030', category: 'apparatus', unit: 'pcs', onHand: 18, reorderLevel: 8, storageLocation: 'Store C, Cabinet E' },
  { name: 'Voltmeter', code: 'AP-031', category: 'apparatus', unit: 'pcs', onHand: 18, reorderLevel: 8, storageLocation: 'Store C, Cabinet E' },
  { name: 'Connecting Leads (set)', code: 'AP-032', category: 'apparatus', unit: 'pcs', onHand: 30, reorderLevel: 12, storageLocation: 'Store C, Cabinet E' },
  { name: 'Lens Convex', code: 'AP-033', category: 'apparatus', unit: 'pcs', onHand: 24, reorderLevel: 12, storageLocation: 'Store C, Shelf 2' },
  { name: 'Prism (glass)', code: 'AP-034', category: 'apparatus', unit: 'pcs', onHand: 16, reorderLevel: 8, storageLocation: 'Store C, Shelf 2' },
  { name: 'Safety Goggles', code: 'AP-035', category: 'apparatus', unit: 'pcs', onHand: 80, reorderLevel: 40, storageLocation: 'Store A, Safety Rack' },
  { name: 'Lab Coat', code: 'AP-036', category: 'apparatus', unit: 'pcs', onHand: 45, reorderLevel: 20, storageLocation: 'Store A, Safety Rack' },
  { name: 'Heat-proof Mat', code: 'AP-037', category: 'apparatus', unit: 'pcs', onHand: 40, reorderLevel: 16, storageLocation: 'Store A, Cabinet 1' },
  { name: 'Mortar and Pestle', code: 'AP-038', category: 'apparatus', unit: 'pcs', onHand: 20, reorderLevel: 10, storageLocation: 'Store A, Shelf 5' },
  { name: 'Wash Bottle', code: 'AP-039', category: 'apparatus', unit: 'pcs', onHand: 36, reorderLevel: 16, storageLocation: 'Store A, Shelf 5' },
  { name: 'Filter Funnel Stand', code: 'AP-040', category: 'apparatus', unit: 'pcs', onHand: 22, reorderLevel: 10, storageLocation: 'Store A, Shelf 2' },
]

const chemicalSeed: ItemSeed[] = [
  { name: 'Hydrochloric Acid', code: 'CH-001', category: 'chemical', unit: 'mL', onHand: 4200, reorderLevel: 1500, storageLocation: 'Acid Cabinet, Store C', hazardClass: 'Corrosive', concentration: '2 M', expiryDate: daysFromNow(520) },
  { name: 'Sulphuric Acid', code: 'CH-002', category: 'chemical', unit: 'mL', onHand: 2600, reorderLevel: 1200, storageLocation: 'Acid Cabinet, Store C', hazardClass: 'Corrosive', concentration: '1 M', expiryDate: daysFromNow(480) },
  { name: 'Nitric Acid', code: 'CH-003', category: 'chemical', unit: 'mL', onHand: 900, reorderLevel: 1000, storageLocation: 'Acid Cabinet, Store C', hazardClass: 'Corrosive / Oxidiser', concentration: '2 M', expiryDate: daysFromNow(300) },
  { name: 'Sodium Hydroxide Solution', code: 'CH-004', category: 'chemical', unit: 'mL', onHand: 3800, reorderLevel: 1500, storageLocation: 'Alkali Cabinet, Store C', hazardClass: 'Corrosive', concentration: '2 M', expiryDate: daysFromNow(450) },
  { name: 'Ammonia Solution', code: 'CH-005', category: 'chemical', unit: 'mL', onHand: 1400, reorderLevel: 800, storageLocation: 'Fume Cabinet, Lab 1', hazardClass: 'Irritant', concentration: '2 M', expiryDate: daysFromNow(260) },
  { name: 'Sodium Chloride', code: 'CH-006', category: 'chemical', unit: 'g', onHand: 2500, reorderLevel: 800, storageLocation: 'Store C, Shelf S1' },
  { name: 'Copper(II) Sulphate', code: 'CH-007', category: 'chemical', unit: 'g', onHand: 1200, reorderLevel: 400, storageLocation: 'Store C, Shelf S1', hazardClass: 'Harmful' },
  { name: 'Zinc Granules', code: 'CH-008', category: 'chemical', unit: 'g', onHand: 900, reorderLevel: 300, storageLocation: 'Store C, Shelf S2' },
  { name: 'Iron Filings', code: 'CH-009', category: 'chemical', unit: 'g', onHand: 1100, reorderLevel: 350, storageLocation: 'Store C, Shelf S2' },
  { name: 'Magnesium Ribbon', code: 'CH-010', category: 'chemical', unit: 'cm', onHand: 800, reorderLevel: 250, storageLocation: 'Store C, Flammables Tray', hazardClass: 'Flammable' },
  { name: 'Calcium Carbonate', code: 'CH-011', category: 'chemical', unit: 'g', onHand: 1600, reorderLevel: 500, storageLocation: 'Store C, Shelf S1' },
  { name: 'Potassium Permanganate', code: 'CH-012', category: 'chemical', unit: 'g', onHand: 350, reorderLevel: 150, storageLocation: 'Store C, Oxidiser Cabinet', hazardClass: 'Oxidiser' },
  { name: 'Hydrogen Peroxide 20 vol', code: 'CH-013', category: 'chemical', unit: 'mL', onHand: 1800, reorderLevel: 700, storageLocation: 'Store C, Shelf S3', hazardClass: 'Oxidiser', expiryDate: daysFromNow(180) },
  { name: 'Ethanol', code: 'CH-014', category: 'chemical', unit: 'mL', onHand: 1800, reorderLevel: 900, storageLocation: 'Flammables Cabinet, Store C', hazardClass: 'Highly Flammable', concentration: '95%', expiryDate: daysFromNow(400) },
  { name: 'Distilled Water', code: 'CH-015', category: 'chemical', unit: 'mL', onHand: 20000, reorderLevel: 5000, storageLocation: 'Store A, Carboys' },
  { name: 'Silver Nitrate Solution', code: 'CH-016', category: 'chemical', unit: 'mL', onHand: 280, reorderLevel: 300, storageLocation: 'Locked Cabinet, Store C', hazardClass: 'Corrosive / Toxic', concentration: '0.1 M', expiryDate: daysFromNow(180) },
  { name: 'Lead(II) Nitrate Solution', code: 'CH-017', category: 'chemical', unit: 'mL', onHand: 520, reorderLevel: 250, storageLocation: 'Locked Cabinet, Store C', hazardClass: 'Toxic', concentration: '0.5 M', expiryDate: daysFromNow(210) },
  { name: 'Barium Chloride Solution', code: 'CH-018', category: 'chemical', unit: 'mL', onHand: 600, reorderLevel: 250, storageLocation: 'Locked Cabinet, Store C', hazardClass: 'Toxic', concentration: '0.1 M', expiryDate: daysFromNow(240) },
  { name: 'Sodium Carbonate', code: 'CH-019', category: 'chemical', unit: 'g', onHand: 1400, reorderLevel: 400, storageLocation: 'Store C, Shelf S1' },
  { name: 'Ammonium Chloride', code: 'CH-020', category: 'chemical', unit: 'g', onHand: 700, reorderLevel: 250, storageLocation: 'Store C, Shelf S2' },
]

const reagentSeed: ItemSeed[] = [
  { name: "Benedict's Solution", code: 'RG-001', category: 'reagent', unit: 'mL', onHand: 1600, reorderLevel: 800, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(150) },
  { name: "Fehling's Solution A", code: 'RG-002', category: 'reagent', unit: 'mL', onHand: 700, reorderLevel: 400, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(120) },
  { name: "Fehling's Solution B", code: 'RG-003', category: 'reagent', unit: 'mL', onHand: 680, reorderLevel: 400, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(120) },
  { name: 'Iodine Solution', code: 'RG-004', category: 'reagent', unit: 'mL', onHand: 950, reorderLevel: 500, storageLocation: 'Reagent Shelf, Lab 3', expiryDate: daysFromNow(200) },
  { name: 'Biuret Reagent', code: 'RG-005', category: 'reagent', unit: 'mL', onHand: 380, reorderLevel: 400, storageLocation: 'Reagent Fridge, Lab 3', hazardClass: 'Corrosive', expiryDate: daysFromNow(95) },
  { name: 'Sudan III Solution', code: 'RG-006', category: 'reagent', unit: 'mL', onHand: 240, reorderLevel: 150, storageLocation: 'Reagent Shelf, Lab 3', expiryDate: daysFromNow(160) },
  { name: 'Methyl Orange Indicator', code: 'RG-007', category: 'reagent', unit: 'mL', onHand: 320, reorderLevel: 150, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(240) },
  { name: 'Phenolphthalein Indicator', code: 'RG-008', category: 'reagent', unit: 'mL', onHand: 410, reorderLevel: 150, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(250) },
  { name: 'Universal Indicator Solution', code: 'RG-009', category: 'reagent', unit: 'mL', onHand: 540, reorderLevel: 250, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(280) },
  { name: 'Litmus Solution (blue)', code: 'RG-010', category: 'reagent', unit: 'mL', onHand: 450, reorderLevel: 200, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(300) },
  { name: 'Litmus Solution (red)', code: 'RG-011', category: 'reagent', unit: 'mL', onHand: 430, reorderLevel: 200, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(300) },
  { name: 'Starch Solution', code: 'RG-012', category: 'reagent', unit: 'mL', onHand: 760, reorderLevel: 300, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(60) },
  { name: 'Glucose Solution', code: 'RG-013', category: 'reagent', unit: 'mL', onHand: 640, reorderLevel: 300, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(70) },
  { name: 'DCPIP Solution', code: 'RG-014', category: 'reagent', unit: 'mL', onHand: 130, reorderLevel: 150, storageLocation: 'Reagent Fridge, Lab 3', expiryDate: daysFromNow(45) },
  { name: 'Methylene Blue Stain', code: 'RG-015', category: 'reagent', unit: 'mL', onHand: 210, reorderLevel: 100, storageLocation: 'Reagent Shelf, Lab 3', expiryDate: daysFromNow(300) },
  { name: 'Bromothymol Blue', code: 'RG-016', category: 'reagent', unit: 'mL', onHand: 175, reorderLevel: 120, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(210) },
  { name: 'Limewater', code: 'RG-017', category: 'reagent', unit: 'mL', onHand: 1250, reorderLevel: 600, storageLocation: 'Reagent Shelf, Lab 1', expiryDate: daysFromNow(40) },
  { name: 'Cobalt Chloride Paper', code: 'RG-018', category: 'reagent', unit: 'pcs', onHand: 80, reorderLevel: 40, storageLocation: 'Reagent Drawer, Lab 1', expiryDate: daysFromNow(365) },
]

function withIds(seeds: ItemSeed[], prefix: string): InventoryItem[] {
  return seeds.map((item, index) => ({
    ...item,
    id: `${prefix}-${String(index + 1).padStart(3, '0')}`,
    consumable: item.category !== 'apparatus',
  }))
}

/** Full store register — apparatus, chemicals and reagents only. */
export function createSeedInventory(): InventoryItem[] {
  return [
    ...withIds(apparatusSeed, 'item-ap'),
    ...withIds(chemicalSeed, 'item-ch'),
    ...withIds(reagentSeed, 'item-rg'),
  ]
}

export const INVENTORY_CATEGORY_ORDER: ItemCategory[] = ['apparatus', 'chemical', 'reagent']
