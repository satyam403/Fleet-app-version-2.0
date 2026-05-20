import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { downloadPDF } from '../services/pdf';
import { generateWorkOrderPDF } from '../services/pdf';
import type { Trailer, WorkOrderItem, InventoryItem } from '../types';
import { toast } from 'sonner';
import {
  Search, Loader2, Plus, X, Download, Filter,
  Camera, CheckCircle, XCircle,
  AlertTriangle, ChevronRight, ChevronLeft,
  ClipboardList, Truck as TruckIcon, Zap,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from "../config";

interface TruckAsset {
  id: string;
  number: string;
  status: string;
  owner: string;
  vin: string;
  make: string;
  year: number | string;
  plate?: string;
}

interface AirtableWorkOrder {
  id: string;
  createdTime: string;
  fields: {
    work_order_number?: string;
    asset_id?: string;
    asset_number?: string;
    vendor?: string;
    issue_description?: string;
    status?: string;
    priority?: string;
    repair_date?: string;
    parts_used?: {
      itemName: string;
      quantity: number;
      pricePerPart?: number;
    }[];
    grand_total?: number;
    end_time?: string;
    start_time?: string;
  };
}

type AssetKind = 'trailer' | 'truck';
interface SelectedAsset {
  kind: AssetKind;
  id: string;
  number: string;
  customerName?: string;
  make?: string;
  year?: string | number;
  status?: string;
  vin?: string;
  plate?: string;
}

interface BulkInspectionItem {
  asset: SelectedAsset;
  hasIssue: boolean | null;
  issueNotes: string;
  priority: 'low' | 'medium' | 'high';
  items: WorkOrderItem[];
  done: boolean;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

const API_BASE = apiUrl("/users");

async function robustFetch(
  authFetch: AuthFetch,
  url: string,
  options?: RequestInit,
  retries = 2,
  timeoutMs = 15000
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await authFetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err: any) {
      clearTimeout(timer);
      const isLast = attempt === retries;
      if (isLast) {
        if (err?.name === 'AbortError') throw new Error('Request timed out. Check your network connection.');
        if (err?.message?.includes('fetch')) throw new Error('Network error. Please check your internet connection and try again.');
        throw err;
      }
      await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw new Error('Request failed after retries');
}

async function apiGet<T>(authFetch: AuthFetch, endpoint: string): Promise<T> {
  const res = await robustFetch(authFetch, `${API_BASE}${endpoint}`);
  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || "API request failed");
  }
  const result = await res.json();
  return result.data;
}

async function getTrailers(authFetch: AuthFetch): Promise<Trailer[]> {
  try {
    const data = await apiGet<any[]>(authFetch, "/getTrailers");
    if (!Array.isArray(data)) return [];
    return data.map((t: any) => ({
      id:           String(t._id ?? t.id ?? ""),
      number:       t.number || t.trailerNumber || t.unitNumber || t.unit_number
                    || t.name || t.trailer_number || t.assetNumber || t.asset_number
                    || t.plate || String(t._id ?? t.id ?? "").slice(-6),
      status:       t.status ?? "",
      customerName: t.customerName ?? t.customer_name ?? t.owner ?? "",
      vin:          t.vin ?? "",
      plate:        t.plate ?? "",
    }));
  } catch (error) { console.error("Failed to fetch trailers:", error); return []; }
}

async function getTrucks(authFetch: AuthFetch): Promise<TruckAsset[]> {
  try {
    const data = await apiGet<any[]>(authFetch, "/getTrucks");
    if (!Array.isArray(data)) return [];
    return data.map((t: any) => ({
      id:     String(t._id ?? t.id ?? ""),
      number: t.number || t.truckNumber || t.unitNumber || t.unit_number
              || t.name || t.truck_number || t.assetNumber
              || String(t._id ?? t.id ?? "").slice(-6),
      status: t.status ?? "",
      owner:  Array.isArray(t.owner) ? t.owner.join(", ") : (t.owner ?? ""),
      vin:    t.vin ?? "",
      make:   t.make ?? "",
      year:   t.year ?? "",
      plate:  t.plate ?? "",
    }));
  } catch (error) { console.error("Failed to fetch trucks:", error); return []; }
}

async function getInventory(authFetch: AuthFetch): Promise<InventoryItem[]> {
  try {
    const data = await apiGet<any>(authFetch, "/getInventory");
    console.log("Raw inventory data:", data);
    if (!Array.isArray(data)) return [];
    return data.map((item: any) => {
      const rawName = item.name || item.partName || "";
      const rawPartNumber = item.partNumber || item.part_number || "";
      const displayName = rawName || rawPartNumber || `Part-${String(item.id ?? "").slice(-6)}`;
      return {
        id: item.id,
        name: displayName,
        partNumber: rawPartNumber,
        available: Number(item.available ?? item.quantity ?? 0),
        pricePerPart: Number(item.pricePerPart ?? 0),
        used: Number(item.used ?? 0),
        pending: Number(item.pending ?? 0),
        // ✅ FIX: photo field properly mapped from all possible keys
        photo: item.photo ?? item.image ?? item.photoUrl ?? item.photo_url ?? "",
      };
    });
  } catch (error) { console.error("Failed to fetch inventory:", error); return []; }
}

async function getMechanics(authFetch: AuthFetch): Promise<string[]> {
  try {
    const res = await robustFetch(authFetch, `${API_BASE}/getMechanics`);
    if (!res.ok) throw new Error("Failed to fetch mechanics");
    const result = await res.json();
    return result.data || [];
  } catch (err) { console.error("Mechanics fetch error:", err); return []; }
}

async function fetchWorkOrders(authFetch: AuthFetch, role: string): Promise<AirtableWorkOrder[]> {
  const endpoint = role === "admin" ? "/getAllWorkOrders" : "/getMyWorkOrders";
  const res = await apiGet<AirtableWorkOrder[]>(authFetch, endpoint);
  return res;
}

async function createWorkOrder(authFetch: AuthFetch, payload: any, imageFiles: File[]) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      form.append(key, typeof value === "object" ? JSON.stringify(value) : String(value));
    }
  });
  imageFiles.forEach((file) => form.append("images", file));
  const res = await robustFetch(authFetch, `${API_BASE}/createWorkOrder`, {
    method:  "POST",
    headers: {},
    body:    form,
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to create work order");
  return result.data;
}

async function updateWorkOrderStatus(authFetch: AuthFetch, id: string, status: string) {
  const res = await robustFetch(authFetch, `${API_BASE}/updateWorkOrderStatus/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to update status");
  return result.data;
}

async function subtractInventory(authFetch: AuthFetch, usedItems: any[]) {
  const res = await robustFetch(authFetch, `${API_BASE}/subtractInventoryService`, {
    method: "POST",
    body: JSON.stringify(usedItems),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to subtract inventory");
  return result;
}

const C = {
  accent:       '#2563eb',
  accentBg:     'rgba(37,99,235,0.08)',
  accentBorder: 'rgba(37,99,235,0.28)',
  green:  '#16a34a', greenBg:  '#dcfce7', greenBorder:  '#86efac',
  red:    '#dc2626', redBg:    '#fee2e2', redBorder:    '#fca5a5',
  orange: '#ea580c', orangeBg: '#fff7ed', orangeBorder: '#fdba74',
  yellow: '#d97706', yellowBg: '#fef9c3', yellowBorder: '#fde68a',
  grey:   '#64748b',
};

const inp: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.6rem 0.75rem',
  background: 'var(--input-background)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  color: 'var(--foreground)',
  fontSize: '0.875rem', outline: 'none',
  fontFamily: 'inherit', transition: 'border-color .15s',
};

const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.7rem', fontWeight: 700,
  color: 'var(--muted-foreground)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginBottom: '0.4rem',
};

const GLOBAL_CSS = `
  .wo-root { display: flex; flex-direction: column; min-height: 100%; background: var(--background); }
  .wo-header { background: var(--card); border-bottom: 1px solid var(--border); }
  .wo-header-inner { max-width: 560px; margin: 0 auto; padding: 12px 16px 0; width: 100%; }
  .wo-body { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
  .wo-body-inner { max-width: 560px; margin: 0 auto; padding: 16px 16px 120px; width: 100%; }
  .wo-footer { background: var(--card); border-top: 1px solid var(--border); }
  .wo-footer-inner { max-width: 560px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; width: 100%; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  @keyframes wo-spin { to { transform: rotate(360deg); } }
  .wo-spin { animation: wo-spin 1s linear infinite; }
  @keyframes wo-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .wo-fadein { animation: wo-fadein 0.22s ease both; }
`;

const STEPS_CREATE = ['Asset', 'Inspector', 'Issue', 'Photos', 'Parts', 'Review'];

function PriorityBadge({ p }: { p?: string }) {
  const map: Record<string, [string, string]> = {
    high:   [C.red,    C.redBg],
    medium: [C.yellow, C.yellowBg],
    low:    [C.green,  C.greenBg],
  };
  const [color, bg] = map[p ?? ''] ?? [C.grey, 'var(--muted)'];
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {p ?? 'N/A'}
    </span>
  );
}

function StatusBadge({ s }: { s?: string }) {
  const map: Record<string, [string, string]> = {
    completed:   [C.green,  C.greenBg],
    in_progress: [C.accent, C.accentBg],
    pending:     [C.yellow, C.yellowBg],
  };
  const [color, bg] = map[s ?? ''] ?? [C.yellow, C.yellowBg];
  return (
    <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: 999, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {s ?? 'pending'}
    </span>
  );
}

function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h2>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '3px 0 0' }}>{sub}</p>
    </div>
  );
}

function PartPickerModal({
  inventory,
  selectedId,
  onPick,
  onClose, // ✅ FIX: separate onClose prop
}: {
  inventory: InventoryItem[];
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void; // ✅ FIX: explicit close handler
}) {
  const [search, setSearch] = useState('');

  const filtered = inventory.filter(inv =>
    !search ||
    (inv.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.partNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} // ✅ FIX: calls onClose directly
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        overscrollBehavior: 'contain',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'var(--card)',
          borderRadius: 16,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 12,
          flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: 'var(--foreground)' }}>
              Select Part
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2 }}>
              {inventory.length} parts available
            </div>
          </div>
          {/* ✅ FIX: X button calls onClose directly */}
          <div
            onClick={() => onClose()}
            style={{
              width: 36, height: 36, borderRadius: '50%',
              border: 'none', background: 'var(--muted)',
              color: 'var(--muted-foreground)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 20, fontWeight: 700, flexShrink: 0,
              userSelect: 'none',
            }}
          >×</div>
        </div>

        {/* Search */}
        <div style={{
          padding: '12px 18px',
          borderBottom: '1px solid var(--border)',
          position: 'relative', flexShrink: 0,
        }}>
          <Search size={15} style={{
            position: 'absolute', left: 30, top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--muted-foreground)', pointerEvents: 'none',
          }} />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search part name or number…"
            style={{ ...inp, paddingLeft: 38, fontSize: '0.95rem' }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' as any }}>
          {filtered.length === 0 ? (
            <div style={{
              padding: '3rem', textAlign: 'center',
              color: 'var(--muted-foreground)', fontSize: 14,
            }}>
              No parts found
            </div>
          ) : (
            filtered.map((inv, i) => {
              const isSelected = inv.id === selectedId;
              const outOfStock = inv.available <= 0;
              // ✅ FIX: properly read photo from mapped field
              const photoUrl = (inv as any).photo || '';
              const hasPhoto = !!photoUrl;

              return (
                <div
                  key={inv.id}
                  onClick={() => {
                    if (!outOfStock) onPick(inv.id);
                  }}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                    background: isSelected ? C.accentBg : 'transparent',
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    opacity: outOfStock ? 0.45 : 1,
                    minHeight: 72,
                    userSelect: 'none',
                    transition: 'background 0.1s',
                  }}
                >
                  {/* ✅ FIX: Photo renders using photoUrl */}
                  {hasPhoto && (
                    <div style={{
                      width: 54, height: 54,
                      borderRadius: 12, flexShrink: 0,
                      background: 'var(--muted)',
                      border: `2px solid ${isSelected ? C.accentBorder : 'var(--border)'}`,
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <img
                        src={photoUrl}
                        alt={inv.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => {
                          const el = e.currentTarget.parentElement;
                          if (el) el.style.display = 'none';
                        }}
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 15,
                      fontFamily: 'inherit',
                      color: isSelected ? C.accent : 'var(--foreground)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 5, lineHeight: 1.3,
                    }}>
                      {inv.name}
                    </div>

                    {inv.partNumber && (
                      <div style={{
                        fontSize: 11, color: 'var(--muted-foreground)',
                        fontFamily: 'monospace', letterSpacing: '0.03em', marginBottom: 5,
                      }}>
                        # {inv.partNumber}
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700,
                        padding: '3px 10px', borderRadius: 99,
                        background: outOfStock ? C.redBg : inv.available <= 3 ? C.yellowBg : C.greenBg,
                        color: outOfStock ? C.red : inv.available <= 3 ? C.yellow : C.green,
                      }}>
                        {outOfStock ? 'Out of stock' : `${inv.available} left`}
                      </span>
                      {inv.pricePerPart > 0 && (
                        <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>
                          ${inv.pricePerPart.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <CheckCircle size={22} color={C.accent} style={{ flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function WorkOrders() {
  const { t } = useTranslation();
  const { authFetch, user } = useAuth();

  const [trailers,        setTrailers]        = useState<Trailer[]>([]);
  const [trucks,          setTrucks]          = useState<TruckAsset[]>([]);
  const [inventory,       setInventory]       = useState<InventoryItem[]>([]);
  const [workOrders,      setWorkOrders]      = useState<AirtableWorkOrder[]>([]);
  const [mechanicOptions, setMechanicOptions] = useState<string[]>([]);
  const [loading,         setLoading]         = useState(true);

  const [activeTab,  setActiveTab]  = useState<'create' | 'history' | 'bulk'>('create');
  const [step,       setStep]       = useState(0);

  const [query,         setQuery]         = useState('');
  const [showDrop,      setShowDrop]      = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset | null>(null);
  const [modalAsset,    setModalAsset]    = useState<SelectedAsset | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const [technicianName,  setTechnicianName]  = useState<string>('');
  const [technicianName2, setTechnicianName2] = useState<string>('');
  const [hasIssue,        setHasIssue]        = useState<boolean | null>(null);
  const [issueNotes,      setIssueNotes]      = useState('');
  const [priority,        setPriority]        = useState<'low' | 'medium' | 'high'>('medium');
  const [items,           setItems]           = useState<WorkOrderItem[]>([{ itemId: '', itemName: '', quantity: 1 }]);
  const [imageFiles,      setImageFiles]      = useState<File[]>([]);
  const [imagePreviews,   setImagePreviews]   = useState<string[]>([]);
  const [submitting,      setSubmitting]      = useState(false);

  const [now, setNow] = useState(Date.now());
  const [filterTrailer, setFilterTrailer] = useState('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [bulkQuery,       setBulkQuery]       = useState('');
  const [bulkShowDrop,    setBulkShowDrop]    = useState(false);
  const [bulkList,        setBulkList]        = useState<BulkInspectionItem[]>([]);
  const [bulkActiveIdx,   setBulkActiveIdx]   = useState<number | null>(null);

  const [partPickerOpen,   setPartPickerOpen]   = useState(false);
  const [partPickerTarget, setPartPickerTarget] = useState<{ rowIdx: number; isBulk: boolean; bulkIdx?: number } | null>(null);

  const [bulkSubmitting,  setBulkSubmitting]  = useState(false);
  const bulkDropRef = useRef<HTMLDivElement>(null);

  async function compressImage(file: File): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target?.result as string; };
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const MAX_WIDTH = 1280;
        const scale = Math.min(1, MAX_WIDTH / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (!blob) return resolve(file);
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          },
          "image/jpeg",
          0.6
        );
      };
      reader.readAsDataURL(file);
    });
  }

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  function formatDuration(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  }

  useEffect(() => {
    Promise.all([getTrailers(authFetch), getTrucks(authFetch), getInventory(authFetch)])
      .then(([tr, tk, inv]) => { setTrailers(tr); setTrucks(tk); setInventory(inv); })
      .catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, [authFetch]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'admin' && user.name) setTechnicianName(user.name);
    fetchWorkOrders(authFetch, user.role)
      .then(setWorkOrders)
      .catch(() => toast.error("Failed to load work orders"));
  }, [authFetch, user]);

  useEffect(() => {
    getMechanics(authFetch).then(setMechanicOptions);
  }, [authFetch]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowDrop(false);
      if (bulkDropRef.current && !bulkDropRef.current.contains(e.target as Node)) setBulkShowDrop(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const q = (query ?? '').toLowerCase();
  const searchResults: { kind: AssetKind; id: string; number: string; sub: string; isTruck: boolean }[] = [
    ...trailers
      .filter(t => {
        if (!q) return true;
        const num   = (t.number ?? '').toLowerCase();
        const vin   = ((t as any).vin ?? '').toLowerCase();
        const plate = ((t as any).plate ?? '').toLowerCase();
        return num.includes(q) || vin.includes(q) || plate.includes(q);
      })
      .map(t => {
        const display = t.number || (t as any).plate || (t as any).vin?.slice(-8) || t.id.slice(-6);
        const extra   = [(t as any).plate, (t as any).customerName].filter(Boolean).join(' · ');
        return { kind: 'trailer' as AssetKind, id: t.id, number: display, sub: `Trailer${extra ? ' · ' + extra : ''}`, isTruck: false };
      }),
    ...trucks
      .filter(t => {
        if (!q) return true;
        const num   = (t.number ?? '').toLowerCase();
        const vin   = (t.vin ?? '').toLowerCase();
        const plate = (t.plate ?? '').toLowerCase();
        return num.includes(q) || vin.includes(q) || plate.includes(q);
      })
      .map(t => {
        const display = t.number || t.plate || t.vin?.slice(-8) || t.id.slice(-6);
        const extra   = [t.make, t.year ? String(t.year) : ''].filter(Boolean).join(' ');
        return { kind: 'truck' as AssetKind, id: t.id, number: display, sub: `Truck${extra ? ' · ' + extra : ''}`, isTruck: true };
      }),
  ].slice(0, 12);

  const bq = (bulkQuery ?? '').toLowerCase();
  const bulkSearchResults = [
    ...trailers
      .filter(t => {
        if (!bq) return true;
        return (t.number ?? '').toLowerCase().includes(bq)
          || ((t as any).vin ?? '').toLowerCase().includes(bq)
          || ((t as any).plate ?? '').toLowerCase().includes(bq);
      })
      .map(t => {
        const display = t.number || (t as any).plate || (t as any).vin?.slice(-8) || t.id.slice(-6);
        return { kind: 'trailer' as AssetKind, id: t.id, number: display, sub: `Trailer`, isTruck: false };
      }),
    ...trucks
      .filter(t => {
        if (!bq) return true;
        return (t.number ?? '').toLowerCase().includes(bq)
          || (t.vin ?? '').toLowerCase().includes(bq)
          || (t.plate ?? '').toLowerCase().includes(bq);
      })
      .map(t => { const display = t.number || t.plate || t.vin?.slice(-8) || t.id.slice(-6); return { kind: 'truck' as AssetKind, id: t.id, number: display, sub: `Truck · ${t.make ?? ''}`, isTruck: true }; }),
  ]
    .filter(r => !bulkList.some(b => b.asset.id === r.id))
    .slice(0, 10);

  function selectAsset(r: typeof searchResults[0]) {
    const fullTrailer = trailers.find(t => t.id === r.id);
    const fullTruck   = trucks.find(t => t.id === r.id);
    const asset: SelectedAsset = {
      kind: r.kind, id: r.id, number: r.number,
      customerName: (fullTrailer as any)?.customerName ?? (fullTrailer as any)?.customer_name ?? fullTruck?.owner,
      make: fullTruck?.make, year: fullTruck?.year,
      status: fullTrailer?.status ?? fullTruck?.status,
      vin:   fullTruck?.vin ?? (fullTrailer as any)?.vin ?? '',
      plate: fullTruck?.plate ?? (fullTrailer as any)?.plate ?? '',
    };
    setModalAsset(asset);
    setQuery(r.number);
    setShowDrop(false);
  }

  function addBulkAsset(r: typeof bulkSearchResults[0]) {
    const fullTrailer = trailers.find(t => t.id === r.id);
    const fullTruck   = trucks.find(t => t.id === r.id);
    const asset: SelectedAsset = {
      kind: r.kind, id: r.id, number: r.number,
      customerName: (fullTrailer as any)?.customerName ?? (fullTrailer as any)?.customer_name ?? fullTruck?.owner,
      make: fullTruck?.make, year: fullTruck?.year,
      status: fullTrailer?.status ?? fullTruck?.status,
      vin:   fullTruck?.vin ?? (fullTrailer as any)?.vin ?? '',
      plate: fullTruck?.plate ?? (fullTrailer as any)?.plate ?? '',
    };
    setBulkList(prev => [...prev, { asset, hasIssue: null, issueNotes: '', priority: 'medium', items: [{ itemId: "", itemName: '', quantity: 1 }], done: false }]);
    setBulkQuery('');
    setBulkShowDrop(false);
    toast.success(`${r.number} added to queue`);
  }

  function updateBulkItem(idx: number, patch: Partial<BulkInspectionItem>) {
    setBulkList(prev => prev.map((b, i) => i === idx ? { ...b, ...patch } : b));
  }

  function removeBulkAsset(idx: number) {
    setBulkList(prev => prev.filter((_, i) => i !== idx));
    if (bulkActiveIdx === idx) setBulkActiveIdx(null);
  }

  async function submitBulkInspections() {
    if (bulkList.length === 0) { toast.error("Add at least one asset"); return; }
    if (bulkList.some(b => b.hasIssue === null)) { toast.error("Mark issue status for all assets"); return; }
    if (!technicianName.trim()) { toast.error("Inspector name required"); return; }
    setBulkSubmitting(true);
    let success = 0, fail = 0;
    for (const b of bulkList) {
      try {
        const woNumber   = `WO-${Date.now()}-${b.asset.id.slice(-4)}`;
        const nowISO     = new Date().toISOString();
        const repairDate = nowISO.split("T")[0];
        const assetType  = b.asset.kind === "truck" ? "truck" : "trailer";
        const validItems = b.items.filter(i => i.itemName.trim() && i.quantity > 0);
        const validItemsWithPrice = validItems.map(it => ({
          ...it,
          pricePerPart: getItemPrice(it.itemName),
          lineTotal:    getLineTotal(it.itemName, it.quantity),
        }));
        const grandTotal = validItemsWithPrice.reduce((s, it) => s + (it.lineTotal ?? 0), 0);

        await createWorkOrder(authFetch, {
          work_order_number: woNumber,
          asset_id:          b.asset.id,
          asset_number:      b.asset.number,
          asset_type:        assetType,
          customer_name:     b.asset.customerName || "",
          asset_status:      b.asset.status || "",
          vin:               b.asset.vin || "",
          plate:             b.asset.plate || "",
          repair_date:       repairDate,
          start_time:        nowISO,
          vendor:            technicianName.trim(),
          issue_description: b.hasIssue ? b.issueNotes || "Issue found" : "Inspection passed — No issues found",
          status:            b.hasIssue ? "pending" : "completed",
          priority:          b.hasIssue ? b.priority : "low",
          grand_total:       grandTotal,
          parts_used:        validItemsWithPrice,
          notes:             b.hasIssue ? "Issue reported via bulk inspection" : "Routine inspection — All clear",
        }, []);

        updateBulkItem(bulkList.indexOf(b), { done: true });
        success++;
        await new Promise(r => setTimeout(r, 200));
      } catch (err: any) {
        console.error(`Failed for ${b.asset.number}:`, err);
        fail++;
      }
    }
    setBulkSubmitting(false);
    if (success > 0) {
      toast.success(`${success} inspection${success > 1 ? 's' : ''} submitted!`, {
        description: fail > 0 ? `${fail} failed` : undefined,
      });
      const updatedWOs = await fetchWorkOrders(authFetch, user?.role ?? 'mechanic').catch(() => workOrders);
      setWorkOrders(updatedWOs);
      setBulkList([]);
      setBulkActiveIdx(null);
      setActiveTab('history');
    } else {
      toast.error("All submissions failed");
    }
  }

  function canAdvance(): boolean {
    if (step === 0) return !!selectedAsset;
    if (step === 1) return !!technicianName.trim();
    if (step === 2) return hasIssue !== null;
    if (step === 3) return hasIssue ? issueNotes.trim().length > 0 : true;
    if (step === 4) return true;
    return true;
  }

  function advance() {
    if (!canAdvance()) {
      const msgs: Record<number, string> = {
        0: 'Select a trailer or truck first',
        1: 'Inspector name is required',
        2: 'Please indicate if there is an issue',
        3: 'Issue description is required — describe the problem',
      };
      toast.error(msgs[step] ?? '');
      return;
    }
    if (step === 2 && hasIssue === false) { setStep(5); return; }
    setStep(s => Math.min(s + 1, STEPS_CREATE.length - 1));
  }

  function goBack() {
    if (step === 5 && hasIssue === false) { setStep(2); return; }
    setStep(s => Math.max(s - 1, 0));
  }

  async function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).filter(f => {
      if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not an image`); return false; }
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} too large`); return false; }
      return true;
    });
    if (!files.length) return;
    const compressedFiles: File[] = [];
    for (const file of files) {
      const compressed = await compressImage(file);
      compressedFiles.push(compressed);
      const reader = new FileReader();
      reader.onload = (ev) => { setImagePreviews(prev => [...prev, ev.target?.result as string]); };
      reader.readAsDataURL(compressed);
    }
    setImageFiles(prev => [...prev, ...compressedFiles]);
    toast.success(`${compressedFiles.length} photo(s) added`);
    if (e.target) e.target.value = '';
  }

  function removeImage(i: number) {
    setImageFiles(p => p.filter((_, x) => x !== i));
    setImagePreviews(p => p.filter((_, x) => x !== i));
  }

  function addItem() {
    setItems(prev => [...prev, { itemId: '', itemName: '', quantity: 1 }]);
  }
  function removeItem(i: number) { setItems(p => p.filter((_, x) => x !== i)); }
  function updateItem(i: number, field: keyof WorkOrderItem, val: string | number) {
    setItems(p => p.map((it, x) => x === i ? { ...it, [field]: val } : it));
  }

  function getItemPrice(itemName: string): number {
    return inventory.find(i =>
      i.name?.toLowerCase() === itemName?.toLowerCase() ||
      i.partNumber?.toLowerCase() === itemName?.toLowerCase()
    )?.pricePerPart ?? 0;
  }

  function getLineTotal(itemName: string, qty: number): number {
    return getItemPrice(itemName) * qty;
  }

  function calcGrandTotal(): number {
    return items
      .filter(i => i.itemName.trim() && i.quantity > 0)
      .reduce((sum, it) => sum + getLineTotal(it.itemName, it.quantity), 0);
  }

  function resetForm() {
    setSelectedAsset(null); setModalAsset(null); setQuery(''); setHasIssue(null);
    setIssueNotes(''); setPriority('medium');
    setItems([{ itemId: '', itemName: '', quantity: 1 }]);
    setImageFiles([]); setImagePreviews([]); setStep(0);
  }

  // ✅ FIX: closePartPicker - dedicated close function
  function closePartPicker() {
    setPartPickerOpen(false);
    setPartPickerTarget(null);
  }

  // ✅ FIX: handlePartPick - only called when a real part is selected
  function handlePartPick(id: string) {
    if (!partPickerTarget) return;

    const selected = inventory.find(i => i.id === id);
    if (!selected) return;

    const { rowIdx, isBulk, bulkIdx } = partPickerTarget;

    if (isBulk && bulkIdx !== undefined) {
      const b = bulkList[bulkIdx];
      const updated = b.items.map((x, xi) =>
        xi === rowIdx
          ? { ...x, itemId: selected.id, itemName: selected.name }
          : x
      );
      updateBulkItem(bulkIdx, { items: updated });
    } else {
      setItems(prev =>
        prev.map((it, i) =>
          i === rowIdx
            ? { ...it, itemId: selected.id, itemName: selected.name }
            : it
        )
      );
    }

    closePartPicker();
  }

  async function submit() {
    if (!selectedAsset) return;
    setSubmitting(true);
    try {
      const woNumber    = `WO-${Date.now()}`;
      const nowISO      = new Date().toISOString();
      const repairDate  = nowISO.split("T")[0];
      const assetType   = selectedAsset.kind === "truck" ? "truck" : "trailer";
      const finalStatus = hasIssue ? "pending" : "completed";
      const basePayload = {
        work_order_number: woNumber,
        asset_id:          selectedAsset.id,
        asset_number:      selectedAsset.number,
        asset_type:        assetType,
        customer_name:     selectedAsset.customerName || "",
        asset_status:      selectedAsset.status || "",
        vin:               selectedAsset.vin || "",
        plate:             selectedAsset.plate || "",
        repair_date:       repairDate,
        start_time:        nowISO,
      };
      if (!hasIssue) {
        await createWorkOrder(authFetch, {
          ...basePayload,
          vendor:            technicianName.trim() || "Auto-Check",
          issue_description: "Inspection passed — No issues found",
          status:            finalStatus,
          priority:          "low",
          grand_total:       0,
          notes:             "Routine inspection — All systems normal",
        }, []);
        toast.success("Inspection completed!", { description: `${selectedAsset.number} marked as completed` });
      } else {
        const validItems = items.filter(i => i.itemName.trim() && i.quantity > 0);
        const validItemsWithPrice = validItems.map(it => ({
          ...it,
          pricePerPart: getItemPrice(it.itemName),
          lineTotal:    getLineTotal(it.itemName, it.quantity),
        }));
        const grandTotal = calcGrandTotal();
        await createWorkOrder(authFetch, {
          ...basePayload,
          vendor: technicianName2
            ? `${technicianName.trim()} + ${technicianName2.trim()}`
            : technicianName.trim(),
          issue_description: issueNotes.trim(),
          status:            finalStatus,
          priority,
          grand_total:       grandTotal,
          notes:             validItems.length > 0
            ? `Parts used: ${validItems.map(i => `${i.itemName} (×${i.quantity})`).join(", ")}`
            : "Issue reported",
          parts_used: validItemsWithPrice,
        }, imageFiles);
        const invUsage = validItemsWithPrice
          .map(it => {
            const inv = inventory.find(i =>
              i.name === it.itemName || i.partNumber === it.itemName
            );
            return { inventoryId: inv?.id ?? "", inventoryName: it.itemName, quantityUsed: it.quantity, currentQty: inv?.available ?? 0 };
          })
          .filter(x => x.inventoryId !== "");
        if (invUsage.length > 0) {
          toast.loading("Updating inventory…", { id: "inv-update" });
          await subtractInventory(authFetch, invUsage);
          toast.dismiss("inv-update");
          const freshInv = await getInventory(authFetch);
          setInventory(freshInv);
        }
        try {
          const pdfBlob = await generateWorkOrderPDF({
            id:             woNumber,
            woNumber,
            trailerId:      selectedAsset.id,
            trailerNumber:  selectedAsset.number,
            technicianName: technicianName2
              ? `${technicianName.trim()} + ${technicianName2.trim()}`
              : technicianName.trim(),
            date:           repairDate,
            issueNotes:     issueNotes.trim(),
            items:          validItemsWithPrice,
            grandTotal,
            status:         finalStatus,
          });
          downloadPDF(pdfBlob, `WorkOrder-${woNumber}.pdf`);
        } catch (pdfErr) {
          console.warn("PDF generation failed (non-blocking)", pdfErr);
          toast.warning("Work order saved — PDF generation failed");
        }
        toast.success("Work order created!", { description: "Status set to Open for repair" });
      }
      resetForm();
      const refreshed = await fetchWorkOrders(authFetch, user?.role ?? "mechanic").catch(() => workOrders);
      setWorkOrders(refreshed);
      setActiveTab("history");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save work order";
      if (msg.includes('network') || msg.includes('fetch') || msg.includes('timed out')) {
        toast.error("Network error — please check your connection and try again", {
          description: "If on mobile data, try switching to WiFi",
        });
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPDF(wo: AirtableWorkOrder) {
    try {
      if (!wo) { toast.error("Invalid work order data"); return; }
      const { id, createdTime, fields = {} as AirtableWorkOrder['fields'] } = wo;
      const { work_order_number, asset_id, asset_number, vendor, repair_date, issue_description, parts_used, grand_total, status } = fields;
      const displayNumber = asset_number || asset_id || "N/A";
      const pdfBlob = await generateWorkOrderPDF({
        id,
        woNumber:       work_order_number ?? "N/A",
        trailerId:      asset_id ?? "",
        trailerNumber:  displayNumber,
        technicianName: vendor ?? "N/A",
        date:           repair_date ?? createdTime,
        issueNotes:     issue_description ?? "",
        items:          Array.isArray(parts_used) ? parts_used : [],
        grandTotal:     typeof grand_total === 'number' ? grand_total : 0,
        status:         status ?? "completed",
      });
      const safeNumber = work_order_number?.toString().replace(/[^\w\-]/g, "") || "WorkOrder";
      downloadPDF(pdfBlob, `WorkOrder-${safeNumber}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (error) {
      console.error("PDF Generation Error:", error);
      toast.error("Failed to generate PDF");
    }
  }

  const filteredWOs = filterTrailer === 'all'
    ? workOrders
    : workOrders.filter(wo => wo.fields.asset_id === filterTrailer);

  return (
    <>
      <style>{GLOBAL_CSS}</style>

      {/* ✅ FIX: PartPickerModal with separate onPick and onClose props */}
      {partPickerOpen && partPickerTarget && (
        <PartPickerModal
          inventory={inventory}
          selectedId={
            partPickerTarget.isBulk && partPickerTarget.bulkIdx !== undefined
              ? bulkList[partPickerTarget.bulkIdx]?.items[partPickerTarget.rowIdx]?.itemId ?? ''
              : items[partPickerTarget.rowIdx]?.itemId ?? ''
          }
          onPick={handlePartPick}
          onClose={closePartPicker}
        />
      )}

      <div className="wo-root">
        <div className="wo-header">
          <div className="wo-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardList size={18} color="var(--primary-foreground)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', lineHeight: 1.2 }}>{t('workOrders.title')}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
                  {activeTab === 'create' ? `${STEPS_CREATE[step]} · Step ${step + 1} of ${STEPS_CREATE.length}` : activeTab === 'bulk' ? `${bulkList.length} asset${bulkList.length !== 1 ? 's' : ''} queued` : 'All work orders'}
                </div>
              </div>
              <div style={{ display: 'flex', background: 'var(--muted)', borderRadius: 8, padding: 3, gap: 2 }}>
                {(['create', 'history', 'bulk'] as const).map(tab => (
                  <button key={tab} onClick={() => { setActiveTab(tab); if (tab === 'create') resetForm(); }}
                    style={{ padding: '0.35rem 0.7rem', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.72rem', cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize', transition: 'all .15s', background: activeTab === tab ? 'var(--card)' : 'transparent', color: activeTab === tab ? 'var(--foreground)' : 'var(--muted-foreground)', boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {tab === 'create' ? t('workOrders.createNew') : tab === 'history' ? t('workOrders.history') : 'Bulk'}
                  </button>
                ))}
              </div>
            </div>
            {activeTab === 'create' && (
              <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
                {STEPS_CREATE.map((label, i) => {
                  const isActive = i === step, isDone = i < step;
                  return (
                    <div key={i} style={{ flex: 1, paddingBottom: 10, borderBottom: `1.5px solid ${isActive ? 'var(--foreground)' : isDone ? C.accent : 'var(--border)'}`, fontSize: 10, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', color: isActive ? 'var(--foreground)' : isDone ? C.accent : 'var(--muted-foreground)', transition: 'all 0.2s' }}>
                      {label}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="wo-body">
          <div className="wo-body-inner">

            {activeTab === 'bulk' && (
              <div className="wo-fadein">
                <PageTitle title="Bulk Yard Inspection" sub="Inspect multiple assets at once" />
                <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
                  <label style={lbl}>Inspector <span style={{ color: C.accent }}>*</span></label>
                  {user?.role === 'admin' ? (
                    <select value={technicianName} onChange={e => setTechnicianName(e.target.value)} style={inp}>
                      <option value="">Select mechanic…</option>
                      {mechanicOptions.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  ) : (
                    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 14 }}>{user?.name || technicianName || '—'}</div>
                  )}
                </div>
                <div ref={bulkDropRef} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                  <div style={{ padding: 10, position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                    <input value={bulkQuery} onChange={e => { setBulkQuery(e.target.value); setBulkShowDrop(true); }} onFocus={() => setBulkShowDrop(true)} placeholder="Add trailer or truck to queue…" style={{ ...inp, paddingLeft: 34 }} />
                  </div>
                  {bulkShowDrop && bulkSearchResults.length > 0 && (
                    <div style={{ borderTop: '1px solid var(--border)', maxHeight: 220, overflowY: 'auto' }}>
                      {bulkSearchResults.map((r, i) => (
                        <button key={r.id} onMouseDown={() => addBulkAsset(r)} style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: i < bulkSearchResults.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'inherit' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                          <TruckIcon size={13} color={r.isTruck ? C.orange : C.accent} />
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{r.number}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{r.sub}</span>
                          <Plus size={13} style={{ marginLeft: 'auto', color: C.accent }} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {bulkList.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted-foreground)', border: '1.5px dashed var(--border)', borderRadius: 12, fontSize: 13 }}>Search and add assets above to build your inspection queue</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {bulkList.map((b, idx) => (
                      <div key={b.asset.id} style={{ background: 'var(--card)', border: `1.5px solid ${b.done ? C.greenBorder : b.hasIssue === null ? 'var(--border)' : b.hasIssue ? C.redBorder : C.greenBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div onClick={() => setBulkActiveIdx(bulkActiveIdx === idx ? null : idx)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                          <div style={{ width: 32, height: 32, borderRadius: 8, background: b.asset.kind === 'truck' ? 'rgba(234,88,12,0.1)' : C.accentBg, border: `1px solid ${b.asset.kind === 'truck' ? C.orangeBorder : C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <TruckIcon size={14} color={b.asset.kind === 'truck' ? C.orange : C.accent} />
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{b.asset.number}</div>
                            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{b.done ? '✅ Submitted' : b.hasIssue === null ? 'Pending review' : b.hasIssue ? '⚠️ Issue found' : '✅ All clear'}</div>
                          </div>
                          {b.done ? <CheckCircle size={18} color={C.green} /> : b.hasIssue === true ? <XCircle size={18} color={C.red} /> : b.hasIssue === false ? <CheckCircle size={18} color={C.green} /> : null}
                          <button onClick={e => { e.stopPropagation(); removeBulkAsset(idx); }} style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: C.redBg, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={12} /></button>
                        </div>
                        {bulkActiveIdx === idx && !b.done && (
                          <div style={{ borderTop: '1px solid var(--border)', padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div>
                              <label style={lbl}>Issue Found?</label>
                              <div style={{ display: 'flex', gap: 8 }}>
                                {[{ val: false, label: 'No Issues', color: C.green, bg: C.greenBg, border: C.greenBorder }, { val: true, label: 'Has Issue', color: C.red, bg: C.redBg, border: C.redBorder }].map(btn => (
                                  <button key={String(btn.val)} onClick={() => updateBulkItem(idx, { hasIssue: btn.val })} style={{ flex: 1, padding: '0.55rem', borderRadius: 9, border: `2px solid ${b.hasIssue === btn.val ? btn.border : 'var(--border)'}`, background: b.hasIssue === btn.val ? btn.bg : 'transparent', color: b.hasIssue === btn.val ? btn.color : 'var(--muted-foreground)', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>{btn.label}</button>
                                ))}
                              </div>
                            </div>
                            {b.hasIssue && (
                              <>
                                <div>
                                  <label style={lbl}>Priority</label>
                                  <select value={b.priority} onChange={e => updateBulkItem(idx, { priority: e.target.value as any })} style={inp}>
                                    <option value="low">🟢 Low</option><option value="medium">🟡 Medium</option><option value="high">🔴 High</option>
                                  </select>
                                </div>
                                <div>
                                  <label style={lbl}>Issue Notes</label>
                                  <textarea value={b.issueNotes} onChange={e => updateBulkItem(idx, { issueNotes: e.target.value })} placeholder="Describe the issue…" rows={2} style={{ ...inp, resize: 'none' }} />
                                </div>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <label style={{ ...lbl, marginBottom: 0 }}>Parts Used</label>
                                    <button onClick={() => updateBulkItem(idx, { items: [...b.items, { itemId: "", itemName: '', quantity: 1 }] })} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 7, background: C.accent, color: '#fff', border: 'none', fontWeight: 600, fontSize: 11, cursor: 'pointer' }}><Plus size={11} /> Add</button>
                                  </div>
                                  {b.items.map((it, iIdx) => (
                                    <div key={iIdx} style={{ display: 'grid', gridTemplateColumns: '1fr 55px 20px', gap: 5, marginBottom: 5 }}>
                                      <button
                                        onClick={() => {
                                          setPartPickerTarget({ rowIdx: iIdx, isBulk: true, bulkIdx: idx });
                                          setPartPickerOpen(true);
                                        }}
                                        style={{
                                          ...inp,
                                          textAlign: 'left',
                                          cursor: 'pointer',
                                          fontSize: '0.8rem',
                                          padding: '0.4rem 0.5rem',
                                          color: it.itemName ? 'var(--foreground)' : 'var(--muted-foreground)',
                                          fontWeight: it.itemName ? 700 : 400,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 6,
                                        }}
                                      >
                                        {it.itemName ? (
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{it.itemName}</span>
                                        ) : (
                                          <span>Select part…</span>
                                        )}
                                        <ChevronRight size={11} style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--muted-foreground)' }} />
                                      </button>
                                      <input type="number" min="1" value={it.quantity} onChange={e => { const updated = b.items.map((x, xi) => xi === iIdx ? { ...x, quantity: parseInt(e.target.value) || 1 } : x); updateBulkItem(idx, { items: updated }); }} style={{ ...inp, textAlign: 'center', padding: '0.4rem 0.3rem', fontSize: '0.8rem' }} />
                                      {b.items.length > 1 && <button onClick={() => updateBulkItem(idx, { items: b.items.filter((_, xi) => xi !== iIdx) })} style={{ width: 20, height: '100%', borderRadius: 5, border: 'none', background: C.redBg, color: C.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}><X size={11} /></button>}
                                    </div>
                                  ))}
                                </div>
                              </>
                            )}
                            {b.hasIssue !== null && (
                              <button onClick={() => { updateBulkItem(idx, { done: false }); setBulkActiveIdx(null); }} style={{ padding: '9px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Confirm & Close ✓</button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'create' && (
              <>
                {step === 0 && (
                  <div className="wo-fadein">
                    <PageTitle title="Select Asset" sub="Search for a trailer or truck" />
                    <div ref={dropRef} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ padding: 10, position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                        <input value={query} onChange={e => { setQuery(e.target.value); setShowDrop(true); }} onFocus={() => setShowDrop(true)} placeholder="Search trailer or truck…" autoFocus style={{ ...inp, paddingLeft: 34 }} />
                      </div>
                      {showDrop && searchResults.length > 0 && (
                        <div style={{ borderTop: '1px solid var(--border)', maxHeight: 260, overflowY: 'auto' }}>
                          {searchResults.map((r, i) => (
                            <button key={r.id} onMouseDown={() => selectAsset(r)} style={{ width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: i < searchResults.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'inherit' }} onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                              <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: r.isTruck ? 'rgba(234,88,12,0.1)' : C.accentBg, border: `1px solid ${r.isTruck ? C.orangeBorder : C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <TruckIcon size={14} color={r.isTruck ? C.orange : C.accent} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span style={{ fontWeight: 600, fontSize: 14 }}>{r.number}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase', background: r.isTruck ? 'rgba(234,88,12,0.1)' : C.accentBg, color: r.isTruck ? C.orange : C.accent, border: `1px solid ${r.isTruck ? C.orangeBorder : C.accentBorder}` }}>{r.isTruck ? 'Truck' : 'Trailer'}</span>
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sub}</div>
                              </div>
                              <ChevronRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                            </button>
                          ))}
                        </div>
                      )}
                      {loading && <div style={{ padding: '12px 14px', color: 'var(--muted-foreground)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}><Loader2 size={14} className="wo-spin" /> Loading assets…</div>}
                    </div>
                    {modalAsset && (
                      <div className="wo-fadein" style={{ background: 'var(--card)', border: `1.5px solid ${C.accentBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '13px 15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: modalAsset.kind === 'truck' ? 'rgba(234,88,12,0.1)' : C.accentBg, border: `1px solid ${modalAsset.kind === 'truck' ? C.orangeBorder : C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TruckIcon size={15} color={modalAsset.kind === 'truck' ? C.orange : C.accent} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: modalAsset.kind === 'truck' ? C.orange : C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>{modalAsset.kind === 'truck' ? 'Truck' : 'Trailer'} · Selected</div>
                              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--foreground)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{modalAsset.number}</div>
                            </div>
                            <CheckCircle size={19} color={C.accent} style={{ flexShrink: 0 }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
                            {([{ label: 'Status', value: modalAsset.status || '—', hi: (modalAsset.status ?? '').toLowerCase() === 'active' }, { label: 'Make', value: modalAsset.make || '—' }, { label: 'Year', value: String(modalAsset.year || '—') }, { label: 'VIN', value: modalAsset.vin || '—' }, { label: 'Plate', value: modalAsset.plate || 'N/A' }, { label: 'Owner', value: modalAsset.customerName || '—' }] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
                              <div key={label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '7px 9px' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: label === 'VIN' ? 10 : 12, color: hi ? C.green : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: label === 'VIN' ? 'monospace' : 'inherit' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                          <div style={{ background: C.greenBg, border: `1.5px solid ${C.greenBorder}`, borderRadius: 9, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
                            <CheckCircle size={15} color={C.green} style={{ flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Inspection Valid</div>
                              <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>Last: N/A</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => { setModalAsset(null); setQuery(''); }} style={{ flex: 1, padding: '10px', borderRadius: 9, border: '1.5px solid var(--border)', background: 'transparent', color: 'var(--muted-foreground)', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
                            <button onClick={() => { setSelectedAsset(modalAsset); setModalAsset(null); }} style={{ flex: 2, padding: '10px', borderRadius: 9, border: 'none', background: C.accent, color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, boxShadow: `0 4px 14px ${C.accentBorder}` }}><CheckCircle size={14} /> Select Asset</button>
                          </div>
                        </div>
                      </div>
                    )}
                    {selectedAsset && !modalAsset && (
                      <div style={{ background: 'var(--card)', border: `1.5px solid ${C.accentBorder}`, borderRadius: 12, overflow: 'hidden' }}>
                        <div style={{ padding: '13px 15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: selectedAsset.kind === 'truck' ? 'rgba(234,88,12,0.1)' : C.accentBg, border: `1px solid ${selectedAsset.kind === 'truck' ? C.orangeBorder : C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <TruckIcon size={15} color={selectedAsset.kind === 'truck' ? C.orange : C.accent} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: selectedAsset.kind === 'truck' ? C.orange : C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>{selectedAsset.kind === 'truck' ? 'Truck' : 'Trailer'} · Selected</div>
                              <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--foreground)', lineHeight: 1.1 }}>{selectedAsset.number}</div>
                            </div>
                            <CheckCircle size={19} color={C.accent} style={{ flexShrink: 0 }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7 }}>
                            {([{ label: 'Status', value: selectedAsset.status || '—', hi: (selectedAsset.status ?? '').toLowerCase() === 'active' }, { label: 'Make', value: selectedAsset.make || '—' }, { label: 'Year', value: String(selectedAsset.year || '—') }, { label: 'VIN', value: selectedAsset.vin || '—' }, { label: 'Plate', value: selectedAsset.plate || 'N/A' }, { label: 'Owner', value: selectedAsset.customerName || '—' }] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
                              <div key={label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '7px 9px' }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
                                <div style={{ fontWeight: 700, fontSize: label === 'VIN' ? 10 : 12, color: hi ? C.green : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: label === 'VIN' ? 'monospace' : 'inherit' }}>{value}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {step === 1 && (
                  <div className="wo-fadein">
                    <PageTitle title="Inspector Details" sub="Who is performing this inspection?" />
                    {selectedAsset && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginBottom: 14, borderRadius: 10, background: selectedAsset.kind === 'truck' ? 'rgba(234,88,12,0.08)' : C.accentBg, border: `1.5px solid ${selectedAsset.kind === 'truck' ? C.orangeBorder : C.accentBorder}` }}>
                        <TruckIcon size={13} color={selectedAsset.kind === 'truck' ? C.orange : C.accent} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: selectedAsset.kind === 'truck' ? C.orange : C.accent }}>{selectedAsset.number}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>· {selectedAsset.kind === 'truck' ? 'Truck' : 'Trailer'}</span>
                      </div>
                    )}
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <label style={lbl}>{user?.role === 'admin' ? 'Mechanic 1 (Lead)' : 'Your Name'}<span style={{ color: C.accent }}> *</span></label>
                        {user?.role === 'admin' ? (
                          <select value={technicianName} onChange={e => setTechnicianName(e.target.value)} style={{ ...inp }} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = 'var(--border)')}>
                            <option value="">Select lead mechanic…</option>
                            {mechanicOptions.map(name => <option key={name} value={name}>{name}</option>)}
                          </select>
                        ) : (
                          <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--muted)', border: '1px solid var(--border)', fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>{user?.name || technicianName || '—'}</div>
                        )}
                      </div>
                      <div style={{ padding: '14px 16px' }}>
                        <label style={lbl}>{user?.role === 'admin' ? 'Mechanic 2' : 'Partner Mechanic'}<span style={{ fontSize: '0.65rem', color: 'var(--muted-foreground)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span></label>
                        <select value={technicianName2} onChange={e => setTechnicianName2(e.target.value)} style={{ ...inp }} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = 'var(--border)')}>
                          <option value="">None (solo inspection)</option>
                          {mechanicOptions.filter(name => name !== technicianName).map(name => <option key={name} value={name}>{name}</option>)}
                        </select>
                        {technicianName2 && (
                          <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBorder}`, fontSize: 12, color: C.accent, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                            👥 Team Inspection: {technicianName || user?.name} + {technicianName2}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="wo-fadein">
                    <PageTitle title="Inspect Asset" sub={`Checking: ${selectedAsset?.number}`} />
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '2rem 1.5rem', textAlign: 'center' }}>
                      <div style={{ width: 64, height: 64, borderRadius: '50%', background: C.yellowBg, border: `2px solid ${C.yellowBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem' }}><AlertTriangle size={28} color={C.yellow} /></div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--foreground)', margin: '0 0 0.4rem' }}>Did you find any issues?</h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--muted-foreground)', margin: '0 0 1.75rem' }}>Check all parts and systems carefully</p>
                      <div style={{ display: 'flex', gap: '0.875rem', justifyContent: 'center' }}>
                        {[{ val: true, label: 'Yes, Found Issues', icon: <XCircle size={16} />, bg: C.redBg, border: C.redBorder, color: C.red, hoverBg: C.red }, { val: false, label: 'No, All Good', icon: <CheckCircle size={16} />, bg: C.greenBg, border: C.greenBorder, color: C.green, hoverBg: C.green }].map(btn => (
                          <button key={String(btn.val)} onClick={() => { setHasIssue(btn.val); if (!btn.val) setStep(5); else setStep(3); }} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0.75rem 1.25rem', borderRadius: 10, background: hasIssue === btn.val ? btn.hoverBg : btn.bg, border: `2px solid ${btn.border}`, color: hasIssue === btn.val ? '#fff' : btn.color, fontWeight: 700, fontSize: '0.875rem', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                            {submitting && !btn.val ? <Loader2 size={16} className="wo-spin" /> : btn.icon}{btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="wo-fadein">
                    <PageTitle title="Issue Photos" sub="Optional — document the problem" />
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                        <label style={lbl}>Issue Priority <span style={{ color: C.accent }}>*</span></label>
                        <select value={priority} onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')} style={inp} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = 'var(--border)')}>
                          <option value="low">🟢 Low — Can wait</option><option value="medium">🟡 Medium — Should fix soon</option><option value="high">🔴 High — Urgent fix needed</option>
                        </select>
                      </div>
                      <div style={{ background: 'var(--card)', border: `1.5px solid ${issueNotes.trim() === '' ? C.redBorder : 'var(--border)'}`, borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                        <label style={lbl}>
                          Issue Description <span style={{ color: C.red }}>*</span>
                          {issueNotes.trim() === '' && (
                            <span style={{ marginLeft: 6, fontSize: '0.65rem', color: C.red, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>— Required</span>
                          )}
                        </label>
                        <textarea value={issueNotes} onChange={e => setIssueNotes(e.target.value)} placeholder="Describe the issue in detail…" rows={3} style={{ ...inp, resize: 'none', lineHeight: 1.6, borderColor: issueNotes.trim() === '' ? C.redBorder : 'var(--border)' }} onFocus={e => (e.target.style.borderColor = C.accent)} onBlur={e => (e.target.style.borderColor = issueNotes.trim() === '' ? C.redBorder : 'var(--border)')} />
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={addImages} style={{ display: 'none' }} />
                      {imagePreviews.length === 0 ? (
                        <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', border: `1.5px dashed var(--border)`, borderRadius: 12, background: 'var(--card)', padding: '1.5rem 1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, fontFamily: 'inherit' }}>
                          <div style={{ width: 48, height: 48, borderRadius: '50%', background: C.accentBg, border: `2px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Camera size={22} color={C.accent} /></div>
                          <div style={{ fontWeight: 700, color: C.accent, fontSize: 14 }}>Add Photos</div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>Optional — tap to take or select</div>
                        </button>
                      ) : (
                        <div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8, marginBottom: 8 }}>
                            {imagePreviews.map((src, i) => (
                              <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)', aspectRatio: '1', background: 'var(--muted)' }}>
                                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                                <button onClick={() => removeImage(i)} style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><X size={11} /></button>
                              </div>
                            ))}
                            <button onClick={() => fileInputRef.current?.click()} style={{ aspectRatio: '1', borderRadius: 8, border: `1.5px dashed var(--border)`, background: 'var(--card)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer', color: 'var(--muted-foreground)', fontFamily: 'inherit' }}><Camera size={18} /><span style={{ fontSize: 11, fontWeight: 500 }}>Add</span></button>
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center' }}>{imagePreviews.length} photo{imagePreviews.length !== 1 ? 's' : ''} attached</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="wo-fadein">
                    <PageTitle title="Parts Used" sub="Select parts from inventory" />
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={lbl}>Parts / Inventory Used</span>
                        <button onClick={addItem} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '0.35rem 0.75rem', borderRadius: 8, background: C.accent, color: '#fff', border: 'none', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', fontFamily: 'inherit' }}>
                          <Plus size={13} /> Add Part
                        </button>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 24px', gap: 6, padding: '8px 14px 4px', alignItems: 'center' }}>
                        <span style={{ ...lbl, marginBottom: 0, fontSize: '0.65rem' }}>Part Name</span>
                        <span style={{ ...lbl, marginBottom: 0, fontSize: '0.65rem', textAlign: 'center' }}>Qty</span>
                        <span style={{ ...lbl, marginBottom: 0, fontSize: '0.65rem', textAlign: 'right' }}>Line Total</span>
                        <span />
                      </div>
                      <div style={{ padding: '4px 14px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {items.map((item, idx) => {
                          const price = getItemPrice(item.itemName);
                          const lineTotal = getLineTotal(item.itemName, item.quantity);
                          const matchedInv = inventory.find(i => i.name === item.itemName);
                          // ✅ FIX: read photo from mapped field
                          const matchedPhoto = (matchedInv as any)?.photo || '';
                          return (
                            <div key={idx}>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px 80px 24px', gap: 6, alignItems: 'center' }}>
                                <button
                                  onClick={() => {
                                    setPartPickerTarget({ rowIdx: idx, isBulk: false });
                                    setPartPickerOpen(true);
                                  }}
                                  style={{
                                    ...inp,
                                    textAlign: 'left',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '0.5rem 0.6rem',
                                    color: item.itemName ? 'var(--foreground)' : 'var(--muted-foreground)',
                                    fontWeight: item.itemName ? 700 : 400,
                                  }}
                                >
                                  {item.itemName ? (
                                    <>
                                      {/* ✅ FIX: use matchedPhoto instead of (matchedInv as any).photo */}
                                      {matchedPhoto ? (
                                        <img
                                          src={matchedPhoto}
                                          alt=""
                                          style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }}
                                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <span style={{ fontSize: 16, flexShrink: 0 }}>🔩</span>
                                      )}
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, fontSize: '0.875rem' }}>
                                        {item.itemName}
                                      </span>
                                    </>
                                  ) : (
                                    <span style={{ fontSize: '0.875rem' }}>Select part…</span>
                                  )}
                                  <ChevronRight size={13} style={{ marginLeft: 'auto', color: 'var(--muted-foreground)', flexShrink: 0 }} />
                                </button>

                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={e => updateItem(idx, 'quantity', parseInt(e.target.value) || 1)}
                                  placeholder="Qty"
                                  style={{ ...inp, textAlign: 'center', padding: '0.6rem 0.3rem' }}
                                  onFocus={e => (e.target.style.borderColor = C.accent)}
                                  onBlur={e => (e.target.style.borderColor = 'var(--border)')}
                                />

                                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: item.itemName ? C.accent : 'var(--muted-foreground)' }}>
                                  {item.itemName ? `$${lineTotal.toFixed(2)}` : '—'}
                                </div>

                                {items.length > 1 ? (
                                  <button
                                    onClick={() => removeItem(idx)}
                                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: C.redBg, color: C.red, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, padding: 0 }}
                                  >
                                    <X size={12} />
                                  </button>
                                ) : <span />}
                              </div>

                              {item.itemName && price > 0 && (
                                <div style={{ marginTop: 3, marginLeft: 2, fontSize: 11, color: 'var(--muted-foreground)' }}>
                                  Unit price: <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>${price.toFixed(2)}</span>
                                  {matchedInv && (
                                    <span style={{ marginLeft: 8, color: matchedInv.available <= 3 ? C.yellow : 'var(--muted-foreground)' }}>
                                      · {matchedInv.available} in stock
                                    </span>
                                  )}
                                  {matchedInv?.partNumber && (
                                    <span style={{ marginLeft: 8, fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                                      · #{matchedInv.partNumber}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {items.some(i => i.itemName.trim()) && (
                        <div style={{ borderTop: '1.5px solid var(--border)', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: C.accentBg }}>
                          <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--foreground)' }}>Grand Total</span>
                          <span style={{ fontWeight: 800, fontSize: 18, color: C.accent }}>${calcGrandTotal().toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {step === 5 && (
                  <div className="wo-fadein">
                    <PageTitle title="Review & Submit" sub="Verify details before submitting" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[{ count: hasIssue ? items.filter(i => i.itemName.trim()).length : 0, label: 'Parts', bg: C.accentBg, border: C.accentBorder, color: C.accent }, { count: imagePreviews.length, label: 'Photos', bg: 'var(--muted)', border: 'var(--border)', color: C.grey }, { count: hasIssue ? 1 : 0, label: 'Issues', bg: hasIssue ? C.redBg : C.greenBg, border: hasIssue ? C.redBorder : C.greenBorder, color: hasIssue ? C.red : C.green }].map(({ count, label, bg, border, color }) => (
                        <div key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      {([[ selectedAsset?.kind === 'truck' ? 'Truck' : 'Trailer', selectedAsset?.number ?? ''], ['Inspector', technicianName], ['Date', new Date().toLocaleDateString()], ...(hasIssue ? [['Priority', priority], ['Description', issueNotes]] : []), ['Status', hasIssue ? 'Issues Found' : 'Passed']] as [string, string][]).map(([k, v], i, arr) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500, flexShrink: 0 }}>{k}</span>
                          <span style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 13, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                    {hasIssue && items.some(i => i.itemName.trim()) && (
                      <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}><span style={{ ...lbl, marginBottom: 0 }}>Parts Breakdown</span></div>
                        {items.filter(i => i.itemName.trim()).map((item, idx) => {
                          const price = getItemPrice(item.itemName);
                          const lineTotal = getLineTotal(item.itemName, item.quantity);
                          return (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 14px', borderBottom: '1px solid var(--border)', gap: 10 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.itemName}</div>
                                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{item.quantity} × ${price.toFixed(2)}</div>
                              </div>
                              <span style={{ fontWeight: 700, fontSize: 14, color: C.accent, flexShrink: 0 }}>${lineTotal.toFixed(2)}</span>
                            </div>
                          );
                        })}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: C.accentBg }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)' }}>Grand Total</span>
                          <span style={{ fontWeight: 800, fontSize: 20, color: C.accent }}>${calcGrandTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    <div style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: hasIssue ? C.redBg : C.greenBg, border: `2px solid ${hasIssue ? C.redBorder : C.greenBorder}` }}>
                      {hasIssue ? <XCircle size={20} color={C.red} style={{ flexShrink: 0 }} /> : <CheckCircle size={20} color={C.green} style={{ flexShrink: 0 }} />}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: hasIssue ? C.red : C.green }}>{hasIssue ? 'Issues Found' : 'All Clear — No Issues'}</div>
                        <div style={{ fontSize: 12, marginTop: 2, color: hasIssue ? '#b91c1c' : '#15803d' }}>Will be marked {hasIssue ? 'FAILED' : 'PASSED'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeTab === "history" && (
              <div className="wo-fadein">
                <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "10px 12px", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                  <Filter size={14} style={{ color: "var(--muted-foreground)" }} />
                  <select value={filterTrailer} onChange={(e) => setFilterTrailer(e.target.value)} style={{ ...inp, padding: "0.4rem 0.6rem" }}>
                    <option value="all">All Assets</option>
                    {trailers.map((t) => <option key={t.id} value={t.id}>{t.number} (Trailer)</option>)}
                    {trucks.map((t) => <option key={t.id} value={t.id}>{t.number} (Truck)</option>)}
                  </select>
                </div>
                {filteredWOs.length === 0 ? (
                  <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: "3rem 1rem", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>No work orders found</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {filteredWOs.map((wo) => {
                      const fields = wo.fields ?? {};
                      const start = fields.start_time;
                      const end = fields.end_time;
                      const status = fields.status;
                      let duration = 0;
                      if (start) {
                        const startTime = new Date(start).getTime();
                        const endTime = status === "completed" && end ? new Date(end).getTime() : now;
                        duration = Math.floor((endTime - startTime) / 1000);
                      }
                      const displayAsset = fields.asset_number || fields.asset_id || "N/A";
                      return (
                        <div key={wo.id} style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "14px 16px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{fields.work_order_number ?? "N/A"}</div>
                              <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2 }}>{displayAsset}</div>
                              {start && <div style={{ fontSize: 12, fontWeight: 600, marginTop: 6, color: status === "completed" ? "#16a34a" : duration > 86400 ? "#dc2626" : "#2563eb" }}>⏱ {formatDuration(duration)}</div>}
                            </div>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <PriorityBadge p={fields.priority} />
                              <StatusBadge s={status} />
                            </div>
                          </div>
                          {fields.issue_description && <div style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 8 }}>{fields.issue_description}</div>}
                          {(fields.grand_total ?? 0) > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBorder}`, width: 'fit-content' }}>
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted-foreground)' }}>Parts Total:</span>
                              <span style={{ fontSize: 14, fontWeight: 800, color: C.accent }}>${Number(fields.grand_total).toFixed(2)}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                              {fields.repair_date ? new Date(fields.repair_date).toLocaleDateString() : ""}
                              {fields.vendor ? ` · ${fields.vendor}` : ""}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {status !== "completed" && (
                                <button onClick={async () => { try { await updateWorkOrderStatus(authFetch, wo.id, "completed"); toast.success("Work order marked as completed"); setWorkOrders(prev => prev.map(item => item.id === wo.id ? { ...item, fields: { ...item.fields, status: "completed", end_time: new Date().toISOString() } } : item)); } catch (err: any) { toast.error(err.message || "Failed to update status"); } }} style={{ background: "#16a34a20", border: "1px solid #16a34a40", color: "#16a34a", fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "5px 10px", borderRadius: 8 }}>✓ Complete</button>
                              )}
                              <button onClick={() => handleDownloadPDF(wo)} style={{ display: "flex", alignItems: "center", gap: 5, background: C.accentBg, border: `1px solid ${C.accentBorder}`, color: C.accent, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "5px 10px", borderRadius: 8 }}><Download size={12} /> PDF</button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {activeTab === 'create' && (
          <div className="wo-footer">
            <div className="wo-footer-inner">
              {step > 0 ? <button onClick={goBack} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 18px', minHeight: 46, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}><ChevronLeft size={15} /> Back</button> : <div />}
              {step === 4 && items.some(i => i.itemName.trim()) && <div style={{ fontSize: 13, fontWeight: 700, color: C.accent, textAlign: 'center' }}>Total: ${calcGrandTotal().toFixed(2)}</div>}
              {step < STEPS_CREATE.length - 1 ? (
                step !== 2 ? <button onClick={advance} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 22px', minHeight: 46, borderRadius: 10, border: 'none', background: !canAdvance() ? 'var(--muted)' : C.accent, color: !canAdvance() ? 'var(--muted-foreground)' : '#fff', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: !canAdvance() ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: canAdvance() ? `0 4px 14px ${C.accentBorder}` : 'none', touchAction: 'manipulation' }}>Continue <ChevronRight size={15} /></button> : <div />
              ) : (
                <button onClick={submit} disabled={submitting} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', minHeight: 46, borderRadius: 10, border: 'none', background: submitting ? 'var(--muted)' : hasIssue ? C.red : C.green, color: submitting ? 'var(--muted-foreground)' : '#fff', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting ? 'none' : `0 4px 14px ${hasIssue ? C.redBorder : C.greenBorder}`, touchAction: 'manipulation' }}>
                  {submitting ? <><Loader2 size={14} className="wo-spin" /> Saving…</> : hasIssue ? <><XCircle size={14} /> Submit Work Order</> : <><Zap size={14} /> Submit — All Clear</>}
                </button>
              )}
            </div>
          </div>
        )}

        {activeTab === 'bulk' && bulkList.length > 0 && (
          <div className="wo-footer">
            <div className="wo-footer-inner">
              <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>{bulkList.filter(b => b.hasIssue !== null).length} / {bulkList.length} reviewed</div>
              <button onClick={submitBulkInspections} disabled={bulkSubmitting || bulkList.some(b => b.hasIssue === null)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', minHeight: 46, borderRadius: 10, border: 'none', background: bulkSubmitting || bulkList.some(b => b.hasIssue === null) ? 'var(--muted)' : C.accent, color: bulkSubmitting || bulkList.some(b => b.hasIssue === null) ? 'var(--muted-foreground)' : '#fff', fontWeight: 700, fontSize: 13, cursor: bulkSubmitting || bulkList.some(b => b.hasIssue === null) ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {bulkSubmitting ? <><Loader2 size={14} className="wo-spin" /> Submitting…</> : <><Zap size={14} /> Submit {bulkList.length} Inspection{bulkList.length !== 1 ? 's' : ''}</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}