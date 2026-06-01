// src/pages/ReportsPage.tsx
import { useEffect, useState, useMemo, Fragment } from "react";
import { useTranslation } from "react-i18next";
import {
  Package, FileText, ClipboardCheck,
  ChevronLeft, ChevronRight, Loader2, AlertCircle,
  User, TrendingUp, BarChart2, Printer, Building2,
  ShoppingCart, Calendar, DollarSign, Wrench,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  buildInventoryReportPdf,
  buildWorkOrderReportPdf,
  buildInspectionReportPdf,
  buildInvoiceReportPdf,
  buildInventoryUpdatesReportPdf,
  type InventoryUpdateLogRow,
} from "../services/pdf";
import { sendInventoryReportEmail, isEmailConfigured, INVENTORY_REPORT_RECIPIENT } from "../services/inventoryEmail";
import { Boxes, Mail } from "lucide-react";

// Row shape from GET /users/getInventoryUpdateLog (extends the PDF row with id)
interface InventoryUpdateLog extends InventoryUpdateLogRow { id: string; }

const API_BASE = apiUrl("/users");

/* ═══════════════════════════════════════════════════
   DESIGN SYSTEM
═══════════════════════════════════════════════════ */
const C = {
  blue:    "#1e40af", blueBg:  "#eff6ff", blueBdr: "#bfdbfe",
  green:   "#15803d", greenBg: "#f0fdf4", greenBdr:"#bbf7d0",
  red:     "#b91c1c", redBg:   "#fef2f2", redBdr:  "#fecaca",
  amber:   "#b45309", amberBg: "#fffbeb", amberBdr:"#fde68a",
  purple:  "#6d28d9", purpBg:  "#f5f3ff", purpBdr: "#ddd6fe",
  teal:    "#0f766e", tealBg:  "#f0fdfa", tealBdr: "#99f6e4",
  border:  "var(--border, #e2e8f0)",
  card:    "var(--card, #ffffff)",
  bg:      "var(--background, #f8fafc)",
  fg:      "var(--foreground, #0f172a)",
  muted:   "var(--muted, #f1f5f9)",
  mutedFg: "var(--muted-foreground, #64748b)",
};
const PIE = ["#1e40af","#15803d","#b45309","#6d28d9","#b91c1c","#0369a1","#0f766e","#7c3aed"];

/* ═══════════════════════════════════════════════════
   CSS
═══════════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600&family=DM+Sans:wght@400;500;600;700;800&display=swap');
  .rp-root{font-family:'DM Sans',sans-serif;background:${C.bg};min-height:100%;display:flex;flex-direction:column;}
  .rp-header{background:${C.card};border-bottom:1.5px solid ${C.border};padding:0 16px;position:sticky;top:0;z-index:20;}
  .rp-header-inner{max-width:1100px;margin:0 auto;display:flex;align-items:center;gap:10px;padding:10px 0;flex-wrap:wrap;}
  .rp-title{font-size:15px;font-weight:800;color:${C.fg};letter-spacing:-.5px;display:flex;align-items:center;gap:6px;white-space:nowrap;}
  .rp-nav{display:flex;gap:2px;background:${C.muted};border-radius:10px;padding:3px;flex-wrap:wrap;flex:1;min-width:0;}
  .rp-nav-btn{padding:6px 10px;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;background:transparent;color:${C.mutedFg};transition:all .14s;display:flex;align-items:center;gap:4px;white-space:nowrap;}
  .rp-nav-btn.active{background:${C.card};color:${C.fg};box-shadow:0 1px 5px rgba(0,0,0,.09);}
  .rp-body{flex:1;overflow-y:auto;}
  .rp-body-inner{max-width:1100px;margin:0 auto;padding:16px 12px 80px;}

  .rp-filters{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end;background:${C.card};border:1.5px solid ${C.border};border-radius:12px;padding:12px 14px;margin-bottom:14px;}
  .rp-fi{display:flex;flex-direction:column;gap:3px;flex:1;min-width:100px;}
  .rp-lbl{font-size:9px;font-weight:700;color:${C.mutedFg};text-transform:uppercase;letter-spacing:.06em;}
  .rp-sel{padding:7px 8px;border:1.5px solid ${C.border};border-radius:8px;background:${C.muted};color:${C.fg};font-size:12px;font-family:inherit;outline:none;transition:border-color .14s;-webkit-appearance:none;width:100%;min-width:0;}
  .rp-sel:focus{border-color:${C.blue};}
  .rp-pnav{display:flex;align-items:center;gap:5px;background:${C.muted};border-radius:9px;padding:3px 5px;border:1.5px solid ${C.border};}
  .rp-pbtn{width:26px;height:26px;border:none;border-radius:6px;background:${C.card};color:${C.fg};cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 3px rgba(0,0,0,.08);transition:all .12s;flex-shrink:0;}
  .rp-pbtn:disabled{opacity:.35;cursor:not-allowed;box-shadow:none;}
  .rp-plbl{font-size:11px;font-weight:700;color:${C.fg};min-width:90px;text-align:center;}
  .rp-toggle{display:flex;background:${C.muted};border-radius:8px;padding:2px;gap:2px;border:1.5px solid ${C.border};}
  .rp-tbtn{padding:5px 9px;border:none;border-radius:6px;background:transparent;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;color:${C.mutedFg};transition:all .14s;white-space:nowrap;}
  .rp-tbtn.active{background:${C.card};color:${C.fg};box-shadow:0 1px 4px rgba(0,0,0,.09);}

  .rp-card{background:${C.card};border:1.5px solid ${C.border};border-radius:12px;overflow:hidden;margin-bottom:12px;}
  .rp-card-hd{display:flex;align-items:center;gap:6px;padding:10px 12px;border-bottom:1px solid ${C.border};flex-wrap:wrap;}
  .rp-card-title{font-size:12px;font-weight:700;color:${C.fg};flex:1;}
  .rp-sg{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;margin-bottom:12px;}
  .rp-stat{padding:10px 12px;border-radius:10px;border:1.5px solid;}
  .rp-stat-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px;}
  .rp-stat-val{font-size:18px;font-weight:800;line-height:1;font-family:'IBM Plex Mono',monospace;}
  .rp-tw{overflow-x:auto;-webkit-overflow-scrolling:touch;}
  .rp-tbl{width:100%;border-collapse:collapse;font-size:11px;}
  .rp-tbl th{padding:6px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${C.mutedFg};background:${C.muted};border-bottom:1px solid ${C.border};white-space:nowrap;}
  .rp-tbl td{padding:8px;border-bottom:1px solid ${C.border};color:${C.fg};vertical-align:middle;}
  .rp-tbl tr:last-child td{border-bottom:none;}
  .rp-tbl tbody tr:hover td{background:${C.muted};}
  .rp-mono{font-family:'IBM Plex Mono',monospace;font-size:10px;}
  .rp-badge{display:inline-flex;align-items:center;padding:2px 7px;border-radius:99px;font-size:9px;font-weight:700;border:1px solid;white-space:nowrap;}
  .rp-total{display:flex;justify-content:flex-end;gap:14px;padding:8px 12px;border-top:2px solid ${C.border};background:${C.muted};font-size:11px;font-weight:700;color:${C.fg};flex-wrap:wrap;}
  .rp-bar-bg{height:5px;background:${C.muted};border-radius:99px;overflow:hidden;margin-top:5px;flex:1;min-width:40px;}
  .rp-bar-fill{height:100%;border-radius:99px;}
  .rp-pdf{display:flex;align-items:center;gap:5px;padding:7px 12px;border-radius:9px;border:1.5px solid ${C.blue};background:${C.blueBg};color:${C.blue};font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .14s;white-space:nowrap;min-height:34px;}
  .rp-pdf:hover{background:${C.blue};color:#fff;}
  .rp-divider{display:flex;align-items:center;gap:8px;margin:14px 0 10px;}
  .rp-divider-line{flex:1;height:1px;background:${C.border};}
  .rp-divider-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${C.mutedFg};white-space:nowrap;}
  .rp-vendor-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:12px;}
  .rp-vcard{background:${C.card};border:1.5px solid ${C.border};border-radius:10px;padding:12px 14px;}
  .rp-vcard-name{font-size:13px;font-weight:800;color:${C.fg};margin-bottom:8px;display:flex;align-items:center;gap:6px;}
  .rp-vstats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}
  .rp-vstat{text-align:center;}
  .rp-vstat-lbl{font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${C.mutedFg};margin-bottom:2px;}
  .rp-vstat-val{font-size:13px;font-weight:800;font-family:'IBM Plex Mono',monospace;}
  .rp-vparts{margin-top:8px;padding-top:7px;border-top:1px solid ${C.border};}
  .rp-vpart-row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:10px;border-bottom:1px dashed ${C.border};}
  .rp-vpart-row:last-child{border-bottom:none;}
  .rp-charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;}
  .rp-exp-btn{background:none;border:none;cursor:pointer;color:${C.blue};font-size:10px;font-weight:700;padding:2px 5px;border-radius:5px;transition:all .12s;display:flex;align-items:center;gap:2px;}
  .rp-exp-btn:hover{background:${C.blueBg};}
  .rp-sub-row td{background:${C.muted};padding:5px 8px 5px 28px !important;font-size:10px;border-bottom:1px dashed ${C.border} !important;}
  .rp-sub-row:last-child td{border-bottom:1px solid ${C.border} !important;}
  @keyframes rp-spin{to{transform:rotate(360deg);}}.rp-spin{animation:rp-spin 1s linear infinite;}
  @keyframes rp-fade{from{opacity:0;transform:translateY(7px);}to{opacity:1;transform:none;}}.rp-fade{animation:rp-fade .2s ease both;}
  .rp-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px 16px;color:${C.mutedFg};gap:8px;font-size:12px;font-weight:600;}
  @media(max-width:700px){
    .rp-sg{grid-template-columns:1fr 1fr;}
    .rp-vendor-grid{grid-template-columns:1fr;}
    .rp-charts-grid{grid-template-columns:1fr;}
    .rp-header-inner{gap:6px;}
    .rp-filters{padding:10px 10px;gap:6px;}
    .rp-body-inner{padding:12px 8px 80px;}
    .rp-plbl{min-width:70px;font-size:11px;}
    .rp-stat-val{font-size:16px;}
    .rp-nav-btn{padding:7px 9px;font-size:11px;min-height:36px;}
    /* Tables: bump to readable sizes on phones */
    .rp-tbl{font-size:13px;}
    .rp-tbl th{padding:10px 8px;font-size:11px;}
    .rp-tbl td{padding:10px 8px;}
    .rp-mono{font-size:12px;}
    .rp-pbtn{width:36px;height:36px;}
    .rp-pdf{padding:9px 12px;font-size:12px;min-height:40px;}
  }
  @media(max-width:420px){
    .rp-sg{grid-template-columns:1fr;}
  }
`;

/* ═══════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════ */
type AuthFetch = (url: string, o?: RequestInit) => Promise<Response>;
type Period = "weekly" | "monthly" | "yearly" | "all";

interface UsedItem { itemId: string; partName: string; partNumber: string; qty: number; pricePerPart: number; lineTotal: number; }
interface RawUsageLog { _id: string; woId: string; woNumber: string; assetNumber: string; vendor: string; completedBy: string; completionNote: string; totalParts: number; totalCost: number; completedAt: string; usedItems: UsedItem[]; }
interface UsageRow { date: string; partName: string; partNumber: string; qty: number; pricePerPart: number; lineTotal: number; woNumber: string; assetNumber: string; vendor: string; completedBy: string; }
interface WO { _id: string; work_order_number: string; asset_number: string; vendor: string; mechanic: string; status: string; priority: string; issue_description: string; grand_total: number; start_time: string; end_time?: string; labor_cost?: number; parts_cost?: number; payment_type?: string; }
interface Insp { id: string; inspection_number?: string; inspection_id?: string; asset_number?: string; asset_type?: string; overall_status: string; technician_name?: string; inspector_name?: string; defects_found?: string; issues_found?: string; inspection_score?: number; issue_count?: number; created_at?: string; _type?: "DOT" | "Quick"; }
interface Inv {
  _id: string; invoice_number: string; wo_number: string;
  asset_number: string; asset_type: string; vendor: string;
  mechanic: string; owner_name: string; owner_email: string;
  labor_cost: number; parts_cost: number; sales_tax: number;
  credit_card_fee: number; grand_total: number; item_count: number;
  notes: string; invoice_url: string; payment_type: string;
  repair_date: string; created_by_name: string; created_at: string;
  wo_status: string;
}

/* ═══════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════ */
const fmtC = (n: number) => `$${(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtD = (s: string) => { if (!s) return "—"; const d = new Date(s); return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); };

function mStr(off = 0) { const d = new Date(); d.setMonth(d.getMonth() + off); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }
function wStr(off = 0) { const d = new Date(); const day = d.getDay(); d.setDate(d.getDate() - ((day + 6) % 7) + off * 7); d.setHours(0, 0, 0, 0); return d.toISOString().slice(0, 10); }
function yStr(off = 0) { return String(new Date().getFullYear() + off); }

function periodLabel(period: Period, mOff: number, wOff: number, yOff: number) {
  if (period === "all") return "All Time";
  if (period === "yearly") return yStr(yOff);
  if (period === "monthly") {
    const ms = mStr(mOff);
    const parts = ms.split("-");
    if (parts.length !== 2) return "—";
    const yi = Number(parts[0]);
    const mi = Number(parts[1]);
    if (Number.isNaN(yi) || Number.isNaN(mi)) return "—";
    return new Date(yi, mi - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const ws = new Date(wStr(wOff));
  const we = new Date(ws); we.setDate(we.getDate() + 6);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(ws)} – ${f(we)}`;
}

function sColor(s: string) {
  const sl = (s || "").toLowerCase();
  if (["completed", "passed", "pass", "invoiced"].includes(sl)) return { bg: C.greenBg, bd: C.greenBdr, tx: C.green };
  if (["failed", "fail"].includes(sl)) return { bg: C.redBg, bd: C.redBdr, tx: C.red };
  if (["in_progress", "in progress"].includes(sl)) return { bg: C.blueBg, bd: C.blueBdr, tx: C.blue };
  if (["pending", "open"].includes(sl)) return { bg: C.amberBg, bd: C.amberBdr, tx: C.amber };
  return { bg: C.muted, bd: C.border, tx: C.mutedFg };
}
function pColor(p: string) {
  const pl = (p || "").toLowerCase();
  if (["high", "urgent"].includes(pl)) return { bg: C.redBg, bd: C.redBdr, tx: C.red };
  if (pl === "medium") return { bg: C.amberBg, bd: C.amberBdr, tx: C.amber };
  return { bg: C.muted, bd: C.border, tx: C.mutedFg };
}

/**
 * Generic GET wrapper around authFetch.
 *
 * Old version silently swallowed every error and returned null — so a 403
 * (non-admin), 401 (expired token), or 500 (server crash) were all
 * indistinguishable from "no data" in the UI. New version:
 *  - surfaces non-2xx with a toast carrying the backend's `message`
 *  - logs the URL + error in dev (Vite strips console.* in prod builds)
 *  - still returns null so the loading state can resolve gracefully
 */
async function api<T>(authFetch: AuthFetch, url: string): Promise<T | null> {
  try {
    const r = await authFetch(url);
    // Parse body once; tolerate empty/malformed JSON without crashing.
    const d = await r.json().catch(() => null) as { data?: T; message?: string } | null;
    if (!r.ok) {
      const msg = d?.message || `Request failed (${r.status})`;
      toast.error(msg);
      console.error(`[report] ${url} →`, r.status, msg);
      return null;
    }
    return (d?.data ?? null) as T | null;
  } catch (err) {
    toast.error("Network error — check your connection");
    console.error(`[report] ${url} →`, err);
    return null;
  }
}

function filterByPeriod<T extends { [key: string]: any }>(list: T[], dateKey: string, period: Period, mOff: number, wOff: number, yOff: number): T[] {
  if (period === "all") return list;
  let start: Date, end: Date;
  if (period === "yearly") {
    const y = Number(yStr(yOff));
    start = new Date(y, 0, 1); end = new Date(y, 11, 31, 23, 59, 59);
  } else if (period === "monthly") {
    const [y, m] = mStr(mOff).split("-").map(Number);
    start = new Date(y, m - 1, 1); end = new Date(y, m, 0, 23, 59, 59);
  } else {
    start = new Date(wStr(wOff)); start.setHours(0, 0, 0, 0);
    end = new Date(start); end.setDate(end.getDate() + 6); end.setHours(23, 59, 59);
  }
  return list.filter(item => { const d = new Date(item[dateKey] || ""); return d >= start && d <= end; });
}

/* ═══════════════════════════════════════════════════
   SHARED UI
═══════════════════════════════════════════════════ */
function Spin({ text }: { text: string }) { return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 48, gap: 8, color: C.mutedFg, fontSize: 12, fontWeight: 600 }}><Loader2 size={16} className="rp-spin" style={{ color: C.blue }} />{text}</div>; }
function Empty({ text }: { text: string }) { return <div className="rp-empty"><FileText size={32} style={{ opacity: .25 }} />{text}</div>; }
function Divider({ label }: { label: string }) { return <div className="rp-divider"><div className="rp-divider-line" /><span className="rp-divider-label">{label}</span><div className="rp-divider-line" /></div>; }

function PeriodNav({ period, setPeriod, mOff, setMOff, wOff, setWOff, yOff, setYOff, periods = ["weekly", "monthly", "yearly", "all"] as Period[] }: any) {
  const label = periodLabel(period, mOff, wOff, yOff);
  const canFwd = period === "weekly" ? wOff < 0 : period === "monthly" ? mOff < 0 : period === "yearly" ? yOff < 0 : false;
  const prev = () => { if (period === "weekly") setWOff((o: number) => o - 1); else if (period === "monthly") setMOff((o: number) => o - 1); else if (period === "yearly") setYOff((o: number) => o - 1); };
  const next = () => { if (period === "weekly") setWOff((o: number) => o + 1); else if (period === "monthly") setMOff((o: number) => o + 1); else if (period === "yearly") setYOff((o: number) => o + 1); };
  return (
    <>
      <div className="rp-fi">
        <span className="rp-lbl">Period</span>
        <div className="rp-toggle">
          {periods.map((p: Period) => (
            <button key={p} className={`rp-tbtn ${period === p ? "active" : ""}`}
              onClick={() => { setPeriod(p); setMOff(0); setWOff(0); setYOff(0); }}>
              {p === "all" ? "All" : p === "weekly" ? "Week" : p === "monthly" ? "Month" : "Year"}
            </button>
          ))}
        </div>
      </div>
      {period !== "all" && (
        <div className="rp-fi">
          <span className="rp-lbl">Date Range</span>
          <div className="rp-pnav">
            <button className="rp-pbtn" onClick={prev}><ChevronLeft size={13} /></button>
            <span className="rp-plbl">{label}</span>
            <button className="rp-pbtn" disabled={!canFwd} onClick={next}><ChevronRight size={13} /></button>
          </div>
        </div>
      )}
    </>
  );
}

function StatCards({ stats }: { stats: { l: string; v: string; c: string; bg: string; bd: string }[] }) {
  return (
    <div className="rp-sg">
      {stats.map(({ l, v, c, bg, bd }) => (
        <div key={l} className="rp-stat" style={{ background: bg, borderColor: bd }}>
          <div className="rp-stat-lbl" style={{ color: c }}>{l}</div>
          <div className="rp-stat-val" style={{ color: c }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INVENTORY REPORT
   API: GET /getInventoryUsageLogsReport → RawUsageLog[]
   Converts raw logs to flat rows + WO-level grouping
═══════════════════════════════════════════════════ */
function InventoryReport({ authFetch, userName }: { authFetch: AuthFetch; userName?: string }) {
  const [period, setPeriod] = useState<Period>("monthly");
  const [mOff, setMOff] = useState(0);
  const [wOff, setWOff] = useState(0);
  const [yOff, setYOff] = useState(0);
  const [groupBy, setGroupBy] = useState<"part" | "vendor" | "person" | "asset">("part");
  const [rawLogs, setRawLogs] = useState<RawUsageLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedWO, setExpandedWO] = useState<Set<string>>(new Set());
  const label = periodLabel(period, mOff, wOff, yOff);

  // Fetch raw logs once
  useEffect(() => {
    setLoading(true);
    api<RawUsageLog[]>(authFetch, `${API_BASE}/getInventoryUsageLogsReport`)
      .then(d => setRawLogs(d || []))
      .finally(() => setLoading(false));
  }, [authFetch]);

  // Filter by period
  const filteredLogs = useMemo(() => filterByPeriod(rawLogs, "completedAt", period, mOff, wOff, yOff), [rawLogs, period, mOff, wOff, yOff]);

  // Flatten to rows
  const allRows: UsageRow[] = useMemo(() => {
    const rows: UsageRow[] = [];
    filteredLogs.forEach(log => {
      (log.usedItems || []).forEach(item => {
        rows.push({
          date: log.completedAt || "", partName: item.partName || "Unknown", partNumber: item.partNumber || "",
          qty: item.qty || 0, pricePerPart: item.pricePerPart || 0, lineTotal: item.lineTotal || 0,
          woNumber: log.woNumber || "", assetNumber: log.assetNumber || "", vendor: log.vendor || "", completedBy: log.completedBy || "",
        });
      });
    });
    return rows;
  }, [filteredLogs]);

  // Summary
  const summary = useMemo(() => {
    const woSet = new Set(allRows.map(r => r.woNumber).filter(Boolean));
    return {
      totalCost: Number(allRows.reduce((s, r) => s + r.lineTotal, 0).toFixed(2)),
      totalUnits: allRows.reduce((s, r) => s + r.qty, 0),
      totalWOs: woSet.size,
      lineCount: allRows.length,
    };
  }, [allRows]);

  // WO-level grouping for expandable table
  const woMap = useMemo(() => {
    return filteredLogs.map(log => ({
      woNumber: log.woNumber, assetNumber: log.assetNumber, vendor: log.vendor, completedBy: log.completedBy,
      completionNote: log.completionNote, date: log.completedAt, totalQty: log.totalParts, totalCost: log.totalCost,
      items: log.usedItems || [],
    })).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [filteredLogs]);

  const toggleWO = (wo: string) => setExpandedWO(prev => { const n = new Set(prev); n.has(wo) ? n.delete(wo) : n.add(wo); return n; });

  const vendorMap = useMemo(() => {
    const m: Record<string, { vendor: string; totalCost: number; totalQty: number; woSet: Set<string>; parts: Record<string, { qty: number; cost: number }> }> = {};
    allRows.forEach(r => {
      const v = r.vendor || "Unassigned";
      if (!m[v]) m[v] = { vendor: v, totalCost: 0, totalQty: 0, woSet: new Set(), parts: {} };
      m[v].totalCost += r.lineTotal; m[v].totalQty += r.qty; m[v].woSet.add(r.woNumber || "");
      const pn = r.partName || "Unknown";
      if (!m[v].parts[pn]) m[v].parts[pn] = { qty: 0, cost: 0 };
      m[v].parts[pn].qty += r.qty; m[v].parts[pn].cost += r.lineTotal;
    });
    return Object.values(m).sort((a, b) => b.totalCost - a.totalCost);
  }, [allRows]);

  const personMap = useMemo(() => {
    const m: Record<string, { name: string; totalCost: number; totalQty: number; woSet: Set<string>; parts: string[] }> = {};
    allRows.forEach(r => {
      const p = r.completedBy || "Unknown";
      if (!m[p]) m[p] = { name: p, totalCost: 0, totalQty: 0, woSet: new Set(), parts: [] };
      m[p].totalCost += r.lineTotal; m[p].totalQty += r.qty; m[p].woSet.add(r.woNumber || "");
      if (!m[p].parts.includes(r.partName)) m[p].parts.push(r.partName);
    });
    return Object.values(m).sort((a, b) => b.totalCost - a.totalCost);
  }, [allRows]);

  const partMap = useMemo(() => {
    const m: Record<string, { partName: string; partNumber: string; totalCost: number; totalQty: number; vendorSet: Set<string> }> = {};
    allRows.forEach(r => {
      const p = r.partName || "Unknown";
      if (!m[p]) m[p] = { partName: p, partNumber: r.partNumber || "", totalCost: 0, totalQty: 0, vendorSet: new Set() };
      m[p].totalCost += r.lineTotal; m[p].totalQty += r.qty; m[p].vendorSet.add(r.vendor || "");
    });
    return Object.values(m).sort((a, b) => b.totalCost - a.totalCost);
  }, [allRows]);

  const dailyChart = useMemo(() => {
    const m: Record<string, number> = {};
    allRows.forEach(r => { const d = new Date(r.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }); m[d] = (m[d] || 0) + r.lineTotal; });
    return Object.entries(m).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime()).map(([date, cost]) => ({ date, cost: parseFloat(cost.toFixed(2)) }));
  }, [allRows]);

  const vendorPie = vendorMap.slice(0, 6).map(v => ({ name: v.vendor, value: parseFloat(v.totalCost.toFixed(2)) }));
  const maxVCost = Math.max(...vendorMap.map(v => v.totalCost), 1);

  return (
    <div className="rp-fade">
      <div className="rp-filters">
        <PeriodNav period={period} setPeriod={setPeriod} mOff={mOff} setMOff={setMOff} wOff={wOff} setWOff={setWOff} yOff={yOff} setYOff={setYOff} />
        <div className="rp-fi">
          <span className="rp-lbl">Group By</span>
          <select className="rp-sel" value={groupBy} onChange={e => setGroupBy(e.target.value as any)}>
            <option value="part">Part</option><option value="vendor">Vendor</option><option value="person">Person</option><option value="asset">Asset</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          <button
            className="rp-pdf"
            onClick={() => {
              // ✅ Build the {summary, grouped} shape buildInventoryReportPdf expects,
              //    grouped by whatever the user picked from the dropdown.
              const keyOf = (r: UsageRow) =>
                groupBy === "vendor" ? (r.vendor       || "Unassigned") :
                groupBy === "person" ? (r.completedBy  || "Unknown")    :
                groupBy === "asset"  ? (r.assetNumber  || "Unknown")    :
                                       (r.partName     || "Unknown");
              const map: Record<string, { key: string; totalQty: number; totalCost: number; rows: UsageRow[] }> = {};
              for (const r of allRows) {
                const k = keyOf(r);
                if (!map[k]) map[k] = { key: k, totalQty: 0, totalCost: 0, rows: [] };
                map[k].totalQty  += r.qty;
                map[k].totalCost += r.lineTotal;
                map[k].rows.push(r);
              }
              const grouped = Object.values(map).sort((a, b) => b.totalCost - a.totalCost);
              buildInventoryReportPdf({ summary, grouped }, label, groupBy, userName);
            }}
          ><Printer size={12} /> PDF</button>
        </div>
      </div>

      {loading && <Spin text="Loading inventory…" />}
      {!loading && <>
        <StatCards stats={[
          { l: "Total Cost", v: fmtC(summary.totalCost), c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: "Units Used", v: String(summary.totalUnits), c: C.blue, bg: C.blueBg, bd: C.blueBdr },
          { l: "Work Orders", v: String(summary.totalWOs), c: C.purple, bg: C.purpBg, bd: C.purpBdr },
          { l: "Line Items", v: String(summary.lineCount), c: C.amber, bg: C.amberBg, bd: C.amberBdr },
          { l: "Vendors", v: String(vendorMap.length), c: C.teal, bg: C.tealBg, bd: C.tealBdr },
          { l: "Parts", v: String(partMap.length), c: C.red, bg: C.redBg, bd: C.redBdr },
        ]} />

        {allRows.length === 0 ? <Empty text={`No usage data for ${label}`} /> : <>

          {/* WO USAGE LOGS — expandable */}
          <Divider label="Work Order Usage Logs" />
          <div className="rp-card">
            <div className="rp-card-hd">
              <Wrench size={13} color={C.purple} />
              <span className="rp-card-title">Parts Used per Work Order</span>
              <span style={{ fontSize: 10, color: C.mutedFg }}>{woMap.length} WOs</span>
            </div>
            <div className="rp-tw">
              <table className="rp-tbl">
                <thead><tr><th></th><th>Date</th><th>WO #</th><th>Asset</th><th>Vendor</th><th>By</th><th>Qty</th><th>Cost</th></tr></thead>
                <tbody>
                  {woMap.map((log) => {
                    const isOpen = expandedWO.has(log.woNumber);
                    // ✅ <React.Fragment key={…}> instead of <>: the shorthand
                    //    cannot accept a key prop, so React was warning about a
                    //    missing key for every WO row in the iteration.
                    return (
                      <Fragment key={log.woNumber}>
                        <tr style={{ cursor: "pointer" }} onClick={() => toggleWO(log.woNumber)}>
                          <td><button className="rp-exp-btn" onClick={e => { e.stopPropagation(); toggleWO(log.woNumber); }}><ChevronRight size={11} style={{ transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />{log.items.length}</button></td>
                          <td className="rp-mono">{fmtD(log.date)}</td>
                          <td className="rp-mono" style={{ color: C.blue, fontWeight: 700 }}>{log.woNumber}</td>
                          <td className="rp-mono">{log.assetNumber || "—"}</td>
                          <td style={{ color: C.blue, fontWeight: 600 }}>{log.vendor || "—"}</td>
                          <td style={{ fontWeight: 600 }}>{log.completedBy || "—"}</td>
                          <td className="rp-mono" style={{ color: C.amber, fontWeight: 700 }}>{log.totalQty}</td>
                          <td className="rp-mono" style={{ color: C.green, fontWeight: 800 }}>{fmtC(log.totalCost)}</td>
                        </tr>
                        {isOpen && log.items.map((item, idx) => (
                          <tr key={`${log.woNumber}-${idx}`} className="rp-sub-row">
                            <td></td><td></td>
                            <td className="rp-mono" style={{ color: C.mutedFg }}>{item.partNumber || "—"}</td>
                            <td colSpan={2} style={{ fontWeight: 700 }}>{item.partName || "—"}</td>
                            <td></td>
                            <td className="rp-mono" style={{ color: C.amber }}>{item.qty} × {fmtC(item.pricePerPart)}</td>
                            <td className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rp-total">
              <span>WOs: <span className="rp-mono">{woMap.length}</span></span>
              <span>Parts: <span className="rp-mono" style={{ color: C.amber }}>{summary.totalUnits}</span></span>
              <span>Total: <span className="rp-mono" style={{ color: C.green }}>{fmtC(summary.totalCost)}</span></span>
            </div>
          </div>

          {/* VENDOR BREAKDOWN */}
          <Divider label="Vendor Breakdown" />
          <div className="rp-charts-grid">
            <div className="rp-card">
              <div className="rp-card-hd"><Building2 size={13} color={C.blue} /><span className="rp-card-title">Cost by Vendor</span></div>
              {vendorMap.map((v, i) => (
                <div key={i} style={{ padding: "8px 12px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: PIE[i % PIE.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{(v.vendor || "?")[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.vendor}</span>
                      <span style={{ fontWeight: 800, fontSize: 12, color: C.green, flexShrink: 0, marginLeft: 6 }}>{fmtC(v.totalCost)}</span>
                    </div>
                    <div className="rp-bar-bg"><div className="rp-bar-fill" style={{ width: `${(v.totalCost / maxVCost) * 100}%`, background: PIE[i % PIE.length] }} /></div>
                    <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 9, color: C.mutedFg }}>
                      <span>{v.totalQty} units</span><span>{v.woSet.size} WOs</span><span style={{ color: C.purple, fontWeight: 700 }}>{((v.totalCost / (summary.totalCost || 1)) * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rp-card">
              <div className="rp-card-hd"><TrendingUp size={13} color={C.purple} /><span className="rp-card-title">Cost Split</span></div>
              <div style={{ padding: "6px 2px" }}>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={vendorPie} cx="50%" cy="50%" innerRadius={48} outerRadius={78} paddingAngle={3} dataKey="value" label={({ percent }) => `${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {vendorPie.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtC(v)} contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* VENDOR CARDS */}
          <div className="rp-vendor-grid">
            {vendorMap.map((v, i) => (
              <div key={i} className="rp-vcard">
                <div className="rp-vcard-name"><div style={{ width: 22, height: 22, borderRadius: "50%", background: PIE[i % PIE.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 10, fontWeight: 800, flexShrink: 0 }}>{(v.vendor || "?")[0].toUpperCase()}</div>{v.vendor}</div>
                <div className="rp-vstats">
                  <div className="rp-vstat"><div className="rp-vstat-lbl">Cost</div><div className="rp-vstat-val" style={{ color: C.green }}>{fmtC(v.totalCost)}</div></div>
                  <div className="rp-vstat"><div className="rp-vstat-lbl">Units</div><div className="rp-vstat-val" style={{ color: C.blue }}>{v.totalQty}</div></div>
                  <div className="rp-vstat"><div className="rp-vstat-lbl">WOs</div><div className="rp-vstat-val" style={{ color: C.purple }}>{v.woSet.size}</div></div>
                </div>
                <div className="rp-vparts">
                  {Object.entries(v.parts).sort((a, b) => b[1].cost - a[1].cost).slice(0, 4).map(([pn, pd], pi) => (
                    <div key={pi} className="rp-vpart-row">
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 120 }}>{pn}</span>
                      <span className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(pd.cost)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* PERSON TABLE */}
          <Divider label="Person Breakdown" />
          <div className="rp-card">
            <div className="rp-card-hd"><User size={13} color={C.purple} /><span className="rp-card-title">Usage by Person</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>Person</th><th>Qty</th><th>Cost</th><th>%</th><th>WOs</th></tr></thead><tbody>
              {personMap.map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 700 }}>{p.name}</td>
                  <td className="rp-mono" style={{ color: C.amber, fontWeight: 700 }}>{p.totalQty}</td>
                  <td className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(p.totalCost)}</td>
                  <td className="rp-mono" style={{ color: C.blue }}>{((p.totalCost / (summary.totalCost || 1)) * 100).toFixed(1)}%</td>
                  <td className="rp-mono">{p.woSet.size}</td>
                </tr>
              ))}
            </tbody></table></div>
          </div>

          {/* PART TABLE */}
          <Divider label="Part Breakdown" />
          <div className="rp-card">
            <div className="rp-card-hd"><Package size={13} color={C.amber} /><span className="rp-card-title">Usage by Part</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>#</th><th>Part</th><th>Qty</th><th>Cost</th><th>%</th></tr></thead><tbody>
              {partMap.map((p, i) => (
                <tr key={i}>
                  <td className="rp-mono" style={{ color: C.mutedFg }}>{i + 1}</td>
                  <td style={{ fontWeight: 700 }}>{p.partName}</td>
                  <td className="rp-mono" style={{ color: C.amber, fontWeight: 700 }}>{p.totalQty}</td>
                  <td className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(p.totalCost)}</td>
                  <td className="rp-mono" style={{ color: C.blue }}>{((p.totalCost / (summary.totalCost || 1)) * 100).toFixed(1)}%</td>
                </tr>
              ))}
            </tbody></table></div>
            <div className="rp-total"><span>Total: <span className="rp-mono" style={{ color: C.green }}>{fmtC(summary.totalCost)}</span></span></div>
          </div>

          {/* DAILY CHART */}
          {dailyChart.length > 1 && <>
            <Divider label="Spend Trend" />
            <div className="rp-card">
              <div className="rp-card-hd"><TrendingUp size={13} color={C.blue} /><span className="rp-card-title">Daily Cost — {label}</span></div>
              <div style={{ padding: "10px 6px 4px" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={dailyChart} margin={{ top: 4, right: 10, bottom: 28, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="date" angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: C.mutedFg }} />
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 9, fill: C.mutedFg }} />
                    <Tooltip formatter={(v: any) => fmtC(v)} contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                    <Line type="monotone" dataKey="cost" stroke={C.blue} strokeWidth={2} dot={{ r: 2.5, fill: C.blue }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>}

          {/* ALL TRANSACTIONS */}
          <Divider label="All Transactions" />
          <div className="rp-card">
            <div className="rp-card-hd"><ShoppingCart size={13} color={C.teal} /><span className="rp-card-title">Transaction Log</span><span style={{ fontSize: 10, color: C.mutedFg }}>{allRows.length} records</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>Date</th><th>Person</th><th>Vendor</th><th>Part</th><th>WO #</th><th>Qty</th><th>Total</th></tr></thead><tbody>
              {[...allRows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((r, i) => (
                <tr key={i}>
                  <td className="rp-mono">{fmtD(r.date)}</td>
                  <td style={{ fontWeight: 600 }}>{r.completedBy || "—"}</td>
                  <td style={{ color: C.blue, fontWeight: 600 }}>{r.vendor || "—"}</td>
                  <td style={{ fontWeight: 700 }}>{r.partName || "—"}</td>
                  <td className="rp-mono" style={{ color: C.blue }}>{r.woNumber || "—"}</td>
                  <td className="rp-mono" style={{ color: C.amber, fontWeight: 700 }}>{r.qty}</td>
                  <td className="rp-mono" style={{ color: C.green, fontWeight: 800 }}>{fmtC(r.lineTotal)}</td>
                </tr>
              ))}
            </tbody></table></div>
            <div className="rp-total"><span>Records: <span className="rp-mono">{allRows.length}</span></span><span>Total: <span className="rp-mono" style={{ color: C.green }}>{fmtC(summary.totalCost)}</span></span></div>
          </div>
        </>}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   WORK ORDER REPORT
   API: GET /getAllWorkOrdersReport
═══════════════════════════════════════════════════ */
function WorkOrderReport({ authFetch, userName }: { authFetch: AuthFetch; userName?: string }) {
  const [wos, setWos] = useState<WO[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [mOff, setMOff] = useState(0); const [wOff, setWOff] = useState(0); const [yOff, setYOff] = useState(0);
  const [stFil, setStFil] = useState("all"); const [venFil, setVenFil] = useState("all");
  const label = periodLabel(period, mOff, wOff, yOff);

  useEffect(() => { setLoading(true); api<WO[]>(authFetch, `${API_BASE}/getAllWorkOrdersReport`).then(d => setWos(d || [])).finally(() => setLoading(false)); }, [authFetch]);

  const vendors = useMemo(() => [...new Set(wos.map(w => w.vendor || w.mechanic).filter(Boolean))], [wos]);
  const filtered = useMemo(() => {
    let list = filterByPeriod(wos, "start_time", period, mOff, wOff, yOff);
    if (stFil !== "all") list = list.filter(w => (w.status || "").toLowerCase() === stFil);
    if (venFil !== "all") list = list.filter(w => (w.vendor || w.mechanic) === venFil);
    return list;
  }, [wos, period, mOff, wOff, yOff, stFil, venFil]);

  const stats = useMemo(() => ({
    total: filtered.length,
    completed: filtered.filter(w => ["completed", "invoiced"].includes((w.status || "").toLowerCase())).length,
    pending: filtered.filter(w => ["pending", "open"].includes((w.status || "").toLowerCase())).length,
    inProg: filtered.filter(w => ["in_progress", "in progress"].includes((w.status || "").toLowerCase())).length,
    totalCost: filtered.reduce((s, w) => s + (w.grand_total || 0), 0),
  }), [filtered]);

  const byVendor = useMemo(() => {
    const m: Record<string, { count: number; cost: number }> = {};
    filtered.forEach(w => { const v = w.vendor || w.mechanic || "Unassigned"; if (!m[v]) m[v] = { count: 0, cost: 0 }; m[v].count++; m[v].cost += w.grand_total || 0; });
    return Object.entries(m).sort((a, b) => b[1].cost - a[1].cost).map(([name, d]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, count: d.count, cost: parseFloat(d.cost.toFixed(2)) }));
  }, [filtered]);

  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    filtered.forEach(w => { const s = w.status || "unknown"; m[s] = (m[s] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  return (
    <div className="rp-fade">
      <div className="rp-filters">
        <PeriodNav period={period} setPeriod={setPeriod} mOff={mOff} setMOff={setMOff} wOff={wOff} setWOff={setWOff} yOff={yOff} setYOff={setYOff} />
        <div className="rp-fi"><span className="rp-lbl">Status</span><select className="rp-sel" value={stFil} onChange={e => setStFil(e.target.value)}><option value="all">All</option><option value="pending">Pending</option><option value="open">Open</option><option value="in_progress">In Progress</option><option value="completed">Completed</option></select></div>
        <div className="rp-fi"><span className="rp-lbl">Vendor</span><select className="rp-sel" value={venFil} onChange={e => setVenFil(e.target.value)}><option value="all">All</option>{vendors.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
        <div style={{ display: "flex", alignItems: "flex-end" }}><button className="rp-pdf" onClick={() => buildWorkOrderReportPdf(filtered, label, userName)}><Printer size={12} /> PDF</button></div>
      </div>
      {loading && <Spin text="Loading work orders…" />}
      {!loading && <>
        <StatCards stats={[
          { l: "Total WOs", v: String(stats.total), c: C.blue, bg: C.blueBg, bd: C.blueBdr },
          { l: "Completed", v: String(stats.completed), c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: "Pending", v: String(stats.pending), c: C.amber, bg: C.amberBg, bd: C.amberBdr },
          { l: "In Progress", v: String(stats.inProg), c: C.purple, bg: C.purpBg, bd: C.purpBdr },
          { l: "Total Cost", v: fmtC(stats.totalCost), c: C.green, bg: C.greenBg, bd: C.greenBdr },
        ]} />
        {filtered.length === 0 ? <Empty text={`No work orders for ${label}`} /> : <>
          <div className="rp-charts-grid">
            <div className="rp-card">
              <div className="rp-card-hd"><BarChart2 size={12} color={C.blue} /><span className="rp-card-title">Cost by Vendor</span></div>
              <div style={{ padding: "8px 4px 4px" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={byVendor} margin={{ top: 4, right: 6, bottom: 34, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: C.mutedFg }} /><YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 9, fill: C.mutedFg }} />
                    <Tooltip formatter={(v: any, n: string) => [n === "cost" ? fmtC(v) : v, n === "cost" ? "Cost" : "WOs"]} contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                    <Bar dataKey="cost" fill={C.blue} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rp-card">
              <div className="rp-card-hd"><TrendingUp size={12} color={C.purple} /><span className="rp-card-title">By Status</span></div>
              <div style={{ padding: "8px 4px 4px" }}>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart><Pie data={byStatus} cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{byStatus.map((_, i) => <Cell key={i} fill={PIE[i % PIE.length]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, fontSize: 10 }} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-hd"><FileText size={13} color={C.blue} /><span className="rp-card-title">Work Orders</span><span style={{ fontSize: 10, color: C.mutedFg }}>{filtered.length}</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>WO #</th><th>Asset</th><th>Vendor</th><th>Status</th><th>Start</th><th>Cost</th></tr></thead><tbody>
              {filtered.map((wo, i) => { const sc = sColor(wo.status); return (
                <tr key={i}>
                  <td className="rp-mono" style={{ color: C.blue, fontWeight: 700 }}>{wo.work_order_number || "—"}</td>
                  <td className="rp-mono">{wo.asset_number || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{wo.vendor || wo.mechanic || "—"}</td>
                  <td><span className="rp-badge" style={{ background: sc.bg, borderColor: sc.bd, color: sc.tx }}>{wo.status || "—"}</span></td>
                  <td className="rp-mono">{fmtD(wo.start_time)}</td>
                  <td className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(wo.grand_total || 0)}</td>
                </tr>); })}
            </tbody></table></div>
            <div className="rp-total"><span>Records: <span className="rp-mono">{filtered.length}</span></span><span>Total: <span className="rp-mono" style={{ color: C.green }}>{fmtC(stats.totalCost)}</span></span></div>
          </div>
        </>}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INSPECTION REPORT
   APIs: GET /getAllInspectionsReport + /getAllQuickInspectionsReport
═══════════════════════════════════════════════════ */
function InspectionReport({ authFetch, userName }: { authFetch: AuthFetch; userName?: string }) {
  const [dotList, setDotList] = useState<Insp[]>([]); const [quickList, setQuickList] = useState<Insp[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [mOff, setMOff] = useState(0); const [wOff, setWOff] = useState(0); const [yOff, setYOff] = useState(0);
  const [typeFil, setTypeFil] = useState("all"); const [stFil, setStFil] = useState("all");
  const label = periodLabel(period, mOff, wOff, yOff);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Insp[]>(authFetch, `${API_BASE}/getAllInspectionsReport`),
      api<Insp[]>(authFetch, `${API_BASE}/getAllQuickInspectionsReport`),
    ]).then(([dot, quick]) => { setDotList(dot || []); setQuickList(quick || []); }).finally(() => setLoading(false));
  }, [authFetch]);

  const all = useMemo(() => [...dotList.map(i => ({ ...i, _type: "DOT" as const })), ...quickList.map(i => ({ ...i, _type: "Quick" as const }))], [dotList, quickList]);
  const filtered = useMemo(() => {
    let list = filterByPeriod(all, "created_at", period, mOff, wOff, yOff);
    if (typeFil !== "all") list = list.filter(i => i._type?.toLowerCase() === typeFil);
    if (stFil === "passed") list = list.filter(i => ["passed", "pass"].includes((i.overall_status || "").toLowerCase()));
    if (stFil === "failed") list = list.filter(i => ["failed", "fail"].includes((i.overall_status || "").toLowerCase()));
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [all, period, mOff, wOff, yOff, typeFil, stFil]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const passed = filtered.filter(i => ["passed", "pass"].includes((i.overall_status || "").toLowerCase())).length;
    const failed = filtered.filter(i => ["failed", "fail"].includes((i.overall_status || "").toLowerCase())).length;
    const dotC = filtered.filter(i => i._type === "DOT").length;
    const quickC = filtered.filter(i => i._type === "Quick").length;
    const scored = filtered.filter(i => i.inspection_score != null);
    const avgScore = scored.length ? (scored.reduce((s, i) => s + (i.inspection_score || 0), 0) / scored.length).toFixed(1) : "—";
    return { total, passed, failed, dotC, quickC, avgScore };
  }, [filtered]);

  const passFailPie = [{ name: "Passed", value: stats.passed }, { name: "Failed", value: stats.failed }, { name: "Other", value: stats.total - stats.passed - stats.failed }].filter(d => d.value > 0);

  return (
    <div className="rp-fade">
      <div className="rp-filters">
        <PeriodNav period={period} setPeriod={setPeriod} mOff={mOff} setMOff={setMOff} wOff={wOff} setWOff={setWOff} yOff={yOff} setYOff={setYOff} />
        <div className="rp-fi"><span className="rp-lbl">Type</span><select className="rp-sel" value={typeFil} onChange={e => setTypeFil(e.target.value)}><option value="all">All</option><option value="dot">DOT</option><option value="quick">Quick</option></select></div>
        <div className="rp-fi"><span className="rp-lbl">Result</span><select className="rp-sel" value={stFil} onChange={e => setStFil(e.target.value)}><option value="all">All</option><option value="passed">Passed</option><option value="failed">Failed</option></select></div>
        <div style={{ display: "flex", alignItems: "flex-end" }}><button className="rp-pdf" onClick={() => buildInspectionReportPdf(filtered, label, userName)}><Printer size={12} /> PDF</button></div>
      </div>
      {loading && <Spin text="Loading inspections…" />}
      {!loading && <>
        <StatCards stats={[
          { l: "Total", v: String(stats.total), c: C.blue, bg: C.blueBg, bd: C.blueBdr },
          { l: "Passed", v: String(stats.passed), c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: "Failed", v: String(stats.failed), c: C.red, bg: C.redBg, bd: C.redBdr },
          { l: "DOT", v: String(stats.dotC), c: C.purple, bg: C.purpBg, bd: C.purpBdr },
          { l: "Quick", v: String(stats.quickC), c: C.amber, bg: C.amberBg, bd: C.amberBdr },
          { l: "Pass Rate", v: stats.total ? `${((stats.passed / stats.total) * 100).toFixed(1)}%` : "—", c: C.green, bg: C.greenBg, bd: C.greenBdr },
        ]} />
        {filtered.length === 0 ? <Empty text={`No inspections for ${label}`} /> : <>
          <div className="rp-charts-grid">
            <div className="rp-card">
              <div className="rp-card-hd"><ClipboardCheck size={12} color={C.green} /><span className="rp-card-title">Pass / Fail</span></div>
              <div style={{ padding: "6px 2px 2px" }}>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart><Pie data={passFailPie} cx="50%" cy="50%" innerRadius={36} outerRadius={62} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>{passFailPie.map((_, i) => <Cell key={i} fill={[C.green, C.red, C.amber][i]} />)}</Pie><Tooltip contentStyle={{ borderRadius: 8, fontSize: 10 }} /></PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          <div className="rp-card">
            <div className="rp-card-hd"><ClipboardCheck size={13} color={C.blue} /><span className="rp-card-title">Inspections</span><span style={{ fontSize: 10, color: C.mutedFg }}>{filtered.length}</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>Date</th><th>Type</th><th>Asset</th><th>Inspector</th><th>Result</th><th>Score</th></tr></thead><tbody>
              {filtered.map((ins, idx) => { const sc = sColor(ins.overall_status); return (
                <tr key={idx}>
                  <td className="rp-mono">{fmtD(ins.created_at || "")}</td>
                  <td><span className="rp-badge" style={{ background: ins._type === "DOT" ? C.purpBg : C.amberBg, borderColor: ins._type === "DOT" ? C.purpBdr : C.amberBdr, color: ins._type === "DOT" ? C.purple : C.amber }}>{ins._type}</span></td>
                  <td className="rp-mono" style={{ fontWeight: 700 }}>{ins.asset_number || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{ins.technician_name || ins.inspector_name || "—"}</td>
                  <td><span className="rp-badge" style={{ background: sc.bg, borderColor: sc.bd, color: sc.tx }}>{ins.overall_status || "—"}</span></td>
                  <td className="rp-mono">{ins.inspection_score != null ? <span style={{ color: ins.inspection_score >= 80 ? C.green : ins.inspection_score >= 60 ? C.amber : C.red, fontWeight: 700 }}>{ins.inspection_score}%</span> : "—"}</td>
                </tr>); })}
            </tbody></table></div>
          </div>
        </>}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INVOICE REPORT
   API: GET /getAllInvoices
═══════════════════════════════════════════════════ */
function InvoiceReport({ authFetch, userName }: { authFetch: AuthFetch; userName?: string }) {
  const [invoices, setInvoices] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<Period>("monthly");
  const [mOff, setMOff] = useState(0); const [wOff, setWOff] = useState(0); const [yOff, setYOff] = useState(0);
  const [payFil, setPayFil] = useState("all"); const [venFil, setVenFil] = useState("all");
  const label = periodLabel(period, mOff, wOff, yOff);

  useEffect(() => { setLoading(true); api<Inv[]>(authFetch, `${API_BASE}/getAllInvoices`).then(d => setInvoices(d || [])).finally(() => setLoading(false)); }, [authFetch]);

  const vendors = useMemo(() => [...new Set(invoices.map(i => i.vendor || i.mechanic).filter(Boolean))], [invoices]);
  const payTypes = useMemo(() => [...new Set(invoices.map(i => i.payment_type).filter(Boolean))], [invoices]);

  const filtered = useMemo(() => {
    let list = filterByPeriod(invoices, "created_at", period, mOff, wOff, yOff);
    if (payFil !== "all") list = list.filter(i => i.payment_type === payFil);
    if (venFil !== "all") list = list.filter(i => (i.vendor || i.mechanic) === venFil);
    return list.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
  }, [invoices, period, mOff, wOff, yOff, payFil, venFil]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalRevenue = filtered.reduce((s, i) => s + (i.grand_total || 0), 0);
    const totalLabor = filtered.reduce((s, i) => s + (i.labor_cost || 0), 0);
    const totalParts = filtered.reduce((s, i) => s + (i.parts_cost || 0), 0);
    const totalTax = filtered.reduce((s, i) => s + (i.sales_tax || 0), 0);
    const totalCCFee = filtered.reduce((s, i) => s + (i.credit_card_fee || 0), 0);
    const avgInvoice = total > 0 ? totalRevenue / total : 0;
    return { total, totalRevenue, totalLabor, totalParts, totalTax, totalCCFee, avgInvoice };
  }, [filtered]);

  const byVendor = useMemo(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    filtered.forEach(i => { const v = i.vendor || i.mechanic || "Unassigned"; if (!m[v]) m[v] = { count: 0, revenue: 0 }; m[v].count++; m[v].revenue += i.grand_total || 0; });
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, d]) => ({ name: name.length > 14 ? name.slice(0, 14) + "…" : name, count: d.count, revenue: parseFloat(d.revenue.toFixed(2)) }));
  }, [filtered]);

  const costBreakdown = useMemo(() => [
    { name: "Labor", value: parseFloat(stats.totalLabor.toFixed(2)) },
    { name: "Parts", value: parseFloat(stats.totalParts.toFixed(2)) },
    { name: "Tax", value: parseFloat(stats.totalTax.toFixed(2)) },
    { name: "CC Fee", value: parseFloat(stats.totalCCFee.toFixed(2)) },
  ].filter(d => d.value > 0), [stats]);

  const byOwner = useMemo(() => {
    const m: Record<string, { count: number; revenue: number }> = {};
    filtered.forEach(i => { const o = i.owner_name || "Unknown"; if (!m[o]) m[o] = { count: 0, revenue: 0 }; m[o].count++; m[o].revenue += i.grand_total || 0; });
    return Object.entries(m).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10).map(([name, d]) => ({ name: name.length > 16 ? name.slice(0, 16) + "…" : name, count: d.count, revenue: parseFloat(d.revenue.toFixed(2)) }));
  }, [filtered]);

  return (
    <div className="rp-fade">
      <div className="rp-filters">
        <PeriodNav period={period} setPeriod={setPeriod} mOff={mOff} setMOff={setMOff} wOff={wOff} setWOff={setWOff} yOff={yOff} setYOff={setYOff} />
        <div className="rp-fi"><span className="rp-lbl">Payment</span><select className="rp-sel" value={payFil} onChange={e => setPayFil(e.target.value)}><option value="all">All</option>{payTypes.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
        <div className="rp-fi"><span className="rp-lbl">Vendor</span><select className="rp-sel" value={venFil} onChange={e => setVenFil(e.target.value)}><option value="all">All</option>{vendors.map(v => <option key={v} value={v}>{v}</option>)}</select></div>
        <div style={{ display: "flex", alignItems: "flex-end" }}>
          {/* ✅ Was window.print() — printed the whole browser chrome (header,
              nav, devtools panel). Now uses the dedicated invoice PDF builder
              that matches the workorder/inspection report layouts. */}
          <button className="rp-pdf" onClick={() => buildInvoiceReportPdf(filtered, label, userName)}>
            <Printer size={12} /> PDF
          </button>
        </div>
      </div>
      {loading && <Spin text="Loading invoices…" />}
      {!loading && <>
        <StatCards stats={[
          { l: "Invoices", v: String(stats.total), c: C.blue, bg: C.blueBg, bd: C.blueBdr },
          { l: "Revenue", v: fmtC(stats.totalRevenue), c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: "Avg", v: fmtC(stats.avgInvoice), c: C.teal, bg: C.tealBg, bd: C.tealBdr },
          { l: "Labor", v: fmtC(stats.totalLabor), c: C.purple, bg: C.purpBg, bd: C.purpBdr },
          { l: "Parts", v: fmtC(stats.totalParts), c: C.amber, bg: C.amberBg, bd: C.amberBdr },
          { l: "Tax", v: fmtC(stats.totalTax), c: C.red, bg: C.redBg, bd: C.redBdr },
        ]} />
        {filtered.length === 0 ? <Empty text={`No invoices for ${label}`} /> : <>
          <div className="rp-charts-grid">
            <div className="rp-card">
              <div className="rp-card-hd"><Building2 size={12} color={C.blue} /><span className="rp-card-title">Revenue by Vendor</span></div>
              <div style={{ padding: "8px 4px 4px" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={byVendor} margin={{ top: 4, right: 6, bottom: 34, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="name" angle={-30} textAnchor="end" tick={{ fontSize: 9, fill: C.mutedFg }} />
                    <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 9, fill: C.mutedFg }} />
                    <Tooltip formatter={(v: any) => fmtC(v)} contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                    <Bar dataKey="revenue" fill={C.green} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rp-card">
              <div className="rp-card-hd"><DollarSign size={12} color={C.green} /><span className="rp-card-title">Cost Breakdown</span></div>
              <div style={{ padding: "6px 2px" }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={costBreakdown} cx="50%" cy="50%" innerRadius={42} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {costBreakdown.map((_, i) => <Cell key={i} fill={[C.purple, C.amber, C.red, C.blue][i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtC(v)} contentStyle={{ borderRadius: 8, fontSize: 10 }} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Customers */}
          {byOwner.length > 0 && <>
            <Divider label="Top Customers" />
            <div className="rp-card">
              <div className="rp-card-hd"><User size={13} color={C.purple} /><span className="rp-card-title">Customer Revenue</span></div>
              <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>#</th><th>Customer</th><th>Inv</th><th>Revenue</th><th>%</th></tr></thead><tbody>
                {byOwner.map((o, i) => (
                  <tr key={i}>
                    <td className="rp-mono" style={{ color: C.mutedFg }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{o.name}</td>
                    <td className="rp-mono" style={{ color: C.blue, fontWeight: 700 }}>{o.count}</td>
                    <td className="rp-mono" style={{ color: C.green, fontWeight: 700 }}>{fmtC(o.revenue)}</td>
                    <td className="rp-mono" style={{ color: C.purple }}>{((o.revenue / (stats.totalRevenue || 1)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody></table></div>
            </div>
          </>}

          {/* Invoice Table */}
          <Divider label="All Invoices" />
          <div className="rp-card">
            <div className="rp-card-hd"><FileText size={13} color={C.blue} /><span className="rp-card-title">Invoices</span><span style={{ fontSize: 10, color: C.mutedFg }}>{filtered.length}</span></div>
            <div className="rp-tw"><table className="rp-tbl"><thead><tr><th>Date</th><th>Inv #</th><th>Customer</th><th>Vendor</th><th>Labor</th><th>Parts</th><th>Total</th><th>PDF</th></tr></thead><tbody>
              {filtered.map((inv, i) => (
                <tr key={i}>
                  <td className="rp-mono">{fmtD(inv.created_at)}</td>
                  <td className="rp-mono" style={{ color: C.blue, fontWeight: 700 }}>{inv.invoice_number || "—"}</td>
                  <td style={{ fontWeight: 600 }}>{inv.owner_name || "—"}</td>
                  <td style={{ color: C.blue, fontWeight: 600 }}>{inv.vendor || inv.mechanic || "—"}</td>
                  <td className="rp-mono">{fmtC(inv.labor_cost)}</td>
                  <td className="rp-mono">{fmtC(inv.parts_cost)}</td>
                  <td className="rp-mono" style={{ color: C.green, fontWeight: 800 }}>{fmtC(inv.grand_total)}</td>
                  <td>{inv.invoice_url ? <a href={inv.invoice_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 9, fontWeight: 700, color: C.green, padding: "2px 6px", borderRadius: 99, background: C.greenBg, border: `1px solid ${C.greenBdr}`, textDecoration: "none" }}>View</a> : <span style={{ fontSize: 9, color: C.mutedFg }}>—</span>}</td>
                </tr>
              ))}
            </tbody></table></div>
            <div className="rp-total">
              <span>Labor: <span className="rp-mono" style={{ color: C.purple }}>{fmtC(stats.totalLabor)}</span></span>
              <span>Parts: <span className="rp-mono" style={{ color: C.amber }}>{fmtC(stats.totalParts)}</span></span>
              <span>Revenue: <span className="rp-mono" style={{ color: C.green }}>{fmtC(stats.totalRevenue)}</span></span>
            </div>
          </div>
        </>}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   INVENTORY UPDATES (AUDIT) REPORT
   Source: Airtable "Inventory Updates" table — who changed which part's
   quantity, when, and by how much. Generates a PDF and emails it to
   satyam@handatransportation.com.
═══════════════════════════════════════════════════ */
function InventoryUpdatesReport({ authFetch, userName }: { authFetch: AuthFetch; userName?: string }) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<Period>("monthly");
  const [mOff, setMOff] = useState(0); const [wOff, setWOff] = useState(0); const [yOff, setYOff] = useState(0);
  const [logs, setLogs] = useState<InventoryUpdateLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const label = periodLabel(period, mOff, wOff, yOff);

  useEffect(() => {
    setLoading(true);
    api<InventoryUpdateLog[]>(authFetch, `${API_BASE}/getInventoryUpdateLog`)
      .then(d => setLogs(d || []))
      .finally(() => setLoading(false));
  }, [authFetch]);

  const filtered = useMemo(
    () => filterByPeriod(logs, "updatedAt", period, mOff, wOff, yOff),
    [logs, period, mOff, wOff, yOff],
  );

  const summary = useMemo(() => {
    const adds = filtered.filter(l => l.action === "add").length;
    const people = new Set(filtered.map(l => l.updatedBy).filter(Boolean)).size;
    const unitsAdded = filtered.reduce((s, l) => s + Math.max(l.change, 0), 0);
    const unitsRemoved = filtered.reduce((s, l) => s + Math.max(-l.change, 0), 0);
    return { total: filtered.length, adds, updates: filtered.length - adds, people, unitsAdded, unitsRemoved };
  }, [filtered]);

  async function emailReport() {
    if (!isEmailConfigured()) { toast.error(t("inventory.manage.emailNotConfigured")); return; }
    try {
      setEmailing(true);
      await sendInventoryReportEmail(filtered, label, userName);
      toast.success(t("inventory.manage.emailSent", { email: INVENTORY_REPORT_RECIPIENT }));
    } catch (e) {
      console.error(e);
      toast.error(t("inventory.manage.emailFailed"));
    } finally {
      setEmailing(false);
    }
  }

  return (
    <div className="rp-fade">
      <div className="rp-filters">
        <PeriodNav period={period} setPeriod={setPeriod} mOff={mOff} setMOff={setMOff} wOff={wOff} setWOff={setWOff} yOff={yOff} setYOff={setYOff} />
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
          <button className="rp-pdf" onClick={() => buildInventoryUpdatesReportPdf(filtered, label, userName)}>
            <Printer size={12} /> PDF
          </button>
          <button className="rp-pdf" style={{ background: C.blue, color: "#fff", borderColor: C.blue }} onClick={emailReport} disabled={emailing}>
            {emailing ? <Loader2 size={12} className="rp-spin" /> : <Mail size={12} />} {t("inventory.manage.emailReport")}
          </button>
        </div>
      </div>

      {loading && <Spin text={t("inventory.manage.loadingLog")} />}
      {!loading && <>
        <StatCards stats={[
          { l: t("inventory.manage.totalChanges"), v: String(summary.total), c: C.blue, bg: C.blueBg, bd: C.blueBdr },
          { l: t("inventory.manage.qtyUpdates"), v: String(summary.updates), c: C.purple, bg: C.purpBg, bd: C.purpBdr },
          { l: t("inventory.manage.newParts"), v: String(summary.adds), c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: t("inventory.manage.people"), v: String(summary.people), c: C.teal, bg: C.tealBg, bd: C.tealBdr },
          { l: t("inventory.manage.unitsAdded"), v: `+${summary.unitsAdded}`, c: C.green, bg: C.greenBg, bd: C.greenBdr },
          { l: t("inventory.manage.unitsRemoved"), v: `-${summary.unitsRemoved}`, c: C.red, bg: C.redBg, bd: C.redBdr },
        ]} />

        {filtered.length === 0 ? <Empty text={t("inventory.manage.noLogForPeriod", { period: label })} /> : <>
          <Divider label={t("inventory.manage.allUpdates")} />
          <div className="rp-card">
            <div className="rp-card-hd">
              <Boxes size={13} color={C.blue} />
              <span className="rp-card-title">{t("inventory.manage.title")}</span>
              <span style={{ fontSize: 10, color: C.mutedFg }}>{filtered.length} {t("inventory.manage.records")}</span>
            </div>
            <div className="rp-tw">
              <table className="rp-tbl">
                <thead><tr>
                  <th>{t("inventory.manage.dateTime")}</th>
                  <th>{t("inventory.manage.part")}</th>
                  <th>{t("inventory.manage.action")}</th>
                  <th>{t("inventory.manage.prev")}</th>
                  <th>{t("inventory.manage.newQ")}</th>
                  <th>{t("inventory.manage.change")}</th>
                  <th>{t("inventory.manage.by")}</th>
                  <th>{t("inventory.manage.note")}</th>
                </tr></thead>
                <tbody>
                  {filtered.map(l => {
                    const chgColor = l.change > 0 ? C.green : l.change < 0 ? C.red : C.mutedFg;
                    return (
                      <tr key={l.id}>
                        <td className="rp-mono">{fmtD(l.updatedAt)}</td>
                        <td style={{ fontWeight: 700 }}>{l.partName || l.partNumber || "—"}</td>
                        <td>{l.action === "add" ? t("inventory.manage.added") : t("inventory.manage.update")}</td>
                        <td className="rp-mono">{l.previousQty}</td>
                        <td className="rp-mono" style={{ fontWeight: 700 }}>{l.newQty}</td>
                        <td className="rp-mono" style={{ color: chgColor, fontWeight: 700 }}>{l.change >= 0 ? "+" : ""}{l.change}</td>
                        <td style={{ fontWeight: 600 }}>{l.updatedBy || "—"}</td>
                        <td style={{ color: C.mutedFg }}>{l.note || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="rp-total">
              <span>{t("inventory.manage.records")}: <span className="rp-mono">{filtered.length}</span></span>
              <span>{t("inventory.manage.unitsAdded")}: <span className="rp-mono" style={{ color: C.green }}>+{summary.unitsAdded}</span></span>
              <span>{t("inventory.manage.unitsRemoved")}: <span className="rp-mono" style={{ color: C.red }}>-{summary.unitsRemoved}</span></span>
            </div>
          </div>
        </>}
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
export default function ReportsPage() {
  const { t } = useTranslation();
  const { user, authFetch } = useAuth();
  const isAdmin = (user?.role || "").toLowerCase().includes("admin");
  const [tab, setTab] = useState<"inventory" | "updates" | "workorder" | "inspection" | "invoice">("inventory");

  if (!isAdmin) return (
    <><style>{CSS}</style>
      <div style={{ padding: 40, textAlign: "center", color: C.mutedFg }}>
        <AlertCircle size={36} color={C.red} style={{ margin: "0 auto 10px", display: "block" }} />
        <div style={{ fontSize: 16, fontWeight: 800, color: C.red, marginBottom: 4 }}>{t("auth.accessDenied")}</div>
        <div style={{ fontSize: 12 }}>{t("auth.adminOnly")}</div>
      </div>
    </>
  );

  return (
    <><style>{CSS}</style>
      <div className="rp-root">
        <div className="rp-header">
          <div className="rp-header-inner">
            <div className="rp-title"><BarChart2 size={15} color={C.blue} />{t("reports.title")}</div>
            <div className="rp-nav">
              {([
                { val: "inventory" as const, label: `📦 ${t("reports.usage")}` },
                { val: "updates" as const, label: `📝 ${t("inventory.manage.updatesTab")}` },
                { val: "workorder" as const, label: `🔧 ${t("reports.workOrders")}` },
                { val: "inspection" as const, label: `✅ ${t("reports.inspections")}` },
                { val: "invoice" as const, label: `💰 ${t("reports.invoices")}` },
              ]).map(item => (
                <button key={item.val} className={`rp-nav-btn ${tab === item.val ? "active" : ""}`} onClick={() => setTab(item.val)}>{item.label}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="rp-body">
          <div className="rp-body-inner">
            {tab === "inventory" && <InventoryReport authFetch={authFetch} userName={user?.name} />}
            {tab === "updates" && <InventoryUpdatesReport authFetch={authFetch} userName={user?.name} />}
            {tab === "workorder" && <WorkOrderReport authFetch={authFetch} userName={user?.name} />}
            {tab === "inspection" && <InspectionReport authFetch={authFetch} userName={user?.name} />}
            {tab === "invoice" && <InvoiceReport authFetch={authFetch} userName={user?.name} />}
          </div>
        </div>
      </div>
    </>
  );
}