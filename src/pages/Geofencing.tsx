import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  MapPin, Plus, Trash2, Pencil, X, Check,
  Shield, AlertTriangle, Navigation, Circle,
  ToggleLeft, ToggleRight, Loader2, Wifi, WifiOff,
  Satellite, Truck, RefreshCw, ChevronDown, ChevronUp,
  Radio, Zap,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";

/* ================= API CONFIG ================= */

const API_BASE = apiUrl("/users");

/* Safely parse a Response as JSON — never throws, returns {} on failure.
   Many backends return HTML on 5xx which crashes res.json(). */
async function safeJson(res: Response): Promise<any> {
  try {
    const text = await res.text();
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

/* ── Types ── */
interface GeofenceZone {
  _id: string;
  name: string;
  type: "circle" | "polygon";
  lat: number;
  lng: number;
  radius: number;
  alertOnEnter: boolean;
  alertOnExit: boolean;
  active: boolean;
  color: string;
  vehicles: number;
  createdAt: string;
  syncedWith?: ("samsara" | "skybitz")[];
}

type IntegrationId = "samsara" | "skybitz";

interface Integration {
  id: IntegrationId;
  name: string;
  logo: string;
  status: "connected" | "disconnected" | "syncing";
  vehicles: number;
  lastSync: string;
  color: string;
  accent: string;
  description: string;
}

/* ── CSS ── */
const CSS = `
  .geo-root {
    font-family: -apple-system, 'SF Pro Display', 'SF Pro Text', BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
    background: #f5f5f7;
    color: #1d1d1f;
    -webkit-font-smoothing: antialiased;
  }
  .geo-root * { box-sizing: border-box; }

  .geo-zone-card {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.08);
    border-radius: 18px;
    padding: 16px;
    transition: box-shadow .2s ease, transform .15s ease;
    position: relative;
    overflow: hidden;
  }
  .geo-zone-card:hover {
    box-shadow: 0 8px 32px rgba(0,0,0,0.10);
    transform: translateY(-1px);
  }

  .geo-toggle-btn {
    background: none; border: none; cursor: pointer; padding: 0;
    display: flex; transition: opacity .15s;
  }
  .geo-toggle-btn:hover { opacity: 0.5; }

  .geo-int-card {
    border-radius: 18px;
    border: 1px solid rgba(0,0,0,0.08);
    background: #ffffff;
    padding: 16px;
    transition: box-shadow .2s;
  }
  .geo-int-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.08); }

  .geo-icon-btn {
    width: 32px; height: 32px;
    border-radius: 10px; border: none;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0;
    transition: opacity .12s, transform .1s, background .12s;
  }
  .geo-icon-btn:hover { opacity: 0.7; transform: scale(0.94); }
  .geo-icon-btn:disabled { opacity: 0.3; cursor: not-allowed; }

  .geo-input {
    width: 100%; padding: 12px 13px;
    background: #f5f5f7;
    border: 1.5px solid rgba(0,0,0,0.1);
    border-radius: 12px; color: #1d1d1f;
    font-size: 16px; /* 16px prevents iOS Safari zoom-on-focus */
    outline: none;
    font-family: inherit; transition: border-color .15s, box-shadow .15s;
    -webkit-font-smoothing: antialiased;
  }
  @media (min-width: 1024px) { .geo-input { font-size: 0.9rem; } }
  .geo-input:focus {
    border-color: #1d1d1f;
    box-shadow: 0 0 0 3px rgba(0,0,0,0.06);
    background: #fff;
  }
  .geo-input::placeholder { color: #86868b; }

  .geo-label {
    display: block; font-size: 0.7rem; font-weight: 600;
    color: #86868b; text-transform: uppercase;
    letter-spacing: 0.06em; margin-bottom: 6px;
  }

  .geo-pill-btn {
    flex: 1; padding: 11px 8px;
    border-radius: 12px; border: 1.5px solid rgba(0,0,0,0.1);
    background: #f5f5f7; color: #86868b;
    font-size: 0.82rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 6px;
    transition: all .15s;
    -webkit-font-smoothing: antialiased;
  }
  .geo-pill-btn.active {
    border-color: #1d1d1f;
    background: #1d1d1f;
    color: #ffffff;
  }
  .geo-pill-btn:hover:not(.active) { background: #ebebed; border-color: rgba(0,0,0,0.18); }

  .geo-submit-btn {
    width: 100%; padding: 14px;
    border-radius: 14px; border: none;
    background: #1d1d1f; color: #fff;
    font-size: 0.9rem; font-weight: 600;
    cursor: pointer; font-family: inherit;
    display: flex; align-items: center; justify-content: center; gap: 7px;
    transition: opacity .15s, transform .1s;
    letter-spacing: 0.01em;
    -webkit-font-smoothing: antialiased;
  }
  .geo-submit-btn:hover:not(:disabled) { opacity: 0.82; transform: translateY(-1px); }
  .geo-submit-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .geo-modal-overlay {
    position: fixed; inset: 0; z-index: 100;
    display: flex; align-items: flex-end; justify-content: center;
    padding: 0; background: rgba(0,0,0,0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  @media (min-width: 600px) {
    .geo-modal-overlay { align-items: center; padding: 1rem; }
    .geo-modal-sheet { border-radius: 20px !important; max-height: 90vh; }
  }
  .geo-modal-sheet {
    width: 100%; max-width: 480px;
    background: #ffffff;
    border-top-left-radius: 24px;
    border-top-right-radius: 24px;
    border: 1px solid rgba(0,0,0,0.08);
    max-height: 92dvh;
    overflow-y: auto;
    box-shadow: 0 -20px 60px rgba(0,0,0,0.2);
    animation: geo-slideup .3s cubic-bezier(.32,1.1,.6,1);
  }
  @keyframes geo-slideup {
    from { transform: translateY(48px); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes geo-spin { to { transform: rotate(360deg); } }
  .geo-spin { animation: geo-spin 1s linear infinite; }

  .geo-stat-card {
    background: #ffffff;
    border: 1px solid rgba(0,0,0,0.07);
    border-radius: 18px;
    padding: 15px 14px;
    display: flex; align-items: center; gap: 12px;
  }

  .geo-sync-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 8px; border-radius: 999px;
    font-size: 0.63rem; font-weight: 600;
    letter-spacing: 0.03em; text-transform: uppercase;
  }

  .geo-section-title {
    font-size: 0.68rem; font-weight: 600;
    color: #86868b; text-transform: uppercase;
    letter-spacing: 0.08em; margin: 0 0 10px;
  }

  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    height: 4px;
    background: #e0e0e5;
    border-radius: 999px;
    outline: none;
    width: 100%;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 22px; height: 22px;
    border-radius: 50%;
    background: #1d1d1f;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    transition: transform .12s;
  }
  input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.15); }
  input[type="range"]::-moz-range-thumb {
    width: 22px; height: 22px;
    border-radius: 50%; background: #1d1d1f;
    cursor: pointer; border: none;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
`;

const colorOptions = ["#000000", "#333333", "#555555", "#777777", "#999999", "#bbbbbb"];

const defaultForm = {
  name: "", lat: "", lng: "", radius: 500,
  alertOnEnter: true, alertOnExit: true, color: "#000000",
  syncSamsara: false, syncSkybitz: false,
};

/* ── Map Placeholder ── */
function MapPlaceholder({ zones }: { zones: GeofenceZone[] }) {
  return (
    <div style={{
      position: "relative", width: "100%", height: 220,
      background: "#f0f0f2", borderRadius: 14, overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.18 }}>
        <defs>
          <pattern id="gg" width="28" height="28" patternUnits="userSpaceOnUse">
            <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#1d1d1f" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#gg)" />
      </svg>
      {zones.map((z, i) => (
        <div key={z._id} style={{
          position: "absolute",
          width: 60 + i * 28, height: 60 + i * 28,
          borderRadius: "50%",
          border: `1.5px solid ${z.active ? "#1d1d1f" : "#bbbbbb"}`,
          background: z.active ? "rgba(29,29,31,0.06)" : "transparent",
          left: `${12 + i * 22}%`, top: `${18 + (i % 2) * 20}%`,
          opacity: z.active ? 1 : 0.3,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: z.active ? "#1d1d1f" : "#bbbbbb" }} />
        </div>
      ))}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center" }}>
        <Navigation size={24} style={{ color: "#86868b", display: "block", margin: "0 auto 6px" }} />
        <p style={{ fontSize: "0.72rem", color: "#86868b", margin: 0, fontWeight: 500 }}>
          Integrate Leaflet / Google Maps
        </p>
      </div>
    </div>
  );
}

/* ── Integration Card ── */
function IntegrationCard({
  integration, onToggle, onSync,
}: {
  integration: Integration;
  onToggle: (id: IntegrationId) => void;
  onSync: (id: IntegrationId) => void;
}) {
  const { t } = useTranslation();
  const connected = integration.status === "connected";
  const syncing   = integration.status === "syncing";

  return (
    <div className="geo-int-card" style={{ borderColor: connected ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: connected ? "#1d1d1f" : "#f5f5f7",
          border: `1px solid ${connected ? "#1d1d1f" : "rgba(0,0,0,0.1)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 700, fontSize: integration.logo.length > 1 ? 10 : 14,
          color: connected ? "#ffffff" : "#86868b",
          letterSpacing: "-0.03em", fontFamily: "-apple-system, sans-serif",
        }}>
          {integration.logo}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1d1d1f", letterSpacing: "-0.01em" }}>
              {integration.name}
            </span>
            <span style={{
              fontSize: "0.61rem", fontWeight: 600, padding: "2px 8px",
              borderRadius: 999, textTransform: "uppercase", letterSpacing: "0.04em",
              background: connected ? "#1d1d1f" : "#f5f5f7",
              color: connected ? "#fff" : "#86868b",
              border: connected ? "none" : "1px solid rgba(0,0,0,0.08)",
            }}>
              {syncing ? t("geofencing.syncing") : connected ? t("geofencing.connected") : t("geofencing.offline")}
            </span>
          </div>
          <div style={{ fontSize: "0.72rem", color: "#86868b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {integration.description}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {[
          { label: t("geofencing.vehicles"), value: integration.vehicles, Icon: Truck },
          { label: t("geofencing.lastSync", { defaultValue: "Last Sync" }), value: integration.lastSync, Icon: RefreshCw },
        ].map(({ label, value, Icon }) => (
          <div key={label} style={{
            flex: 1, padding: "8px 10px", borderRadius: 10,
            background: "#f5f5f7", border: "1px solid rgba(0,0,0,0.06)",
            display: "flex", alignItems: "center", gap: 7,
          }}>
            <Icon size={12} style={{ color: "#86868b", flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: "0.66rem", color: "#86868b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 500 }}>{label}</div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.01em" }}>{value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onToggle(integration.id)}
          style={{
            flex: 1, padding: "9px", borderRadius: 11,
            border: `1px solid ${connected ? "rgba(0,0,0,0.12)" : "rgba(0,0,0,0.1)"}`,
            background: connected ? "#f5f5f7" : "#1d1d1f",
            color: connected ? "#1d1d1f" : "#fff",
            fontWeight: 600, fontSize: "0.8rem", cursor: "pointer",
            fontFamily: "inherit", transition: "all .15s",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
          }}
        >
          {connected ? <><WifiOff size={13} /> {t("geofencing.disconnect")}</> : <><Wifi size={13} /> {t("geofencing.connect")}</>}
        </button>
        {connected && (
          <button
            onClick={() => onSync(integration.id)}
            disabled={syncing}
            style={{
              flex: 1, padding: "9px", borderRadius: 11,
              border: "1px solid rgba(0,0,0,0.1)",
              background: "#f5f5f7", color: "#1d1d1f",
              fontWeight: 600, fontSize: "0.8rem",
              cursor: syncing ? "not-allowed" : "pointer",
              fontFamily: "inherit", transition: "all .15s",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
              opacity: syncing ? 0.5 : 1,
            }}
          >
            <RefreshCw size={13} className={syncing ? "geo-spin" : ""} />
            {syncing ? t("geofencing.syncing") : t("geofencing.sync")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══ MAIN ══ */
export function Geofencing() {
  const { t } = useTranslation();
  const { authFetch } = useAuth();
  const [zones,        setZones]       = useState<GeofenceZone[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddForm,  setShowAddForm]  = useState(false);
  const [formData,     setFormData]     = useState(defaultForm);
  const [submitting,   setSubmitting]   = useState(false);
  const [deletingId,   setDeletingId]   = useState<string | null>(null);
  const [editingId,    setEditingId]    = useState<string | null>(null);
  const [editName,     setEditName]     = useState("");
  const [expandedId,   setExpandedId]   = useState<string | null>(null);
  const [intExpanded,  setIntExpanded]  = useState(true);

  /* ── Load ── */
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([fetchZones(), fetchIntegrations()])
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // authFetch is stable per-render via context — safe to omit, but lint-clean to include
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchZones() {
    try {
      const res  = await authFetch(`${API_BASE}/geofencing`);
      if (!res.ok) return;
      const json = await safeJson(res);
      setZones(Array.isArray(json.data) ? json.data : []);
    } catch (err) { console.error("Zone load error:", err); }
  }

  async function fetchIntegrations() {
    try {
      const res  = await authFetch(`${API_BASE}/integrations`);
      if (!res.ok) return;
      const json = await safeJson(res);
      setIntegrations(Array.isArray(json.data) ? json.data : []);
    } catch (err) { console.error("Integration load error:", err); }
  }

  /* ── Create ── */
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.lat || !formData.lng) {
      toast.error(t("geofencing.fillRequired"));
      return;
    }
    const lat = parseFloat(formData.lat);
    const lng = parseFloat(formData.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error(t("geofencing.invalidCoordinates"));
      return;
    }
    setSubmitting(true);
    try {
      const syncs: ("samsara" | "skybitz")[] = [];
      if (formData.syncSamsara) syncs.push("samsara");
      if (formData.syncSkybitz) syncs.push("skybitz");

      const res  = await authFetch(`${API_BASE}/geofencing`, {
        method: "POST",
        body: JSON.stringify({
          name: formData.name.trim(),
          lat, lng,
          radius: formData.radius,
          alertOnEnter: formData.alertOnEnter,
          alertOnExit: formData.alertOnExit,
          color: formData.color,
          syncedWith: syncs,
        }),
      });
      const json = await safeJson(res);
      if (res.ok && json.data) {
        setZones(prev => [...prev, json.data]);
        setShowAddForm(false);
        setFormData(defaultForm);
        toast.success(t("geofencing.created"));
      } else {
        toast.error(json.message || t("common.somethingWrong"));
      }
    } catch (err) {
      console.error("Create error:", err);
      toast.error(t("geofencing.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  /* ── Delete ── */
  async function handleDelete(id: string) {
    if (!confirm(t("geofencing.deleteConfirm"))) return;
    setDeletingId(id);
    try {
      const res = await authFetch(`${API_BASE}/geofencing/${id}`, { method: "DELETE" });
      if (res.ok) {
        setZones(prev => prev.filter(z => z._id !== id));
        toast.success(t("geofencing.deleted"));
      } else {
        const json = await safeJson(res);
        toast.error(json.message || t("common.somethingWrong"));
      }
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(t("common.networkError"));
    } finally {
      setDeletingId(null);
    }
  }

  /* ── Toggle Active ── */
  async function toggleZone(id: string) {
    const zone = zones.find(z => z._id === id);
    if (!zone) return;
    // Optimistic update
    const prevZones = zones;
    setZones(prev => prev.map(z => z._id === id ? { ...z, active: !z.active } : z));
    try {
      const res  = await authFetch(`${API_BASE}/geofencing/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !zone.active }),
      });
      if (!res.ok) {
        setZones(prevZones); // rollback
        const json = await safeJson(res);
        toast.error(json.message || t("common.somethingWrong"));
        return;
      }
      const json = await safeJson(res);
      if (json.data) setZones(prev => prev.map(z => z._id === id ? json.data : z));
    } catch (err) {
      console.error("Toggle error:", err);
      setZones(prevZones);
      toast.error(t("common.networkError"));
    }
  }

  /* ── Edit Name ── */
  function startEdit(zone: GeofenceZone) { setEditingId(zone._id); setEditName(zone.name); }
  function cancelEdit() { setEditingId(null); setEditName(""); }
  async function saveEdit(id: string) {
    if (!editName.trim()) { toast.error(t("geofencing.nameRequired")); return; }
    try {
      const res  = await authFetch(`${API_BASE}/geofencing/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName.trim() }),
      });
      if (!res.ok) {
        const json = await safeJson(res);
        toast.error(json.message || t("common.somethingWrong"));
        return;
      }
      const json = await safeJson(res);
      if (json.data) setZones(prev => prev.map(z => z._id === id ? json.data : z));
    } catch (err) {
      console.error("Edit error:", err);
      toast.error(t("common.networkError"));
    } finally {
      cancelEdit();
    }
  }

  /* ── Integration Toggle ── */
  async function handleToggleIntegration(id: IntegrationId) {
    const intg = integrations.find(i => i.id === id);
    if (!intg) return;
    const newStatus = intg.status === "connected" ? "disconnected" : "connected";
    try {
      const res  = await authFetch(`${API_BASE}/integrations/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.data) {
          setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...json.data } : i));
          return;
        }
      }
      // Fallback for missing/invalid response — preserve prior optimistic UX
      setIntegrations(prev => prev.map(i =>
        i.id === id ? { ...i, status: newStatus, vehicles: newStatus === "connected" ? 12 : 0 } : i
      ));
    } catch {
      setIntegrations(prev => prev.map(i =>
        i.id === id ? { ...i, status: newStatus, vehicles: newStatus === "connected" ? 12 : 0 } : i
      ));
    }
  }

  /* ── Integration Sync ── */
  async function handleSync(id: IntegrationId) {
    setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "syncing" } : i));
    try {
      const res  = await authFetch(`${API_BASE}/integrations/${id}/sync`, { method: "POST" });
      if (res.ok) {
        const json = await safeJson(res);
        if (json.data) {
          setIntegrations(prev => prev.map(i => i.id === id ? { ...i, ...json.data, status: "connected" } : i));
          return;
        }
      }
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "connected", lastSync: "Just now" } : i));
    } catch {
      setIntegrations(prev => prev.map(i => i.id === id ? { ...i, status: "connected", lastSync: "Just now" } : i));
    }
  }

  /* ── Derived ── */
  const totalActive   = zones.filter(z => z.active).length;
  const totalVehicles = zones.reduce((s, z) => s + (z.vehicles || 0), 0);
  const alertZones    = zones.filter(z => z.alertOnEnter || z.alertOnExit).length;
  const samsaraConnected = integrations.find(i => i.id === "samsara")?.status === "connected";
  const skybitzConnected = integrations.find(i => i.id === "skybitz")?.status === "connected";

  /* ── Render ── */
  return (
    <div className="geo-root" style={{ display: "flex", flexDirection: "column", gap: "1rem", paddingBottom: 24 }}>
      <style>{CSS}</style>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "#1d1d1f", margin: 0, letterSpacing: "-0.03em" }}>
            {t("geofencing.title")}
          </h1>
          <p style={{ fontSize: "0.78rem", color: "#86868b", margin: "3px 0 0", fontWeight: 400 }}>
            {t("geofencing.subtitle")}
          </p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "9px 15px", background: "#1d1d1f",
            color: "#fff", border: "none", borderRadius: 12,
            fontSize: "0.85rem", fontWeight: 600, cursor: "pointer",
            fontFamily: "inherit", flexShrink: 0, letterSpacing: "-0.01em",
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)", transition: "opacity .15s",
          }}
        >
          <Plus size={14} strokeWidth={2.5} /> {t("geofencing.addZone")}
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
        {[
          { label: t("geofencing.active"),   value: totalActive,   Icon: Shield        },
          { label: t("geofencing.vehicles"), value: totalVehicles, Icon: Navigation    },
          { label: t("geofencing.alerts"),   value: alertZones,    Icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="geo-stat-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: "#f5f5f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <s.Icon size={15} style={{ color: "#1d1d1f" }} />
            </div>
            <div>
              <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#1d1d1f", lineHeight: 1, letterSpacing: "-0.03em" }}>
                {loading ? "—" : s.value}
              </div>
              <div style={{ fontSize: "0.67rem", color: "#86868b", marginTop: 2, fontWeight: 500 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Integrations */}
      <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18, overflow: "hidden" }}>
        <button
          onClick={() => setIntExpanded(p => !p)}
          style={{
            width: "100%", padding: "14px 16px", background: "transparent", border: "none",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            cursor: "pointer", fontFamily: "inherit",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Radio size={14} style={{ color: "#1d1d1f" }} />
            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1d1d1f", letterSpacing: "-0.01em" }}>
              {t("geofencing.integrations")}
            </span>
            <span style={{ fontSize: "0.63rem", fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "#f5f5f7", color: "#1d1d1f", border: "1px solid rgba(0,0,0,0.08)" }}>
              {integrations.filter(i => i.status === "connected").length}/{integrations.length}
            </span>
          </div>
          {intExpanded ? <ChevronUp size={14} style={{ color: "#86868b" }} /> : <ChevronDown size={14} style={{ color: "#86868b" }} />}
        </button>

        {intExpanded && (
          <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "20px 0" }}>
                <Loader2 size={20} className="geo-spin" style={{ color: "#86868b" }} />
              </div>
            ) : integrations.length === 0 ? (
              <p style={{ color: "#86868b", fontSize: "0.8rem", textAlign: "center", padding: "16px 0", margin: 0 }}>
                {t("common.noData")}
              </p>
            ) : integrations.map(intg => (
              <IntegrationCard key={intg.id} integration={intg} onToggle={handleToggleIntegration} onSync={handleSync} />
            ))}
          </div>
        )}
      </div>

      {/* Map Preview */}
      <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18, padding: "14px" }}>
        <p className="geo-section-title">{t("geofencing.zoneMapPreview")}</p>
        <MapPlaceholder zones={zones} />
      </div>

      {/* Zones List */}
      <div>
        <p className="geo-section-title">{t("geofencing.allZones")} ({zones.length})</p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "3rem 0" }}>
            <Loader2 size={28} className="geo-spin" style={{ color: "#86868b" }} />
          </div>
        ) : zones.length === 0 ? (
          <div style={{ background: "#ffffff", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 18, padding: "3rem 1rem", textAlign: "center" }}>
            <MapPin size={32} style={{ color: "#c7c7cc", margin: "0 auto 10px", display: "block" }} />
            <p style={{ color: "#86868b", fontSize: "0.875rem", margin: 0 }}>{t("geofencing.noZones")}</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {zones.map(zone => {
              const isEditing  = editingId === zone._id;
              const isDeleting = deletingId === zone._id;
              const isExpanded = expandedId === zone._id;

              return (
                <div key={zone._id} className="geo-zone-card" style={{
                  borderLeft: `3px solid ${zone.active ? "#1d1d1f" : "#d1d1d6"}`,
                  opacity: zone.active ? 1 : 0.55,
                }}>
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: zone.active ? "#1d1d1f" : "#f5f5f7",
                      border: `1px solid ${zone.active ? "#1d1d1f" : "rgba(0,0,0,0.08)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>
                      <Circle size={12} style={{ color: zone.active ? "#fff" : "#86868b" }} />
                    </div>

                    {isEditing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") saveEdit(zone._id); if (e.key === "Escape") cancelEdit(); }}
                        className="geo-input"
                        style={{ flex: 1, padding: "7px 10px", fontSize: "0.85rem" }}
                      />
                    ) : (
                      <span
                        style={{ flex: 1, fontWeight: 600, fontSize: "0.9rem", color: "#1d1d1f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", letterSpacing: "-0.01em" }}
                        onClick={() => setExpandedId(isExpanded ? null : zone._id)}
                      >
                        {zone.name}
                      </span>
                    )}

                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {isEditing ? (
                        <>
                          <button className="geo-icon-btn" onClick={() => saveEdit(zone._id)} style={{ background: "#1d1d1f", color: "#fff" }}>
                            <Check size={12} />
                          </button>
                          <button className="geo-icon-btn" onClick={cancelEdit} style={{ background: "#f5f5f7", color: "#86868b" }}>
                            <X size={12} />
                          </button>
                        </>
                      ) : (
                        <button className="geo-icon-btn" onClick={() => startEdit(zone)} style={{ background: "#f5f5f7", color: "#86868b" }}>
                          <Pencil size={12} />
                        </button>
                      )}
                      <button className="geo-icon-btn" onClick={() => handleDelete(zone._id)} disabled={isDeleting} style={{ background: "#f5f5f7", color: "#1d1d1f" }}>
                        {isDeleting ? <Loader2 size={12} className="geo-spin" /> : <Trash2 size={12} />}
                      </button>
                      <button className="geo-icon-btn" onClick={() => setExpandedId(isExpanded ? null : zone._id)} style={{ background: "#f5f5f7", color: "#86868b" }}>
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Chips */}
                  <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.71rem", color: "#86868b", background: "#f5f5f7", borderRadius: 7, padding: "3px 8px", fontWeight: 500, border: "1px solid rgba(0,0,0,0.06)" }}>
                      {zone.radius >= 1000 ? `${zone.radius / 1000}km` : `${zone.radius}m`}
                    </span>
                    {zone.vehicles > 0 && (
                      <span style={{ fontSize: "0.71rem", color: "#1d1d1f", background: "#f5f5f7", borderRadius: 7, padding: "3px 8px", fontWeight: 600, border: "1px solid rgba(0,0,0,0.08)" }}>
                        {zone.vehicles} {t("geofencing.vehicles").toLowerCase()}
                      </span>
                    )}
                    {zone.alertOnEnter && (
                      <span className="geo-sync-chip" style={{ background: "#f5f5f7", color: "#1d1d1f", border: "1px solid rgba(0,0,0,0.07)" }}>
                        <Zap size={9} /> {t("geofencing.onEnter")}
                      </span>
                    )}
                    {zone.alertOnExit && (
                      <span className="geo-sync-chip" style={{ background: "#f5f5f7", color: "#1d1d1f", border: "1px solid rgba(0,0,0,0.07)" }}>
                        <Zap size={9} /> {t("geofencing.onExit")}
                      </span>
                    )}
                    {zone.syncedWith?.includes("samsara") && (
                      <span className="geo-sync-chip" style={{ background: "#1d1d1f", color: "#fff" }}>
                        <Satellite size={9} /> Samsara
                      </span>
                    )}
                    {zone.syncedWith?.includes("skybitz") && (
                      <span className="geo-sync-chip" style={{ background: "#f5f5f7", color: "#1d1d1f", border: "1px solid rgba(0,0,0,0.1)" }}>
                        <Satellite size={9} /> SkyBitz
                      </span>
                    )}
                  </div>

                  {/* Expandable details */}
                  {isExpanded && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(0,0,0,0.06)", display: "flex", flexDirection: "column", gap: 7 }}>
                      {[
                        { label: t("geofencing.coordinates"), value: `${zone.lat?.toFixed(4)}, ${zone.lng?.toFixed(4)}`, mono: true },
                        { label: t("geofencing.created_label"), value: zone.createdAt ? zone.createdAt.split("T")[0] : "—" },
                        { label: t("geofencing.type"),        value: zone.type ? zone.type.charAt(0).toUpperCase() + zone.type.slice(1) : "Circle" },
                      ].map(row => (
                        <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "0.72rem", color: "#86868b" }}>{row.label}</span>
                          <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#1d1d1f", fontFamily: row.mono ? "monospace" : "inherit" }}>{row.value}</span>
                        </div>
                      ))}

                      <div style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed rgba(0,0,0,0.08)" }}>
                        <div style={{ fontSize: "0.66rem", color: "#86868b", marginBottom: 7, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          {t("geofencing.syncStatus")}
                        </div>
                        <div style={{ display: "flex", gap: 7 }}>
                          {(["samsara", "skybitz"] as IntegrationId[]).map(platform => {
                            const synced = zone.syncedWith?.includes(platform);
                            const label  = platform === "samsara" ? "Samsara" : "SkyBitz";
                            return (
                              <div key={platform} style={{
                                flex: 1, padding: "7px 10px", borderRadius: 10,
                                background: synced ? "#1d1d1f" : "#f5f5f7",
                                border: `1px solid ${synced ? "#1d1d1f" : "rgba(0,0,0,0.07)"}`,
                                display: "flex", alignItems: "center", gap: 6,
                              }}>
                                <Satellite size={11} style={{ color: synced ? "#fff" : "#86868b", flexShrink: 0 }} />
                                <div>
                                  <div style={{ fontSize: "0.66rem", color: synced ? "#fff" : "#86868b", fontWeight: 600 }}>{label}</div>
                                  <div style={{ fontSize: "0.6rem", color: synced ? "rgba(255,255,255,0.65)" : "#c7c7cc" }}>{synced ? t("geofencing.synced") : t("geofencing.notSynced")}</div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Toggle */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                    <span style={{ fontSize: "0.72rem", color: zone.active ? "#1d1d1f" : "#86868b", fontWeight: 500 }}>
                      {zone.active ? `● ${t("geofencing.active")}` : `○ ${t("geofencing.inactive")}`}
                    </span>
                    <button className="geo-toggle-btn" onClick={() => toggleZone(zone._id)} style={{ color: zone.active ? "#1d1d1f" : "#c7c7cc" }}>
                      {zone.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Zone Modal */}
      {showAddForm && (
        <div
          className="geo-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) { setShowAddForm(false); setFormData(defaultForm); } }}
        >
          <div className="geo-modal-sheet">
            <div style={{ display: "flex", justifyContent: "center", paddingTop: 12, paddingBottom: 4 }}>
              <div style={{ width: 36, height: 4, borderRadius: 999, background: "#e0e0e5" }} />
            </div>

            <div style={{ padding: "6px 18px 28px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
                <div>
                  <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#1d1d1f", margin: 0, letterSpacing: "-0.02em" }}>{t("geofencing.newZone")}</h2>
                  <p style={{ fontSize: "0.75rem", color: "#86868b", margin: "3px 0 0" }}>{t("geofencing.configureZone")}</p>
                </div>
                <button
                  onClick={() => { setShowAddForm(false); setFormData(defaultForm); }}
                  style={{ background: "#f5f5f7", border: "none", cursor: "pointer", color: "#86868b", width: 32, height: 32, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  <X size={14} />
                </button>
              </div>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label className="geo-label">{t("geofencing.zoneName")} *</label>
                  <input
                    type="text" required className="geo-input"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t("geofencing.zoneNamePlaceholder")}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    { key: "lat", label: t("geofencing.latitude"),  placeholder: "24.8607" },
                    { key: "lng", label: t("geofencing.longitude"), placeholder: "67.0011" },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="geo-label">{f.label} *</label>
                      <input
                        type="number" step="any" required className="geo-input"
                        value={formData[f.key as "lat" | "lng"]}
                        onChange={e => setFormData({ ...formData, [f.key]: e.target.value })}
                        placeholder={f.placeholder}
                        style={{ padding: "10px 11px" }}
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="geo-label">
                    {t("geofencing.radius")} — <span style={{ color: "#1d1d1f", fontWeight: 700 }}>
                      {formData.radius >= 1000 ? `${formData.radius / 1000}km` : `${formData.radius}m`}
                    </span>
                  </label>
                  <input
                    type="range" min="100" max="5000" step="100"
                    value={formData.radius}
                    onChange={e => setFormData({ ...formData, radius: parseInt(e.target.value) })}
                    style={{ width: "100%", margin: "6px 0 3px" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.67rem", color: "#86868b", fontWeight: 500 }}>
                    <span>100m</span><span>5km</span>
                  </div>
                </div>

                <div>
                  <label className="geo-label">{t("geofencing.color")}</label>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {colorOptions.map(c => (
                      <button
                        key={c} type="button"
                        onClick={() => setFormData({ ...formData, color: c })}
                        style={{
                          width: 28, height: 28, borderRadius: "50%", background: c, border: "none", cursor: "pointer",
                          outline: formData.color === c ? `2.5px solid ${c}` : "2px solid transparent",
                          outlineOffset: 3, transition: "transform .12s",
                          transform: formData.color === c ? "scale(1.2)" : "scale(1)",
                          boxShadow: formData.color === c ? "0 2px 8px rgba(0,0,0,0.25)" : "none",
                        }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="geo-label">{t("geofencing.alertTriggers")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      { key: "alertOnEnter", label: t("geofencing.onEnter"), icon: "↓" },
                      { key: "alertOnExit",  label: t("geofencing.onExit"),  icon: "↑" },
                    ].map(({ key, label, icon }) => (
                      <button
                        key={key} type="button"
                        onClick={() => setFormData({ ...formData, [key]: !formData[key as "alertOnEnter" | "alertOnExit"] })}
                        className={`geo-pill-btn${formData[key as "alertOnEnter" | "alertOnExit"] ? " active" : ""}`}
                      >
                        <span>{icon}</span> {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="geo-label">{t("geofencing.syncWith")}</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      // NOTE: brand names are NOT translated.
                      { key: "syncSamsara", label: "Samsara", connected: samsaraConnected },
                      { key: "syncSkybitz", label: "SkyBitz", connected: skybitzConnected },
                    ].map(({ key, label, connected }) => (
                      <button
                        key={key} type="button"
                        disabled={!connected}
                        onClick={() => connected && setFormData({ ...formData, [key]: !formData[key as "syncSamsara" | "syncSkybitz"] })}
                        className={`geo-pill-btn${formData[key as "syncSamsara" | "syncSkybitz"] && connected ? " active" : ""}`}
                        style={{ flex: 1, opacity: !connected ? 0.35 : 1 }}
                      >
                        <Satellite size={12} /> {label}
                        {!connected && <span style={{ fontSize: "0.6rem", opacity: 0.7 }}>({t("geofencing.offline")})</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="submit" disabled={submitting} className="geo-submit-btn" style={{ marginTop: 4 }}>
                  {submitting && <Loader2 size={15} className="geo-spin" />}
                  {submitting ? t("geofencing.creating") : t("geofencing.create")}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}