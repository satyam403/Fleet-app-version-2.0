import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Package, Search, Plus, Save, Loader2, AlertTriangle,
  Mail, FileText, Check, X, Boxes,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";
import {
  sendInventoryReportEmail,
  isEmailConfigured,
  INVENTORY_REPORT_RECIPIENT,
} from "../services/inventoryEmail";
import type { InventoryUpdateLogRow } from "../services/pdf";

const LOW_STOCK = 10;

// Shape returned by GET /users/getInventoryManage
interface InvItem {
  id: string;
  partName: string;
  partNumber: string;
  description: string;
  type: string;
  manufacturer: string;
  quantity: number;
  used: number;
  available: number;
  pricePerPart: number;
  shelfLocation: string;
  lastModifiedBy: string;
  lastModified: string;
}

export function InventoryManagement() {
  const { t } = useTranslation();
  const { authFetch } = useAuth();

  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [emailing, setEmailing] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(apiUrl("/users/getInventoryManage"));
      if (!res.ok) throw new Error("Failed");
      const json = await res.json().catch(() => ({} as any));
      setItems(Array.isArray(json?.data) ? json.data : []);
    } catch (e) {
      console.error(e);
      toast.error(t("inventory.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [authFetch, t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(it =>
      [it.partName, it.partNumber, it.description, it.manufacturer, it.shelfLocation, it.type]
        .some(v => (v || "").toLowerCase().includes(q))
    );
  }, [items, query]);

  const stats = useMemo(() => {
    const total = items.length;
    const low = items.filter(i => i.quantity > 0 && i.quantity < LOW_STOCK).length;
    const out = items.filter(i => i.quantity === 0).length;
    const units = items.reduce((s, i) => s + (i.quantity || 0), 0);
    return { total, low, out, units };
  }, [items]);

  const patchItem = (id: string, patch: Partial<InvItem>) =>
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));

  async function handleSaveQty(item: InvItem, newQty: number, note: string) {
    const res = await authFetch(apiUrl("/users/setInventoryQuantity"), {
      method: "PATCH",
      body: JSON.stringify({ id: item.id, quantity: newQty, note }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j?.message || "Update failed");
    }
    const j = await res.json().catch(() => ({} as any));
    const updated: InvItem = j?.data ?? { ...item, quantity: newQty };
    patchItem(item.id, updated);
  }

  async function handleEmailReport() {
    if (!isEmailConfigured()) {
      toast.error(t("inventory.manage.emailNotConfigured"));
      return;
    }
    try {
      setEmailing(true);
      const res = await authFetch(apiUrl("/users/getInventoryUpdateLog"));
      const json = await res.json().catch(() => ({} as any));
      const logs: InventoryUpdateLogRow[] = Array.isArray(json?.data) ? json.data : [];
      await sendInventoryReportEmail(logs, "All Time");
      toast.success(t("inventory.manage.emailSent", { email: INVENTORY_REPORT_RECIPIENT }));
    } catch (e) {
      console.error(e);
      toast.error(t("inventory.manage.emailFailed"));
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="im-root">
      <Style />

      {/* ── Header ── */}
      <div className="im-head">
        <div>
          <h1 className="im-title"><Boxes size={24} /> {t("inventory.manage.title")}</h1>
          <p className="im-sub">{t("inventory.manage.subtitle")}</p>
        </div>
        <div className="im-head-actions">
          <button className="im-btn im-btn-ghost" onClick={handleEmailReport} disabled={emailing}>
            {emailing ? <Loader2 size={16} className="im-spin" /> : <Mail size={16} />}
            {t("inventory.manage.emailReport")}
          </button>
          <Link to="/reports" className="im-btn im-btn-ghost">
            <FileText size={16} /> {t("inventory.manage.viewReport")}
          </Link>
          <button className="im-btn im-btn-primary" onClick={() => setShowAdd(s => !s)}>
            {showAdd ? <X size={16} /> : <Plus size={16} />}
            {showAdd ? t("inventory.addForm.cancel") : t("inventory.manage.addItem")}
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="im-stats">
        <StatCard label={t("inventory.manage.totalItems")} value={stats.total} color="#1e40af" />
        <StatCard label={t("inventory.manage.totalUnits")} value={stats.units} color="#0f766e" />
        <StatCard label={t("inventory.lowStock")} value={stats.low} color="#b45309" />
        <StatCard label={t("inventory.outOfStock")} value={stats.out} color="#b91c1c" />
      </div>

      {/* ── Add form ── */}
      {showAdd && (
        <AddItemForm
          onClose={() => setShowAdd(false)}
          onAdded={(it) => { setItems(prev => [it, ...prev]); setShowAdd(false); }}
        />
      )}

      {/* ── Search ── */}
      <div className="im-search">
        <Search size={18} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t("inventory.manage.searchPlaceholder")}
        />
        {query && <button className="im-clear" onClick={() => setQuery("")}><X size={16} /></button>}
      </div>

      {/* ── List ── */}
      {loading ? (
        <div className="im-grid">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="im-skeleton" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="im-empty">
          <Package size={48} strokeWidth={1.3} />
          <p>{query ? t("inventory.manage.noResults") : t("inventory.noItems")}</p>
        </div>
      ) : (
        <div className="im-grid">
          {filtered.map(item => (
            <ItemRow key={item.id} item={item} onSave={handleSaveQty} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────── */

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="im-stat" style={{ borderTopColor: color }}>
      <div className="im-stat-val" style={{ color }}>{value}</div>
      <div className="im-stat-lbl">{label}</div>
    </div>
  );
}

function ItemRow({
  item,
  onSave,
}: {
  item: InvItem;
  onSave: (item: InvItem, qty: number, note: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [qty, setQty] = useState<string>(String(item.quantity));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => { setQty(String(item.quantity)); }, [item.quantity]);

  const parsed = Number(qty);
  const valid = qty.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const dirty = valid && parsed !== item.quantity;

  const status =
    item.quantity === 0 ? "out" :
    item.quantity < LOW_STOCK ? "low" : "ok";

  async function save() {
    if (!dirty || saving) return;
    try {
      setSaving(true);
      await onSave(item, parsed, note.trim());
      setNote("");
      setJustSaved(true);
      toast.success(t("inventory.manage.saved", { name: item.partName || item.partNumber }));
      setTimeout(() => setJustSaved(false), 1800);
    } catch (e) {
      console.error(e);
      toast.error(t("inventory.manage.updateFailed"));
      setQty(String(item.quantity));
    } finally {
      setSaving(false);
    }
  }

  const step = (d: number) => {
    const next = Math.max(0, (Number.isFinite(parsed) ? parsed : item.quantity) + d);
    setQty(String(next));
  };

  return (
    <div className={`im-card ${status}`}>
      <div className="im-card-top">
        <div className="im-card-icon"><Package size={18} /></div>
        <div className="im-card-id">
          <h3>{item.partName || item.partNumber || "—"}</h3>
          {item.partNumber && item.partName && item.partNumber !== item.partName && (
            <span className="im-pno">{item.partNumber}</span>
          )}
          <div className="im-meta">
            {item.shelfLocation && <span>📍 {item.shelfLocation}</span>}
            {item.manufacturer && <span>🏭 {item.manufacturer}</span>}
          </div>
        </div>
        {status !== "ok" && (
          <span className={`im-badge ${status}`}>
            <AlertTriangle size={12} />
            {status === "out" ? t("inventory.outOfStock") : t("inventory.lowStock")}
          </span>
        )}
      </div>

      <div className="im-qty-block">
        <label className="im-qty-label">{t("inventory.manage.setQty")}</label>
        <div className="im-stepper">
          <button type="button" onClick={() => step(-1)} aria-label="-">−</button>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={qty}
            onChange={e => setQty(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); }}
          />
          <button type="button" onClick={() => step(1)} aria-label="+">+</button>
        </div>
        <button
          className={`im-save ${justSaved ? "ok" : ""}`}
          onClick={save}
          disabled={!dirty || saving}
        >
          {saving ? <Loader2 size={15} className="im-spin" /> : justSaved ? <Check size={15} /> : <Save size={15} />}
          {justSaved ? t("inventory.manage.savedShort") : t("inventory.manage.save")}
        </button>
      </div>

      {dirty && (
        <input
          className="im-note"
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={t("inventory.manage.notePlaceholder")}
        />
      )}

      {item.lastModifiedBy && (
        <div className="im-foot">
          {t("inventory.manage.lastBy")}: <strong>{item.lastModifiedBy}</strong>
          {item.lastModified && ` · ${new Date(item.lastModified).toLocaleDateString()}`}
        </div>
      )}
    </div>
  );
}

function AddItemForm({
  onAdded,
  onClose,
}: {
  onAdded: (item: InvItem) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { authFetch } = useAuth();
  const [form, setForm] = useState({
    partName: "", description: "", manufacturer: "", type: "",
    shelfLocation: "", pricePerPart: "", quantity: "0",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.partName.trim()) { toast.error(t("inventory.manage.nameRequired")); return; }
    const qty = Math.max(0, Number(form.quantity) || 0);
    try {
      setSaving(true);
      const res = await authFetch(apiUrl("/users/addInventoryItem"), {
        method: "POST",
        body: JSON.stringify({
          partName: form.partName.trim(),
          description: form.description.trim(),
          manufacturer: form.manufacturer.trim(),
          type: form.type.trim(),
          shelfLocation: form.shelfLocation.trim(),
          pricePerPart: Number(form.pricePerPart) || 0,
          quantity: qty,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.message || "Add failed");
      }
      const j = await res.json().catch(() => ({} as any));
      toast.success(t("inventory.addForm.success"));
      onAdded(j?.data as InvItem);
    } catch (e) {
      console.error(e);
      toast.error(t("inventory.manage.addFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="im-add" onSubmit={submit}>
      <div className="im-add-head">
        <strong>{t("inventory.addForm.title")}</strong>
        <button type="button" className="im-clear" onClick={onClose}><X size={16} /></button>
      </div>
      <div className="im-add-grid">
        <Field label={t("inventory.itemName")} required value={form.partName} onChange={set("partName")} placeholder={t("inventory.addForm.itemPlaceholder")} />
        <Field label={t("inventory.manage.manufacturer")} value={form.manufacturer} onChange={set("manufacturer")} />
        <Field label={t("inventory.manage.type")} value={form.type} onChange={set("type")} />
        <Field label={t("inventory.manage.shelf")} value={form.shelfLocation} onChange={set("shelfLocation")} />
        <Field label={t("inventory.manage.price")} type="number" value={form.pricePerPart} onChange={set("pricePerPart")} />
        <Field label={t("inventory.addForm.quantity")} type="number" value={form.quantity} onChange={set("quantity")} />
        <Field label={t("inventory.addForm.notes")} value={form.description} onChange={set("description")} placeholder={t("inventory.addForm.notesPlaceholder")} full />
      </div>
      <div className="im-add-actions">
        <button type="button" className="im-btn im-btn-ghost" onClick={onClose}>{t("inventory.addForm.cancel")}</button>
        <button type="submit" className="im-btn im-btn-primary" disabled={saving}>
          {saving ? <Loader2 size={16} className="im-spin" /> : <Plus size={16} />}
          {t("inventory.addForm.submit")}
        </button>
      </div>
    </form>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", required, full,
}: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean; full?: boolean;
}) {
  return (
    <label className={`im-field ${full ? "full" : ""}`}>
      <span>{label}{required && <em> *</em>}</span>
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} min={type === "number" ? 0 : undefined} />
    </label>
  );
}

function Style() {
  return (
    <style>{`
      .im-root { max-width: 1200px; margin: 0 auto; padding: 20px 14px 80px; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif; color: var(--foreground, #1d1d1f); }
      .im-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; margin-bottom: 18px; }
      .im-title { font-size: 26px; font-weight: 800; letter-spacing: -0.5px; display: flex; align-items: center; gap: 10px; margin: 0; }
      .im-sub { color: #6e6e73; font-size: 13px; margin: 4px 0 0; }
      .im-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
      .im-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; border: 1px solid transparent; text-decoration: none; transition: .15s; }
      .im-btn-primary { background: #1e40af; color: #fff; }
      .im-btn-primary:hover { background: #1b399b; }
      .im-btn-ghost { background: var(--card, #fff); color: #1d1d1f; border-color: var(--border, rgba(0,0,0,.1)); }
      .im-btn-ghost:hover { background: #f5f5f7; }
      .im-btn:disabled { opacity: .6; cursor: not-allowed; }

      .im-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 18px; }
      .im-stat { background: var(--card, #fff); border: 1px solid var(--border, rgba(0,0,0,.06)); border-top: 3px solid #1e40af; border-radius: 12px; padding: 14px 16px; }
      .im-stat-val { font-size: 26px; font-weight: 800; line-height: 1; }
      .im-stat-lbl { font-size: 11px; color: #6e6e73; text-transform: uppercase; letter-spacing: .04em; margin-top: 6px; font-weight: 600; }

      .im-search { display: flex; align-items: center; gap: 10px; background: var(--card, #fff); border: 1px solid var(--border, rgba(0,0,0,.1)); border-radius: 12px; padding: 0 14px; margin-bottom: 18px; color: #6e6e73; }
      .im-search input { flex: 1; border: none; outline: none; background: transparent; padding: 13px 0; font-size: 15px; color: inherit; }
      .im-clear { background: none; border: none; cursor: pointer; color: #6e6e73; display: inline-flex; padding: 4px; border-radius: 6px; }
      .im-clear:hover { background: #f0f0f2; }

      .im-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 14px; }
      .im-card { background: var(--card, #fff); border: 1px solid var(--border, rgba(0,0,0,.07)); border-radius: 16px; padding: 16px; box-shadow: 0 2px 12px rgba(0,0,0,.04); display: flex; flex-direction: column; gap: 12px; }
      .im-card.low { border-left: 3px solid #f59e0b; }
      .im-card.out { border-left: 3px solid #ef4444; }
      .im-card-top { display: flex; gap: 12px; align-items: flex-start; }
      .im-card-icon { background: #f0f4ff; color: #1e40af; padding: 9px; border-radius: 10px; flex-shrink: 0; display: flex; }
      .im-card-id { flex: 1; min-width: 0; }
      .im-card-id h3 { margin: 0; font-size: 15px; font-weight: 700; line-height: 1.25; word-break: break-word; }
      .im-pno { font-size: 12px; color: #6e6e73; font-family: 'IBM Plex Mono', monospace; }
      .im-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 5px; font-size: 11px; color: #86868b; }
      .im-badge { display: inline-flex; align-items: center; gap: 3px; font-size: 10px; font-weight: 700; padding: 3px 7px; border-radius: 20px; height: fit-content; white-space: nowrap; }
      .im-badge.low { background: #fffbeb; color: #b45309; }
      .im-badge.out { background: #fef2f2; color: #b91c1c; }

      .im-qty-block { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; background: #f8fafc; border-radius: 12px; padding: 10px; }
      .im-qty-label { font-size: 11px; font-weight: 700; color: #6e6e73; text-transform: uppercase; letter-spacing: .04em; width: 100%; }
      .im-stepper { display: flex; align-items: center; border: 1px solid var(--border, rgba(0,0,0,.12)); border-radius: 10px; overflow: hidden; background: #fff; }
      .im-stepper button { width: 34px; height: 38px; border: none; background: #fff; font-size: 19px; cursor: pointer; color: #1e40af; font-weight: 700; }
      .im-stepper button:hover { background: #eff6ff; }
      .im-stepper input { width: 64px; height: 38px; border: none; border-left: 1px solid #eee; border-right: 1px solid #eee; text-align: center; font-size: 16px; font-weight: 700; outline: none; -moz-appearance: textfield; }
      .im-stepper input::-webkit-outer-spin-button, .im-stepper input::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
      .im-save { flex: 1; min-width: 96px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; border: none; border-radius: 10px; background: #1e40af; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; }
      .im-save:hover:not(:disabled) { background: #1b399b; }
      .im-save:disabled { background: #c7c7cc; cursor: not-allowed; }
      .im-save.ok { background: #15803d; }

      .im-note { width: 100%; border: 1px solid var(--border, rgba(0,0,0,.12)); border-radius: 10px; padding: 9px 11px; font-size: 13px; outline: none; }
      .im-note:focus { border-color: #1e40af; }
      .im-foot { font-size: 11px; color: #86868b; border-top: 1px solid rgba(0,0,0,.05); padding-top: 9px; }

      .im-add { background: var(--card, #fff); border: 1px solid var(--border, rgba(0,0,0,.1)); border-radius: 16px; padding: 16px; margin-bottom: 18px; box-shadow: 0 4px 20px rgba(0,0,0,.06); }
      .im-add-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; font-size: 15px; }
      .im-add-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
      .im-field { display: flex; flex-direction: column; gap: 5px; font-size: 12px; }
      .im-field.full { grid-column: 1 / -1; }
      .im-field span { font-weight: 600; color: #6e6e73; }
      .im-field em { color: #ef4444; font-style: normal; }
      .im-field input { border: 1px solid var(--border, rgba(0,0,0,.14)); border-radius: 10px; padding: 10px 12px; font-size: 14px; outline: none; }
      .im-field input:focus { border-color: #1e40af; }
      .im-add-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

      .im-empty { background: var(--card, #fff); border: 1px dashed var(--border, rgba(0,0,0,.14)); border-radius: 16px; padding: 60px 20px; text-align: center; color: #86868b; }
      .im-empty p { margin-top: 12px; }
      .im-skeleton { height: 200px; background: #e9e9ee; border-radius: 16px; animation: im-pulse 1.2s infinite ease-in-out; }
      @keyframes im-pulse { 0%,100% { opacity: 1; } 50% { opacity: .45; } }
      .im-spin { animation: im-spin 0.8s linear infinite; }
      @keyframes im-spin { to { transform: rotate(360deg); } }
    `}</style>
  );
}
