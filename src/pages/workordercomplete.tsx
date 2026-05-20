import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  Clock, DollarSign, Package, FileText, CheckCircle2,
  Loader2, ChevronRight, Printer, Save,
  Plus, Trash2, Wrench, Search, Receipt, Eye,
  Edit3, ArrowLeft, X, AlertCircle, Hash,
  User, Info, Truck, CheckCircle, Download,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";
import { tStatus, tPriority, tPaymentType } from "../utils/i18nDisplay";

type WorkOrder = {
  id: string;
  airtable_id?: string;
  work_order_number: string;
  asset_type: "Truck" | "Trailer";
  asset_unit_number: string;
  asset_id: string;
  mechanic: string;
  description: string;
  status: string;
  priority?: string;
  owner_name?: string;
  owner_email?: string;
  vin?: string;
  year?: string | number;
  license?: string;
  make?: string;
  odometer?: string;
  photos?: string[];
  inspection_airtable_id?: string;
  created_at?: string;
  invoice_number?: string;
  grand_total?: number;
  repair_date?: string;
  payment_type?: string;
  labor_cost?: number;
  parts_cost?: number;
  sales_tax?: number;
  credit_card_fee?: number;
  time_hours?: number;
  work_notes?: string;
  inventory_parts?: LineItem[];
  invoice_pdf_url?: string;
  truck_airtable_id?: string;
  trailer_airtable_id?: string;
  inspection_linked_id?: string;
};

type InventoryItem = {
  id: string;
  name: string;
  part_number?: string;
  partNumber?: string;
  cost: number;
  pricePerPart: number;
  quantity_available: number;
  available: number;
  photo?: string;
};

type LineItem = {
  uid: string;
  inventory_id?: string;
  name: string;
  quantity: number;
  unit_cost: number;
  total: number;
};

type PaymentType = "Cash" | "Check" | "Credit Card" | "ACH" | "Zelle" | "Other";
type ViewMode    = "list" | "complete" | "view-invoice";

const LABOR_RATE    = 120;
const CC_FEE_PCT    = 0.035;
const SALES_TAX_PCT = 0.10;
const API_BASE      = apiUrl("/users");

const C = {
  accent:       "#2563eb",
  accentBg:     "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.28)",
  green:        "#16a34a", greenBg: "#dcfce7", greenBorder: "#86efac",
  red:          "#dc2626", redBg:   "#fee2e2", redBorder:   "#fca5a5",
  orange:       "#ea580c", orangeBg:"#fff7ed", orangeBorder:"#fdba74",
  grey:         "#64748b",
  purple:       "#7c3aed", purpleBg:"rgba(124,58,237,0.08)", purpleBorder:"rgba(124,58,237,0.28)",
  yellow:       "#d97706", yellowBg: "#fef9c3", yellowBorder: "#fde68a",
};

const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.65rem 0.75rem",
  background: "var(--input-background)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: "16px",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color .15s",
  WebkitAppearance: "none",
  appearance: "none",
};

/* ══════════════════════════════════════════════════════
   GLOBAL CSS
══════════════════════════════════════════════════════ */
const GLOBAL_CSS = `
*, *::before, *::after {
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
  -webkit-text-size-adjust: 100%;
}

.woc-root {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--background);
  width: 100%;
  overflow-x: hidden;
}

.woc-header {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 20;
  width: 100%;
  overflow: hidden;
}
.woc-header-inner {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 16px 0;
}

.woc-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  width: 100%;
}
.woc-body-inner {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  padding: 14px 16px 100px;
}
.woc-body-inner-narrow {
  width: 100%;
  max-width: 660px;
  margin: 0 auto;
  padding: 14px 16px 100px;
}

@keyframes woc-spin    { to { transform: rotate(360deg); } }
@keyframes woc-fadein  { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:none; } }
@keyframes woc-slideup { from { opacity:0; transform:translateY(100%); } to { opacity:1; transform:translateY(0); } }
.woc-spin   { animation: woc-spin 1s linear infinite; }
.woc-fadein { animation: woc-fadein 0.18s ease both; }

/* TAB BAR */
.tab-btn {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  color: var(--muted-foreground);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}
.tab-btn.active {
  color: var(--foreground);
  border-bottom-color: var(--foreground);
}

/* SEARCH */
.wo-search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  background: var(--card);
  border: 1.5px solid var(--border);
  border-bottom: 1px solid var(--border);
  border-radius: 12px 12px 0 0;
  width: 100%;
}
.wo-search-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 2px 0;
  font-size: 15px;
  color: var(--foreground);
  outline: none;
  font-family: inherit;
  min-width: 0;
}
.wo-search-count {
  font-size: 11px;
  color: var(--muted-foreground);
  flex-shrink: 0;
  font-weight: 600;
  padding-left: 8px;
  border-left: 1px solid var(--border);
  white-space: nowrap;
}

/* TABLE WRAPPER */
.wo-table-wrap {
  border: 1.5px solid var(--border);
  border-radius: 0 0 12px 12px;
  border-top: none;
  overflow: hidden;
  background: var(--card);
  width: 100%;
}

/* DESKTOP TABLE — hidden on mobile */
.wo-desktop-table { display: none; }
.wo-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.wo-table thead tr { background: var(--muted); }
.wo-table thead th {
  padding: 10px 12px;
  text-align: left;
  font-size: 10px;
  font-weight: 800;
  color: var(--muted-foreground);
  text-transform: uppercase;
  letter-spacing: 0.09em;
  white-space: nowrap;
  border-bottom: 2px solid var(--border);
}
.wo-table tbody tr { border-bottom: 1px solid var(--border); transition: background 0.12s; }
.wo-table tbody tr:hover { background: var(--accent); }
.wo-table tbody tr:last-child { border-bottom: none; }
.wo-table td { padding: 10px 12px; vertical-align: middle; }
.tbl-action-btn {
  display: inline-flex; align-items: center; gap: 4px;
  padding: 6px 10px; border-radius: 7px;
  font-size: 11px; font-weight: 700; cursor: pointer;
  font-family: inherit; transition: all 0.15s;
  white-space: nowrap; border: 1.5px solid transparent; min-height: 34px;
}

@media (min-width: 768px) {
  .wo-desktop-table { display: block; overflow-x: auto; }
  .wo-mobile-list   { display: none !important; }
}

/* MOBILE CARDS */
.wo-mobile-list { display: flex; flex-direction: column; width: 100%; }
.wo-card {
  background: var(--card);
  border-bottom: 1px solid var(--border);
  padding: 14px 16px;
  display: flex; flex-direction: column; gap: 10px;
  width: 100%;
}
.wo-card:last-child { border-bottom: none; }
.wo-card-top {
  display: flex; align-items: flex-start;
  justify-content: space-between; gap: 10px; width: 100%;
}
.wo-card-left {
  flex: 1; min-width: 0;
  display: flex; flex-direction: column; gap: 6px;
}
.wo-card-right {
  display: flex; flex-direction: column;
  align-items: flex-end; gap: 4px; flex-shrink: 0;
}
.wo-card-meta {
  display: flex; flex-wrap: wrap;
  gap: 4px 10px; font-size: 12px;
  color: var(--muted-foreground);
}
.wo-card-desc {
  font-size: 12px; color: var(--muted-foreground);
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.wo-card-btns { display: grid; gap: 8px; width: 100%; }
.wo-card-btns.open { grid-template-columns: 1fr; }
.wo-card-btns.done { grid-template-columns: 1fr 1fr; }
.wo-card-btns.done .full-btn { grid-column: 1 / -1; }
.wo-card-btn {
  display: flex; align-items: center; justify-content: center;
  gap: 7px; padding: 13px 10px; border-radius: 10px;
  font-size: 14px; font-weight: 700; cursor: pointer;
  font-family: inherit; border: 1.5px solid transparent;
  transition: opacity 0.15s; min-height: 48px; width: 100%;
  text-align: center;
}
.wo-card-btn:active { opacity: 0.75; }

/* BADGES */
.badge {
  display: inline-flex; align-items: center;
  font-size: 10px; font-weight: 700; padding: 3px 8px;
  border-radius: 99px; text-transform: uppercase;
  letter-spacing: 0.05em; white-space: nowrap;
  border: 1px solid transparent; flex-shrink: 0;
}

/* ══════════════════════════════════════════════
   MODAL OVERLAY
   position:fixed, inset:0 — covers everything
   overflow:hidden — stops body scroll behind it
   NO position:fixed on body (that causes the clip bug)
══════════════════════════════════════════════ */
.woc-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-end;
  overflow: hidden;
  animation: woc-fadein 0.15s ease;
}
@media (min-width: 640px) {
  .woc-modal-overlay {
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
}

/* ══════════════════════════════════════════════
   MODAL BOX
   On mobile: fills full width, slides up from bottom
   max-height: 90vh so it never overflows screen
   overflow:hidden clips content, scroll area handles scrolling
══════════════════════════════════════════════ */
.woc-modal-box {
  background: var(--card);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-height: 90vh;
  max-height: 90dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.25);
  animation: woc-slideup 0.3s cubic-bezier(0.32,0.72,0,1);
  flex-shrink: 0;
}
@media (min-width: 640px) {
  .woc-modal-box {
    border-radius: 16px;
    max-width: 580px;
    width: 100%;
    max-height: 88vh;
    max-height: 88dvh;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
  }
}

.woc-modal-drag-handle {
  width: 36px; height: 4px;
  background: var(--border);
  border-radius: 99px;
  margin: 10px auto 2px;
  flex-shrink: 0;
}
@media (min-width: 640px) { .woc-modal-drag-handle { display: none; } }

/* MODAL HEADER */
.woc-modal-header {
  display: flex; align-items: center;
  gap: 10px; padding: 10px 16px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0; width: 100%; overflow: hidden;
}
.woc-modal-header-left {
  display: flex; align-items: center;
  gap: 10px; flex: 1; min-width: 0;
}
.woc-modal-icon {
  width: 36px; height: 36px; min-width: 36px;
  border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
}
.woc-modal-title {
  font-size: 15px; font-weight: 700; color: var(--foreground);
  margin: 0 0 1px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis;
}
.woc-modal-subtitle {
  font-size: 11px; color: var(--muted-foreground); margin: 0;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.woc-modal-close {
  width: 32px; height: 32px; min-width: 32px; border-radius: 50%;
  background: var(--muted); border: none; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  color: var(--muted-foreground); transition: background 0.15s; flex-shrink: 0;
}
.woc-modal-close:hover { background: var(--accent); }

/* STEP TABS */
.step-tabs {
  display: flex; flex-shrink: 0;
  border-bottom: 1px solid var(--border);
  background: var(--card);
  overflow-x: auto; overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
.step-tabs::-webkit-scrollbar { display: none; }
.step-tab {
  flex: 1; min-width: 68px; text-align: center;
  padding: 9px 4px; font-size: 9px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.05em;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  cursor: default; user-select: none; white-space: nowrap;
}

/* ══════════════════════════════════════════════
   MODAL SCROLL — THE KEY FIX
   min-height: 0 is REQUIRED for flex scroll to work
   Without it, the child never gets constrained
   and overflow-y: auto never activates
══════════════════════════════════════════════ */
.woc-modal-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* DETAIL GRID */
.woc-detail-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 1px; background: var(--border);
  margin: 12px 16px; border-radius: 12px;
  overflow: hidden; border: 1px solid var(--border);
}
.woc-detail-item {
  display: flex; align-items: flex-start; gap: 9px;
  padding: 10px 12px; background: var(--card); min-width: 0;
}
.woc-detail-item.full { grid-column: 1 / -1; }
.woc-detail-icon { color: var(--muted-foreground); flex-shrink: 0; margin-top: 2px; }
.woc-detail-label { font-size: 9px; font-weight: 600; color: var(--muted-foreground); text-transform: uppercase; letter-spacing: 0.4px; margin: 0 0 2px; }
.woc-detail-value { font-size: 12px; font-weight: 600; color: var(--foreground); margin: 0; word-break: break-word; }

@media (max-width: 400px) {
  .woc-detail-grid { grid-template-columns: 1fr; margin: 10px 12px; }
}

/* MODAL SECTIONS */
.woc-modal-section { padding: 0 16px 14px; width: 100%; box-sizing: border-box; }
.woc-modal-section-head {
  display: flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--muted-foreground);
  text-transform: uppercase; letter-spacing: 0.5px;
  margin-bottom: 10px; padding-top: 14px; flex-wrap: wrap;
}

.woc-label {
  font-size: 10px; font-weight: 700; color: var(--muted-foreground);
  text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 5px; display: block;
}
.woc-optional {
  font-size: 10px; background: var(--muted); color: var(--muted-foreground);
  padding: 1px 7px; border-radius: 20px; font-weight: 500;
  margin-left: auto; text-transform: none; letter-spacing: 0;
}

.woc-textarea, .woc-note-input {
  width: 100%; box-sizing: border-box;
  border: 1px solid var(--border); border-radius: 10px;
  padding: 11px 13px; font-size: 16px; font-family: inherit;
  color: var(--foreground); background: var(--muted);
  resize: vertical; outline: none; line-height: 1.5;
  min-height: 80px; -webkit-appearance: none; display: block;
}
.woc-textarea:focus, .woc-note-input:focus { border-color: ${C.purple}; }

/* BILLING GRID */
.woc-billing-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  gap: 10px; margin-bottom: 12px; width: 100%;
}
@media (max-width: 400px) { .woc-billing-grid { grid-template-columns: 1fr; } }

/* PART CARD */
.woc-inv-card {
  background: var(--muted); border: 1.5px solid var(--border);
  border-radius: 12px; padding: 12px;
  display: flex; flex-direction: column; gap: 9px;
  margin-bottom: 9px; width: 100%; box-sizing: border-box;
}
.woc-inv-remove {
  background: none; border: none; cursor: pointer;
  color: var(--muted-foreground);
  display: flex; align-items: center; justify-content: center;
  padding: 8px; border-radius: 8px;
  min-width: 40px; min-height: 40px; flex-shrink: 0;
}
.woc-inv-remove:active { background: ${C.redBg}; color: ${C.red}; }
.woc-part-picker-btn {
  flex: 1; min-width: 0; padding: 10px 12px;
  background: var(--card); border: 1px solid var(--border);
  border-radius: 9px; cursor: pointer; text-align: left;
  display: flex; align-items: center; gap: 10px;
  font-family: inherit; min-height: 46px; overflow: hidden;
}

/* COST ROWS */
.woc-cost-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 8px 0; border-bottom: 1px solid var(--border);
}
.woc-cost-row:last-of-type { border-bottom: none; }
.woc-grand-total-row {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 10px; padding: 14px 16px;
  background: ${C.accentBg}; border: 1.5px solid ${C.accentBorder};
  border-radius: 12px; width: 100%; box-sizing: border-box;
}
.woc-grand-total-val { font-size: 22px; font-weight: 800; color: ${C.accent}; }

/* MODAL FOOTER */
.woc-modal-footer {
  display: flex; gap: 8px; padding: 12px 16px;
  padding-bottom: max(12px, env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border);
  flex-shrink: 0; background: var(--card);
  width: 100%; box-sizing: border-box;
}
.woc-cancel-btn {
  background: var(--muted); color: var(--muted-foreground);
  border: 1px solid var(--border); border-radius: 10px;
  padding: 12px 16px; font-size: 14px; font-weight: 600;
  cursor: pointer; font-family: inherit; white-space: nowrap;
  min-height: 48px; flex-shrink: 0;
}
.woc-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.woc-submit-btn {
  color: #fff; border: none; border-radius: 10px;
  padding: 12px 16px; font-size: 14px; font-weight: 700;
  cursor: pointer; display: flex; align-items: center; gap: 6px;
  font-family: inherit; flex: 1; justify-content: center;
  min-height: 48px; min-width: 0;
}
.woc-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.woc-btn-spinner {
  width: 16px; height: 16px; flex-shrink: 0;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff; border-radius: 50%;
  animation: woc-spin 0.7s linear infinite;
}

/* BANNERS */
.woc-error {
  margin: 0 16px 12px; padding: 10px 14px;
  background: ${C.redBg}; border: 1px solid ${C.redBorder};
  border-radius: 10px; font-size: 12px; color: ${C.red};
  font-weight: 500; display: flex; align-items: flex-start; gap: 6px;
}
.woc-edit-warn {
  margin: 8px 16px 0; padding: 10px 14px; border-radius: 10px;
  background: ${C.orangeBg}; border: 1.5px solid ${C.orangeBorder};
  display: flex; align-items: center; gap: 8px;
  font-size: 12px; color: ${C.orange}; font-weight: 600; flex-shrink: 0;
}

/* PART PICKER */
.part-picker-overlay {
  position: fixed; inset: 0; z-index: 99999;
  background: rgba(0,0,0,0.65);
  display: flex; align-items: flex-end; justify-content: center;
  overflow: hidden;
}
.part-picker-sheet {
  width: 100%; max-width: 540px;
  background: var(--card); border-radius: 20px 20px 0 0;
  height: 85dvh; height: 85vh;
  display: flex; flex-direction: column; overflow: hidden;
  box-shadow: 0 -8px 40px rgba(0,0,0,0.3);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.part-picker-list {
  flex: 1; min-height: 0;
  overflow-y: auto; overflow-x: hidden;
  -webkit-overflow-scrolling: touch; width: 100%;
}
.part-picker-item {
  display: flex; align-items: center; gap: 12px;
  padding: 13px 16px; border-bottom: 1px solid var(--border);
  cursor: pointer; min-height: 68px;
  width: 100%; box-sizing: border-box;
}
.part-picker-item:last-child { border-bottom: none; }
.part-picker-item:active { background: var(--accent); }

/* INVOICE PREVIEW */
.invoice-preview-wrap {
  background: #fff; color: #111;
  font-family: Georgia, serif;
  border-radius: 12px; overflow: hidden;
  border: 2px solid #e5e7eb;
  margin-bottom: 16px; width: 100%; box-sizing: border-box;
}
.inv-header-row {
  display: flex; justify-content: space-between;
  align-items: flex-start; flex-wrap: wrap; gap: 12px; width: 100%;
}
.inv-info-grid {
  display: grid; grid-template-columns: 1fr 1fr;
  border-bottom: 2px solid #f1f5f9;
}
.inv-info-cell { padding: 12px 14px; min-width: 0; overflow: hidden; }
.inv-info-cell + .inv-info-cell { border-left: 1px solid #f1f5f9; }
.inv-table-wrap { overflow-x: auto; width: 100%; }
.inv-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 280px; }
.inv-table th {
  padding: 8px 10px; text-align: left;
  font-size: 9px; font-weight: 800; color: #64748b;
  text-transform: uppercase; border-bottom: 2px solid #e5e7eb;
  background: #f8fafc; white-space: nowrap;
}
.inv-table th:not(:first-child) { text-align: right; }
.inv-table td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
.inv-table td:not(:first-child) { text-align: right; white-space: nowrap; }
.inv-table tr:last-child td { border-bottom: none; }
.inv-actions {
  display: grid; grid-template-columns: 1fr 1fr 1fr;
  gap: 10px; margin-top: 4px; width: 100%;
}

.hdr-action-btn {
  display: flex; align-items: center; gap: 6px; padding: 8px 12px;
  border-radius: 9px; border: 1.5px solid var(--border);
  background: var(--muted); color: var(--muted-foreground);
  font-weight: 700; font-size: 12px; cursor: pointer;
  font-family: inherit; white-space: nowrap; min-height: 36px; flex-shrink: 0;
}

@media print {
  .woc-header, .woc-modal-overlay, .no-print { display: none !important; }
  .invoice-preview-wrap { border: none !important; }
}

@media (max-width: 430px) {
  .woc-header-inner { padding: 10px 12px 0; }
  .woc-body-inner, .woc-body-inner-narrow { padding: 12px 12px 100px; }
  .woc-modal-section { padding: 0 12px 12px; }
  .woc-modal-footer { padding: 10px 12px; padding-bottom: max(10px, env(safe-area-inset-bottom, 0px)); }
  .woc-modal-title { font-size: 14px; }
  .inv-info-grid { grid-template-columns: 1fr; }
  .inv-info-cell + .inv-info-cell { border-left: none; border-top: 1px solid #f1f5f9; }
  .inv-actions { grid-template-columns: 1fr 1fr; }
  .inv-actions .inv-print-btn { grid-column: 1 / -1; }
  .woc-billing-grid { grid-template-columns: 1fr; }
}
`;

/* ══════════════════════════════════════════════════════
   PDF
══════════════════════════════════════════════════════ */
function buildInvoiceHTML(wo: WorkOrder, d: any): string {
  const hrs  = Math.floor(d.t_hours);
  const mins = Math.round((d.t_hours % 1) * 60);
  const fmtDate = (s: string) =>
    s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  const detailRows = ([
    [`${wo.asset_type} #`, wo.asset_unit_number],
    ["Make", wo.make], ["Year", String(wo.year || "")],
    ["VIN", wo.vin], ["License", wo.license], ["Mechanic", wo.mechanic],
    ["Odometer", wo.odometer ? `${wo.odometer} mi` : undefined],
  ] as [string, string | undefined][])
    .filter(([, v]) => v)
    .map(([k, v]) => `<div style="display:flex;gap:6px;font-size:11px;margin-bottom:2px;"><span style="color:#64748b;width:64px;flex-shrink:0;">${k}:</span><span style="font-weight:700;color:#111;">${v}</span></div>`).join("");

  const partRows = d.lines.map((line: LineItem) => `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;"><div style="font-weight:700;color:#111;font-size:12px;">${line.name}</div><div style="font-size:10px;color:#64748b;">Parts</div></td>
      <td style="padding:10px 14px;text-align:right;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;">${line.quantity}</td>
      <td style="padding:10px 14px;text-align:right;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;">$${(line.unit_cost ?? 0).toFixed(2)}</td>
      <td style="padding:10px 14px;text-align:right;font-weight:700;color:#111;font-size:12px;border-bottom:1px solid #f1f5f9;">$${(line.total ?? 0).toFixed(2)}</td>
    </tr>`).join("");

  const summaryRows = [
    { label: "Labor", amount: d.l_cost },
    { label: "Parts", amount: d.p_cost },
    { label: "Subtotal", amount: (d.l_cost || 0) + (d.p_cost || 0), bold: true },
    ...(d.s_tax > 0  ? [{ label: `Sales Tax (10%)`, amount: d.s_tax }] : []),
    ...(d.cc_fee > 0 ? [{ label: "Credit Card Fee (3.5%)", amount: d.cc_fee }] : []),
  ].map(({ label, amount, bold }: any) =>
    `<div style="display:flex;justify-content:space-between;margin-bottom:5px;font-size:13px;"><span style="color:${bold ? "#111" : "#64748b"};font-weight:${bold ? "700" : "400"};">${label}</span><span style="font-weight:${bold ? "700" : "400"};color:#111;">$${(amount || 0).toFixed(2)}</span></div>`
  ).join("");

  return `<div style="background:#fff;color:#111;font-family:Georgia,serif;border-radius:10px;overflow:hidden;border:2px solid #e5e7eb;width:700px;margin:0 auto;">
    <div style="background:#1e293b;color:#fff;padding:20px 24px;display:flex;justify-content:space-between;align-items:flex-start;">
      <div><div style="font-size:22px;font-weight:900;letter-spacing:0.05em;margin-bottom:2px;">APEX LION</div><div style="font-size:11px;color:#94a3b8;letter-spacing:0.1em;text-transform:uppercase;">Truck &amp; Trailer Repair</div><div style="margin-top:10px;font-size:11px;color:#cbd5e1;line-height:1.7;">23408 30th Ave South<br/>Kent, WA 98032<br/>+1 (253) 272-9253</div></div>
      <div style="text-align:right;"><div style="font-size:28px;font-weight:900;color:#3b82f6;">INVOICE</div><div style="font-size:12px;color:#94a3b8;margin-top:4px;">#${d.inv_number}</div><div style="font-size:10px;color:#64748b;margin-top:2px;">WO# ${wo.work_order_number}</div><div style="margin-top:10px;font-size:11px;color:#cbd5e1;line-height:1.7;"><div>Date: <span style="color:#fff;font-weight:700;">${fmtDate(d.rep_date)}</span></div>${d.due_d ? `<div>Due: <span style="color:#f59e0b;font-weight:700;">${fmtDate(d.due_d)}</span></div>` : ""}</div></div>
    </div>
    <div style="display:flex;border-bottom:2px solid #f1f5f9;">
      <div style="flex:1;padding:16px 20px;border-right:1px solid #f1f5f9;"><div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px;">Billed To</div><div style="font-weight:800;font-size:15px;color:#111;margin-bottom:2px;">${wo.owner_name || "—"}</div>${wo.owner_email ? `<div style="font-size:11px;color:#64748b;">${wo.owner_email}</div>` : ""}</div>
      <div style="flex:1;padding:16px 20px;"><div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:8px;">${wo.asset_type} Details</div>${detailRows}</div>
    </div>
    <table style="width:100%;border-collapse:collapse;"><thead><tr style="background:#f8fafc;"><th style="padding:10px 14px;text-align:left;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Description</th><th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Qty</th><th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Unit Price</th><th style="padding:10px 14px;text-align:right;font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;border-bottom:2px solid #e5e7eb;">Total</th></tr></thead>
    <tbody><tr><td style="padding:12px 14px;border-bottom:1px solid #f1f5f9;"><div style="font-weight:700;color:#111;font-size:12px;">Labor — ${wo.mechanic}</div><div style="font-size:10px;color:#64748b;margin-top:2px;">${hrs}h ${mins}m @ $${LABOR_RATE}/hr</div></td><td style="padding:12px 14px;text-align:right;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;">${d.t_hours.toFixed(2)}h</td><td style="padding:12px 14px;text-align:right;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;">$${LABOR_RATE}.00</td><td style="padding:12px 14px;text-align:right;font-weight:700;color:#111;font-size:12px;border-bottom:1px solid #f1f5f9;">$${(d.l_cost || 0).toFixed(2)}</td></tr>${partRows}</tbody></table>
    <div style="background:#f8fafc;border-top:2px solid #e5e7eb;padding:16px 20px;"><div style="max-width:260px;margin-left:auto;">${summaryRows}<div style="border-top:2px solid #1e293b;margin-top:8px;padding-top:10px;display:flex;justify-content:space-between;align-items:center;"><span style="font-size:15px;font-weight:900;color:#1e293b;">TOTAL DUE</span><span style="font-size:22px;font-weight:900;color:#2563eb;">$${(d.g_total || 0).toFixed(2)}</span></div><div style="margin-top:8px;font-size:11px;color:#64748b;text-align:right;">Payment: <span style="font-weight:700;color:#111;">${d.pay_type}</span></div></div></div>
    ${(d.w_notes || d.i_notes) ? `<div style="padding:14px 20px;border-top:1px solid #f1f5f9;">${d.w_notes ? `<div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Work Notes</div><div style="font-size:12px;color:#374151;margin-bottom:10px;">${d.w_notes}</div>` : ""}${d.i_notes ? `<div style="font-size:9px;font-weight:800;color:#64748b;text-transform:uppercase;margin-bottom:4px;">Notes</div><div style="font-size:12px;color:#374151;">${d.i_notes}</div>` : ""}</div>` : ""}
    <div style="background:#1e293b;padding:10px 20px;text-align:center;font-size:10px;color:#94a3b8;">APEX LION TRUCK &amp; TRAILER REPAIR · 23408 30th Ave South, Kent, WA 98032 · +1 (253) 272-9253</div>
  </div>`;
}

// ══════════════════════════════════════════════════════
// REPLACEMENT: generateAndDownloadPDF function
// FIX: Forces all CSS colors to hex/rgb so html2canvas
//      doesn't choke on oklch() color functions
// ══════════════════════════════════════════════════════

async function uploadPDFToServer(
  authFetch: any,
  pdfBase64: string,
  invoiceNum: string,
  woId: string
): Promise<string | null> {
  try {
    console.log("📤 Uploading PDF for WO:", woId);
 
    const res = await authFetch(`${API_BASE}/uploadInvoicePDF/${woId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pdf_base64: pdfBase64,
        filename: `Invoice-${invoiceNum}.pdf`,
      }),
    });
 
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("❌ Upload failed:", errData);
      return null;
    }
 
    const data = await res.json();
    const pdfUrl = data?.data?.pdf_url || null;
 
    if (pdfUrl) {
      console.log("✅ PDF URL received:", pdfUrl);
    } else {
      console.error("❌ No pdf_url in response:", data);
    }
 
    return pdfUrl;
  } catch (err) {
    console.error("❌ uploadPDFToServer error:", err);
    return null;
  }
}
 
 
// ─────────────────────────────────────────────
// 2) generateAndDownloadPDF
// ─────────────────────────────────────────────
 
async function generateAndDownloadPDF(
  wo: WorkOrder,
  invoiceData: any
): Promise<string | null> {
  try {
    if (!(window as any).html2pdf) {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Failed to load html2pdf"));
        document.head.appendChild(script);
      });
    }
 
    // Isolated iframe — no oklch colors from parent
    const iframe = document.createElement("iframe");
    iframe.style.cssText =
      "position:fixed;top:-9999px;left:-9999px;width:760px;height:1200px;border:none;visibility:hidden;";
    document.body.appendChild(iframe);
 
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      throw new Error("Could not access iframe document");
    }
 
    iframeDoc.open();
    iframeDoc.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{background:#fff;color:#111;font-family:Georgia,"Times New Roman",serif;-webkit-font-smoothing:antialiased;}
</style>
</head><body>
  <div id="invoice-root" style="width:700px;margin:0 auto;background:#fff;">
    ${buildInvoiceHTML(wo, invoiceData)}
  </div>
</body></html>`);
    iframeDoc.close();
 
    await new Promise((r) =>
      iframeDoc.readyState === "complete"
        ? setTimeout(r, 350)
        : (iframe.onload = () => setTimeout(r, 350))
    );
 
    // Load html2pdf inside iframe
    await new Promise<void>((resolve, reject) => {
      const s = iframeDoc.createElement("script");
      s.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("html2pdf load failed in iframe"));
      iframeDoc.head.appendChild(s);
    });
 
    const invoiceRoot = iframeDoc.getElementById("invoice-root");
    if (!invoiceRoot) {
      document.body.removeChild(iframe);
      throw new Error("invoice-root not found");
    }
 
    const iframeHtml2pdf = (iframe.contentWindow as any).html2pdf;
 
    const pdfBlob: Blob = await iframeHtml2pdf()
      .set({
        margin: 8,
        filename: `Invoice-${invoiceData.inv_number}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 760,
        },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(invoiceRoot)
      .outputPdf("blob");
 
    document.body.removeChild(iframe);
 
    // Download
    const blobUrl = URL.createObjectURL(pdfBlob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `Invoice-${invoiceData.inv_number}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 3000);
 
    // Return base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(pdfBlob);
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return null;
  }
}

 



function normalizeInventoryItem(raw: any): InventoryItem {
  return {
    id: raw.id ?? "",
    name: raw.partName || raw.partNumber || raw.name || "Unknown Part",
    part_number: raw.partNumber ?? raw.part_number ?? "",
    partNumber: raw.partNumber ?? raw.part_number ?? "",
    cost: raw.pricePerPart ?? raw.cost ?? 0,
    pricePerPart: raw.pricePerPart ?? raw.cost ?? 0,
    quantity_available: raw.quantity ?? raw.available ?? raw.quantity_available ?? 0,
    available: raw.available ?? raw.quantity ?? raw.quantity_available ?? 0,
    photo: raw.photo || (Array.isArray(raw.allPhotos) && raw.allPhotos[0]) || "",
  };
}

function normalizeWO(raw: any): WorkOrder {
  const f = raw.fields ?? raw;
  return {
    id: raw.id || raw._id || f.id || "",
    airtable_id: raw.id || raw.airtable_id,
    work_order_number: f.work_order_number ?? "",
    asset_type: ((f.asset_type ?? "Truck") as string).toLowerCase() === "trailer" ? "Trailer" : "Truck",
    asset_unit_number: f.asset_number ?? f.asset_unit_number ?? "",
    asset_id: f.asset_id ?? "",
    mechanic: f.vendor ?? f.mechanic ?? f.assignedTo ?? "",
    description: f.issue_description ?? f.description ?? "",
    status: f.status ?? "open",
    priority: f.priority,
    owner_name: f.owner_name ?? f.ownerName,
    owner_email: f.owner_email ?? f.ownerEmail,
    vin: f.vin, year: f.year,
    license: f.license ?? f.plate,
    make: f.make, odometer: f.odometer,
    inspection_airtable_id: f.inspection_airtable_id,
    created_at: raw.createdTime ?? f.created_at,
    invoice_number: f.invoice_number,
    grand_total: typeof f.grand_total === "number" ? f.grand_total : undefined,
    repair_date: f.repair_date, payment_type: f.payment_type,
    labor_cost: typeof f.labor_cost === "number" ? f.labor_cost : undefined,
    parts_cost: typeof (f.parts_cost ?? f.parts) === "number" ? (f.parts_cost ?? f.parts) : undefined,
    sales_tax: typeof f.sales_tax === "number" ? f.sales_tax : undefined,
    credit_card_fee: typeof f.credit_card_fee === "number" ? f.credit_card_fee : undefined,
    time_hours: typeof f.time_hours === "number" ? f.time_hours : undefined,
    work_notes: f.work_notes ?? f.notes ?? "",
    inventory_parts: f.inventory_parts, photos: f.photos,
    invoice_pdf_url: f.invoice_pdf_url,
    truck_airtable_id: f.truck_airtable_id, trailer_airtable_id: f.trailer_airtable_id,
    inspection_linked_id: f.inspection_linked_id,
  };
}

/* ══════════════════════════════════════════════════════
   PART PICKER
══════════════════════════════════════════════════════ */
function PartPickerModal({ inventory, selectedId, onPick, onClose }: {
  inventory: InventoryItem[]; selectedId: string;
  onPick: (id: string) => void; onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = inventory.filter(inv =>
    !search ||
    (inv.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (inv.partNumber || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="part-picker-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="part-picker-sheet">
        <div style={{ width: 36, height: 4, background: "var(--border)", borderRadius: 99, margin: "10px auto 0", flexShrink: 0 }} />
        <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--foreground)" }}>Select Part</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{inventory.length} parts available</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: "var(--muted)", color: "var(--muted-foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 18 }}>×</button>
        </div>
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", position: "relative", flexShrink: 0 }}>
          <Search size={14} style={{ position: "absolute", left: 26, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
          <input autoFocus value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search part name or number…"
            style={{ ...inp, paddingLeft: 36 }} />
        </div>
        <div className="part-picker-list">
          {filtered.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>No parts found</div>
          ) : filtered.map((inv, i) => {
            const isSelected = inv.id === selectedId;
            const outOfStock = inv.available <= 0;
            return (
              <div key={inv.id} onClick={() => { if (!outOfStock) onPick(inv.id); }}
                style={{ padding: "13px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", background: isSelected ? C.accentBg : "transparent", cursor: outOfStock ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 12, opacity: outOfStock ? 0.45 : 1, minHeight: 68 }}>
                {inv.photo && (
                  <img src={inv.photo} alt={inv.name} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: `2px solid ${isSelected ? C.accentBorder : "var(--border)"}` }}
                    onError={e => { (e.currentTarget as any).style.display = "none"; }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: isSelected ? C.accent : "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>{inv.name}</div>
                  {inv.partNumber && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>#{inv.partNumber}</div>}
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 99, background: outOfStock ? C.redBg : inv.available <= 3 ? C.yellowBg : C.greenBg, color: outOfStock ? C.red : inv.available <= 3 ? C.yellow : C.green }}>
                      {outOfStock ? "Out of stock" : `${inv.available} left`}
                    </span>
                    {inv.pricePerPart > 0 && <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>${inv.pricePerPart.toFixed(2)}</span>}
                  </div>
                </div>
                {isSelected && <CheckCircle size={20} color={C.accent} style={{ flexShrink: 0 }} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type CompletePayload = {
  wo: WorkOrder; invoiceNum: string; repairDate: string; dueDate: string;
  paymentType: PaymentType; totalHours: number; laborCost: number;
  partsCost: number; salesTax: number; ccFee: number; grandTotal: number;
  lineItems: LineItem[]; workNotes: string; invoiceNotes: string; applyTax: boolean;
};

/* ══════════════════════════════════════════════════════
   STEP: TIME & PARTS
══════════════════════════════════════════════════════ */
function StepTimeAndParts({ hours, setHours, minutes, setMinutes, lineItems, setLineItems, inventory, customName, setCustomName, customCost, setCustomCost, workNotes, setWorkNotes, totalHours, laborCost, partsCost }: any) {
  const [partPickerOpen, setPartPickerOpen] = useState(false);
  const [partPickerIndex, setPartPickerIndex] = useState<number | null>(null);

  function updateLine(uid: string, field: "quantity" | "unit_cost", val: number) {
    setLineItems((prev: LineItem[]) => prev.map((l: LineItem) => {
      if (l.uid !== uid) return l;
      const u = { ...l, [field]: val };
      u.total = u.quantity * u.unit_cost;
      return u;
    }));
  }

  function addCustomPart() {
    if (!customName.trim() || !customCost) return;
    setLineItems((prev: LineItem[]) => [...prev, { uid: `c-${Date.now()}`, name: customName.trim(), quantity: 1, unit_cost: Number(customCost), total: Number(customCost) }]);
    setCustomName(""); setCustomCost("");
  }

  return (
    <div className="woc-fadein">
      {partPickerOpen && partPickerIndex !== null && (
        <PartPickerModal
          inventory={inventory}
          selectedId={lineItems[partPickerIndex]?.inventory_id || ""}
          onPick={(id: string) => {
            const selected = inventory.find((i: InventoryItem) => i.id === id);
            if (!selected) return;
            setLineItems((prev: LineItem[]) => prev.map((item: LineItem, i: number) =>
              i === partPickerIndex ? { ...item, inventory_id: selected.id, name: selected.name, unit_cost: selected.pricePerPart, total: selected.pricePerPart * item.quantity } : item
            ));
            setPartPickerOpen(false); setPartPickerIndex(null);
          }}
          onClose={() => { setPartPickerOpen(false); setPartPickerIndex(null); }}
        />
      )}

      <div className="woc-modal-section">
        <div className="woc-modal-section-head"><Clock size={13} style={{ color: C.purple }} /><span>Time Spent · ${LABOR_RATE}/hr</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label className="woc-label">Hours *</label>
            <input type="number" min="0" max="24" step="1" value={hours}
              onChange={e => setHours(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0" style={inp} inputMode="numeric" />
          </div>
          <div>
            <label className="woc-label">Minutes</label>
            <select value={minutes} onChange={e => setMinutes(Number(e.target.value))} style={inp}>
              {[0, 15, 30, 45].map(m => <option key={m} value={m}>{m} min</option>)}
            </select>
          </div>
        </div>
        {totalHours > 0 && (
          <div style={{ padding: "10px 12px", borderRadius: 10, background: C.purpleBg, border: `1.5px solid ${C.purpleBorder}`, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <span style={{ fontSize: 13, color: C.purple, fontWeight: 600 }}>⏱ {Number(hours) || 0}h {minutes}m</span>
            <span style={{ fontSize: 18, fontWeight: 900, color: C.purple }}>${laborCost.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="woc-modal-section">
        <div className="woc-modal-section-head"><Package size={13} style={{ color: C.orange }} /><span>Parts Used</span></div>
        <button onClick={() => setLineItems((prev: LineItem[]) => [...prev, { uid: Date.now().toString(), name: "", quantity: 1, unit_cost: 0, total: 0 }])}
          style={{ width: "100%", marginBottom: 12, padding: "13px 16px", borderRadius: 10, border: `1.5px dashed ${C.accentBorder}`, background: C.accentBg, color: C.accent, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48 }}>
          <Plus size={16} /> Add Part
        </button>

        {lineItems.map((line: LineItem, index: number) => (
          <div key={line.uid} className="woc-inv-card">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => { setPartPickerIndex(index); setPartPickerOpen(true); }} className="woc-part-picker-btn">
                <Package size={13} style={{ color: C.orange, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.name || "Select part…"}</span>
                <ChevronRight size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
              </button>
              <button onClick={() => setLineItems((prev: LineItem[]) => prev.filter((l: LineItem) => l.uid !== line.uid))} className="woc-inv-remove">
                <Trash2 size={14} />
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label className="woc-label">Qty</label>
                <input type="number" min="1" step="1" value={line.quantity}
                  onChange={e => updateLine(line.uid, "quantity", Number(e.target.value) || 1)}
                  style={{ ...inp, textAlign: "center" }} inputMode="numeric" />
              </div>
              <div>
                <label className="woc-label">Unit Cost ($)</label>
                <input type="number" min="0" step="0.01" value={line.unit_cost}
                  onChange={e => updateLine(line.uid, "unit_cost", Number(e.target.value) || 0)}
                  style={{ ...inp, textAlign: "right" }} inputMode="decimal" />
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 12, color: C.orange, fontWeight: 700 }}>Line Total: ${(line.total ?? 0).toFixed(2)}</div>
          </div>
        ))}
        {lineItems.length > 0 && <div style={{ textAlign: "right", fontWeight: 800, fontSize: 13, color: C.orange, marginBottom: 10 }}>Parts Total: ${partsCost.toFixed(2)}</div>}

        <div style={{ padding: 12, borderRadius: 10, background: "var(--muted)", border: "1.5px dashed var(--border)" }}>
          <label className="woc-label">Add Custom Part / Service</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={customName} onChange={e => setCustomName(e.target.value)} placeholder="Part name…" style={inp} />
            <div style={{ display: "flex", gap: 8 }}>
              <input type="number" min="0" step="0.01" value={customCost}
                onChange={e => setCustomCost(e.target.value === "" ? "" : Number(e.target.value))}
                placeholder="$ Cost" style={{ ...inp, flex: 1 }} inputMode="decimal" />
              <button onClick={addCustomPart} disabled={!customName.trim() || !customCost}
                style={{ padding: "0 16px", height: "46px", borderRadius: 8, border: "none", background: customName.trim() && customCost ? C.accent : "var(--muted)", color: customName.trim() && customCost ? "#fff" : "var(--muted-foreground)", cursor: customName.trim() && customCost ? "pointer" : "not-allowed", display: "flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, fontFamily: "inherit", flexShrink: 0, minWidth: 70 }}>
                <Plus size={13} /> Add
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="woc-modal-section">
        <div className="woc-modal-section-head"><FileText size={13} /><span>Work Notes</span><span className="woc-optional">optional</span></div>
        <textarea className="woc-note-input" value={workNotes} onChange={e => setWorkNotes(e.target.value)} placeholder="Describe work performed…" rows={3} />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   STEP: BILLING
══════════════════════════════════════════════════════ */
function StepBilling({ invoiceNum, setInvoiceNum, repairDate, setRepairDate, dueDate, setDueDate, paymentType, setPaymentType, applyTax, setApplyTax, invoiceNotes, setInvoiceNotes, totalHours, laborCost, partsCost, salesTax, ccFee, grandTotal, lineItems }: any) {
  const { t } = useTranslation();
  return (
    <div className="woc-fadein">
      <div className="woc-modal-section">
        <div className="woc-modal-section-head"><Receipt size={13} style={{ color: C.purple }} /><span>{t("workOrders.steps.billing")}</span></div>
        <div className="woc-billing-grid">
          <div><label className="woc-label">{t("workOrders.invoiceNumber")} #</label><input value={invoiceNum} onChange={e => setInvoiceNum(e.target.value)} style={inp} /></div>
          <div><label className="woc-label">{t("workOrders.repairDate")} *</label><input type="date" value={repairDate} onChange={e => setRepairDate(e.target.value)} style={inp} /></div>
          <div><label className="woc-label">{t("workOrders.dueDate")}</label><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></div>
          <div>
            <label className="woc-label">{t("workOrders.paymentType")}</label>
            {/*  IMPORTANT: option `value` stays English ("Cash", "Credit Card") because that's
                what's stored in state and sent to backend. Only the label is translated. */}
            <select value={paymentType} onChange={e => setPaymentType(e.target.value as PaymentType)} style={inp}>
              {(["Cash", "Check", "Credit Card", "ACH", "Zelle", "Other"] as PaymentType[]).map(p => <option key={p} value={p}>{tPaymentType(t, p)}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <button onClick={() => setApplyTax((v: boolean) => !v)}
            style={{ flex: "1 1 140px", padding: "12px 8px", borderRadius: 9, border: `2px solid ${applyTax ? C.orange : "var(--border)"}`, background: applyTax ? C.orangeBg : "var(--card)", color: applyTax ? C.orange : "var(--muted-foreground)", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", minHeight: 46 }}>
            {applyTax ? "✓ " : ""}{t("workOrders.salesTax")} (10%)
          </button>
          {paymentType === "Credit Card" && (
            <div style={{ flex: "1 1 140px", padding: "12px 8px", borderRadius: 9, border: `2px solid ${C.redBorder}`, background: C.redBg, color: C.red, fontWeight: 700, fontSize: 13, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
              ✓ {t("workOrders.creditCardFee")} (3.5%)
            </div>
          )}
        </div>
        <div>
          <label className="woc-label">{t("workOrders.invoiceNotes")}</label>
          <textarea className="woc-note-input" value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} rows={2} style={{ resize: "none" }} />
        </div>
      </div>

      <div className="woc-modal-section">
        <div className="woc-modal-section-head"><DollarSign size={13} style={{ color: C.green }} /><span>Cost Summary</span></div>
        {[
          { label: "Labor", sub: `${totalHours.toFixed(2)}h × $${LABOR_RATE}`, amount: laborCost, color: C.purple },
          { label: "Parts", sub: `${lineItems.length} item(s)`, amount: partsCost, color: C.orange },
          { label: "Subtotal", amount: laborCost + partsCost, bold: true },
          ...(applyTax ? [{ label: "Sales Tax (10%)", amount: salesTax }] : []),
          ...(ccFee > 0 ? [{ label: "CC Fee (3.5%)", amount: ccFee, color: C.red }] : []),
        ].map(({ label, sub, amount, bold, color }: any) => (
          <div key={label} className="woc-cost-row">
            <div>
              <div style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 14 : 13, color: color || "var(--foreground)" }}>{label}</div>
              {sub && <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{sub}</div>}
            </div>
            <span style={{ fontWeight: bold ? 800 : 600, fontSize: bold ? 15 : 14, color: color || "var(--foreground)" }}>${(amount || 0).toFixed(2)}</span>
          </div>
        ))}
        <div className="woc-grand-total-row">
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase" }}>Grand Total</div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{lineItems.length} parts · {totalHours.toFixed(2)}h labor</div>
          </div>
          <span className="woc-grand-total-val">${grandTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   INVOICE DOC
══════════════════════════════════════════════════════ */
function InvoiceDoc({ wo, inv_number, rep_date, due_d, pay_type, t_hours, l_cost, p_cost, s_tax, cc_fee, g_total, lines, w_notes, i_notes }: any) {
  const hrs  = Math.floor(t_hours);
  const mins = Math.round((t_hours % 1) * 60);
  return (
    <div className="invoice-preview-wrap">
      <div style={{ background: "#1e293b", color: "#fff", padding: "16px 18px" }}>
        <div className="inv-header-row">
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: "0.05em", marginBottom: 2 }}>APEX LION</div>
            <div style={{ fontSize: 10, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase" }}>Truck &amp; Trailer Repair</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#cbd5e1", lineHeight: 1.7 }}>23408 30th Ave South<br />Kent, WA 98032<br />+1 (253) 272-9253</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#3b82f6" }}>INVOICE</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>#{inv_number}</div>
            <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>WO# {wo.work_order_number}</div>
            <div style={{ marginTop: 8, fontSize: 11, color: "#cbd5e1", lineHeight: 1.7 }}>
              <div>Date: <span style={{ color: "#fff", fontWeight: 700 }}>{rep_date ? new Date(rep_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}</span></div>
              {due_d && <div>Due: <span style={{ color: "#f59e0b", fontWeight: 700 }}>{new Date(due_d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>}
            </div>
          </div>
        </div>
      </div>
      <div className="inv-info-grid">
        <div className="inv-info-cell" style={{ borderRight: "1px solid #f1f5f9", borderBottom: "2px solid #f1f5f9" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>Billed To</div>
          <div style={{ fontWeight: 800, fontSize: 14, color: "#111", marginBottom: 2 }}>{wo.owner_name || "—"}</div>
          {wo.owner_email && <div style={{ fontSize: 11, color: "#64748b" }}>{wo.owner_email}</div>}
        </div>
        <div className="inv-info-cell" style={{ borderBottom: "2px solid #f1f5f9" }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 6 }}>{wo.asset_type} Details</div>
          {([
            [`${wo.asset_type} #`, wo.asset_unit_number], ["Make", wo.make],
            ["Year", String(wo.year || "")], ["VIN", wo.vin],
            ["License", wo.license], ["Mechanic", wo.mechanic],
          ] as [string, string | undefined][]).filter(([, v]) => v).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 6, fontSize: 11, marginBottom: 2 }}>
              <span style={{ color: "#64748b", width: 60, flexShrink: 0 }}>{k}:</span>
              <span style={{ fontWeight: 700, color: "#111", wordBreak: "break-all" }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="inv-table-wrap">
        <table className="inv-table">
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Description", "Qty", "Unit", "Total"].map(h => (
                <th key={h} style={{ textAlign: h === "Description" ? "left" : "right" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
              <td><div style={{ fontWeight: 700, color: "#111" }}>Labor — {wo.mechanic}</div><div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{hrs}h {mins}m @ ${LABOR_RATE}/hr</div></td>
              <td style={{ textAlign: "right", color: "#64748b" }}>{t_hours.toFixed(2)}h</td>
              <td style={{ textAlign: "right", color: "#64748b" }}>${LABOR_RATE}</td>
              <td style={{ textAlign: "right", fontWeight: 700, color: "#111" }}>${(l_cost || 0).toFixed(2)}</td>
            </tr>
            {lines.map((line: LineItem) => (
              <tr key={line.uid} style={{ borderBottom: "1px solid #f1f5f9" }}>
                <td><div style={{ fontWeight: 700, color: "#111" }}>{line.name}</div><div style={{ fontSize: 10, color: "#64748b" }}>Parts</div></td>
                <td style={{ textAlign: "right", color: "#64748b" }}>{line.quantity}</td>
                <td style={{ textAlign: "right", color: "#64748b" }}>${(line.unit_cost ?? 0).toFixed(2)}</td>
                <td style={{ textAlign: "right", fontWeight: 700, color: "#111" }}>${(line.total ?? 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ background: "#f8fafc", borderTop: "2px solid #e5e7eb", padding: "14px 16px" }}>
        <div style={{ maxWidth: 260, marginLeft: "auto" }}>
          {[
            { label: "Labor", amount: l_cost }, { label: "Parts", amount: p_cost },
            { label: "Subtotal", amount: (l_cost || 0) + (p_cost || 0), bold: true },
            ...(s_tax > 0  ? [{ label: `Sales Tax (10%)`, amount: s_tax }] : []),
            ...(cc_fee > 0 ? [{ label: "CC Fee (3.5%)", amount: cc_fee }] : []),
          ].map(({ label, amount, bold }: any) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 13 }}>
              <span style={{ color: bold ? "#111" : "#64748b", fontWeight: bold ? 700 : 400 }}>{label}</span>
              <span style={{ fontWeight: bold ? 700 : 400, color: "#111" }}>${(amount || 0).toFixed(2)}</span>
            </div>
          ))}
          <div style={{ borderTop: "2px solid #1e293b", marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: "#1e293b" }}>TOTAL DUE</span>
            <span style={{ fontSize: 20, fontWeight: 900, color: "#2563eb" }}>${(g_total || 0).toFixed(2)}</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: "#64748b", textAlign: "right" }}>Payment: <span style={{ fontWeight: 700, color: "#111" }}>{pay_type}</span></div>
        </div>
      </div>
      {(w_notes || i_notes) && (
        <div style={{ padding: "12px 16px", borderTop: "1px solid #f1f5f9" }}>
          {w_notes && <><div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Work Notes</div><div style={{ fontSize: 12, color: "#374151", marginBottom: 10 }}>{w_notes}</div></>}
          {i_notes && <><div style={{ fontSize: 9, fontWeight: 800, color: "#64748b", textTransform: "uppercase", marginBottom: 4 }}>Notes</div><div style={{ fontSize: 12, color: "#374151" }}>{i_notes}</div></>}
        </div>
      )}
      <div style={{ background: "#1e293b", padding: "8px 16px", textAlign: "center", fontSize: 10, color: "#94a3b8" }}>
        APEX LION TRUCK &amp; TRAILER REPAIR · 23408 30th Ave South, Kent, WA 98032 · +1 (253) 272-9253
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   WO MODAL
══════════════════════════════════════════════════════ */
function WOModal({ title, iconBg, iconColor, icon: Icon, warningBanner, accentColor, wo, inventory, initialData, onClose, onConfirm }: any) {
  const { t } = useTranslation();
  const [step, setStep]               = useState(0);
  const [hours, setHours]             = useState<number | "">(initialData?.hours ?? "");
  const [minutes, setMinutes]         = useState<number>(initialData?.minutes ?? 0);
  const [lineItems, setLineItems]     = useState<LineItem[]>(initialData?.lineItems ?? []);
  const [customName, setCustomName]   = useState("");
  const [customCost, setCustomCost]   = useState<number | "">("");
  const [repairDate, setRepairDate]   = useState(initialData?.repairDate ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate]         = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType>(initialData?.paymentType ?? "Cash");
  const [applyTax, setApplyTax]       = useState(initialData?.applyTax ?? false);
  const [workNotes, setWorkNotes]     = useState(initialData?.workNotes ?? wo.description ?? "");
  const [invoiceNotes, setInvoiceNotes] = useState("");
  const [invoiceNum, setInvoiceNum]   = useState(initialData?.invoiceNum ?? `WO-${Date.now().toString().slice(-6)}`);
  const [submitting, setSubmitting]   = useState(false);
  const [error, setError]             = useState("");

  const totalHours = (Number(hours) || 0) + minutes / 60;
  const laborCost  = Math.round(totalHours * LABOR_RATE * 100) / 100;
  const partsCost  = lineItems.reduce((a, l) => a + l.total, 0);
  const subtotal   = laborCost + partsCost;
  const salesTax   = applyTax ? Math.round(subtotal * SALES_TAX_PCT * 100) / 100 : 0;
  const ccFee      = paymentType === "Credit Card" ? Math.round((subtotal + salesTax) * CC_FEE_PCT * 100) / 100 : 0;
  const grandTotal = subtotal + salesTax + ccFee;

  function canAdvance() {
    if (step === 1) return totalHours > 0;
    if (step === 2) return !!repairDate;
    return true;
  }

  async function handleSubmit() {
    // Defensive validation — user could navigate back, clear fields, then Save
    if (totalHours <= 0) { setError(t("workOrders.enterTimeSpent")); setStep(1); return; }
    if (!repairDate)     { setError(t("workOrders.enterRepairDate")); setStep(2); return; }
    if (!invoiceNum?.trim()) { setError(t("workOrders.invoiceRequired")); setStep(2); return; }

    setSubmitting(true); setError("");
    try {
      await onConfirm({ wo, invoiceNum, repairDate, dueDate, paymentType, totalHours, laborCost, partsCost, salesTax, ccFee, grandTotal, lineItems, workNotes, invoiceNotes, applyTax });
      onClose();
    } catch (e: any) {
      setError(e?.message || t("common.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  const stepLabels = [
    t("workOrders.steps.details"),
    t("workOrders.steps.timeAndParts"),
    t("workOrders.steps.billing"),
    t("workOrders.steps.review"),
  ];

  return (
    <div className="woc-modal-overlay" onClick={onClose}>
      <div className="woc-modal-box" onClick={e => e.stopPropagation()}>
        <span className="woc-modal-drag-handle" />

        <div className="woc-modal-header">
          <div className="woc-modal-header-left">
            <div className="woc-modal-icon" style={{ background: iconBg, color: iconColor }}><Icon size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <h2 className="woc-modal-title">{title}</h2>
              <p className="woc-modal-subtitle">WO #{wo.work_order_number} · {wo.asset_type} {wo.asset_unit_number}</p>
            </div>
          </div>
          <button className="woc-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        {warningBanner}

        <div className="step-tabs">
          {stepLabels.map((label, i) => (
            <div key={i} className="step-tab" style={{
              color: i === step ? "var(--foreground)" : i < step ? accentColor : "var(--muted-foreground)",
              borderBottomColor: i === step ? "var(--foreground)" : i < step ? accentColor : "transparent",
            }}>
              {i < step ? "✓" : (i + 1)}. {label}
            </div>
          ))}
        </div>

        {/* THE KEY: min-height:0 enables scrolling */}
        <div className="woc-modal-scroll">
          {step === 0 && (
            <div className="woc-fadein">
              <div className="woc-detail-grid">
                {([
                  [Hash,  "WO Number", wo.work_order_number],
                  [Truck, "Asset",     `${wo.asset_type} ${wo.asset_unit_number}`],
                  [User,  "Mechanic",  wo.mechanic],
                  [Info,  "Priority",  wo.priority || "Normal"],
                  [User,  "Owner",     wo.owner_name],
                  [Info,  "Status",    wo.status],
                  [Info,  "Make/Year", wo.make ? `${wo.make}${wo.year ? ` · ${wo.year}` : ""}` : undefined],
                  [Info,  "VIN",       wo.vin],
                ] as [any, string, string | undefined][]).filter(([, , v]) => v).map(([Icon2, label, value]) => (
                  <div key={label} className="woc-detail-item">
                    <Icon2 size={13} className="woc-detail-icon" />
                    <div><p className="woc-detail-label">{label}</p><p className="woc-detail-value">{value}</p></div>
                  </div>
                ))}
                {wo.description && (
                  <div className="woc-detail-item full">
                    <FileText size={13} className="woc-detail-icon" />
                    <div><p className="woc-detail-label">Issue Description</p><p className="woc-detail-value">{wo.description}</p></div>
                  </div>
                )}
              </div>
            </div>
          )}

          {step === 1 && <StepTimeAndParts hours={hours} setHours={setHours} minutes={minutes} setMinutes={setMinutes} lineItems={lineItems} setLineItems={setLineItems} inventory={inventory} customName={customName} setCustomName={setCustomName} customCost={customCost} setCustomCost={setCustomCost} workNotes={workNotes} setWorkNotes={setWorkNotes} totalHours={totalHours} laborCost={laborCost} partsCost={partsCost} />}

          {step === 2 && <StepBilling invoiceNum={invoiceNum} setInvoiceNum={setInvoiceNum} repairDate={repairDate} setRepairDate={setRepairDate} dueDate={dueDate} setDueDate={setDueDate} paymentType={paymentType} setPaymentType={setPaymentType} applyTax={applyTax} setApplyTax={setApplyTax} invoiceNotes={invoiceNotes} setInvoiceNotes={setInvoiceNotes} totalHours={totalHours} laborCost={laborCost} partsCost={partsCost} salesTax={salesTax} ccFee={ccFee} grandTotal={grandTotal} lineItems={lineItems} />}

          {step === 3 && (
            <div className="woc-fadein" style={{ padding: "12px 14px 0" }}>
              <InvoiceDoc wo={wo} inv_number={invoiceNum} rep_date={repairDate} due_d={dueDate} pay_type={paymentType} t_hours={totalHours} l_cost={laborCost} p_cost={partsCost} s_tax={salesTax} cc_fee={ccFee} g_total={grandTotal} lines={lineItems} w_notes={workNotes} i_notes={invoiceNotes} />
            </div>
          )}

          {error && <div className="woc-error"><AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}</div>}
        </div>

        <div className="woc-modal-footer">
          {step > 0
            ? <button className="woc-cancel-btn" onClick={() => setStep(s => s - 1)} disabled={submitting}>← {t("common.back")}</button>
            : <button className="woc-cancel-btn" onClick={onClose}>{t("common.cancel")}</button>
          }
          {step < stepLabels.length - 1 ? (
            <button onClick={() => {
              if (!canAdvance()) {
                toast.error(step === 1 ? t("workOrders.enterTimeSpent") : t("workOrders.enterRepairDate"));
                return;
              }
              setStep(s => s + 1);
            }} className="woc-submit-btn" style={{ background: accentColor }}>
              {t("common.continue")} <ChevronRight size={16} />
            </button>
          ) : (
            <button className="woc-submit-btn" onClick={handleSubmit} disabled={submitting} style={{ background: accentColor }}>
              {submitting
                ? <><span className="woc-btn-spinner" /> {t("workOrders.saving")}</>
                : <><Save size={14} /> {t("workOrders.save")} · ${grandTotal.toFixed(2)}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════ */
export function WorkOrderComplete() {
  const { t } = useTranslation();
  const { authFetch } = useAuth();
  const [viewMode,   setViewMode]   = useState<ViewMode>("list");
  const [activeTab,  setActiveTab]  = useState<"open" | "completed">("open");
  const [listQuery,  setListQuery]  = useState("");
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [woLoading,  setWoLoading]  = useState(true);
  const [inventory,  setInventory]  = useState<InventoryItem[]>([]);
  const [selectedWO, setSelectedWO] = useState<WorkOrder | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [completeModalWO, setCompleteModalWO] = useState<WorkOrder | null>(null);
  const [editModalWO,     setEditModalWO]     = useState<WorkOrder | null>(null);
  const scrollY = useRef(0);

  /* ── Body scroll lock — NO position:fixed (causes layout shift) ── */
  useEffect(() => {
    const isOpen = !!(completeModalWO || editModalWO);
    if (isOpen) {
      scrollY.current = window.scrollY;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [completeModalWO, editModalWO]);

  function loadWOs() {
    setWoLoading(true);
    authFetch(`${API_BASE}/getAllWorkOrders`)
      .then(r => r.json())
      .then(d => setWorkOrders((d.data || []).map(normalizeWO)))
      .catch(() => toast.error(t("workOrders.failedToLoad")))
      .finally(() => setWoLoading(false));
  }

  // loadWOs is stable enough — it only reads authFetch (closed over once at component init).
  // We deliberately depend on authFetch only; loadWOs would create a re-fetch loop.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadWOs(); }, [authFetch]);
  useEffect(() => {
    authFetch(`${API_BASE}/getInventory`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed to load inventory")))
      .then(d => setInventory((d.data || []).map(normalizeInventoryItem)))
      .catch(err => {
        console.error(err);
        toast.error(t("workOrders.failedToLoadInventory"));
      });
  }, [authFetch]);

  const isCompletedStatus = (s?: string) =>
    ["completed", "invoiced", "closed"].includes((s ?? "").toLowerCase().trim());
  const openWOs      = workOrders.filter(wo => !isCompletedStatus(wo.status));
  const completedWOs = workOrders.filter(wo =>  isCompletedStatus(wo.status));
  const isCompleted  = activeTab === "completed";

  const filterList = (list: WorkOrder[]) => {
    const q = listQuery.toLowerCase().trim();
    if (!q) return list;
    return list.filter(wo =>
      (wo.work_order_number ?? "").toLowerCase().includes(q) ||
      (wo.asset_unit_number ?? "").toLowerCase().includes(q) ||
      (wo.description       ?? "").toLowerCase().includes(q) ||
      (wo.mechanic          ?? "").toLowerCase().includes(q) ||
      (wo.owner_name        ?? "").toLowerCase().includes(q) ||
      (wo.make              ?? "").toLowerCase().includes(q) ||
      (wo.status            ?? "").toLowerCase().includes(q) ||
      (wo.invoice_number    ?? "").toLowerCase().includes(q)
    );
  };

async function handleDownloadAndSavePDF(wo: WorkOrder) {
  setPdfLoading(true);
  try {
    const invoiceData = {
      inv_number: wo.invoice_number || "—",
      rep_date: wo.repair_date || "",
      due_d: "",
      pay_type: wo.payment_type || "Cash",
      t_hours: wo.time_hours || 0,
      l_cost: wo.labor_cost || 0,
      p_cost: wo.parts_cost || 0,
      s_tax: wo.sales_tax || 0,
      cc_fee: wo.credit_card_fee || 0,
      g_total: wo.grand_total || 0,
      lines: wo.inventory_parts || [],
      w_notes: wo.work_notes || "",
      i_notes: "",
    };
 
    const pdfBase64 = await generateAndDownloadPDF(wo, invoiceData);
 
    if (pdfBase64) {
      const pdfUrl = await uploadPDFToServer(
        authFetch,
        pdfBase64,
        wo.invoice_number || wo.id,
        wo.id
      );
 
      if (pdfUrl) {
        await authFetch(`${API_BASE}/completeWorkOrder/${wo.id}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_order_airtable_id: wo.airtable_id,
            is_edit: true,
            status: "Completed",
            pdf_url: pdfUrl,
            labor_cost: wo.labor_cost,
            parts: wo.parts_cost,
            sales_tax: wo.sales_tax,
            credit_card_fee: wo.credit_card_fee,
            grand_total: wo.grand_total,
            invoice_number: wo.invoice_number,
            repair_date: wo.repair_date,
            payment_type: wo.payment_type,
            mechanic: wo.mechanic,
            owner_name: wo.owner_name,
            email: wo.owner_email,
            asset_type: wo.asset_type,
            asset_unit_number: wo.asset_unit_number,
            asset_id: wo.asset_id,
            make: wo.make || "",
            vin: wo.vin || "",
            year: wo.year || "",
            license: wo.license || "",
            odometer: wo.odometer || "",
            priority: wo.priority || "Normal",
            work_notes: wo.work_notes || "",
            inventory_parts: wo.inventory_parts || [],
            truck_airtable_id: wo.truck_airtable_id,
            trailer_airtable_id: wo.trailer_airtable_id,
            inspection_linked_id: wo.inspection_linked_id,
          }),
        });
 
        toast.success("PDF saved to Airtable!", {
          description: `Invoice #${wo.invoice_number}`,
        });
      } else {
        toast.info("PDF downloaded but upload failed");
      }
    }
  } catch (err: any) {
    toast.error("PDF generation failed: " + err.message);
  } finally {
    setPdfLoading(false);
  }
}

async function handleCompleteSubmit(p: CompletePayload) {
  const wo = p.wo;
 
  // Step 1: Complete WO
  const payload: any = {
    work_order_airtable_id: wo.airtable_id,
    status: "Completed",
    repair_date: p.repairDate,
    invoiced_date: new Date().toISOString().slice(0, 10),
    due_date: p.dueDate || null,
    description: wo.description,
    work_notes: p.workNotes,
    mechanic: wo.mechanic,
    payment_type: p.paymentType,
    odometer: wo.odometer || "",
    priority: wo.priority || "Normal",
    asset_type: wo.asset_type,
    asset_unit_number: wo.asset_unit_number,
    asset_id: wo.asset_id,
    make: wo.make || "",
    owner_name: wo.owner_name || "",
    email: wo.owner_email || "",
    vin: wo.vin || "",
    year: wo.year || "",
    license: wo.license || "",
    time_hours: p.totalHours,
    labor_cost: p.laborCost,
    parts: p.partsCost,
    sales_tax: p.salesTax,
    credit_card_fee: p.ccFee,
    grand_total: p.grandTotal,
    invoice_number: p.invoiceNum,
    inventory_parts: p.lineItems,
    inspection_airtable_id: wo.inspection_airtable_id || null,
    truck_airtable_id: wo.truck_airtable_id,
    trailer_airtable_id: wo.trailer_airtable_id,
    inspection_linked_id: wo.inspection_linked_id,
    is_edit: false,
  };
 
  const res = await authFetch(`${API_BASE}/completeWorkOrder/${wo.id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
 
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.message || "Failed to complete work order");
  }
 
  const updatedWO: WorkOrder = {
    ...wo,
    status: "Completed",
    invoice_number: p.invoiceNum,
    grand_total: p.grandTotal,
    repair_date: p.repairDate,
    payment_type: p.paymentType,
    labor_cost: p.laborCost,
    parts_cost: p.partsCost,
    sales_tax: p.salesTax,
    credit_card_fee: p.ccFee,
    time_hours: p.totalHours,
    work_notes: p.workNotes,
    inventory_parts: p.lineItems,
  };
  setWorkOrders((prev) => prev.map((w) => (w.id !== wo.id ? w : updatedWO)));
 
  toast.success("Work Order Completed!", { description: "Generating PDF…" });
 
  // Step 2: Generate PDF
  const invoiceData = {
    inv_number: p.invoiceNum,
    rep_date: p.repairDate,
    due_d: p.dueDate,
    pay_type: p.paymentType,
    t_hours: p.totalHours,
    l_cost: p.laborCost,
    p_cost: p.partsCost,
    s_tax: p.salesTax,
    cc_fee: p.ccFee,
    g_total: p.grandTotal,
    lines: p.lineItems,
    w_notes: p.workNotes,
    i_notes: p.invoiceNotes,
  };
 
  const pdfBase64 = await generateAndDownloadPDF(updatedWO, invoiceData);
  if (!pdfBase64) {
    toast.error("PDF generation failed — invoice saved without PDF");
    return;
  }
 
  // Step 3: Upload to GCP + save URL (all in one backend call)
  const pdfUrl = await uploadPDFToServer(authFetch, pdfBase64, p.invoiceNum, wo.id);
  if (!pdfUrl) {
    toast.error("PDF upload failed — invoice saved without PDF");
    return;
  }
 
  // Step 4: Update invoice with PDF URL
  try {
    await authFetch(`${API_BASE}/completeWorkOrder/${wo.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, is_edit: true, pdf_url: pdfUrl }),
    });
 
    setWorkOrders((prev) =>
      prev.map((w) => (w.id !== wo.id ? w : { ...w, invoice_pdf_url: pdfUrl }))
    );
 
    toast.success("PDF saved to invoice!", { description: `Invoice #${p.invoiceNum}` });
  } catch (err) {
    console.error("PDF URL save failed:", err);
    toast.error("PDF downloaded but failed to save URL to invoice");
  }
}

  const currentList  = activeTab === "open" ? openWOs : completedWOs;
  const filteredList = filterList(currentList);

  const AssetBadge = ({ wo }: { wo: WorkOrder }) => {
    const isTruck = wo.asset_type === "Truck";
    return (
      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: isTruck ? C.orangeBg : C.accentBg, color: isTruck ? C.orange : C.accent, border: `1px solid ${isTruck ? C.orangeBorder : C.accentBorder}`, whiteSpace: "nowrap", display: "inline-block" }}>
        {wo.asset_type} {wo.asset_unit_number}
      </span>
    );
  };

  const StatusBadge = ({ wo, completed }: { wo: WorkOrder; completed: boolean }) => (
    <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 99, background: completed ? C.greenBg : "var(--muted)", color: completed ? C.green : C.grey, border: `1px solid ${completed ? C.greenBorder : "var(--border)"}`, whiteSpace: "nowrap", display: "inline-block" }}>
      {completed ? `✓ ${tStatus(t, "completed")}` : tStatus(t, wo.status || "open")}
    </span>
  );

  function WOMobileCard({ wo }: { wo: WorkOrder }) {
    const isHigh = wo.priority && wo.priority !== "Normal" && wo.priority !== "normal";
    return (
      <div className="wo-card">
        <div className="wo-card-top">
          <div className="wo-card-left">
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 800, fontSize: 15, color: "var(--foreground)" }}>#{wo.work_order_number}</span>
              {isHigh && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 99, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}` }}>{tPriority(t, wo.priority)}</span>}
            </div>
            <AssetBadge wo={wo} />
            {wo.make && <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{wo.make}{wo.year ? ` · ${wo.year}` : ""}</div>}
          </div>
          <div className="wo-card-right">
            <StatusBadge wo={wo} completed={isCompleted} />
            {isCompleted && wo.grand_total != null && (
              <span style={{ fontWeight: 900, fontSize: 17, color: C.green }}>${(Number(wo.grand_total) || 0).toFixed(2)}</span>
            )}
          </div>
        </div>
        <div className="wo-card-meta">
          {wo.owner_name && <span>👤 {wo.owner_name}</span>}
          {wo.mechanic   && <span>🔧 {wo.mechanic}</span>}
        </div>
        {wo.description && <div className="wo-card-desc">{wo.description}</div>}

        {!isCompleted ? (
          <div className="wo-card-btns open">
            <button className="wo-card-btn" onClick={() => setCompleteModalWO(wo)}
              style={{ background: C.purpleBg, color: C.purple, border: `1.5px solid ${C.purpleBorder}` }}>
              <Wrench size={16} /> Complete Work Order
            </button>
          </div>
        ) : (
          <div className="wo-card-btns done">
            <button className="wo-card-btn" onClick={() => { setSelectedWO(wo); setViewMode("view-invoice"); }}
              style={{ background: C.greenBg, color: C.green, border: `1.5px solid ${C.greenBorder}` }}>
              <Eye size={14} /> View Invoice
            </button>
            <button className="wo-card-btn" onClick={() => handleDownloadAndSavePDF(wo)} disabled={pdfLoading}
              style={{ background: C.accentBg, color: C.accent, border: `1.5px solid ${C.accentBorder}` }}>
              {pdfLoading ? <Loader2 size={14} className="woc-spin" /> : <Download size={14} />} PDF
            </button>
            <button className="wo-card-btn full-btn" onClick={() => setEditModalWO(wo)}
              style={{ background: C.orangeBg, color: C.orange, border: `1.5px solid ${C.orangeBorder}` }}>
              <Edit3 size={14} /> Edit Invoice
            </button>
          </div>
        )}
      </div>
    );
  }

  function WOTable({ list }: { list: WorkOrder[] }) {
    if (list.length === 0) {
      return (
        <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--muted-foreground)" }}>
          {isCompleted
            ? <><CheckCircle2 size={36} style={{ marginBottom: 10, opacity: 0.25 }} /><div style={{ fontWeight: 700, fontSize: 15 }}>No completed work orders yet</div></>
            : <><Wrench size={36} style={{ marginBottom: 10, opacity: 0.25 }} /><div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>No open work orders</div><div style={{ fontSize: 13 }}>All caught up! 🎉</div></>
          }
        </div>
      );
    }
    return (
      <>
        <div className="wo-desktop-table">
          <table className="wo-table">
            <thead>
              <tr>
                <th>WO #</th><th>Asset</th><th>Owner</th><th>Mechanic</th>
                <th>Description</th><th>Status</th>
                {isCompleted && <th style={{ textAlign: "right" }}>Amount</th>}
                <th style={{ textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map(wo => {
                const isHigh = wo.priority && wo.priority !== "Normal" && wo.priority !== "normal";
                return (
                  <tr key={wo.id}>
                    <td><div style={{ fontWeight: 800, fontSize: 13 }}>#{wo.work_order_number ?? "—"}</div>{isHigh && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 99, background: C.redBg, color: C.red, border: `1px solid ${C.redBorder}`, display: "inline-block", marginTop: 2 }}>{tPriority(t, wo.priority)}</span>}</td>
                    <td><AssetBadge wo={wo} />{wo.make && <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 3 }}>{wo.make}{wo.year ? ` · ${wo.year}` : ""}</div>}</td>
                    <td><div style={{ fontWeight: 600, fontSize: 12 }}>{wo.owner_name ?? "—"}</div>{wo.owner_email && <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>{wo.owner_email}</div>}</td>
                    <td><span style={{ fontSize: 12 }}>{wo.mechanic ?? "—"}</span></td>
                    <td style={{ maxWidth: 180 }}><span style={{ fontSize: 12, color: "var(--muted-foreground)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{wo.description ?? "—"}</span></td>
                    <td><StatusBadge wo={wo} completed={isCompleted} /></td>
                    {isCompleted && <td style={{ textAlign: "right" }}>{wo.grand_total != null ? <span style={{ fontSize: 14, fontWeight: 900, color: C.green }}>${(Number(wo.grand_total) || 0).toFixed(2)}</span> : <span style={{ color: "var(--muted-foreground)", fontSize: 12 }}>—</span>}</td>}
                    <td>
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                        {!isCompleted ? (
                          <button onClick={() => setCompleteModalWO(wo)} className="tbl-action-btn" style={{ background: C.purpleBg, color: C.purple, border: `1.5px solid ${C.purpleBorder}` }}><Wrench size={12} /> Complete</button>
                        ) : (
                          <>
                            <button onClick={() => { setSelectedWO(wo); setViewMode("view-invoice"); }} className="tbl-action-btn" style={{ background: C.greenBg, color: C.green, border: `1.5px solid ${C.greenBorder}` }}><Eye size={11} /> View</button>
                            <button onClick={() => handleDownloadAndSavePDF(wo)} disabled={pdfLoading} className="tbl-action-btn" style={{ background: C.accentBg, color: C.accent, border: `1.5px solid ${C.accentBorder}` }}>{pdfLoading ? <Loader2 size={11} className="woc-spin" /> : <Download size={11} />} PDF</button>
                            <button onClick={() => setEditModalWO(wo)} className="tbl-action-btn" style={{ background: C.orangeBg, color: C.orange, border: `1.5px solid ${C.orangeBorder}` }}><Edit3 size={11} /> Edit</button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="wo-mobile-list">
          {list.map(wo => <WOMobileCard key={wo.id} wo={wo} />)}
        </div>
      </>
    );
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="woc-root">

        {completeModalWO && (
          <WOModal title="Complete Work Order" iconBg={C.purpleBg} iconColor={C.purple} icon={Wrench}
            accentColor={C.purple} wo={completeModalWO} inventory={inventory}
            initialData={{ workNotes: completeModalWO.description || "" }}
            onClose={() => setCompleteModalWO(null)} onConfirm={handleCompleteSubmit} />
        )}

        {editModalWO && (
          <WOModal title="Edit Invoice" iconBg={C.accentBg} iconColor={C.accent} icon={Edit3}
            accentColor={C.accent} wo={editModalWO} inventory={inventory}
            warningBanner={
              <div className="woc-edit-warn"><Edit3 size={13} /> Editing existing invoice — changes will update Airtable</div>
            }
            initialData={{ hours: editModalWO.time_hours ? Math.floor(editModalWO.time_hours) : "", minutes: editModalWO.time_hours ? Math.round((editModalWO.time_hours % 1) * 60) : 0, lineItems: (editModalWO.inventory_parts || []).map(l => ({ ...l, uid: l.uid || `e-${Math.random()}` })), repairDate: editModalWO.repair_date || new Date().toISOString().slice(0, 10), paymentType: (editModalWO.payment_type as PaymentType) || "Cash", applyTax: (editModalWO.sales_tax ?? 0) > 0, workNotes: editModalWO.work_notes || "", invoiceNum: editModalWO.invoice_number || `WO-${Date.now().toString().slice(-6)}` }}
            onClose={() => setEditModalWO(null)}
            onConfirm={async (p) => {
              const res = await authFetch(`${API_BASE}/completeWorkOrder/${p.wo.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ work_order_airtable_id: p.wo.airtable_id, is_edit: true, status: "Completed", repair_date: p.repairDate, invoiced_date: new Date().toISOString().slice(0, 10), due_date: p.dueDate || null, description: p.wo.description, work_notes: p.workNotes, mechanic: p.wo.mechanic, payment_type: p.paymentType, time_hours: p.totalHours, labor_cost: p.laborCost, parts: p.partsCost, sales_tax: p.salesTax, credit_card_fee: p.ccFee, grand_total: p.grandTotal, invoice_number: p.invoiceNum, inventory_parts: p.lineItems, owner_name: p.wo.owner_name || "", email: p.wo.owner_email || "", asset_type: p.wo.asset_type, asset_unit_number: p.wo.asset_unit_number, asset_id: p.wo.asset_id, make: p.wo.make || "", vin: p.wo.vin || "", year: p.wo.year || "", license: p.wo.license || "", odometer: p.wo.odometer || "", priority: p.wo.priority || "Normal", truck_airtable_id: p.wo.truck_airtable_id, trailer_airtable_id: p.wo.trailer_airtable_id, inspection_linked_id: p.wo.inspection_linked_id }) });
              if (!res.ok) { const e = await res.json(); throw new Error(e.message || "Failed"); }
              setWorkOrders(prev => prev.map(w => w.id !== p.wo.id ? w : { ...w, grand_total: p.grandTotal, repair_date: p.repairDate, payment_type: p.paymentType, labor_cost: p.laborCost, parts_cost: p.partsCost, sales_tax: p.salesTax, credit_card_fee: p.ccFee, time_hours: p.totalHours, work_notes: p.workNotes, inventory_parts: p.lineItems, invoice_number: p.invoiceNum }));
              toast.success("Invoice Updated!", { description: `#${p.invoiceNum} · $${p.grandTotal.toFixed(2)}` });
            }} />
        )}

        {/* HEADER */}
        <div className="woc-header no-print">
          <div className="woc-header-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              {viewMode !== "list" ? (
                <button onClick={() => { setViewMode("list"); setSelectedWO(null); }}
                  style={{ width: 38, height: 38, minWidth: 38, borderRadius: 9, border: "1.5px solid var(--border)", background: "var(--muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                  <ArrowLeft size={16} color="var(--muted-foreground)" />
                </button>
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: 10, background: C.purple, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Wrench size={18} color="#fff" />
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--foreground)" }}>
                  {viewMode === "list" ? "Work Orders" : `Invoice #${selectedWO?.invoice_number || "—"}`}
                </div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
                  {viewMode === "list" ? `${openWOs.length} open · ${completedWOs.length} completed` : `${selectedWO?.asset_type} ${selectedWO?.asset_unit_number}`}
                </div>
              </div>
              {viewMode === "view-invoice" && selectedWO && (
                <button onClick={() => handleDownloadAndSavePDF(selectedWO)} disabled={pdfLoading}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 9, border: `1.5px solid ${C.accentBorder}`, background: C.accentBg, color: C.accent, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit", flexShrink: 0, minHeight: 40 }}>
                  {pdfLoading ? <Loader2 size={13} className="woc-spin" /> : <Download size={13} />}
                  {pdfLoading ? "…" : "PDF"}
                </button>
              )}
            </div>
            {viewMode === "list" && (
              <div style={{ display: "flex" }}>
                <button className={`tab-btn ${activeTab === "open" ? "active" : ""}`} onClick={() => setActiveTab("open")}>🔧 Open ({openWOs.length})</button>
                <button className={`tab-btn ${activeTab === "completed" ? "active" : ""}`} onClick={() => setActiveTab("completed")}>✅ Done ({completedWOs.length})</button>
              </div>
            )}
          </div>
        </div>

        {/* BODY */}
        <div className="woc-body">
          <div className={viewMode === "list" ? "woc-body-inner" : "woc-body-inner-narrow"}>
            {viewMode === "list" && (
              <div className="woc-fadein">
                <div className="wo-search-bar">
                  <Search size={14} color="var(--muted-foreground)" style={{ flexShrink: 0 }} />
                  <input className="wo-search-input" value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="Search WO#, unit, owner, mechanic…" />
                  {listQuery && (
                    <button onClick={() => setListQuery("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}>
                      <X size={13} color="var(--muted-foreground)" />
                    </button>
                  )}
                  <span className="wo-search-count">{filteredList.length}</span>
                </div>
                <div className="wo-table-wrap">
                  {woLoading ? (
                    <div style={{ padding: "48px", textAlign: "center", color: "var(--muted-foreground)", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                      <Loader2 size={28} className="woc-spin" color={C.purple} />
                      <span style={{ fontSize: 13 }}>Loading work orders…</span>
                    </div>
                  ) : (
                    <WOTable list={filteredList} />
                  )}
                </div>
              </div>
            )}

            {viewMode === "view-invoice" && selectedWO && (
              <div className="woc-fadein">
                <InvoiceDoc wo={selectedWO} inv_number={selectedWO.invoice_number || "—"} rep_date={selectedWO.repair_date || ""} due_d="" pay_type={selectedWO.payment_type || "Cash"} t_hours={selectedWO.time_hours || 0} l_cost={selectedWO.labor_cost || 0} p_cost={selectedWO.parts_cost || 0} s_tax={selectedWO.sales_tax || 0} cc_fee={selectedWO.credit_card_fee || 0} g_total={selectedWO.grand_total || 0} lines={selectedWO.inventory_parts || []} w_notes={selectedWO.work_notes || ""} i_notes="" />
                <div className="inv-actions no-print">
                  <button className="inv-print-btn" onClick={() => window.print()}
                    style={{ padding: "13px 8px", borderRadius: 10, border: `1.5px solid ${C.purpleBorder}`, background: C.purpleBg, color: C.purple, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", minHeight: 48 }}>
                    <Printer size={15} /> Print
                  </button>
                  <button onClick={() => handleDownloadAndSavePDF(selectedWO)} disabled={pdfLoading}
                    style={{ padding: "13px 8px", borderRadius: 10, border: `1.5px solid ${C.accentBorder}`, background: C.accentBg, color: C.accent, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", minHeight: 48 }}>
                    {pdfLoading ? <Loader2 size={15} className="woc-spin" /> : <Download size={15} />}
                    {pdfLoading ? "…" : "PDF"}
                  </button>
                  <button onClick={() => setEditModalWO(selectedWO)}
                    style={{ padding: "13px 8px", borderRadius: 10, border: `1.5px solid ${C.orangeBorder}`, background: C.orangeBg, color: C.orange, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit", minHeight: 48 }}>
                    <Edit3 size={15} /> Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}