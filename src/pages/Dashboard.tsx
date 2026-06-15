import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from "../config";
import { useIsMobile } from '../hooks/useMediaQuery';
import { tStatus, tPriority } from '../utils/i18nDisplay';

import type { InventoryItem, Inspection } from '../services/airtable';
import {
  Truck, ClipboardCheck, Package,
  Bell, RefreshCw, CheckCircle2,
  Wrench, AlertTriangle, CalendarClock,
  X, Calendar, User, Hash, Car, Info,
  FileText, AlertCircle, CheckSquare,
  Filter, ChevronDown,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

/* ─────────────────────────── Types ─────────────────────────── */

interface TrailerAsset {
  id: string;
  number: string;
  status: string;
  customerName: string;
  inspectionDate: string;
  plate: string;
  vin: string;
  year: string;
  make: string;
}

interface TruckAsset {
  id: string;
  number: string;
  status: string;
  owner: string;
  vin: string;
  make: string;
  year: string | number;
  plate: string;
  inspectionDate: string;
  photo?: string;
}

interface WorkOrder {
  id: string;
  title: string;
  trailerNumber: string;
  status: 'open' | 'in_progress' | 'completed' | 'on_hold';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo: string;
  dueDate: string;
  createdAt: string;
}

interface InspectionAlert {
  id: string;
  vehicleNumber: string;
  vehicleType: 'trailer' | 'truck';
  inspectionDate: string;
  daysUntilExpiry: number;
  ownerName?: string;
  plate?: string;
  vin?: string;
  year?: string | number;
  make?: string;
  status?: string;
}

interface InspectionRecord {
  id: string;
  inspection_number?: string;
  inspection_id?: string;
  asset_number?: string;
  asset_unit_number?: string;
  asset_type?: string;
  overall_status?: string;
  technician_name?: string;
  inspector_name?: string;
  inspection_type?: string;
  defects_found?: string;
  issues_found?: string;
  created_at?: string;
  completed_at?: string;
  inspection_score?: number;
  issue_count?: number;
}

interface DashboardProps {
  trailerInspectionAlerts?: InspectionAlert[];
  truckInspectionAlerts?: InspectionAlert[];
  workOrders?: WorkOrder[];
}

interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
}

const API_BASE = apiUrl("/users");

/* ─────────────────────────── Helpers ─────────────────────────── */

function calculateDaysUntilExpiry(dateStr?: string): number {
  if (!dateStr) return 999;
  const inspectionDate = new Date(dateStr);
  if (isNaN(inspectionDate.getTime())) return 999;
  const expiryDate = new Date(inspectionDate);
  expiryDate.setMonth(expiryDate.getMonth() + 3); // 3-month inspection validity
  const today = new Date();
  const diff = expiryDate.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ─────────────────────────── Fetch Functions ─────────────────────────── */

async function fetchTrailers(authFetch: (url: string, options?: RequestInit) => Promise<Response>): Promise<TrailerAsset[]> {
  const res = await authFetch(`${API_BASE}/getTrailersdashboard`);
  const result: ApiResponse<TrailerAsset[]> = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch trailers");
  return result.data;
}

async function fetchTrucks(authFetch: (url: string, options?: RequestInit) => Promise<Response>): Promise<TruckAsset[]> {
  const res = await authFetch(`${API_BASE}/getTrucksdashboard`);
  const result: ApiResponse<TruckAsset[]> = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch trucks");
  return result.data;
}

async function fetchInventory(authFetch: any): Promise<InventoryItem[]> {
  const res = await authFetch(`${API_BASE}/getInventorydashboard`);
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch inventory");
  // BUG FIX: safe fallback if dashboardData is missing or not an array
  return Array.isArray(result.data?.dashboardData) ? result.data.dashboardData : [];
}

async function fetchCurrentUser(authFetch: (url: string, options?: RequestInit) => Promise<Response>): Promise<any> {
  const res = await authFetch(`${API_BASE}/getCurrentUser`);
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch user");
  return result.data;
}

async function fetchWorkOrders(authFetch: (url: string, options?: RequestInit) => Promise<Response>, role: string): Promise<any[]> {
  const endpoint = role === "admin" ? "/getAllWorkOrders" : "/getMyWorkOrders";
  const res = await authFetch(`${API_BASE}${endpoint}`);
   
  const result = await res.json();
  console.log("Raw work orders data:", result);
  if (!res.ok) throw new Error(result?.message || "Failed to fetch work orders");
  return result.data || [];
}

async function fetchAllInspections(authFetch: (url: string, options?: RequestInit) => Promise<Response>): Promise<{
  dotInspections: InspectionRecord[];
  quickInspections: InspectionRecord[];
}> {
  try {
    const [dotRes, quickRes] = await Promise.all([
      authFetch(`${API_BASE}/getAllInspections`).catch(() => null),
      authFetch(`${API_BASE}/getAllQuickInspections`).catch(() => null),
    ]);

    let dotInspections: InspectionRecord[] = [];
    let quickInspections: InspectionRecord[] = [];

    if (dotRes?.ok) {
      const dotResult = await dotRes.json();
      dotInspections = (dotResult.data || []).map((i: any) => ({
        ...i,
        id: i._id || i.id,
        inspection_type: i.inspection_type || 'DOT',
        asset_number: i.asset_number || i.asset_unit_number,
        overall_status: (i.overall_status || '').toLowerCase(),
        technician_name: i.technician_name || i.inspector_name,
        created_at: i.created_at || i.completed_at,
      }));
    }

    if (quickRes?.ok) {
      const quickResult = await quickRes.json();
      quickInspections = (quickResult.data || []).map((i: any) => ({
        ...i,
        id: i._id || i.id,
        inspection_type: i.inspection_type || 'Quick',
        asset_number: i.asset_unit_number || i.asset_number,
        overall_status: (i.overall_status || '').toLowerCase(),
        technician_name: i.inspector_name || i.technician_name,
        created_at: i.completed_at || i.created_at,
      }));
    }

    return { dotInspections, quickInspections };
  } catch (e) {
    console.error('fetchAllInspections error:', e);
    return { dotInspections: [], quickInspections: [] };
  }
}

async function updateWorkOrderAPI(
  authFetch: (url: string, options?: RequestInit) => Promise<Response>,
  id: string,
  payload: {
    status: string;
    notes?: string;
    end_time?: string;
    used_inventory?: { inventoryId: string; inventoryName: string; quantityUsed: number; currentQty: number }[];
  }
): Promise<any> {
  const res = await authFetch(`${API_BASE}/updateWorkOrderStatus/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to update work order");
  return result.data;
}

async function subtractInventory(
  authFetch: (url: string, options?: RequestInit) => Promise<Response>,
  usedItems: { inventoryId: string; inventoryName: string; currentQty: number; quantityUsed: number }[]
): Promise<any> {
  if (!usedItems.length) return { success: true, skipped: true };
  const res = await authFetch(`${API_BASE}/subtractInventoryService`, {
    method: "POST",
    body: JSON.stringify(usedItems),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to subtract inventory");
  return result;
}

/* ─────────────────────────── Inspection Alert Detail Modal ─────────────────────────── */

function InspectionDetailModal({ alert, onClose }: { alert: InspectionAlert; onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const days = alert.daysUntilExpiry;
  const isExpired = days < 0;
  const isCritical = days <= 7 && days >= 0;
  const isWarning = days > 7 && days <= 30;

  const expiryDate = (() => {
    if (!alert.inspectionDate) return null;
    const d = new Date(alert.inspectionDate);
    if (isNaN(d.getTime())) return null;
    d.setMonth(d.getMonth() + 3); // 3-month inspection validity
    return d;
  })();

  const statusColor = isExpired ? '#ff3b30' : isCritical ? '#ff6b00' : isWarning ? '#ff9500' : '#34c759';
  const statusBg = isExpired ? 'rgba(255,59,48,0.10)' : isCritical ? 'rgba(255,107,0,0.10)' : isWarning ? 'rgba(255,149,0,0.10)' : 'rgba(52,199,89,0.10)';
  const statusText = isExpired ? `Expired ${Math.abs(days)} days ago` : days === 0 ? 'Expires today!' : `${days} days remaining`;

  const whyMessage = isExpired
    ? `This ${alert.vehicleType} has exceeded the 3-month inspection validity. It should be taken out of service immediately until a new inspection is completed.`
    : isCritical
    ? `Inspection expires in ${days} day${days !== 1 ? 's' : ''}. Schedule an urgent re-inspection to avoid service interruption.`
    : `Inspection will expire on ${expiryDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}. Plan ahead to avoid last-minute scheduling.`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-vehicle-icon" style={{ background: statusBg, color: statusColor }}>
              {alert.vehicleType === 'truck' ? <Truck size={22} /> : <Package size={22} />}
            </div>
            <div>
              <h2 className="modal-title">
                {alert.vehicleType === 'truck' ? 'Truck' : 'Trailer'} #{alert.vehicleNumber}
              </h2>
              <p className="modal-subtitle">Inspection Alert Details</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-status-banner" style={{ background: statusBg, borderColor: statusColor + '33', color: statusColor }}>
          <AlertCircle size={16} />
          <span className="modal-status-text">{statusText}</span>
          {expiryDate && !isExpired && (
            <span className="modal-expiry-date">
              Expires: {expiryDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>

        <div className="modal-details-grid">
          <div className="modal-detail-item">
            <Hash size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Vehicle Number</p>
              <p className="detail-value">{alert.vehicleNumber || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <User size={14} className="detail-icon" />
            <div>
              <p className="detail-label">{alert.vehicleType === 'truck' ? 'Owner' : 'Customer'}</p>
              <p className="detail-value">{alert.ownerName || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <Calendar size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Last Inspection Date</p>
              <p className="detail-value">
                {alert.inspectionDate
                  ? new Date(alert.inspectionDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
          <div className="modal-detail-item">
            <Calendar size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Expiry Date (3-month cycle)</p>
              <p className="detail-value" style={{ color: statusColor, fontWeight: 700 }}>
                {expiryDate
                  ? expiryDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
          {alert.plate && (
            <div className="modal-detail-item">
              <Car size={14} className="detail-icon" />
              <div>
                <p className="detail-label">License Plate</p>
                <p className="detail-value">{alert.plate}</p>
              </div>
            </div>
          )}
          {alert.vin && (
            <div className="modal-detail-item">
              <Hash size={14} className="detail-icon" />
              <div>
                <p className="detail-label">VIN</p>
                <p className="detail-value vin-value">{alert.vin}</p>
              </div>
            </div>
          )}
          {alert.make && (
            <div className="modal-detail-item">
              <Truck size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Make / Year</p>
                <p className="detail-value">{alert.make}{alert.year ? ` · ${alert.year}` : ''}</p>
              </div>
            </div>
          )}
          {alert.status && (
            <div className="modal-detail-item">
              <Info size={14} className="detail-icon" />
              <div>
                <p className="detail-label">{t('workOrders.table.status')}</p>
                <p className="detail-value">{tStatus(t, alert.status)}</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-why-box" style={{ borderColor: statusColor + '40', background: statusBg }}>
          <div className="modal-why-header" style={{ color: statusColor }}>
            <AlertTriangle size={14} />
            <span>Why this alert?</span>
          </div>
          <p className="modal-why-text">{whyMessage}</p>
        </div>

        <div className="modal-footer">
          <button className="modal-action-btn" onClick={onClose}>Close</button>
          <button
            className="modal-action-btn"
            style={{ background: '#1e40af', color: '#fff', border: 'none' }}
            onClick={() => {
              onClose();
              navigate(`/inspection?asset=${encodeURIComponent(alert.vehicleNumber)}`);
            }}
          >
            Start DOT Inspection
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Part Picker Modal ─────────────────────────── */

function DashboardPartPickerModal({
  inventory,
  selectedId,
  onPick,
  onClose,
}: {
  inventory: InventoryItem[];
  selectedId: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = (inventory as any[]).filter(inv =>
    !search ||
    (inv.partName || inv.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (inv.partNumber || inv.part_number || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 520,
        background: '#fff',
        borderRadius: 20,
        maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        border: '1px solid rgba(0,0,0,0.08)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 17, color: '#1d1d1f' }}>Select Part</div>
            <div style={{ fontSize: 12, color: '#86868b', marginTop: 2 }}>{inventory.length} parts available</div>
          </div>
          <div
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.06)', color: '#86868b',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 20, fontWeight: 700, userSelect: 'none',
            }}
          >×</div>
        </div>

        {/* Search */}
        <div style={{
          padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.08)',
          position: 'relative', flexShrink: 0,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2"
            style={{ position: 'absolute', left: 30, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search part name or number…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '0.6rem 0.75rem 0.6rem 2.2rem',
              background: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.10)',
              borderRadius: 10, color: '#1d1d1f', fontSize: '0.95rem',
              outline: 'none', fontFamily: 'inherit',
            }}
          />
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#86868b', fontSize: 14 }}>
              No parts found
            </div>
          ) : (
            filtered.map((inv: any, i: number) => {
              const isSelected = String(inv.id || inv._id || '') === selectedId;
              const available = Number(inv.available ?? inv.quantity ?? 0);
              const outOfStock = available <= 0;
              const photoUrl = inv.photo || inv.image || inv.photoUrl || inv.photo_url || '';
              const displayName = inv.partName || inv.part_name || inv.name || inv.partNumber || `Part ${i + 1}`;
              const partNum = inv.partNumber || inv.part_number || '';
              const price = Number(inv.pricePerPart ?? inv.price_per_part ?? inv['Price per part'] ?? inv.price ?? 0);
              const invId = String(inv.id || inv._id || '');

              return (
                <div
                  key={invId || i}
                  onClick={() => { if (!outOfStock) onPick(invId); }}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < filtered.length - 1 ? '1px solid rgba(0,0,0,0.06)' : 'none',
                    background: isSelected ? 'rgba(0,122,255,0.06)' : 'transparent',
                    cursor: outOfStock ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 14,
                    opacity: outOfStock ? 0.45 : 1,
                    minHeight: 72,
                    userSelect: 'none',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={e => { if (!outOfStock && !isSelected) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.025)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = isSelected ? 'rgba(0,122,255,0.06)' : 'transparent'; }}
                >
                  {photoUrl ? (
                    <div style={{
                      width: 54, height: 54, borderRadius: 12, flexShrink: 0,
                      background: 'rgba(0,0,0,0.04)',
                      border: `2px solid ${isSelected ? 'rgba(0,122,255,0.35)' : 'rgba(0,0,0,0.08)'}`,
                      overflow: 'hidden',
                    }}>
                      <img
                        src={photoUrl} alt={displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.currentTarget.parentElement as HTMLDivElement).style.display = 'none'; }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      width: 54, height: 54, borderRadius: 12, flexShrink: 0,
                      background: 'rgba(0,0,0,0.04)',
                      border: `2px solid ${isSelected ? 'rgba(0,122,255,0.35)' : 'rgba(0,0,0,0.08)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22,
                    }}>🔩</div>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 14,
                      color: isSelected ? '#007aff' : '#1d1d1f',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      marginBottom: 4,
                    }}>
                      {displayName}
                    </div>
                    {partNum && (
                      <div style={{ fontSize: 11, color: '#86868b', fontFamily: 'monospace', marginBottom: 5 }}>
                        # {partNum}
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                        background: outOfStock ? 'rgba(255,59,48,0.10)' : available <= 3 ? 'rgba(255,149,0,0.12)' : 'rgba(52,199,89,0.12)',
                        color: outOfStock ? '#ff3b30' : available <= 3 ? '#cc7700' : '#1a8a3e',
                      }}>
                        {outOfStock ? 'Out of stock' : `${available} left`}
                      </span>
                      {price > 0 && (
                        <span style={{ fontSize: 14, fontWeight: 800, color: '#007aff' }}>
                          ${price.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007aff" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
                    </svg>
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

/* ─────────────────────────── Failed Inspection Detail Modal ─────────────────────────── */

function FailedInspectionModal({ inspection, onClose }: { inspection: InspectionRecord; onClose: () => void }) {
  const isQuick = (inspection.inspection_type || '').toLowerCase().includes('quick')
    || !!inspection.inspector_name;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-vehicle-icon" style={{ background: 'rgba(255,59,48,0.10)', color: '#ff3b30' }}>
              <AlertCircle size={22} />
            </div>
            <div>
              <h2 className="modal-title">Failed Inspection</h2>
              <p className="modal-subtitle">
                {isQuick ? 'Quick Inspection' : 'DOT Inspection'} · {inspection.asset_number || '—'}
              </p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-status-banner" style={{ background: 'rgba(255,59,48,0.08)', borderColor: 'rgba(255,59,48,0.25)', color: '#ff3b30' }}>
          <AlertCircle size={16} />
          <span className="modal-status-text">Inspection Failed — Work Order may be created</span>
        </div>

        <div className="modal-details-grid">
          <div className="modal-detail-item">
            <Hash size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Inspection #</p>
              <p className="detail-value">{inspection.inspection_number || inspection.inspection_id || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <Truck size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Asset Number</p>
              <p className="detail-value">{inspection.asset_number || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <ClipboardCheck size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Inspection Type</p>
              <p className="detail-value">{inspection.inspection_type || (isQuick ? 'Quick' : 'DOT')}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <User size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Inspector</p>
              <p className="detail-value">{inspection.technician_name || inspection.inspector_name || '—'}</p>
            </div>
          </div>
          {inspection.asset_type && (
            <div className="modal-detail-item">
              <Info size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Asset Type</p>
                <p className="detail-value" style={{ textTransform: 'capitalize' }}>{inspection.asset_type}</p>
              </div>
            </div>
          )}
          {inspection.inspection_score !== undefined && (
            <div className="modal-detail-item">
              <CheckSquare size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Inspection Score</p>
                <p className="detail-value" style={{ color: '#ff3b30', fontWeight: 700 }}>{inspection.inspection_score}%</p>
              </div>
            </div>
          )}
          {inspection.issue_count !== undefined && (
            <div className="modal-detail-item">
              <AlertTriangle size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Issues Found</p>
                <p className="detail-value" style={{ color: '#ff3b30', fontWeight: 700 }}>{inspection.issue_count}</p>
              </div>
            </div>
          )}
          <div className="modal-detail-item">
            <Calendar size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Date</p>
              <p className="detail-value">
                {inspection.created_at
                  ? new Date(inspection.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </p>
            </div>
          </div>
          {(inspection.defects_found || inspection.issues_found) && (
            <div className="modal-detail-item full-width">
              <FileText size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Defects / Issues</p>
                <p className="detail-value">{inspection.defects_found || inspection.issues_found}</p>
              </div>
            </div>
          )}
        </div>

        <div className="modal-why-box" style={{ borderColor: 'rgba(255,59,48,0.30)', background: 'rgba(255,59,48,0.06)' }}>
          <div className="modal-why-header" style={{ color: '#ff3b30' }}>
            <AlertTriangle size={14} />
            <span>Action Required</span>
          </div>
          <p className="modal-why-text">
            This inspection failed. A work order should have been automatically created for repair.
            Please ensure the vehicle is serviced before returning to operation.
          </p>
        </div>

        <div className="modal-footer">
          <button className="modal-action-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Work Order Complete Modal ─────────────────────────── */

function WorkOrderCompleteModal({
  wo,
  inventory,
  onClose,
  onConfirm,
}: {
  wo: any;
  inventory: InventoryItem[];
  onClose: () => void;
  onConfirm: (id: string, note: string, usedItems: { itemId: string; qty: number }[]) => Promise<void>;
}) {
  const { t } = useTranslation();
  const fields = wo.fields ?? wo;
  const id = wo.id || wo._id;
  const existingNote = fields.notes || fields.note || fields.completion_note || fields.issue_description || '';
  const [note, setNote] = useState(existingNote);
  const [usedItems, setUsedItems] = useState<{ itemId: string; qty: number }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // BUG FIX: partPickerOpenIdx moved INTO this modal — was in Dashboard before, causing scope error
  const [partPickerOpenIdx, setPartPickerOpenIdx] = useState<number | null>(null);

  function addInventoryRow() {
    setUsedItems(prev => [...prev, { itemId: '', qty: 1 }]);
  }

  function removeInventoryRow(index: number) {
    setUsedItems(prev => prev.filter((_, i) => i !== index));
  }

  function updateRow(index: number, field: 'itemId' | 'qty', value: string | number) {
    setUsedItems(prev => prev.map((row, i) => i === index ? { ...row, [field]: value } : row));
  }

  const filledCount = usedItems.filter(u => u.itemId && u.qty > 0).length;

  const grandTotal = usedItems.reduce((sum, row) => {
    const inv: any = inventory.find((inv: any) =>
      String(inv.id || inv._id || '') === String(row.itemId)
    );
    const price = Number(inv?.pricePerPart ?? inv?.price_per_part ?? inv?.['Price per part'] ?? inv?.price ?? 0);
    return sum + price * (row.qty || 0);
  }, 0);

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(id, note, usedItems);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box wo-modal-box" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-vehicle-icon" style={{ background: 'rgba(0,122,255,0.10)', color: '#007aff' }}>
              <Wrench size={20} />
            </div>
            <div>
              <h2 className="modal-title">Complete Work Order</h2>
              <p className="modal-subtitle">{fields.work_order_number || fields.title}</p>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {/* ── WO Info Grid ── */}
        <div className="modal-details-grid">
          <div className="modal-detail-item">
            <Hash size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Work Order #</p>
              <p className="detail-value">{fields.work_order_number || id}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <Truck size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Asset Number</p>
              <p className="detail-value">{fields.asset_number || fields.trailerNumber || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <User size={14} className="detail-icon" />
            <div>
              <p className="detail-label">Assigned To / Vendor</p>
              <p className="detail-value">{fields.vendor || fields.assignedTo || '—'}</p>
            </div>
          </div>
          <div className="modal-detail-item">
            <Info size={14} className="detail-icon" />
            <div>
              <p className="detail-label">{t('workOrders.table.status')}</p>
              <p className="detail-value">{tStatus(t, fields.status || 'open')}</p>
            </div>
          </div>
          {(fields.issue_description || fields.description || fields.title) && (
            <div className="modal-detail-item full-width">
              <FileText size={14} className="detail-icon" />
              <div>
                <p className="detail-label">{t('workOrders.issueDescription')}</p>
                <p className="detail-value">{fields.issue_description || fields.description || fields.title}</p>
              </div>
            </div>
          )}
          {fields.priority && (
            <div className="modal-detail-item">
              <AlertTriangle size={14} className="detail-icon" />
              <div>
                <p className="detail-label">{t('workOrders.table.priority')}</p>
                <p className="detail-value" style={{
                  color: fields.priority === 'urgent' || fields.priority === 'high' ? '#ff3b30'
                       : fields.priority === 'medium' ? '#ff9500' : '#86868b',
                }}>
                  {tPriority(t, fields.priority)}
                </p>
              </div>
            </div>
          )}
          {fields.repair_date && (
            <div className="modal-detail-item">
              <Calendar size={14} className="detail-icon" />
              <div>
                <p className="detail-label">Repair Date</p>
                <p className="detail-value">
                  {new Date(fields.repair_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Inventory Used Section ── */}
        <div className="wo-section">
          <div className="wo-section-header">
            <Package size={14} />
            <span>Inventory Used</span>
            <button className="add-inv-btn" onClick={addInventoryRow}>+ Add Item</button>
          </div>

          {usedItems.length === 0 ? (
            <div className="inv-empty-box">
              <Package size={22} strokeWidth={1.4} style={{ color: '#d2d2d7' }} />
              <p className="wo-section-empty">No parts added yet. Click "+ Add Item" to log inventory used.</p>
            </div>
          ) : (
            <>
              <div className="inv-rows">
                {usedItems.map((row, i) => {
                  const sel: any = inventory.find((inv: any) =>
                    String(inv.id || inv._id || '') === String(row.itemId)
                  );

                  const sAvail    = sel ? Number(sel.available ?? sel.quantity ?? 0) : 0;
                  const sType     = sel?.type         || '—';
                  const sMfg      = sel?.manufacturer || '';
                  const unitPrice = sel
                    ? Number(sel.pricePerPart ?? sel.price_per_part ?? sel['Price per part'] ?? sel.price ?? 0)
                    : 0;
                  const lineTotal = unitPrice * (row.qty || 0);

                  return (
                    <div key={i} className="inv-card">

                      {/* Part Picker Button */}
                      <div className="inv-card-top">
                        <div className="inv-card-icon"><Package size={14} /></div>
                        <button
                          onClick={() => setPartPickerOpenIdx(i)}
                          style={{
                            flex: 1,
                            padding: '8px 12px',
                            background: row.itemId ? 'rgba(0,122,255,0.06)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${row.itemId ? 'rgba(0,122,255,0.25)' : 'rgba(0,0,0,0.12)'}`,
                            borderRadius: 9,
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            fontFamily: 'inherit',
                            transition: 'all 0.15s',
                            minWidth: 0,
                          }}
                        >
                          {row.itemId ? (() => {
                            const selItem: any = inventory.find((inv: any) => String(inv.id || inv._id || '') === String(row.itemId));
                            const photoUrl = selItem?.photo || selItem?.image || selItem?.photoUrl || selItem?.photo_url || '';
                            const displayName = selItem?.partName || selItem?.part_name || selItem?.name || selItem?.partNumber || 'Selected';
                            return (
                              <>
                                {photoUrl ? (
                                  <img src={photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                                ) : (
                                  <span style={{ fontSize: 18, flexShrink: 0 }}>🔩</span>
                                )}
                                <span style={{ fontWeight: 700, fontSize: 13, color: '#007aff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {displayName}
                                </span>
                              </>
                            );
                          })() : (
                            <span style={{ fontSize: 13, color: '#aeaeb2' }}>Select part… ({inventory.length} available)</span>
                          )}
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aeaeb2" strokeWidth="2.5" style={{ marginLeft: 'auto', flexShrink: 0 }}>
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        </button>
                        <button className="inv-remove" onClick={() => removeInventoryRow(i)}>
                          <X size={13} />
                        </button>
                      </div>

                      {/* Detail chips — shown after selection */}
                      {sel && (
                        <div className="inv-card-details">
                          <div className="inv-detail-chip">
                            <span className="inv-chip-label">Available</span>
                            <span className="inv-chip-value" style={{ color: sAvail < row.qty ? '#ff3b30' : '#34c759' }}>
                              {sAvail}
                            </span>
                          </div>
                          <div className="inv-detail-chip">
                            <span className="inv-chip-label">Type</span>
                            <span className="inv-chip-value">{sType}</span>
                          </div>
                          {sMfg && (
                            <div className="inv-detail-chip">
                              <span className="inv-chip-label">Mfg</span>
                              <span className="inv-chip-value">{sMfg}</span>
                            </div>
                          )}
                          <div className="inv-detail-chip" style={{ background: 'rgba(0,122,255,0.05)', border: '1px solid rgba(0,122,255,0.18)' }}>
                            <span className="inv-chip-label" style={{ color: '#007aff' }}>Unit Price</span>
                            <span className="inv-chip-value" style={{ color: '#007aff', fontSize: 13 }}>
                              {unitPrice > 0 ? `$${unitPrice.toFixed(2)}` : '—'}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Qty stepper + line total */}
                      <div className="inv-card-qty-row">
                        <span className="inv-qty-label">Quantity to use:</span>
                        <div className="inv-qty-stepper">
                          <button className="inv-step-btn" onClick={() => updateRow(i, 'qty', Math.max(1, row.qty - 1))}>−</button>
                          <input
                            type="number"
                            min={1}
                            className="inv-qty-input"
                            value={row.qty}
                            onChange={e => updateRow(i, 'qty', parseInt(e.target.value) || 1)}
                          />
                          <button className="inv-step-btn" onClick={() => updateRow(i, 'qty', row.qty + 1)}>+</button>
                        </div>

                        {sel && sAvail < row.qty && (
                          <span className="inv-qty-warn">⚠ Exceeds stock</span>
                        )}

                        {sel && unitPrice > 0 && (
                          <div className="inv-line-total">
                            <span className="inv-line-total-label">Total</span>
                            <span className="inv-line-total-value">${lineTotal.toFixed(2)}</span>
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>

              {/* Grand total row */}
              {grandTotal > 0 && (
                <div className="inv-grand-total-row">
                  <div>
                    <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: '#86868b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Parts Grand Total
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#aeaeb2' }}>
                      {filledCount} part{filledCount !== 1 ? 's' : ''} · {usedItems.filter(u => u.itemId).reduce((s, u) => s + u.qty, 0)} units
                    </p>
                  </div>
                  <span className="inv-grand-total-value">${grandTotal.toFixed(2)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Note Section ── */}
        <div className="wo-section">
          <div className="wo-section-header">
            <FileText size={14} />
            <span>Completion Note</span>
            <span className="optional-badge">optional</span>
          </div>

          {existingNote && (
            <div className="existing-note-box">
              <div className="existing-note-label">
                <CheckCircle2 size={12} />
                <span>Previously saved note</span>
              </div>
              <p className="existing-note-text">{existingNote}</p>
            </div>
          )}

          <textarea
            className="wo-note-input"
            placeholder={existingNote
              ? "Add more details or update the note above…"
              : "Describe what was done, any issues found, parts replaced, etc…"}
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
          />
          {note !== existingNote && note.trim() && (
            <p className="note-changed-hint">ℹ️ This will update the saved note on completion.</p>
          )}
        </div>

        {error && (
          <div className="wo-error">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="modal-footer">
          <button className="modal-cancel-btn" onClick={onClose} disabled={submitting}>Cancel</button>
          <button className="modal-complete-btn" onClick={handleSubmit} disabled={submitting}>
            {submitting ? (
              <>
                <span className="btn-spinner" />
                {filledCount > 0
                  ? `Saving & updating ${filledCount} part${filledCount > 1 ? 's' : ''}…`
                  : 'Completing…'}
              </>
            ) : (
              <>
                <CheckSquare size={15} />
                {filledCount > 0
                  ? `Mark Complete + Deduct ${filledCount} Part${filledCount > 1 ? 's' : ''}${grandTotal > 0 ? ` · $${grandTotal.toFixed(2)}` : ''}`
                  : 'Mark Complete'}
              </>
            )}
          </button>
        </div>

        {/* BUG FIX: Part picker modal rendered here, inside WorkOrderCompleteModal, so it has access to partPickerOpenIdx */}
        {partPickerOpenIdx !== null && (
          <DashboardPartPickerModal
            inventory={inventory}
            selectedId={String(usedItems[partPickerOpenIdx]?.itemId || '')}
           onPick={(id) => {
  if (partPickerOpenIdx === null) return;

  const selected = inventory.find(
    (inv) => String(inv.id ?? inv.partNumber ?? "") === String(id)
  );

  if (!selected) return;

  const name =
    selected.partName ||
    
    '';

  const partNumber =
    selected.partNumber ||
  
    '';

  setUsedItems((prev) =>
    prev.map((row, index) =>
      index === partPickerOpenIdx
        ? {
            ...row,
            itemId: id,
            itemName: name,
            partNumber: partNumber, // 🔥 IMPORTANT
          }
        : row
    )
  );

  setPartPickerOpenIdx(null);
}}
            onClose={() => setPartPickerOpenIdx(null)}
          />
        )}

      </div>
    </div>
  );
}


/* ─────────────────────────── Sub-Components ─────────────────────────── */

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: number | string; icon: any; color: string; sub?: string;
}) {
  return (
    <div className="apple-card stat-card group">
      <div className="stat-inner">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value">{value}</p>
          {sub && <p className="stat-sub">{sub}</p>}
        </div>
        <div className={`stat-icon-wrap ${color}`}>
          <Icon size={20} strokeWidth={1.8} className="stat-icon" />
        </div>
      </div>
    </div>
  );
}

function urgencyClass(days: number) {
  if (days <= 7)  return 'alert-critical';
  if (days <= 30) return 'alert-warning';
  return 'alert-info';
}

function InspectionAlertCard({ alert, onClick }: { alert: InspectionAlert; onClick: () => void }) {
  const cls = urgencyClass(alert.daysUntilExpiry);
  const label =
    alert.daysUntilExpiry <= 0
      ? 'Expired'
      : alert.daysUntilExpiry === 1
      ? '1 day left'
      : `${alert.daysUntilExpiry} days left`;

  return (
    <div className={`alert-row ${cls} clickable-alert`} onClick={onClick}>
      <div className="alert-icon-col">
        {alert.vehicleType === 'truck' ? <Truck size={16} /> : <Package size={16} />}
      </div>
      <div className="alert-body">
        <span className="alert-vehicle">{alert.vehicleNumber}</span>
        {alert.ownerName && <span className="alert-owner"> · {alert.ownerName}</span>}
        <span className="alert-date">
          {new Date(alert.inspectionDate).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </span>
      </div>
      <span className={`alert-badge ${cls}`}>{label}</span>
      <span className="alert-chevron">›</span>
    </div>
  );
}

function FailedInspectionRow({ inspection, onClick }: { inspection: InspectionRecord; onClick: () => void }) {
  const isQuick = (inspection.inspection_type || '').toLowerCase().includes('quick')
    || !!inspection.inspector_name;

  return (
    <div className="failed-insp-row clickable-alert" onClick={onClick}>
      <div className="failed-insp-type-badge" style={{ background: isQuick ? 'rgba(255,149,0,0.12)' : 'rgba(255,59,48,0.10)', color: isQuick ? '#ff9500' : '#ff3b30', border: `1px solid ${isQuick ? 'rgba(255,149,0,0.25)' : 'rgba(255,59,48,0.20)'}` }}>
        {isQuick ? 'Quick' : 'DOT'}
      </div>
      <div className="alert-body">
        <span className="alert-vehicle">{inspection.asset_number || '—'}</span>
        {(inspection.technician_name || inspection.inspector_name) && (
          <span className="alert-owner"> · {inspection.technician_name || inspection.inspector_name}</span>
        )}
        <span className="alert-date">
          {inspection.created_at
            ? new Date(inspection.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
            : '—'}
        </span>
      </div>
      {inspection.inspection_score !== undefined && (
        <span className="failed-score-badge">{inspection.inspection_score}%</span>
      )}
      <span className="alert-badge alert-critical">Failed</span>
      <span className="alert-chevron">›</span>
    </div>
  );
}

function WorkOrderRow({
  wo,
  onComplete,
}: {
  wo: any;
  onComplete: (wo: any) => void;
}) {
  const fields = wo.fields ?? wo;
  const status = fields.status || "open";

  return (
    <div className="wo-row">
      <div className="wo-left">
        <div>
          <p className="wo-title">
            {fields.work_order_number || fields.title}
          </p>
          <p className="wo-meta">
            #{fields.asset_number || fields.trailerNumber} ·{" "}
            {fields.vendor || fields.assignedTo}
          </p>
        </div>
      </div>
      <div className="wo-right">
        <span className="wo-status">{status}</span>
        {status !== "completed" && (
          <button
            onClick={() => onComplete(wo)}
            style={{
              background: "#000",
              color: "#fff",
              border: "none",
              padding: "6px 12px",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              marginLeft: 10,
            }}
          >
            Complete
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyAlert({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <CheckCircle2 size={28} strokeWidth={1.4} className="empty-icon" />
      <p>{text}</p>
    </div>
  );
}

/* ─────────────────────────── Main Dashboard ─────────────────────────── */

export function Dashboard({}: DashboardProps) {
  const { t } = useTranslation();
  const { authFetch } = useAuth();
  const isMobile = useIsMobile();

  const [trailers,    setTrailers]    = useState<TrailerAsset[]>([]);
  const [inventory,   setInventory]   = useState<InventoryItem[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [refreshing,  setRefreshing]  = useState(false);
  const [truckAssets, setTruckAssets] = useState<TruckAsset[]>([]);
  const [trailerTab,  setTrailerTab]  = useState<'upcoming' | 'expired'>('upcoming');
  const [truckTab,    setTruckTab]    = useState<'upcoming' | 'expired'>('upcoming');
  const [user,        setUser]        = useState<any>(null);
  const [workOrders,  setWorkOrders]  = useState<any[]>([]);

  const [dotInspections,   setDotInspections]   = useState<InspectionRecord[]>([]);
  const [quickInspections, setQuickInspections] = useState<InspectionRecord[]>([]);
  const [inspTypeFilter,   setInspTypeFilter]   = useState<'all' | 'dot' | 'quick'>('all');

  // Modal states
  const [selectedAlert,      setSelectedAlert]      = useState<InspectionAlert | null>(null);
  const [selectedWorkOrder,  setSelectedWorkOrder]  = useState<any | null>(null);
  const [selectedFailedInsp, setSelectedFailedInsp] = useState<InspectionRecord | null>(null);
  // BUG FIX: removed partPickerOpenIdx from here — it now lives inside WorkOrderCompleteModal

  useEffect(() => {
    async function loadUser() {
      try {
        const userData = await fetchCurrentUser(authFetch);
        setUser(userData);
      } catch (err) {
        console.error("User load failed:", err);
      }
    }
    loadUser();
  }, [authFetch]);

  useEffect(() => {
    if (!user) return;
    async function loadWorkOrders() {
      try {
        const orders = await fetchWorkOrders(authFetch, user.role);
        setWorkOrders(orders);
      } catch (err) {
        console.error("Work order load failed:", err);
      }
    }
    loadWorkOrders();
  }, [user, authFetch]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [trailerData, truckData, inv, { dotInspections: dot, quickInspections: quick }] = await Promise.all([
        fetchTrailers(authFetch),
        fetchTrucks(authFetch),
        fetchInventory(authFetch),
        fetchAllInspections(authFetch),
      ]);

      setTrailers(trailerData);
      setTruckAssets(truckData);
      setInventory(inv);
      setDotInspections(dot);
      setQuickInspections(quick);

      if (!inv?.length) {
        console.warn('[Dashboard] Inventory is empty or null:', inv);
      }
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Dashboard load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(true), 60_000);
    return () => clearInterval(timer);
  }, [loadData]);

  /* ── Derived: Inspection Alerts ── */
  const trailerInspectionAlerts: InspectionAlert[] = trailers
    .map(t => ({
      id: t.id,
      vehicleNumber: t.number,
      vehicleType: 'trailer' as const,
      inspectionDate: t.inspectionDate,
      daysUntilExpiry: calculateDaysUntilExpiry(t.inspectionDate),
      ownerName: t.customerName,
      plate: t.plate,
      vin: t.vin,
      year: t.year,
      make: t.make,
      status: t.status,
    }))
    .filter(a => a.daysUntilExpiry <= 30);

  const truckInspectionAlerts: InspectionAlert[] = truckAssets
    .map(t => ({
      id: t.id,
      vehicleNumber: t.number,
      vehicleType: 'truck' as const,
      inspectionDate: t.inspectionDate,
      daysUntilExpiry: calculateDaysUntilExpiry(t.inspectionDate),
      ownerName: t.owner,
      plate: t.plate,
      vin: t.vin,
      year: t.year,
      make: t.make,
      status: t.status,
    }))
    .filter(a => a.daysUntilExpiry <= 30);

  const trailerExpired  = trailerInspectionAlerts.filter(a => a.daysUntilExpiry < 0);
  const trailerUpcoming = trailerInspectionAlerts.filter(a => a.daysUntilExpiry >= 0);
  const truckExpired    = truckInspectionAlerts.filter(a => a.daysUntilExpiry < 0);
  const truckUpcoming   = truckInspectionAlerts.filter(a => a.daysUntilExpiry >= 0);

  const failedDotInspections   = dotInspections.filter(i => i.overall_status === 'failed' || i.overall_status === 'fail');
  const failedQuickInspections = quickInspections.filter(i => i.overall_status === 'failed' || i.overall_status === 'fail');

  const allFailedInspections = [
    ...failedDotInspections.map(i => ({ ...i, _source: 'dot' as const })),
    ...failedQuickInspections.map(i => ({ ...i, _source: 'quick' as const })),
  ].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());

  const filteredFailedInspections = inspTypeFilter === 'all'
    ? allFailedInspections
    : inspTypeFilter === 'dot'
    ? allFailedInspections.filter(i => i._source === 'dot')
    : allFailedInspections.filter(i => i._source === 'quick');

  /* ── Derived Stats ── */
  const totalTrailers      = trailers.length;
  const inspectionsPending = allFailedInspections.length;
  const totalAlerts        = trailerInspectionAlerts.length + truckInspectionAlerts.length;

  const usedInventory = Array.isArray(inventory)
    ? inventory.reduce((sum: number, item: any) => {
        return sum + Number(item.quantityUsedFromMechanic ?? 0);
      }, 0)
    : 0;

  const inventoryChartData = (Array.isArray(inventory) ? inventory.slice(0, 6) : []).map((i: any) => ({
    name: i.partName || i.part_name || i.name || "Unknown",
    available: i.quantity ?? i.availableQty ?? i.stock ?? i.available ?? 0,
    used: i.quantityUsedFromMechanic ?? i.quantityUsed ?? i.used ?? 0,
    pending: i.totalInventory ?? i.total ?? 0,
  }));

  const totalDot   = dotInspections.length;
  const totalQuick = quickInspections.length;
  const passedDot   = dotInspections.filter(i => i.overall_status === 'passed' || i.overall_status === 'pass').length;
  const passedQuick = quickInspections.filter(i => i.overall_status === 'passed' || i.overall_status === 'pass').length;
  const failedTotal = failedDotInspections.length + failedQuickInspections.length;

  const inspectionStatusData = [
    { name: 'DOT Pass',   value: passedDot   },
    { name: 'Quick Pass', value: passedQuick  },
    { name: 'Failed',     value: failedTotal  },
  ].filter(d => d.value > 0);

  const COLORS = ['#1d1d1f', '#6e6e73', '#ff3b30'];

  /* ── Work Order Complete Handler ── */
  async function handleCompleteWorkOrder(id: string, note: string, usedItems: { itemId: string; qty: number }[]) {
    const filledItems = usedItems.filter(u => u.itemId && u.qty > 0);

    const usedInventoryPayload = filledItems.map(u => {
      const invItem: any = inventory.find((inv: any) =>
        String(inv.id || inv._id || inv.itemId || '') === String(u.itemId)
      );
      const currentQty    = invItem ? Number(invItem.quantity ?? invItem.availableQty ?? invItem.stock ?? invItem.available ?? 0) : 0;
      const inventoryName = invItem ? (invItem.partName || invItem.part_name || invItem.name || invItem.title || 'Unknown Part') : 'Unknown Part';
      return {
        inventoryId:   String(u.itemId),
        inventoryName: inventoryName,
        currentQty:    currentQty,
        quantityUsed:  Number(u.qty),
      };
    });

    await updateWorkOrderAPI(authFetch, id, {
      status:         'completed',
      notes:          note || undefined,
      end_time:       new Date().toISOString(),
      used_inventory: usedInventoryPayload,
    });

    if (usedInventoryPayload.length > 0) {
      try {
        await subtractInventory(authFetch, usedInventoryPayload);
        setInventory(prev => prev.map((inv: any) => {
          const matched = usedInventoryPayload.find(p =>
            p.inventoryId === String(inv.id || inv._id || inv.itemId || '')
          );
          if (!matched) return inv;
          const qtyKey = 'quantity' in inv ? 'quantity'
                       : 'availableQty' in inv ? 'availableQty'
                       : 'stock' in inv ? 'stock'
                       : 'available' in inv ? 'available' : null;
          if (!qtyKey) return inv;
          return { ...inv, [qtyKey]: Math.max(0, Number(inv[qtyKey]) - matched.quantityUsed) };
        }));
      } catch (invErr) {
        console.error('[Dashboard] Inventory subtract failed (WO saved):', invErr);
      }
    }

    setWorkOrders(prev =>
      prev.map(w =>
        (w.id || w._id) === id
          ? { ...w, fields: { ...(w.fields ?? w), status: 'completed' } }
          : w
      )
    );
  }

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <>
        <Style />
        <div className="dash-root">
          <header className="dash-header">
            <div>
              <h1 className="dash-title">{t('dashboard.title')}</h1>
              <p className="dash-sub">Loading live data…</p>
            </div>
          </header>
          <div className="grid-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="apple-card skeleton-card">
                <div className="skel skel-text w-half" />
                <div className="skel skel-big w-third" />
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Style />
      <div className="dash-root">

        {/* ── Inspection Alert Modal ── */}
        {selectedAlert && (
          <InspectionDetailModal
            alert={selectedAlert}
            onClose={() => setSelectedAlert(null)}
          />
        )}

        {/* ── Failed Inspection Modal ── */}
        {selectedFailedInsp && (
          <FailedInspectionModal
            inspection={selectedFailedInsp}
            onClose={() => setSelectedFailedInsp(null)}
          />
        )}

        {/* ── Work Order Complete Modal ── */}
        {selectedWorkOrder && (
          <WorkOrderCompleteModal
            wo={selectedWorkOrder}
            inventory={inventory}
            onClose={() => setSelectedWorkOrder(null)}
            onConfirm={handleCompleteWorkOrder}
          />
        )}

        {/* ── Header ── */}
        <header className="dash-header">
          <div>
            <h1 className="dash-title">{t('dashboard.title')}</h1>
            <p className="dash-sub">
              {t('dashboard.lastUpdated')} {lastRefresh.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <button
            className={`refresh-btn ${refreshing ? 'spinning' : ''}`}
            onClick={() => loadData(true)}
            title={t('dashboard.refresh')}
            aria-label={t('dashboard.refresh')}
          >
            <RefreshCw size={15} strokeWidth={2} />
            {refreshing ? t('dashboard.refreshing') : t('dashboard.refresh')}
          </button>
        </header>

        {/* ── Stat Cards ── */}
        <div className="grid-4">
          <StatCard label={t('dashboard.totalTrailers')}      value={totalTrailers}      icon={Truck}          color="blue"   />
          <StatCard
            label="Failed Inspections"
            value={inspectionsPending}
            icon={ClipboardCheck}
            color="amber"
            sub={inspectionsPending > 0 ? `${failedDotInspections.length} DOT · ${failedQuickInspections.length} Quick` : 'All clear'}
          />
          <StatCard
            label={t('dashboard.usedInventory')}
            value={usedInventory}
            icon={Package}
            color="green"
            sub={`${inventory.length} total parts`}
          />
          <StatCard label="Active Alerts" value={totalAlerts} icon={Bell} color={totalAlerts > 0 ? 'red' : 'gray'} sub={totalAlerts > 0 ? 'Inspection due' : 'All clear'} />
        </div>

        {/* ── Inspection Alerts ── */}
        <div className="grid-2">
          {/* Trailer Alerts */}
          <div className="apple-card">
            <div className="section-head">
              <div className="section-head-left">
                <CalendarClock size={16} strokeWidth={1.8} className="section-icon amber" />
                <h2 className="section-title">{t('dashboard.trailerInspectionAlerts')}</h2>
              </div>
              <span className="badge-count amber">{trailerInspectionAlerts.length}</span>
            </div>
            <div className="segmented-control">
              <button className={trailerTab === 'upcoming' ? 'segment active' : 'segment'} onClick={() => setTrailerTab('upcoming')}>
                {t('dashboard.daysLeft')} ({trailerUpcoming.length})
              </button>
              <button className={trailerTab === 'expired' ? 'segment active' : 'segment'} onClick={() => setTrailerTab('expired')}>
                {t('dashboard.expired')} ({trailerExpired.length})
              </button>
            </div>
            <div className="alert-list scrollable">
              {(trailerTab === 'upcoming' ? trailerUpcoming : trailerExpired).length === 0 ? (
                <EmptyAlert text={t('dashboard.noAlertsInCategory')} />
              ) : (
                (trailerTab === 'upcoming' ? trailerUpcoming : trailerExpired)
                  .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
                  .map(a => (
                    <InspectionAlertCard
                      key={a.id}
                      alert={a}
                      onClick={() => setSelectedAlert(a)}
                    />
                  ))
              )}
            </div>
          </div>

          {/* Truck Alerts */}
          <div className="apple-card">
            <div className="section-head">
              <div className="section-head-left">
                <AlertTriangle size={16} strokeWidth={1.8} className="section-icon red" />
                <h2 className="section-title">{t('dashboard.truckInspectionAlerts')}</h2>
              </div>
              <span className="badge-count red">{truckInspectionAlerts.length}</span>
            </div>
            <div className="segmented-control">
              <button className={truckTab === 'upcoming' ? 'segment active' : 'segment'} onClick={() => setTruckTab('upcoming')}>
                {t('dashboard.daysLeft')} ({truckUpcoming.length})
              </button>
              <button className={truckTab === 'expired' ? 'segment active' : 'segment'} onClick={() => setTruckTab('expired')}>
                {t('dashboard.expired')} ({truckExpired.length})
              </button>
            </div>
            <div className="alert-list scrollable">
              {(truckTab === 'upcoming' ? truckUpcoming : truckExpired).length === 0 ? (
                <EmptyAlert text={t('dashboard.noAlertsInCategory')} />
              ) : (
                (truckTab === 'upcoming' ? truckUpcoming : truckExpired)
                  .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
                  .map(a => (
                    <InspectionAlertCard
                      key={a.id}
                      alert={a}
                      onClick={() => setSelectedAlert(a)}
                    />
                  ))
              )}
            </div>
          </div>
        </div>

        {/* ── Failed Inspections Section ── */}
        <div className="apple-card">
          <div className="section-head">
            <div className="section-head-left">
              <AlertCircle size={16} strokeWidth={1.8} className="section-icon red" />
              <h2 className="section-title">Failed Inspections</h2>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div className="insp-type-filter">
                <button
                  className={`insp-type-pill ${inspTypeFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setInspTypeFilter('all')}
                >
                  All ({allFailedInspections.length})
                </button>
                <button
                  className={`insp-type-pill dot ${inspTypeFilter === 'dot' ? 'active' : ''}`}
                  onClick={() => setInspTypeFilter('dot')}
                >
                  DOT ({failedDotInspections.length})
                </button>
                <button
                  className={`insp-type-pill quick ${inspTypeFilter === 'quick' ? 'active' : ''}`}
                  onClick={() => setInspTypeFilter('quick')}
                >
                  Quick ({failedQuickInspections.length})
                </button>
              </div>
              <span className="badge-count red">{filteredFailedInspections.length}</span>
            </div>
          </div>

          <div className="alert-list scrollable">
            {filteredFailedInspections.length === 0 ? (
              <EmptyAlert text="No failed inspections" />
            ) : (
              filteredFailedInspections.map(insp => (
                <FailedInspectionRow
                  key={insp.id}
                  inspection={insp}
                  onClick={() => setSelectedFailedInsp(insp)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Work Orders ── */}
        <div className="apple-card">
          <div className="section-head">
            <div className="section-head-left">
              <Wrench size={16} strokeWidth={1.8} className="section-icon blue" />
              <h2 className="section-title">Work Orders</h2>
            </div>
            <span className="badge-count blue">{workOrders.length}</span>
          </div>
          <div className="wo-list wo-list-scroll">
            {workOrders.length === 0 ? (
              <EmptyAlert text="No work orders found" />
            ) : (
              workOrders.map((wo: any) => (
                <WorkOrderRow
                  key={wo.id || wo._id}
                  wo={wo}
                  onComplete={(wo) => setSelectedWorkOrder(wo)}
                />
              ))
            )}
          </div>
        </div>

        {/* ── Charts ── */}
        <div className="grid-2">
          <div className="apple-card">
            <div className="section-head">
              <div className="section-head-left">
                <Package size={16} strokeWidth={1.8} className="section-icon green" />
                <h2 className="section-title">{t('dashboard.inventoryUsage')}</h2>
              </div>
              <span style={{ fontSize: 11, color: '#86868b', fontWeight: 500 }}>{t('dashboard.topParts', { count: 6 })}</span>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 220 : 260}>
              <BarChart
                data={inventoryChartData}
                margin={{ top: 4, right: 8, bottom: isMobile ? 36 : 60, left: isMobile ? -16 : 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f5" />
                <XAxis
                  dataKey="name"
                  angle={isMobile ? -20 : -38}
                  textAnchor="end"
                  interval={0}
                  tick={{ fontSize: isMobile ? 10 : 11, fill: '#86868b' }}
                  height={isMobile ? 50 : 70}
                />
                <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: '#86868b' }} width={isMobile ? 28 : 40} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#1d1d1f', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: isMobile ? 11 : 12, paddingTop: 8, color: '#86868b' }} />
                <Bar dataKey="available" fill="#1d1d1f" radius={[4, 4, 0, 0]} name="Available" />
                <Bar dataKey="used"      fill="#86868b" radius={[4, 4, 0, 0]} name="Used" />
                <Bar dataKey="pending"   fill="#d2d2d7" radius={[4, 4, 0, 0]} name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="apple-card">
            <div className="section-head">
              <div className="section-head-left">
                <ClipboardCheck size={16} strokeWidth={1.8} className="section-icon blue" />
                <h2 className="section-title">{t('dashboard.inspectionOverview')}</h2>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
              <div className="insp-summary-chip" style={{ background: 'rgba(0,0,0,0.05)', color: '#1d1d1f' }}>
                <ClipboardCheck size={12} />
                <span>DOT: {totalDot}</span>
              </div>
              <div className="insp-summary-chip" style={{ background: 'rgba(255,149,0,0.10)', color: '#cc7700' }}>
                <ClipboardCheck size={12} />
                <span>Quick: {totalQuick}</span>
              </div>
              <div className="insp-summary-chip" style={{ background: 'rgba(255,59,48,0.10)', color: '#ff3b30' }}>
                <AlertCircle size={12} />
                <span>Failed: {failedTotal}</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 220}>
              <PieChart>
                <Pie
                  data={inspectionStatusData}
                  cx="50%" cy="50%"
                  innerRadius={isMobile ? 45 : 55}
                  outerRadius={isMobile ? 75 : 90}
                  paddingAngle={3}
                  labelLine={false}
                  label={({ name, value }) => value > 0 ? `${name} ${value}` : ''}
                  dataKey="value"
                >
                  {inspectionStatusData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid rgba(0,0,0,0.08)', background: '#fff', color: '#1d1d1f', boxShadow: '0 4px 24px rgba(0,0,0,0.10)', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            {(totalDot + totalQuick) === 0 && (
              <EmptyAlert text={t('dashboard.noInspectionData')} />
            )}
          </div>
        </div>

        {/* ── Recent Activity ── */}
        <div className="apple-card">
          <div className="section-head">
            <div className="section-head-left">
              <ClipboardCheck size={16} strokeWidth={1.8} className="section-icon blue" />
              <h2 className="section-title">{t('dashboard.recentActivity')}</h2>
            </div>
          </div>
          {allFailedInspections.length === 0 && dotInspections.length === 0 && quickInspections.length === 0 ? (
            <EmptyAlert text={t('common.noData')} />
          ) : (
            <div className="activity-list">
              {[...dotInspections, ...quickInspections]
                .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
                .slice(0, 5)
                .map(ins => (
                  <div key={ins.id} className="activity-row">
                    <div className="activity-icon-wrap" style={{
                      background: (ins.overall_status === 'failed' || ins.overall_status === 'fail')
                        ? 'rgba(255,59,48,0.10)' : 'rgba(52,199,89,0.10)',
                      color: (ins.overall_status === 'failed' || ins.overall_status === 'fail') ? '#ff3b30' : '#34c759',
                    }}>
                      <ClipboardCheck size={14} strokeWidth={2} />
                    </div>
                    <div className="activity-body">
                      <p className="activity-title">
                        {ins.inspection_type || (ins.inspector_name ? 'Quick' : 'DOT')} Inspection — {ins.asset_number || '—'}
                      </p>
                      <p className="activity-meta">{ins.technician_name || ins.inspector_name || '—'}</p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      <span className="activity-date">
                        {ins.created_at
                          ? new Date(ins.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '—'}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: (ins.overall_status === 'failed' || ins.overall_status === 'fail') ? 'rgba(255,59,48,0.10)' : 'rgba(52,199,89,0.10)',
                        color: (ins.overall_status === 'failed' || ins.overall_status === 'fail') ? '#ff3b30' : '#34c759',
                      }}>
                        {tStatus(t, ins.overall_status)}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>

      </div>
    </>
  );
}

/* ─────────────────────────── CSS ─────────────────────────── */
function Style() {
  return (
    <style>{`
      :root {
        --bg:        #f5f5f7;
        --surface:   #ffffff;
        --surface-2: #f5f5f7;
        --border:    rgba(0,0,0,0.08);
        --border-2:  rgba(0,0,0,0.05);
        --text-1:    #1d1d1f;
        --text-2:    #3d3d3f;
        --text-3:    #86868b;
        --text-4:    #aeaeb2;
        --accent:    #1d1d1f;
        --warn:      #6e6e73;
        --ok:        #86868b;
        --gray:      #d2d2d7;
        --radius-lg: 18px;
        --radius-md: 12px;
        --radius-sm: 8px;
        --shadow:    0 1px 0 rgba(0,0,0,0.04), 0 2px 16px rgba(0,0,0,0.06);
        --shadow-hv: 0 1px 0 rgba(0,0,0,0.06), 0 6px 28px rgba(0,0,0,0.10);
        --font:     -apple-system, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif;
        --font-num: 'SF Pro Rounded', -apple-system, 'Helvetica Neue', Arial, sans-serif;
      }
      *, *::before, *::after { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; background: var(--bg); overflow-x: hidden; width: 100%; }
      .dash-root { font-family: var(--font); background: var(--bg); min-height: 100%; width: 100%; display: flex; flex-direction: column; gap: 18px; }
      .dash-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: nowrap; }
      .dash-title { font-size: 26px; font-weight: 700; letter-spacing: -0.6px; color: var(--text-1); margin: 0; line-height: 1.15; }
      @media (min-width: 600px) { .dash-title { font-size: 30px; } }
      .dash-sub { font-size: 13px; color: var(--text-3); margin: 2px 0 0; font-weight: 400; }
      .refresh-btn { display: flex; align-items: center; gap: 5px; font-family: var(--font); font-size: 13px; font-weight: 500; color: var(--text-2); background: rgba(0,0,0,0.05); border: 1px solid rgba(0,0,0,0.08); border-radius: 20px; padding: 8px 14px; cursor: pointer; transition: background 0.15s, transform 0.15s; white-space: nowrap; flex-shrink: 0; -webkit-tap-highlight-color: transparent; }
      .refresh-btn:hover { background: rgba(0,0,0,0.09); }
      .refresh-btn:active { transform: scale(0.96); background: rgba(0,0,0,0.12); }
      .refresh-btn svg { flex-shrink: 0; }
      .refresh-btn.spinning svg { animation: spin 0.8s linear infinite; }
      @keyframes spin { to { transform: rotate(360deg); } }
      .alert-list.scrollable { max-height: 340px; overflow-y: auto; padding-right: 4px; }
      .alert-list.scrollable::-webkit-scrollbar { width: 6px; }
      .alert-list.scrollable::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.15); border-radius: 10px; }
      .alert-list.scrollable::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.25); }
      .segmented-control { display: flex; background: #f2f2f7; border-radius: 10px; padding: 4px; margin-bottom: 12px; }
      .segment { flex: 1; border: none; background: transparent; padding: 6px 10px; font-size: 13px; border-radius: 8px; cursor: pointer; transition: all 0.2s ease; }
      .segment.active { background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.08); font-weight: 600; }
      .apple-card { background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--border); box-shadow: var(--shadow); padding: 18px 16px; transition: box-shadow 0.2s, border-color 0.2s; width: 100%; min-width: 0; }
      @media (min-width: 600px) { .apple-card { padding: 20px; } }
      .apple-card:hover { box-shadow: var(--shadow-hv); border-color: rgba(0,0,0,0.12); }
      .grid-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      .grid-2 { display: grid; grid-template-columns: 1fr; gap: 14px; }
      @media (min-width: 600px) { .grid-4 { gap: 12px; } }
      @media (min-width: 900px) { .grid-2 { grid-template-columns: 1fr 1fr; } }
      @media (min-width: 1024px) { .grid-4 { grid-template-columns: repeat(4, 1fr); gap: 14px; } }
      .stat-card { cursor: default; }
      .stat-inner { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      .stat-label { font-size: 10px; font-weight: 600; color: var(--text-3); letter-spacing: 0.4px; margin: 0 0 6px; text-transform: uppercase; }
      @media (min-width: 600px) { .stat-label { font-size: 11px; } }
      .stat-value { font-family: var(--font-num); font-size: 32px; font-weight: 700; color: var(--text-1); line-height: 1; letter-spacing: -1px; margin: 0; }
      @media (min-width: 600px) { .stat-value { font-size: 36px; } }
      .stat-sub { font-size: 11px; color: var(--text-3); margin: 5px 0 0; font-weight: 400; }
      .stat-icon-wrap { border-radius: var(--radius-sm); padding: 9px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
      .stat-icon { color: var(--text-1); }
      .stat-icon-wrap.blue  { background: rgba(0,0,0,0.06); }
      .stat-icon-wrap.amber { background: rgba(0,0,0,0.05); }
      .stat-icon-wrap.green { background: rgba(0,0,0,0.05); }
      .stat-icon-wrap.red   { background: rgba(0,0,0,0.07); border: 1px solid rgba(0,0,0,0.10); }
      .stat-icon-wrap.gray  { background: rgba(0,0,0,0.04); }
      .section-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 8px; }
      .section-head-left { display: flex; align-items: center; gap: 8px; }
      .section-title { font-size: 15px; font-weight: 600; color: var(--text-1); margin: 0; letter-spacing: -0.2px; }
      .section-icon { color: var(--text-3); }
      .section-icon.blue  { color: var(--text-2); }
      .section-icon.green { color: var(--text-2); }
      .section-icon.amber { color: var(--warn); }
      .section-icon.red   { color: #ff3b30; }
      .badge-count { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 20px; }
      .badge-count.amber { background: rgba(0,0,0,0.06); color: var(--warn); }
      .badge-count.red   { background: rgba(255,59,48,0.10); color: #ff3b30; border: 1px solid rgba(255,59,48,0.20); }
      .badge-count.blue  { background: rgba(0,0,0,0.05); color: var(--text-2); }
      .alert-list { display: flex; flex-direction: column; gap: 6px; }
      .alert-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); transition: background 0.15s; }
      .alert-row:hover { filter: brightness(0.97); }
      .clickable-alert { cursor: pointer; transition: transform 0.12s, box-shadow 0.12s; }
      .clickable-alert:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      .clickable-alert:active { transform: scale(0.98); }
      .alert-chevron { font-size: 18px; color: var(--text-4); flex-shrink: 0; margin-left: 2px; transition: transform 0.15s; }
      .clickable-alert:hover .alert-chevron { transform: translateX(2px); color: var(--text-3); }
      .alert-critical { background: rgba(255,59,48,0.06); border: 1px solid rgba(255,59,48,0.12); }
      .alert-warning  { background: rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.06); }
      .alert-info     { background: rgba(0,0,0,0.02); border: 1px solid rgba(0,0,0,0.04); }
      .alert-icon-col { flex-shrink: 0; color: var(--text-3); }
      .alert-body { flex: 1; min-width: 0; }
      .alert-vehicle { font-size: 13px; font-weight: 600; color: var(--text-1); }
      .alert-owner   { font-size: 13px; color: var(--text-3); }
      .alert-date    { display: block; font-size: 11px; color: var(--text-3); margin-top: 1px; }
      .alert-badge { font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.2px; }
      .alert-badge.alert-critical { background: rgba(255,59,48,0.10); color: #ff3b30; border: 1px solid rgba(255,59,48,0.20); }
      .alert-badge.alert-warning  { background: rgba(0,0,0,0.06); color: var(--warn); }
      .alert-badge.alert-info     { background: rgba(0,0,0,0.04); color: var(--text-3); }
      .failed-insp-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--radius-sm); background: rgba(255,59,48,0.04); border: 1px solid rgba(255,59,48,0.10); }
      .failed-insp-type-badge { font-size: 10px; font-weight: 700; padding: 3px 9px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; letter-spacing: 0.3px; text-transform: uppercase; }
      .failed-score-badge { font-size: 11px; font-weight: 700; color: #ff3b30; flex-shrink: 0; }
      .insp-type-filter { display: flex; gap: 4px; }
      .insp-type-pill { font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; border: 1px solid rgba(0,0,0,0.10); background: rgba(0,0,0,0.04); color: #86868b; cursor: pointer; transition: all 0.15s; }
      .insp-type-pill:hover { background: rgba(0,0,0,0.08); }
      .insp-type-pill.active { background: #1d1d1f; color: #fff; border-color: #1d1d1f; }
      .insp-type-pill.dot.active { background: #1d1d1f; color: #fff; }
      .insp-type-pill.quick.active { background: #cc7700; color: #fff; border-color: #cc7700; }
      .insp-summary-chip { display: flex; align-items: center; gap: 5px; font-size: 11px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
      .wo-list { display: flex; flex-direction: column; gap: 0; }
      .wo-list-scroll { max-height: 360px; overflow-y: auto; padding-right: 4px; }
      .wo-list-scroll::-webkit-scrollbar { width: 6px; }
      .wo-list-scroll::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.13); border-radius: 10px; }
      .wo-list-scroll::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.22); }
      .wo-row { display: flex; align-items: center; justify-content: space-between; padding: 11px 4px; border-bottom: 1px solid var(--border-2); gap: 12px; transition: background 0.12s; border-radius: 6px; }
      .wo-row:last-child { border-bottom: none; }
      .wo-row:hover { background: rgba(0,0,0,0.025); }
      .wo-left  { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
      .wo-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
      .wo-title { font-size: 13px; font-weight: 600; color: var(--text-1); margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
      @media (min-width: 480px) { .wo-title { max-width: 220px; } }
      @media (min-width: 768px) { .wo-title { max-width: 300px; font-size: 13.5px; } }
      .wo-meta { font-size: 11px; color: var(--text-3); margin: 0; }
      .wo-status { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; background: rgba(0,0,0,0.06); color: var(--text-2); }
      .activity-list { display: flex; flex-direction: column; gap: 0; }
      .activity-row { display: flex; align-items: center; gap: 12px; padding: 11px 4px; border-bottom: 1px solid var(--border-2); }
      .activity-row:last-child { border-bottom: none; }
      .activity-icon-wrap { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
      .activity-body { flex: 1; min-width: 0; }
      .activity-title { font-size: 13.5px; font-weight: 600; color: var(--text-1); margin: 0 0 2px; }
      .activity-meta  { font-size: 11px; color: var(--text-3); margin: 0; }
      .activity-date  { font-size: 11px; color: var(--text-3); flex-shrink: 0; }
      .empty-state { display: flex; flex-direction: column; align-items: center; padding: 28px 0; color: var(--text-3); gap: 8px; font-size: 13px; }
      .empty-icon { color: var(--text-4); opacity: 0.7; }
      .skeleton-card { display: flex; flex-direction: column; gap: 12px; }
      .skel { background: #e5e5ea; border-radius: 6px; animation: pulse 1.3s ease-in-out infinite; }
      .skel-text { height: 13px; }
      .skel-big  { height: 36px; }
      .w-half  { width: 55%; }
      .w-third { width: 35%; }
      @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.45; } }

      /* ══════ MODAL STYLES ══════ */
      .modal-overlay {
        position: fixed; inset: 0; z-index: 1000;
        background: rgba(0,0,0,0.45);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 16px;
        animation: fadeIn 0.18s ease;
      }
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      .modal-box {
        background: #fff;
        border-radius: 22px;
        width: 100%;
        max-width: 520px;
        max-height: 88vh;
        overflow-y: auto;
        box-shadow: 0 24px 64px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.10);
        animation: slideUp 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
        border: 1px solid rgba(0,0,0,0.08);
      }
      .wo-modal-box { max-width: 580px; }
      @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0)   scale(1);    }
      }
      .inv-line-total {
        margin-left: auto; display: flex; flex-direction: column;
        align-items: flex-end; gap: 1px; flex-shrink: 0;
      }
      .inv-line-total-label {
        font-size: 9px; font-weight: 700; color: #aeaeb2;
        text-transform: uppercase; letter-spacing: 0.4px;
      }
      .inv-line-total-value { font-size: 14px; font-weight: 700; color: #007aff; }
      .inv-grand-total-row {
        display: flex; align-items: center; justify-content: space-between;
        margin-top: 10px; padding: 12px 16px;
        background: rgba(0,122,255,0.06);
        border: 1.5px solid rgba(0,122,255,0.18);
        border-radius: 12px;
      }
      .inv-grand-total-value {
        font-size: 22px; font-weight: 800; color: #007aff; letter-spacing: -0.5px;
      }
      .modal-box::-webkit-scrollbar { width: 6px; }
      .modal-box::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 10px; }
      .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 20px 20px 16px;
        border-bottom: 1px solid rgba(0,0,0,0.07);
        gap: 12px;
      }
      .modal-header-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
      .modal-vehicle-icon {
        width: 44px; height: 44px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .modal-title { font-size: 17px; font-weight: 700; color: #1d1d1f; margin: 0 0 2px; letter-spacing: -0.3px; }
      .modal-subtitle { font-size: 12px; color: #86868b; margin: 0; }
      .modal-close {
        width: 32px; height: 32px; border-radius: 50%;
        background: rgba(0,0,0,0.06);
        border: none; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        color: #86868b; flex-shrink: 0;
        transition: background 0.15s, color 0.15s;
      }
      .modal-close:hover { background: rgba(0,0,0,0.12); color: #1d1d1f; }
      .modal-status-banner {
        margin: 16px 20px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid;
        display: flex; align-items: center; gap: 8px;
        font-size: 13px; font-weight: 600;
      }
      .modal-status-text { flex: 1; }
      .modal-expiry-date { font-size: 11px; font-weight: 400; opacity: 0.8; white-space: nowrap; }
      .modal-details-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1px;
        background: rgba(0,0,0,0.06);
        margin: 0 20px 16px;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(0,0,0,0.06);
      }
      .modal-detail-item {
        display: flex; align-items: flex-start; gap: 10px;
        padding: 12px 14px;
        background: #fff;
        min-width: 0;
      }
      .modal-detail-item.full-width { grid-column: 1 / -1; }
      .detail-icon { color: #86868b; flex-shrink: 0; margin-top: 2px; }
      .detail-label { font-size: 10px; font-weight: 600; color: #86868b; text-transform: uppercase; letter-spacing: 0.4px; margin: 0 0 3px; }
      .detail-value { font-size: 13px; font-weight: 600; color: #1d1d1f; margin: 0; }
      .vin-value { font-size: 11px; font-family: 'SF Mono', 'Courier New', monospace; letter-spacing: 0.5px; }
      .modal-why-box {
        margin: 0 20px 16px;
        padding: 12px 14px;
        border-radius: 12px;
        border: 1px solid;
      }
      .modal-why-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
        margin-bottom: 6px;
      }
      .modal-why-text { font-size: 13px; color: #3d3d3f; margin: 0; line-height: 1.5; }
      .modal-footer {
        display: flex; justify-content: flex-end; gap: 10px;
        padding: 16px 20px;
        border-top: 1px solid rgba(0,0,0,0.07);
      }
      .modal-action-btn {
        background: #1d1d1f; color: #fff;
        border: none; border-radius: 10px;
        padding: 10px 20px;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        font-family: var(--font);
      }
      .modal-action-btn:hover { background: #3d3d3f; }
      .modal-action-btn:active { transform: scale(0.97); }
      .modal-cancel-btn {
        background: rgba(0,0,0,0.06); color: #3d3d3f;
        border: none; border-radius: 10px;
        padding: 10px 20px;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        transition: background 0.15s;
        font-family: var(--font);
      }
      .modal-cancel-btn:hover { background: rgba(0,0,0,0.10); }
      .modal-cancel-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .modal-complete-btn {
        background: #1d1d1f; color: #fff;
        border: none; border-radius: 10px;
        padding: 10px 20px;
        font-size: 13px; font-weight: 600;
        cursor: pointer;
        display: flex; align-items: center; gap: 6px;
        transition: background 0.15s, transform 0.1s;
        font-family: var(--font);
      }
      .modal-complete-btn:hover:not(:disabled) { background: #3d3d3f; }
      .modal-complete-btn:active:not(:disabled) { transform: scale(0.97); }
      .modal-complete-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .btn-spinner {
        width: 14px; height: 14px;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
      .wo-section { padding: 0 20px 16px; }
      .wo-section-header {
        display: flex; align-items: center; gap: 6px;
        font-size: 12px; font-weight: 700; color: #86868b;
        text-transform: uppercase; letter-spacing: 0.5px;
        margin-bottom: 10px;
      }
      .optional-badge { font-size: 10px; background: rgba(0,0,0,0.06); color: #86868b; padding: 1px 7px; border-radius: 20px; font-weight: 500; letter-spacing: 0; text-transform: none; margin-left: auto; }
      .add-inv-btn { margin-left: auto; font-size: 12px; font-weight: 600; color: #007aff; background: rgba(0,122,255,0.08); border: none; border-radius: 7px; padding: 4px 10px; cursor: pointer; transition: background 0.15s; }
      .add-inv-btn:hover { background: rgba(0,122,255,0.15); }
      .wo-section-empty { font-size: 12px; color: #aeaeb2; margin: 0; padding: 8px 0; }
      .inv-empty-box { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 20px 0 10px; }
      .inv-empty-box .wo-section-empty { text-align: center; }
      .inv-rows { display: flex; flex-direction: column; gap: 10px; }
      .inv-card { background: #fafafa; border: 1px solid rgba(0,0,0,0.08); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; transition: box-shadow 0.15s; }
      .inv-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.07); }
      .inv-card-top { display: flex; align-items: center; gap: 8px; }
      .inv-card-icon { width: 28px; height: 28px; background: rgba(0,0,0,0.06); border-radius: 7px; display: flex; align-items: center; justify-content: center; color: #86868b; flex-shrink: 0; }
      .inv-card-details { display: flex; gap: 8px; flex-wrap: wrap; }
      .inv-detail-chip { background: #fff; border: 1px solid rgba(0,0,0,0.08); border-radius: 8px; padding: 5px 10px; display: flex; flex-direction: column; gap: 1px; min-width: 80px; }
      .inv-chip-label { font-size: 9px; font-weight: 700; color: #aeaeb2; text-transform: uppercase; letter-spacing: 0.4px; }
      .inv-chip-value { font-size: 12px; font-weight: 700; color: #1d1d1f; }
      .inv-card-qty-row { display: flex; align-items: center; gap: 10px; }
      .inv-qty-label { font-size: 12px; font-weight: 600; color: #86868b; flex: 1; }
      .inv-qty-stepper { display: flex; align-items: center; border: 1px solid rgba(0,0,0,0.12); border-radius: 9px; overflow: hidden; background: #fff; }
      .inv-step-btn { background: none; border: none; width: 32px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 400; color: #3d3d3f; cursor: pointer; transition: background 0.12s; line-height: 1; }
      .inv-step-btn:hover { background: rgba(0,0,0,0.06); }
      .inv-step-btn:active { background: rgba(0,0,0,0.10); }
      .inv-qty-input { width: 42px; height: 30px; border: none; border-left: 1px solid rgba(0,0,0,0.08); border-right: 1px solid rgba(0,0,0,0.08); text-align: center; font-size: 13px; font-weight: 700; color: #1d1d1f; font-family: var(--font); outline: none; background: #fff; }
      .inv-qty-input::-webkit-inner-spin-button, .inv-qty-input::-webkit-outer-spin-button { -webkit-appearance: none; }
      .inv-qty-warn { font-size: 11px; font-weight: 600; color: #ff3b30; }
      .wo-note-input {
        width: 100%; border: 1px solid rgba(0,0,0,0.12);
        border-radius: 10px; padding: 10px 12px;
        font-size: 13px; font-family: var(--font); color: #1d1d1f;
        background: #fafafa; resize: vertical; outline: none;
        line-height: 1.5; transition: border-color 0.15s;
      }
      .wo-note-input:focus { border-color: rgba(0,0,0,0.3); }
      .wo-note-input::placeholder { color: #aeaeb2; }
      .existing-note-box { background: rgba(52,199,89,0.07); border: 1px solid rgba(52,199,89,0.25); border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; }
      .existing-note-label { display: flex; align-items: center; gap: 5px; font-size: 10px; font-weight: 700; color: #34c759; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
      .existing-note-text { font-size: 13px; color: #1d1d1f; margin: 0; line-height: 1.5; white-space: pre-wrap; }
      .note-changed-hint { font-size: 11px; color: #86868b; margin: 6px 0 0; }
      .wo-error { margin: 0 20px 12px; padding: 10px 14px; background: rgba(255,59,48,0.08); border: 1px solid rgba(255,59,48,0.20); border-radius: 10px; font-size: 12px; color: #ff3b30; font-weight: 500; display: flex; align-items: center; gap: 6px; }
      .inv-remove { background: none; border: none; cursor: pointer; color: #aeaeb2; display: flex; align-items: center; padding: 4px; border-radius: 6px; transition: background 0.12s, color 0.12s; flex-shrink: 0; }
      .inv-remove:hover { background: rgba(255,59,48,0.10); color: #ff3b30; }
    `}</style>
  );
}