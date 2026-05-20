import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import {
  Camera, Upload, ScanLine, X, Check, Plus, Minus,
  Loader2, CheckCircle2, Edit3, Package, PenLine, AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext'; // ✅ import
import { apiUrl } from "../config";

/* ══════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════ */
interface InventoryItem {
  id: string;
  name: string;
  available: number;
}

interface ScannedItem {
  name: string;
  quantity: number;
  checked: boolean;
}

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;
/* ══════════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════════ */
const BACKEND_OCR  = apiUrl("/users/scanBill");
const BACKEND_SAVE = apiUrl("/users/create-purchase-order");
const BACKEND_INV  = apiUrl("/users/getInventory");

/* ══════════════════════════════════════════════
   FETCH HELPERS — sab authFetch parameter se lenge
   Hooks yahan nahi — sirf component ke andar
══════════════════════════════════════════════ */

async function fetchInventory(authFetch: AuthFetch): Promise<InventoryItem[]> {
  const res = await authFetch(BACKEND_INV);
  if (!res.ok) throw new Error('Failed to fetch inventory');
  const result = await res.json();
  return result.data.map((r: any) => ({
    id: r.id || r._id,
    name: r.partName || r.name || r.fields?.['Part Name'] || '',
    available: Number(r.quantity ?? r.available ?? r.fields?.['Quantity'] ?? 0),
  }));
}

async function scanBill(authFetch: AuthFetch, file: File): Promise<any> {
  const form = new FormData();
  form.append('bill', file);

  // ✅ Content-Type intentionally set nahi — browser FormData boundary khud set karega
  const res = await authFetch(BACKEND_OCR, {
    method: 'POST',
    headers: {}, // empty — authFetch ka default 'application/json' override karo
    body: form,
  });

  if (!res.ok) throw new Error(`Server error ${res.status}`);
  return res.json();
}

// ✅ Replace your existing savePurchaseOrder function with this:

async function savePurchaseOrder(
  authFetch: AuthFetch,
  items: { name: string; quantity: number }[],
  file: File | null,                          // ✅ file parameter add kiya
  extras: {
    vendorName?: string;
    invoiceNumber?: string;
    invoiceDate?: string;
    subtotal?: number;
    tax?: number;
    grandTotal?: number;
    notes?: string;
  } = {}
): Promise<any> {

  const form = new FormData();

  // ✅ File attach karo — same field name "bill" jo multer expect karta hai
  if (file) {
    form.append("bill", file);
  }

  // ✅ Items as JSON string
  form.append("items", JSON.stringify(items));

  // ✅ Optional extra fields
  if (extras.vendorName)    form.append("vendorName",    extras.vendorName);
  if (extras.invoiceNumber) form.append("invoiceNumber", extras.invoiceNumber);
  if (extras.invoiceDate)   form.append("invoiceDate",   extras.invoiceDate);
  if (extras.subtotal)      form.append("subtotal",      String(extras.subtotal));
  if (extras.tax)           form.append("tax",           String(extras.tax));
  if (extras.grandTotal)    form.append("grandTotal",    String(extras.grandTotal));
  if (extras.notes)         form.append("notes",         extras.notes);

  const res = await authFetch(BACKEND_SAVE, {
    method: "POST",
    headers: {},        // ✅ Content-Type mat set karo — browser FormData boundary khud set karega
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: `Server error ${res.status}` }));
    throw new Error(err.message);
  }

  return res.json();
}
/* ══════════════════════════════════════════════
   CSS
══════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&family=Geist+Mono:wght@400;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .po-root {
    font-family: 'Geist', sans-serif; background: #f7f7f7;
    min-height: 100vh; color: #0a0a0a;
    display: flex; flex-direction: column; align-items: center;
    padding: 24px 16px 60px;
  }
  .po-card {
    background: #fff; border: 1.5px solid #e5e5e5;
    border-radius: 18px; padding: 22px; width: 100%; max-width: 520px;
  }
  .po-title { font-size: 22px; font-weight: 800; color: #0a0a0a; letter-spacing: -0.02em; margin: 0 0 4px; }
  .po-sub   { font-size: 13px; color: #999; margin: 0 0 22px; }
  .po-sec {
    font-size: 11px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: #aaa;
    margin-bottom: 12px; display: flex; align-items: center; gap: 7px;
  }

  .po-scan-row { display: flex; gap: 10px; margin-bottom: 8px; }
  .po-scan-btn {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 13px 10px; border-radius: 13px;
    border: 1.5px solid #e5e5e5; background: #fafafa;
    font-size: 14px; font-weight: 600; font-family: 'Geist', sans-serif;
    cursor: pointer; color: #555; transition: all 0.15s;
  }
  .po-scan-btn:hover { border-color: #000; background: #000; color: #fff; }
  .po-scan-btn-black { background: #000; color: #fff; border-color: #000; }
  .po-scan-btn-black:hover { background: #222; }

  .po-manual-btn {
    width: 100%; display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 13px 10px; border-radius: 13px;
    border: 1.5px dashed #d0d0d0; background: transparent;
    font-size: 14px; font-weight: 600; font-family: 'Geist', sans-serif;
    cursor: pointer; color: #888; transition: all 0.15s; margin-top: 10px;
  }
  .po-manual-btn:hover { border-color: #000; color: #000; border-style: solid; }

  .po-err {
    background: #fffbf0; border: 1.5px solid #fde68a;
    border-radius: 13px; padding: 16px;
    display: flex; flex-direction: column; gap: 12px;
  }
  .po-err-top { display: flex; align-items: flex-start; gap: 10px; }
  .po-err-ic {
    width: 36px; height: 36px; border-radius: 9px; background: #fef3c7;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px;
  }
  .po-err-title { font-size: 14px; font-weight: 700; color: #92400e; margin: 0 0 3px; }
  .po-err-msg   { font-size: 12px; color: #b45309; margin: 0; line-height: 1.5; }
  .po-err-btns  { display: flex; gap: 8px; }
  .po-err-btn {
    flex: 1; padding: 10px; border-radius: 10px; font-size: 13px;
    font-weight: 700; font-family: 'Geist', sans-serif; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.15s;
  }
  .po-err-retry  { background: #fff; border: 1.5px solid #fde68a; color: #92400e; }
  .po-err-retry:hover  { background: #fef3c7; }
  .po-err-manual { background: #000; border: 1.5px solid #000; color: #fff; }
  .po-err-manual:hover { background: #222; }

  .po-scanning {
    border: 1.5px solid #e5e5e5; border-radius: 13px;
    padding: 28px 16px; background: #fafafa;
    display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center;
  }
  .po-pulse {
    width: 52px; height: 52px; border-radius: 50%; background: #000;
    display: flex; align-items: center; justify-content: center;
    animation: po-pulse 1.5s ease-in-out infinite;
  }
  @keyframes po-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(0,0,0,.25); }
    50%     { box-shadow: 0 0 0 16px rgba(0,0,0,0); }
  }

  .po-item {
    display: flex; align-items: flex-start; gap: 10px;
    padding: 11px 13px; border: 1.5px solid #ebebeb;
    border-radius: 11px; margin-bottom: 8px; background: #fafafa;
    transition: all 0.15s; position: relative;
  }
  .po-item.unchecked { opacity: 0.38; }
  .po-check {
    width: 22px; height: 22px; border-radius: 6px; border: 1.5px solid #d5d5d5; background: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; transition: all 0.15s; flex-shrink: 0; margin-top: 2px;
  }
  .po-check.on { background: #000; border-color: #000; }

  .po-name-wrap { flex: 1; min-width: 0; position: relative; }
  .po-name-input {
    width: 100%; border: none; background: transparent;
    font-family: 'Geist', sans-serif; font-size: 14px;
    font-weight: 500; color: #0a0a0a; outline: none;
    padding: 2px 4px; border-radius: 5px; transition: background 0.15s;
  }
  .po-name-input:focus { background: #f0f0f0; }

  .po-suggest {
    position: absolute; top: calc(100% + 6px); left: -13px; right: -60px;
    background: #fff; border: 1.5px solid #e0e0e0;
    border-radius: 13px; box-shadow: 0 8px 28px rgba(0,0,0,.12);
    z-index: 9999; overflow: hidden; max-height: 220px; overflow-y: auto;
  }
  .po-sug-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 10px 13px; cursor: pointer; font-size: 13px;
    font-family: 'Geist', sans-serif; transition: background .1s;
    border-bottom: 1px solid #f5f5f5; gap: 8px;
  }
  .po-sug-item:last-child { border-bottom: none; }
  .po-sug-item:hover, .po-sug-item.hi { background: #f5f5f5; }
  .po-sug-name { font-weight: 600; color: #0a0a0a; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .po-sug-name em { font-style: normal; background: #fef9c3; border-radius: 2px; padding: 0 1px; }
  .po-sug-qty { font-size: 11px; font-weight: 700; color: #2e7d32; background: #e8f5e9; padding: 2px 7px; border-radius: 99px; white-space: nowrap; flex-shrink: 0; }
  .po-sug-empty { padding: 11px 13px; font-size: 13px; color: #aaa; font-family: 'Geist', sans-serif; }

  .po-qty-wrap { display: flex; align-items: center; gap: 5px; flex-shrink: 0; margin-top: 1px; }
  .po-qty-btn {
    width: 26px; height: 26px; border-radius: 7px; border: 1.5px solid #e5e5e5; background: #fff;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: #0a0a0a; transition: all 0.15s;
  }
  .po-qty-btn:hover { background: #000; color: #fff; border-color: #000; }

  .po-badge-inv { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: #e8f5e9; color: #2e7d32; white-space: nowrap; }
  .po-badge-new { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 99px; background: #fff3e0; color: #e65100; white-space: nowrap; }

  .po-add-row {
    width: 100%; padding: 9px; border: 1.5px dashed #e0e0e0;
    border-radius: 9px; background: transparent; color: #bbb;
    font-size: 13px; font-family: 'Geist', sans-serif;
    cursor: pointer; display: flex; align-items: center;
    justify-content: center; gap: 5px; transition: all 0.15s; margin-top: 4px;
  }
  .po-add-row:hover { border-color: #000; color: #000; }

  .po-save-btn {
    width: 100%; padding: 15px; border-radius: 13px; border: none;
    background: #000; color: #fff; font-size: 15px; font-weight: 800;
    font-family: 'Geist', sans-serif; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: all 0.15s; margin-top: 14px; letter-spacing: 0.01em;
  }
  .po-save-btn:hover:not(:disabled) { background: #222; transform: translateY(-1px); box-shadow: 0 6px 20px rgba(0,0,0,.18); }
  .po-save-btn:disabled { background: #e5e5e5; color: #aaa; cursor: not-allowed; transform: none; box-shadow: none; }

  .po-success {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    flex-direction: column; text-align: center; padding: 32px;
    background: #fff; font-family: 'Geist', sans-serif;
  }
  .po-success-icon {
    width: 72px; height: 72px; border-radius: 50%; background: #f5f5f5; border: 2px solid #e5e5e5;
    display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;
  }
  .po-divider { height: 1px; background: #f0f0f0; margin: 18px 0; }

  @keyframes po-fadein { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
  .po-fadein { animation: po-fadein 0.22s ease both; }
  @keyframes po-spin { to { transform: rotate(360deg); } }
  .po-spin { animation: po-spin 1s linear infinite; }
`;

/* ══════════════════════════════════════════════
   ITEM ROW
══════════════════════════════════════════════ */
function ItemRow({
  item, idx, inventory, onToggle, onName, onQty, onQtyDirect, onRemove,
}: {
  item: ScannedItem; idx: number; inventory: InventoryItem[];
  onToggle: () => void; onName: (v: string) => void;
  onQty: (d: number) => void; onQtyDirect: (v: number) => void; onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [hi,   setHi]   = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const q = item.name.trim().toLowerCase();
  const suggestions = q.length === 0
    ? inventory.slice(0, 8)
    : inventory.filter(inv => inv.name.toLowerCase().includes(q)).slice(0, 8);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function pick(inv: InventoryItem) { onName(inv.name); setOpen(false); setHi(-1); }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) { if (e.key === 'ArrowDown') { setOpen(true); setHi(0); e.preventDefault(); } return; }
    if      (e.key === 'ArrowDown')                            { setHi(p => Math.min(p+1, suggestions.length-1)); e.preventDefault(); }
    else if (e.key === 'ArrowUp')                              { setHi(p => Math.max(p-1, 0)); e.preventDefault(); }
    else if (e.key === 'Enter' && hi >= 0 && suggestions[hi]) { pick(suggestions[hi]); e.preventDefault(); }
    else if (e.key === 'Escape')                               { setOpen(false); }
  }

  function hl(text: string): React.ReactNode {
    if (!q) return text;
    const i = text.toLowerCase().indexOf(q);
    if (i === -1) return text;
    return <>{text.slice(0, i)}<em>{text.slice(i, i + q.length)}</em>{text.slice(i + q.length)}</>;
  }

  const exact   = inventory.find(inv => inv.name.toLowerCase() === item.name.trim().toLowerCase());
  const partial = !exact && inventory.find(inv => {
    const n = inv.name.toLowerCase(), v = item.name.trim().toLowerCase();
    return n.includes(v) || v.includes(n);
  });
  const match = exact || partial;

  return (
    <div className={`po-item ${item.checked ? '' : 'unchecked'}`}>
      <button className={`po-check ${item.checked ? 'on' : ''}`} onClick={onToggle}>
        {item.checked && <Check size={12} color="#fff" />}
      </button>

      <div className="po-name-wrap" ref={wrap}>
        <input
          className="po-name-input"
          value={item.name}
          placeholder="Type to search inventory…"
          autoFocus={idx === 0 && item.name === ''}
          onChange={e => { onName(e.target.value); setOpen(true); setHi(-1); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
        />
        <div style={{ marginTop: 3 }}>
          {match
            ? <span className="po-badge-inv">✓ In stock · qty {match.available}</span>
            : item.name.trim() ? <span className="po-badge-new">+ New item</span> : null}
        </div>
        {open && (
          <div className="po-suggest">
            {suggestions.length === 0
              ? <div className="po-sug-empty">No match — will be added as new item</div>
              : suggestions.map((inv, si) => (
                <div key={inv.id} className={`po-sug-item${hi===si?' hi':''}`}
                  onMouseDown={() => pick(inv)} onMouseEnter={() => setHi(si)}>
                  <span className="po-sug-name">{hl(inv.name)}</span>
                  <span className="po-sug-qty">qty {inv.available}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="po-qty-wrap">
        <button className="po-qty-btn" onClick={() => onQty(-1)}><Minus size={10} /></button>
        <input
          type="number" min="1" value={item.quantity}
          onChange={e => onQtyDirect(parseInt(e.target.value) || 1)}
          style={{ width:40, border:'1.5px solid #e5e5e5', borderRadius:6, padding:'3px 4px', fontFamily:'Geist Mono,monospace', fontWeight:600, fontSize:13, textAlign:'center', outline:'none', background:'#fff', color:'#0a0a0a' }}
        />
        <button className="po-qty-btn" onClick={() => onQty(+1)}><Plus size={10} /></button>
      </div>

      <button
        onClick={onRemove}
        style={{ background:'none', border:'none', cursor:'pointer', color:'#ccc', padding:4, borderRadius:6, display:'flex', alignItems:'center', flexShrink:0, transition:'color 0.15s', marginTop:1 }}
        onMouseEnter={e => (e.currentTarget.style.color='#000')}
        onMouseLeave={e => (e.currentTarget.style.color='#ccc')}
      >
        <X size={13} />
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export function PurchaseOrder() {
  const { authFetch } = useAuth(); // ✅ hook sirf yahan — component ke andar

  const [inventory,  setInventory]  = useState<InventoryItem[]>([]);
  const [scanning,   setScanning]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [imgPreview, setImgPreview] = useState<string | null>(null);
  const [items,      setItems]      = useState<ScannedItem[] | null>(null);
  const [scanError,  setScanError]  = useState<string | null>(null);
  const [lastFile,   setLastFile]   = useState<File | null>(null);

  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  // ✅ authFetch dependency mein
  const loadInventory = useCallback(async () => {
    try { setInventory(await fetchInventory(authFetch)); }
    catch { toast.error('Failed to load inventory'); }
  }, [authFetch]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  function findMatch(name: string): InventoryItem | undefined {
    const n = name.toLowerCase();
    return inventory.find(inv => {
      const i = inv.name.toLowerCase();
      return i === n || i.includes(n) || n.includes(i);
    });
  }

  /* ── scan ── */
async function handleFile(file: File) {
    if (file.size > 15 * 1024 * 1024) { toast.error('File too large (max 15MB)'); return; }

    setLastFile(file);
    setScanError(null);
    setItems(null);

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setImgPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setImgPreview(null);
    }

    setScanning(true);
    try {
      const data = await scanBill(authFetch, file);

      const extracted: ScannedItem[] = (data.items ?? [])
        .filter((i: { name?: string }) => i.name?.trim())
        .map((i: { name: string; quantity?: number }) => ({
          name: i.name.trim(),
          quantity: Math.max(1, Number(i.quantity) || 1),
          checked: true,
        }));

      if (extracted.length === 0) {
        // ✅ AI ne kuch extract nahi kiya — silently open manual mode
        toast.info('Could not read bill — add items manually');
        setItems([{ name: '', quantity: 1, checked: true }]);
        return;
      }

      setItems(extracted);

    } catch (err: unknown) {
      // ✅ Network/server error — bhi silently manual mode open karo
      toast.info('Scan failed — add items manually');
      setItems([{ name: '', quantity: 1, checked: true }]);
    } finally {
      setScanning(false);
    }
  }

  function startManual() {
    setScanError(null);
    setImgPreview(null);
    setItems([{ name: '', quantity: 1, checked: true }]);
  }

  function retryScan() {
    setScanError(null);
    if (lastFile) handleFile(lastFile);
    else cameraRef.current?.click();
  }

  /* item helpers */
  function toggleCheck(i: number)        { setItems(p => p!.map((it,x) => x===i ? {...it, checked:!it.checked} : it)); }
  function setName(i: number, v: string) { setItems(p => p!.map((it,x) => x===i ? {...it, name:v} : it)); }
  function setQty(i: number, d: number)  { setItems(p => p!.map((it,x) => x===i ? {...it, quantity:Math.max(1,it.quantity+d)} : it)); }
  function setQtyD(i: number, v: number) { setItems(p => p!.map((it,x) => x===i ? {...it, quantity:Math.max(1,v)} : it)); }
  function addRow()                      { setItems(p => [...(p ?? []), { name:'', quantity:1, checked:true }]); }
  function removeRow(i: number)          { setItems(p => p!.filter((_,x) => x!==i)); }

  /* ── save ── */
 // ✅ Replace your existing handleSave function with this:

async function handleSave() {
  if (selected.length === 0) return;
  setSaving(true);
  try {
    const data = await savePurchaseOrder(
      authFetch,
      selected.map(i => ({ name: i.name.trim(), quantity: i.quantity })),
      lastFile,   // ✅ file pass karo — req.file ab controller mein milega
    );

    if (data.inventory) {
      const { updated = [], created = [], failed = [] } = data.inventory;
      if (failed.length > 0) {
        toast.warning(`Saved with issues — ${failed.length} item(s) failed`);
      } else {
        toast.success(`Done! ${updated.length} updated · ${created.length} new`);
      }
    } else {
      toast.success('Saved to inventory!');
    }

    setSubmitted(true);
  } catch (err: unknown) {
    toast.error(err instanceof Error ? err.message : 'Save failed');
  } finally {
    setSaving(false);
  }
}

  function reset() {
    setItems(null);
    setImgPreview(null);
    setSubmitted(false);
    setScanError(null);
    setLastFile(null);
  }

  const selected = items?.filter(i => i.checked && i.name.trim()) ?? [];

  /* ── SUCCESS ── */
  if (submitted) return (
    <>
      <style>{CSS}</style>
      <div className="po-success">
        <div className="po-success-icon"><CheckCircle2 size={32} color="#000" /></div>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#aaa', marginBottom:8 }}>Done</div>
        <h2 style={{ fontSize:24, fontWeight:800, color:'#0a0a0a', margin:'0 0 8px', letterSpacing:'-0.02em' }}>Saved to Inventory</h2>
        <p style={{ color:'#999', fontSize:14, marginBottom:24, maxWidth:260 }}>Items have been added / updated in Airtable.</p>
        <button onClick={reset} style={{ padding:'12px 28px', borderRadius:12, border:'1.5px solid #e5e5e5', background:'#fff', fontFamily:'Geist,sans-serif', fontWeight:700, fontSize:14, cursor:'pointer' }}>
          Scan Another
        </button>
      </div>
    </>
  );

  /* ── MAIN ── */
  return (
    <>
      <style>{CSS}</style>

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display:'none' }}
        onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); e.target.value=''; }} />
      <input ref={uploadRef} type="file" accept="image/*,.pdf" style={{ display:'none' }}
        onChange={e => { const f=e.target.files?.[0]; if(f) handleFile(f); e.target.value=''; }} />

      <div className="po-root">

        {/* Header */}
        <div style={{ width:'100%', maxWidth:520, marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
            <div style={{ width:34, height:34, background:'#000', borderRadius:9, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Package size={16} color="#fff" />
            </div>
            <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.1em', textTransform:'uppercase', color:'#aaa' }}>Inventory</span>
          </div>
          <h1 className="po-title">Add Stock</h1>
          <p className="po-sub">Scan a bill or add manually — saves directly to Airtable</p>
        </div>

        {/* ── SCAN CARD ── */}
        <div className="po-card" style={{ marginBottom:14 }}>
          <div className="po-sec"><ScanLine size={12} /> Scan Bill</div>

          {scanning ? (
            <div className="po-scanning po-fadein">
              <div className="po-pulse"><ScanLine size={22} color="#fff" /></div>
              <div style={{ fontWeight:700, fontSize:14 }}>Scanning…</div>
              <div style={{ fontSize:12, color:'#aaa' }}>AI is reading items & quantities</div>
            </div>

          ) : scanError ? (
            <div className="po-err po-fadein">
              <div className="po-err-top">
                <div className="po-err-ic">
                  <AlertTriangle size={17} color="#f59e0b" />
                </div>
                <div>
                  <p className="po-err-title">Scan Failed</p>
                  <p className="po-err-msg">{scanError}</p>
                </div>
              </div>
              <div className="po-err-btns">
                <button className="po-err-btn po-err-retry" onClick={retryScan}>
                  <ScanLine size={13} /> Try Again
                </button>
                <button className="po-err-btn po-err-manual" onClick={startManual}>
                  <PenLine size={13} /> Add Manually
                </button>
              </div>
            </div>

          ) : items === null ? (
            <>
              <div className="po-scan-row">
                <button className="po-scan-btn po-scan-btn-black" onClick={() => cameraRef.current?.click()}>
                  <Camera size={15} /> Take Photo
                </button>
                <button className="po-scan-btn" onClick={() => uploadRef.current?.click()}>
                  <Upload size={14} /> Upload Bill
                </button>
              </div>
              <div style={{ textAlign:'center', fontSize:12, color:'#ccc', marginTop:4 }}>Photo or PDF · max 15MB</div>
            </>

          ) : (
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="po-scan-btn" style={{ flex:'none', padding:'9px 14px', fontSize:13 }} onClick={() => cameraRef.current?.click()}>
                <Camera size={13} /> Retake
              </button>
              <button className="po-scan-btn" style={{ flex:'none', padding:'9px 14px', fontSize:13 }} onClick={() => uploadRef.current?.click()}>
                <Upload size={13} /> Re-upload
              </button>
            </div>
          )}
        </div>

        {/* ── REVIEW CARD ── */}
        {items !== null && (
          <div className="po-card po-fadein">
            {imgPreview && (
              <img src={imgPreview} alt="Scanned"
                style={{ width:'100%', maxHeight:130, objectFit:'cover', borderRadius:10, marginBottom:14, border:'1px solid #ebebeb' }} />
            )}

            <div className="po-sec">
              <Edit3 size={12} /> Review Items
              <span style={{ fontWeight:400, textTransform:'none', letterSpacing:0, fontSize:11, color:'#ccc' }}>
                type to search · pick or add new
              </span>
            </div>

            {items.map((item, idx) => (
              <ItemRow
                key={idx} item={item} idx={idx} inventory={inventory}
                onToggle={() => toggleCheck(idx)}
                onName={v => setName(idx, v)}
                onQty={d => setQty(idx, d)}
                onQtyDirect={v => setQtyD(idx, v)}
                onRemove={() => removeRow(idx)}
              />
            ))}

            <button className="po-add-row" onClick={addRow}>
              <Plus size={12} /> Add row manually
            </button>

            <div className="po-divider" />

            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
              <span style={{ fontSize:13, color:'#888' }}>
                {selected.length} item{selected.length !== 1 ? 's' : ''} selected
              </span>
              <span style={{ fontSize:12, color:'#bbb' }}>
                {selected.filter(i => findMatch(i.name)).length} update · {selected.filter(i => !findMatch(i.name)).length} new
              </span>
            </div>

            <button className="po-save-btn" onClick={handleSave} disabled={saving || selected.length === 0}>
              {saving
                ? <><Loader2 size={15} className="po-spin" /> Saving…</>
                : <><CheckCircle2 size={15} /> Save {selected.length} Item{selected.length !== 1 ? 's' : ''} to Inventory</>
              }
            </button>
          </div>
        )}
      </div>
    </>
  );
}
