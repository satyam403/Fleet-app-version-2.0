// src/services/airtable-inspection.ts
const AIRTABLE_API_KEY = import.meta.env.VITE_AIRTABLE_API_KEY;
const AIRTABLE_BASE_ID = import.meta.env.VITE_AIRTABLE_BASE_ID;

const INSPECTION_TABLE = 'Inspections';      // ✏️ exact naam
const INVENTORY_TABLE  = 'Inventory';        // ✏️ exact naam
const STATS_TABLE      = 'Dashboard Stats';  // ✏️ exact naam

const AIRTABLE_INSPECTION_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(INSPECTION_TABLE)}`;
const AIRTABLE_INVENTORY_URL  = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(INVENTORY_TABLE)}`;
const AIRTABLE_STATS_URL      = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(STATS_TABLE)}`;

// ─────────────────────────────────────────────
// Inventory Field Names
// ─────────────────────────────────────────────
const INVENTORY_FIELDS = {
  inventoryId:      'Inventory ID',
  partName:         'Part Name',
  description:      'Description',
  type:             'Type',
  manufacturer:     'Manufacturer',
  quantity:         'Quantity',
  totalInventory:   'Total Inventory',
  qtyCheckedOut:    'Qty Checked out Via APP',
  quantityUsed:     'Quantity used (from Mechanic Inventory)',
  used:             0,
  pricePerPart:     'Price per part',
  shelfLocation:    'Shelf Location',
  partShelfAndRow:  'Part shelf and Row',
  barcode:          'Barcode',
  barcodeUrl:       'Barcode URL',
  googlePartLink:   'Google Part Link',
  googlePartForApp: 'Google Part for APP',
  lastModifiedBy:   'Last Modified By',
  lastModified:     'Last Modified',
  quantityAugust:   'Quantity in August',
  quantitySept:     'Quantity in Sept',
  quantityOct:      'Quantity in Oct',
  quantityNov:      'Quantity in Nov',
  quantityDecember: 'Quantity in December',
  quantityJanuary:  'Quantity in January',
  inventoryUsedAug: 'Inventory Used in August',
};

// ─────────────────────────────────────────────
// Stats Field Names
// ─────────────────────────────────────────────
const STATS_FIELDS = {
  totalTrailers:      'Total Trailers',       // ✏️
  inspectionsPending: 'Inspections Pending',  // ✏️
  usedInventory:      'Used Inventory',       // ✏️
  pendingInventory:   'Pending Inventory',    // ✏️
};

// ─────────────────────────────────────────────
// Inspection Field Names
// ─────────────────────────────────────────────
const INSPECTION_FIELDS = {
  trailerNumber:  'asset_id',         // ✏️
  technicianName: 'technician_name',  // ✏️
  date:           'inspection_date',  // ✏️
  overallStatus:  'overall_status',   // ✏️
};

// ═════════════════════════════════════════════
// INTERFACES
// ═════════════════════════════════════════════

interface AirtableAttachment {
  url: string;
  filename?: string;
}

interface AirtableInspectionData {
  inspection_number?: string;
  asset_id?: string;
  technician_name?: string;
  inspection_date?: string;
  inspection_type?: string;
  overall_status?: string;
  dot_number?: string;
  license_plate?: string;
  vin?: string;
  brake_adjustment?: string;
  brake_connections?: string;
  brake_drums?: string;
  brake_hoses?: string;
  brake_tubing?: string;
  fifth_wheel?: string;
  pintle_hooks?: string;
  drawbar_eye?: string;
  safety_chains?: string;
  exhaust_system?: string;
  fuel_tank?: string;
  fuel_lines?: string;
  headlights?: string;
  tail_lights?: string;
  brake_lights?: string;
  turn_signals?: string;
  clearance_lights?: string;
  reflectors?: string;
  cargo_securement?: string;
  tailgate?: string;
  doors?: string;
  steering_wheel?: string;
  steering_column?: string;
  steering_gear?: string;
  pitman_arm?: string;
  power_steering?: string;
  spring_assembly?: string;
  torque_arm?: string;
  frame_members?: string;
  tire_condition?: string;
  tire_tread_depth?: string;
  wheels_rims?: string;
  wheel_fasteners?: string;
  windshield_condition?: string;
  windshield_wipers?: string;
  horn?: string;
  mirrors?: string;
  mud_flaps?: string;
  inspection_photos?: AirtableAttachment[];
  defects_found?: string;
  repair_notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface InventoryItem {
  id: string;
  inventoryId: string;
  partName: string;
  description: string;
  part_Number?: string;
  type: string;
  manufacturer: string;
  quantity: number;
  totalInventory: number;
  qtyCheckedOut: number;
  quantityUsed: number;
  partNumber: string;
  used: number; // 👈 THIS WAS MISSING
  pricePerPart: number;
  shelfLocation: string;
  partShelfAndRow: string;
  barcode: string;
  barcodeUrl: string;
  googlePartLink: string;
  googlePartForApp: string;
  lastModified: string;
  lastModifiedBy: string;
  quantityAugust: number;
  quantitySept: number;
  quantityOct: number;
  quantityNov: number;
  quantityDecember: number;
  quantityJanuary: number;
  inventoryUsedAug: number;
  photo?: string 
}

export interface DashboardStats {
  totalTrailers: number;
  inspectionsPending: number;
  usedInventory: number;
  pendingInventory: number;
}

export interface Inspection {
  id: string;
  trailerNumber: string;
  technicianName: string;
  date: string;
  overallStatus: string;
  checklist: { status: string }[];
}

// ═════════════════════════════════════════════
// HELPERS
// ═════════════════════════════════════════════

function mapInventoryRecord(record: {
  id: string;
  fields: Record<string, any>;
}): InventoryItem {

  const f = record.fields;

  return {
    id: record.id || "",

    inventoryId: f[INVENTORY_FIELDS.inventoryId] ?? '',
    partName: f[INVENTORY_FIELDS.partName] ?? '',
    description: f[INVENTORY_FIELDS.description] ?? '',
    type: f[INVENTORY_FIELDS.type] ?? '',
    manufacturer: f[INVENTORY_FIELDS.manufacturer] ?? '',

    quantity: Number(f[INVENTORY_FIELDS.quantity] ?? 0),
    totalInventory: Number(f[INVENTORY_FIELDS.totalInventory] ?? 0),
    qtyCheckedOut: Number(f[INVENTORY_FIELDS.qtyCheckedOut] ?? 0),
    quantityUsed: Number(f[INVENTORY_FIELDS.quantityUsed] ?? 0),

    // ✅ FIX ADDED HERE
    used: Number(f[INVENTORY_FIELDS.used] ?? 0),

    pricePerPart: Number(f[INVENTORY_FIELDS.pricePerPart] ?? 0),
    partNumber: f[INVENTORY_FIELDS.partName] ?? '',

    shelfLocation: f[INVENTORY_FIELDS.shelfLocation] ?? '',
    partShelfAndRow: f[INVENTORY_FIELDS.partShelfAndRow] ?? '',
    barcode: f[INVENTORY_FIELDS.barcode] ?? '',
    barcodeUrl: f[INVENTORY_FIELDS.barcodeUrl] ?? '',
    googlePartLink: f[INVENTORY_FIELDS.googlePartLink] ?? '',
    googlePartForApp: f[INVENTORY_FIELDS.googlePartForApp] ?? '',

    lastModified: f[INVENTORY_FIELDS.lastModified] ?? '',
    lastModifiedBy: f[INVENTORY_FIELDS.lastModifiedBy] ?? '',

    quantityAugust: Number(f[INVENTORY_FIELDS.quantityAugust] ?? 0),
    quantitySept: Number(f[INVENTORY_FIELDS.quantitySept] ?? 0),
    quantityOct: Number(f[INVENTORY_FIELDS.quantityOct] ?? 0),
    quantityNov: Number(f[INVENTORY_FIELDS.quantityNov] ?? 0),
    quantityDecember: Number(f[INVENTORY_FIELDS.quantityDecember] ?? 0),
    quantityJanuary: Number(f[INVENTORY_FIELDS.quantityJanuary] ?? 0),

    inventoryUsedAug: Number(f[INVENTORY_FIELDS.inventoryUsedAug] ?? 0),
  };
}

function mapInspectionRecord(record: { id: string; fields: Record<string, any> }): Inspection {
  const f = record.fields;
  const status = (f[INSPECTION_FIELDS.overallStatus] ?? '').toLowerCase();
  return {
    id:             record.id,
    trailerNumber:  f[INSPECTION_FIELDS.trailerNumber]  ?? '',
    technicianName: f[INSPECTION_FIELDS.technicianName] ?? '',
    date:           f[INSPECTION_FIELDS.date]           ?? '',
    overallStatus:  f[INSPECTION_FIELDS.overallStatus]  ?? '',
    checklist:      [{ status: status === 'pass' ? 'pass' : 'fail' }],
  };
}

async function convertImageToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ═════════════════════════════════════════════
// INSPECTION OPERATIONS
// ═════════════════════════════════════════════

export async function createAirtableInspection(
  data: AirtableInspectionData,
  imageFiles?: File[]
) {
  try {
    let attachments: AirtableAttachment[] = [];

    if (imageFiles && imageFiles.length > 0) {
      console.log(`📸 Processing ${imageFiles.length} images...`);
      const results = await Promise.all(
        imageFiles.map(async (file): Promise<AirtableAttachment | null> => {
          try {
            const url = await convertImageToDataURL(file);
            return { url, filename: file.name };
          } catch (error) {
            console.error('Failed to process image:', file.name, error);
            return null;
          }
        })
      );
      attachments = results.filter((r): r is AirtableAttachment => r !== null);
      console.log(`✅ Processed ${attachments.length} images`);
    }

    const response = await fetch(AIRTABLE_INSPECTION_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ...data,
          inspection_photos: attachments,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable create error:', error);
      throw new Error(`Failed to create inspection: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Inspection created in Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable API error:', error);
    throw error;
  }
}

export async function getAirtableInspections(): Promise<Inspection[]> {
  try {
    const response = await fetch(AIRTABLE_INSPECTION_URL, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch inspections: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    return (result.records ?? []).map(mapInspectionRecord);
  } catch (error) {
    console.error('💥 Airtable fetch error:', error);
    throw error;
  }
}

export async function updateAirtableInspection(
  recordId: string,
  data: Partial<AirtableInspectionData>
) {
  try {
    const response = await fetch(`${AIRTABLE_INSPECTION_URL}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: { ...data, updated_at: new Date().toISOString() },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update inspection: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Inspection updated in Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable update error:', error);
    throw error;
  }
}

export async function deleteAirtableInspection(recordId: string) {
  try {
    const response = await fetch(`${AIRTABLE_INSPECTION_URL}/${recordId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete inspection: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Inspection deleted from Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable delete error:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════
// INVENTORY OPERATIONS
// ═════════════════════════════════════════════

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    const allRecords: InventoryItem[] = [];
    let offset: string | undefined = undefined;

    do {
      const url = new URL(AIRTABLE_INVENTORY_URL);
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Failed to fetch inventory: ${error.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      allRecords.push(...(result.records ?? []).map(mapInventoryRecord));
      offset = result.offset;
    } while (offset);

    console.log(`✅ Fetched ${allRecords.length} inventory items`);
    return allRecords;
  } catch (error) {
    console.error('💥 Airtable fetch error:', error);
    throw error;
  }
}

export async function addInventoryItem(
  data: Omit<InventoryItem, 'id'>
): Promise<InventoryItem> {
  try {
    const response = await fetch(AIRTABLE_INVENTORY_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          fields: {
            [INVENTORY_FIELDS.partName]:        data.partName,
            [INVENTORY_FIELDS.description]:     data.description,
            [INVENTORY_FIELDS.type]:            data.type,
            [INVENTORY_FIELDS.manufacturer]:    data.manufacturer,
            [INVENTORY_FIELDS.quantity]:        data.quantity,
            [INVENTORY_FIELDS.pricePerPart]:    data.pricePerPart,
            [INVENTORY_FIELDS.shelfLocation]:   data.shelfLocation,
            [INVENTORY_FIELDS.partShelfAndRow]: data.partShelfAndRow,
            [INVENTORY_FIELDS.googlePartLink]:  data.googlePartLink,
          },
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable create error:', error);
      throw new Error(`Failed to add inventory item: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Inventory item added:', result);
    return mapInventoryRecord(result.records[0]);
  } catch (error) {
    console.error('💥 Airtable API error:', error);
    throw error;
  }
}

export async function updateInventoryItem(
  recordId: string,
  data: Partial<InventoryItem>
): Promise<InventoryItem> {
  try {
    const fields: Record<string, any> = {};

    if (data.partName        !== undefined) fields[INVENTORY_FIELDS.partName]        = data.partName;
    if (data.description     !== undefined) fields[INVENTORY_FIELDS.description]     = data.description;
    if (data.quantity        !== undefined) fields[INVENTORY_FIELDS.quantity]        = data.quantity;
    if (data.qtyCheckedOut   !== undefined) fields[INVENTORY_FIELDS.qtyCheckedOut]   = data.qtyCheckedOut;
    if (data.quantityUsed    !== undefined) fields[INVENTORY_FIELDS.quantityUsed]    = data.quantityUsed;
    if (data.totalInventory  !== undefined) fields[INVENTORY_FIELDS.totalInventory]  = data.totalInventory;
    if (data.pricePerPart    !== undefined) fields[INVENTORY_FIELDS.pricePerPart]    = data.pricePerPart;
    if (data.shelfLocation   !== undefined) fields[INVENTORY_FIELDS.shelfLocation]   = data.shelfLocation;
    if (data.partShelfAndRow !== undefined) fields[INVENTORY_FIELDS.partShelfAndRow] = data.partShelfAndRow;
    // Audit stamp: who touched the row and when. The Inventory Management page
    // always passes these so "Last Modified By" reflects the mechanic, not a
    // bare timestamp.
    if (data.lastModifiedBy  !== undefined) fields[INVENTORY_FIELDS.lastModifiedBy]  = data.lastModifiedBy;
    if (data.lastModified    !== undefined) fields[INVENTORY_FIELDS.lastModified]    = data.lastModified;

    const response = await fetch(`${AIRTABLE_INVENTORY_URL}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update inventory item: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Inventory item updated:', result);
    return mapInventoryRecord(result);
  } catch (error) {
    console.error('💥 Airtable update error:', error);
    throw error;
  }
}

export async function deleteInventoryItem(recordId: string): Promise<void> {
  try {
    const response = await fetch(`${AIRTABLE_INVENTORY_URL}/${recordId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete inventory item: ${error.error?.message || 'Unknown error'}`);
    }

    console.log('✅ Inventory item deleted');
  } catch (error) {
    console.error('💥 Airtable delete error:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════
// INVENTORY UPDATE LOG (audit trail)
// ─────────────────────────────────────────────
// Every quantity change / new part from the Inventory Management page is
// appended here as one row. The Reports → Inventory Updates tab reads this
// table to show *who* changed *what*, *when*, and by how much, and to build
// the PDF that gets emailed.
//
// 🛠️  Create this table in your Airtable base once, named exactly
//     "Inventory Updates", with these columns (all plain text/number/date):
//       Part Name (text) · Part Number (text) · Action (text)
//       Previous Qty (number) · New Qty (number) · Change (number)
//       Updated By (text) · Updated At (date, include time) · Note (text)
// ═════════════════════════════════════════════

const INVENTORY_LOG_TABLE = 'Inventory Updates';
const AIRTABLE_INVENTORY_LOG_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(INVENTORY_LOG_TABLE)}`;

const INVENTORY_LOG_FIELDS = {
  partName:    'Part Name',
  partNumber:  'Part Number',
  action:      'Action',        // 'update' | 'add'
  previousQty: 'Previous Qty',
  newQty:      'New Qty',
  change:      'Change',         // newQty - previousQty
  updatedBy:   'Updated By',
  updatedAt:   'Updated At',
  note:        'Note',
};

export interface InventoryUpdateLog {
  id: string;
  partName: string;
  partNumber: string;
  action: 'update' | 'add';
  previousQty: number;
  newQty: number;
  change: number;
  updatedBy: string;
  updatedAt: string;
  note: string;
}

function mapInventoryLogRecord(record: { id: string; fields: Record<string, any> }): InventoryUpdateLog {
  const f = record.fields;
  return {
    id:          record.id || '',
    partName:    f[INVENTORY_LOG_FIELDS.partName] ?? '',
    partNumber:  f[INVENTORY_LOG_FIELDS.partNumber] ?? '',
    action:      (f[INVENTORY_LOG_FIELDS.action] ?? 'update') as 'update' | 'add',
    previousQty: Number(f[INVENTORY_LOG_FIELDS.previousQty] ?? 0),
    newQty:      Number(f[INVENTORY_LOG_FIELDS.newQty] ?? 0),
    change:      Number(f[INVENTORY_LOG_FIELDS.change] ?? 0),
    updatedBy:   f[INVENTORY_LOG_FIELDS.updatedBy] ?? '',
    updatedAt:   f[INVENTORY_LOG_FIELDS.updatedAt] ?? '',
    note:        f[INVENTORY_LOG_FIELDS.note] ?? '',
  };
}

export async function addInventoryUpdateLog(
  entry: Omit<InventoryUpdateLog, 'id'>
): Promise<void> {
  try {
    const response = await fetch(AIRTABLE_INVENTORY_LOG_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        records: [{
          fields: {
            [INVENTORY_LOG_FIELDS.partName]:    entry.partName,
            [INVENTORY_LOG_FIELDS.partNumber]:  entry.partNumber,
            [INVENTORY_LOG_FIELDS.action]:      entry.action,
            [INVENTORY_LOG_FIELDS.previousQty]: entry.previousQty,
            [INVENTORY_LOG_FIELDS.newQty]:      entry.newQty,
            [INVENTORY_LOG_FIELDS.change]:      entry.change,
            [INVENTORY_LOG_FIELDS.updatedBy]:   entry.updatedBy,
            [INVENTORY_LOG_FIELDS.updatedAt]:   entry.updatedAt,
            [INVENTORY_LOG_FIELDS.note]:        entry.note,
          },
        }],
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      // A missing "Inventory Updates" table shouldn't block the actual
      // inventory write — surface it but don't throw the whole save away.
      console.error('❌ Inventory log write failed:', error);
      throw new Error(`Failed to log inventory update: ${error?.error?.message || 'Unknown error'}`);
    }
    console.log('✅ Inventory update logged');
  } catch (error) {
    console.error('💥 Inventory log error:', error);
    throw error;
  }
}

export async function getInventoryUpdateLog(): Promise<InventoryUpdateLog[]> {
  try {
    const allRecords: InventoryUpdateLog[] = [];
    let offset: string | undefined = undefined;

    do {
      const url = new URL(AIRTABLE_INVENTORY_LOG_URL);
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(`Failed to fetch inventory log: ${error?.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();
      allRecords.push(...(result.records ?? []).map(mapInventoryLogRecord));
      offset = result.offset;
    } while (offset);

    // Newest first.
    allRecords.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    return allRecords;
  } catch (error) {
    console.error('💥 Inventory log fetch error:', error);
    throw error;
  }
}

// ═════════════════════════════════════════════
// DASHBOARD STATS OPERATIONS
// ═════════════════════════════════════════════

export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const response = await fetch(AIRTABLE_STATS_URL, {
      headers: { 'Authorization': `Bearer ${AIRTABLE_API_KEY}` },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to fetch stats: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    // Stats table ka pehla record use karo
    const f = result.records?.[0]?.fields ?? {};

    return {
      totalTrailers:      f[STATS_FIELDS.totalTrailers]      ?? 0,
      inspectionsPending: f[STATS_FIELDS.inspectionsPending] ?? 0,
      usedInventory:      f[STATS_FIELDS.usedInventory]      ?? 0,
      pendingInventory:   f[STATS_FIELDS.pendingInventory]   ?? 0,
    };
  } catch (error) {
    console.error('💥 Airtable stats fetch error:', error);
    throw error;
  }
} 


interface AirtableWorkOrder {
  work_order_number?: string;
  asset_id?: string;
  vendor?: string;
  issue_description?: string;
  status?: string;
  priority?: string;
  repair_date?: string;
  grand_total?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  start_time?: string;
  end_time?: string;
}


const AIRTABLE_API_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Work%20Orders`; // ✏️ exact naam of table with URL encoding
// Create Work Order in Airtable
export async function createAirtableWorkOrder(data: AirtableWorkOrder) {
  try {
    const response = await fetch(AIRTABLE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          work_order_number: data.work_order_number,
          asset_id: data.asset_id,
          vendor: data.vendor || '',
          issue_description: data.issue_description,
          status: data.status || 'pending',
          priority: data.priority || 'medium',
          repair_date: data.repair_date,
          grand_total: data.grand_total || 0,
          notes: data.notes || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          start_time: data.start_time || '',
          end_time: data.end_time || '',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable create error:', error);
      throw new Error(`Failed to create work order in Airtable: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Work order created in Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable API error:', error);
    throw error;
  }
}

// Update Work Order in Airtable
export async function updateAirtableWorkOrder(recordId: string, data: Partial<AirtableWorkOrder>) {
  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fields: {
          ...data,
          updated_at: new Date().toISOString(),
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable update error:', error);
      throw new Error(`Failed to update work order in Airtable: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Work order updated in Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable update error:', error);
    throw error;
  }
}

// Get Work Orders from Airtable
export async function getAirtableWorkOrders() {
  try {
    const response = await fetch(AIRTABLE_API_URL, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable fetch error:', error);
      throw new Error(`Failed to fetch work orders from Airtable: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Work orders fetched from Airtable:', result);
    return result.records;
  } catch (error) {
    console.error('💥 Airtable fetch error:', error);
    throw error;
  }
}

// Delete Work Order from Airtable
export async function deleteAirtableWorkOrder(recordId: string) {
  try {
    const response = await fetch(`${AIRTABLE_API_URL}/${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Airtable delete error:', error);
      throw new Error(`Failed to delete work order from Airtable: ${error.error?.message || 'Unknown error'}`);
    }

    const result = await response.json();
    console.log('✅ Work order deleted from Airtable:', result);
    return result;
  } catch (error) {
    console.error('💥 Airtable delete error:', error);
    throw error;
  }
}