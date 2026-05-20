import { useTranslation } from "react-i18next";
import { useState, useEffect, useCallback } from "react";
import type { InventoryItem } from "../services/airtable";
import { toast } from "sonner";
import { Package, AlertTriangle } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";

const API_URL = apiUrl("/users/getInventorywork");
export function Inventory() {
  const { t } = useTranslation();
  const { authFetch } = useAuth();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch(API_URL);
      if (!res.ok) throw new Error("Failed");
      const result = await res.json().catch(() => ({} as any));
      setInventory(Array.isArray(result?.data) ? result.data : []);
    } catch (error) {
      console.error(error);
      toast.error(t("inventory.failedToLoad"));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadInventory(); }, [loadInventory]);

  if (loading) {
    return (
      <div className="inv-root">
        <InventoryStyle />
        <h1 className="inv-title">{t("inventory.title")}</h1>
        <div className="inv-grid">
          {[1,2,3,4,5,6].map(i => <div key={i} className="inv-card inv-skeleton" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="inv-root">
      <InventoryStyle />
      <h1 className="inv-title">{t("inventory.title")}</h1>

      {inventory.length === 0 ? (
        <div className="inv-empty">
          <Package size={48} strokeWidth={1.5} />
          <p>{t("inventory.noItems")}</p>
        </div>
      ) : (
        <div className="inv-grid">
          {inventory.map(item => {
            const available = item.quantity;
            const used      = item.quantityUsed ?? 0;
            const pending   = Math.max(available - used, 0);
            const stockStatus =
              available === 0 ? "outOfStock" :
              available < 10  ? "lowStock"   : "normal";

            // ✅ Photo URL — Airtable attachment array ya direct string
            const photoUrl: string | null =
              Array.isArray(item.photo)
                ? item.photo[0]?.url ?? null
                : typeof item.photo === "string" && item.photo
                ? item.photo
                : null;

            return (
              <div key={item.id} className="inv-card">

                {/* ✅ Photo section */}
                {photoUrl ? (
                  <div className="inv-photo-wrap">
                    <img
                      src={photoUrl}
                      alt={item.partName || item.partNumber || "part"}
                      className="inv-photo"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                ) : (
                  <div className="inv-photo-placeholder">
                    <Package size={32} strokeWidth={1.2} color="#c7c7cc" />
                  </div>
                )}

                <div className="inv-card-body">
                  <div className="inv-card-head">
                    <div className="inv-icon">
                      <Package size={18} strokeWidth={1.8} />
                    </div>
  <div>
  {/* ✅ Always show Part Number FIRST */}
  <h3>{item.partNumber}</h3>

  {/* ✅ Show Part Name if exists */}
  {item.partName && (
    <div style={{
      fontSize: "13px",
      color: "#6e6e73",
      marginTop: "2px"
    }}>
      {item.partName}
    </div>
  )}

  {stockStatus !== "normal" && (
    <div className="inv-alert">
      <AlertTriangle size={14} />
      <span>{t(`inventory.${stockStatus}`)}</span>
    </div>
  )}
</div>
                  </div>

                  <div className="inv-stats">
                    <Stat label={t("inventory.available")} value={available} />
                    <Stat label={t("inventory.used")}      value={used}      />
                    <Stat label={t("inventory.pending")}   value={pending}   />
                  </div>

                  {item.description && (
                    <div className="inv-notes">{item.description}</div>
                  )}

                  {item.lastModified && (
                    <div className="inv-date">
                      {t("inventory.updated")}: {new Date(item.lastModified).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="inv-stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function InventoryStyle() {
  return (
    <style>{`
      .inv-root {
        max-width: 1200px;
        margin: 0 auto;
        padding: 24px 16px 60px;
        font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;
      }
      .inv-title {
        font-size: 28px;
        font-weight: 700;
        margin-bottom: 24px;
        letter-spacing: -0.4px;
        color: var(--foreground, #1d1d1f);
      }
      .inv-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 20px;
      }
      .inv-card {
        background: var(--card, #fff);
        border-radius: 18px;
        border: 1px solid var(--border, rgba(0,0,0,0.06));
        overflow: hidden;
        transition: 0.25s ease;
        box-shadow: 0 2px 16px rgba(0,0,0,0.04);
      }
      .inv-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 28px rgba(0,0,0,0.08);
      }

      /* ✅ Photo */
      .inv-photo-wrap {
        width: 100%;
        height: 180px;
        overflow: hidden;
        background: #f5f5f7;
      }
      .inv-photo {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
        transition: transform 0.3s ease;
      }
      .inv-card:hover .inv-photo {
        transform: scale(1.04);
      }
      .inv-photo-placeholder {
        width: 100%;
        height: 120px;
        background: #f5f5f7;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .inv-card-body {
        padding: 16px 20px 20px;
      }
      .inv-card-head {
        display: flex;
        gap: 14px;
        margin-bottom: 16px;
      }
      .inv-icon {
        background: #f5f5f7;
        padding: 10px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .inv-card h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--foreground, #1d1d1f);
      }
      .inv-alert {
        margin-top: 4px;
        display: flex;
        gap: 4px;
        font-size: 12px;
        color: #ff9500;
        align-items: center;
      }
      .inv-stats {
        display: flex;
        flex-direction: column;
        gap: 8px;
        margin-bottom: 14px;
      }
      .inv-stat-row {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #6e6e73;
      }
      .inv-stat-row strong {
        color: var(--foreground, #1d1d1f);
        font-weight: 600;
      }
      .inv-notes {
        background: #f5f5f7;
        padding: 10px;
        border-radius: 10px;
        font-size: 12px;
        margin-bottom: 10px;
        color: #6e6e73;
      }
      .inv-date {
        font-size: 11px;
        color: #86868b;
        border-top: 1px solid rgba(0,0,0,0.05);
        padding-top: 8px;
      }
      .inv-empty {
        background: var(--card, #fff);
        border-radius: 18px;
        padding: 60px 20px;
        text-align: center;
        border: 1px solid rgba(0,0,0,0.06);
        color: #86868b;
      }
      .inv-skeleton {
        height: 300px;
        background: #e5e5ea;
        border-radius: 18px;
        animation: pulse 1.2s infinite ease-in-out;
      }
      @keyframes pulse {
        0%,100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }
    `}</style>
  );
}