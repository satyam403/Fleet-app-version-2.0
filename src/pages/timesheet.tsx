// src/pages/MechanicTimesheet.tsx
import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Loader2, Clock, Users, Calendar, TrendingUp,
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  BarChart2, Download, Filter, AlertCircle, User,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";

const API_BASE = apiUrl("/users");

/* ─────────────────────────────────────────────────────
   COLOURS
───────────────────────────────────────────────────── */
const C = {
  accent:       "#2563eb",
  accentBg:     "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.28)",
  green:        "#16a34a", greenBg:  "#dcfce7", greenBorder:  "#86efac",
  red:          "#dc2626", redBg:    "#fee2e2", redBorder:    "#fca5a5",
  orange:       "#ea580c", orangeBg: "#fff7ed", orangeBorder: "#fdba74",
  grey:         "#64748b",
  purple:       "#7c3aed", purpleBg: "#f5f3ff", purpleBorder: "#c4b5fd",
};

/* ─────────────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  .ts-root {
    display: flex;
    flex-direction: column;
    min-height: 100%;
    background: var(--background);
    font-family: inherit;
  }
  .ts-header {
    background: var(--card);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    padding: 16px 20px;
  }
  .ts-body {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .ts-body-inner {
    max-width: 900px;
    margin: 0 auto;
    padding: 20px 16px 80px;
    width: 100%;
    box-sizing: border-box;
  }
  .ts-card {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: 14px;
    overflow: hidden;
    margin-bottom: 16px;
  }
  .ts-card-header {
    padding: 14px 18px;
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .ts-tab-bar {
    display: flex;
    gap: 4px;
    background: var(--muted);
    border-radius: 10px;
    padding: 4px;
  }
  .ts-tab {
    flex: 1;
    padding: 8px 14px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--muted-foreground);
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
    transition: all .15s;
    text-align: center;
  }
  .ts-tab.active {
    background: var(--card);
    color: var(--foreground);
    box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  }
  .ts-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .ts-stat {
    background: var(--card);
    border: 1.5px solid var(--border);
    border-radius: 12px;
    padding: 14px 16px;
  }
  .ts-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--border);
    transition: background .12s;
  }
  .ts-row:last-child { border-bottom: none; }
  .ts-row:hover { background: var(--muted); }
  .ts-bar-bg {
    height: 6px;
    background: var(--muted);
    border-radius: 99px;
    overflow: hidden;
    margin-top: 4px;
  }
  .ts-bar-fill {
    height: 100%;
    border-radius: 99px;
    transition: width 0.5s ease;
  }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  @keyframes ts-fadein {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: none; }
  }
  .ts-fadein { animation: ts-fadein 0.22s ease both; }
  @keyframes ts-spin { to { transform: rotate(360deg); } }
  .ts-spin { animation: ts-spin 1s linear infinite; }
  .ts-inp {
    width: 100%;
    padding: 9px 12px;
    background: var(--input-background, var(--muted));
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--foreground);
    font-size: 14px;
    outline: none;
    font-family: inherit;
    transition: border-color .15s;
  }
  .ts-inp:focus { border-color: #2563eb; }
  @media (max-width: 600px) {
    .ts-stat-grid { grid-template-columns: 1fr 1fr; }
  }
`;

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type Mechanic = {
  _id: string;
  name: string;
  email?: string;
  role?: string;
};

type AttendanceRecord = {
  _id: string;
  user: string | { _id: string; name: string };
  type: "clock-in" | "clock-out";
  latitude: number;
  longitude: number;
  address: string;
  timestamp: string;
};

type SessionPair = {
  mechanic_id: string;
  mechanic_name: string;
  date: string;
  clockIn: AttendanceRecord;
  clockOut?: AttendanceRecord;
  hours?: number;
};

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

/* ─────────────────────────────────────────────────────
   FETCH HELPERS — sab authFetch parameter se lenge
   ✅ Hooks yahan nahi — sirf component ke andar
───────────────────────────────────────────────────── */
async function fetchMechanics(authFetch: AuthFetch): Promise<Mechanic[]> {
  const res = await authFetch(`${API_BASE}/getMechanics`);
  const d = await res.json();
  return (d.data || []).map((n: string, i: number) => ({ _id: String(i), name: n }));
}

async function fetchAllAttendance(authFetch: AuthFetch): Promise<AttendanceRecord[]> {
  const res = await authFetch(`${API_BASE}/getAllAttendance`);
  const d = await res.json();
  return d.data || [];
}

async function fetchAttendanceSummary(authFetch: AuthFetch, period: string): Promise<any> {
  const res = await authFetch(`${API_BASE}/getAttendanceSummary?period=${period}`);
  const d = await res.json();
  return d.data || null;
}

async function markAttendance(authFetch: AuthFetch, payload: object): Promise<void> {
  await authFetch(`${API_BASE}/markAttendance`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/* ─────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────── */
function fmt12(timeStr: string): string {
  if (!timeStr) return "—";
  const d = new Date(timeStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}
function fmtDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function hoursColor(h: number) {
  if (h >= 8) return C.green;
  if (h >= 6) return C.accent;
  if (h >= 4) return C.orange;
  return C.red;
}
function getWeekRange(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { start: monday, end: sunday };
}
function getMonthRange(offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

const lbl: React.CSSProperties = {
  display: "block", fontSize: 10, fontWeight: 700,
  color: "var(--muted-foreground)", textTransform: "uppercase",
  letterSpacing: "0.08em", marginBottom: 6,
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function MechanicTimesheetPage() {
  const { t } = useTranslation();
  const { user, authFetch } = useAuth(); // ✅ hook sirf yahan — authFetch + user dono lo
  const isAdmin = (user?.role || "").toLowerCase().includes("admin");

  const [tab,         setTab]         = useState<"overview" | "detail" | "add">("overview");
  const [mechanics,   setMechanics]   = useState<Mechanic[]>([]);
  const [attendance,  setAttendance]  = useState<AttendanceRecord[]>([]);
  const [summary,     setSummary]     = useState<any>(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  const [period,      setPeriod]      = useState<"weekly" | "monthly">("weekly");
  const [weekOffset,  setWeekOffset]  = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);

  const [filterMech,  setFilterMech]  = useState("all");

  const [addMech,     setAddMech]     = useState("");
  const [addDate,     setAddDate]     = useState(new Date().toISOString().slice(0, 10));
  const [addIn,       setAddIn]       = useState("");
  const [addOut,      setAddOut]      = useState("");
  const [addTask,     setAddTask]     = useState("");
  const [addMsg,      setAddMsg]      = useState<{ type: "ok" | "err"; text: string } | null>(null);

  /* ── ✅ Fetch mechanics — gated on admin to avoid useless API calls ── */
  useEffect(() => {
    if (!isAdmin) return;
    fetchMechanics(authFetch)
      .then(setMechanics)
      .catch(() => {});
  }, [authFetch, isAdmin]);

  /* ── ✅ Fetch all attendance — admin only ── */
  useEffect(() => {
    if (!isAdmin) return;
    setLoading(true);
    fetchAllAttendance(authFetch)
      .then(setAttendance)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authFetch, isAdmin]);

  /* ── ✅ Fetch summary — admin only ── */
  useEffect(() => {
    if (!isAdmin) return;
    const p = period === "weekly" ? "weekly" : "monthly";
    fetchAttendanceSummary(authFetch, p)
      .then(setSummary)
      .catch(() => {});
  }, [authFetch, period, weekOffset, monthOffset, isAdmin]);

  /* ── Period range ── */
  const range = useMemo(() => {
    return period === "weekly" ? getWeekRange(weekOffset) : getMonthRange(monthOffset);
  }, [period, weekOffset, monthOffset]);

  /* ── Pair clock-in / clock-out into sessions ── */
  const sessions: SessionPair[] = useMemo(() => {
  const byUser: Record<string, AttendanceRecord[]> = {};

  attendance.forEach(a => {
    if (!a || !a.user) return; // 🛑 null guard

    let uid: string | undefined;

    if (typeof a.user === "object") {
      uid = a.user?._id; // safe access
    } else {
      uid = a.user;
    }

    if (!uid) return; // 🛑 skip broken records

    if (!byUser[uid]) byUser[uid] = [];
    byUser[uid].push(a);
  });

  const pairs: SessionPair[] = [];

  Object.entries(byUser).forEach(([uid, recs]) => {
    if (!recs.length) return;

    const sorted = [...recs].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() -
        new Date(b.timestamp).getTime()
    );

    const mechName =
      typeof sorted[0]?.user === "object"
        ? sorted[0]?.user?.name || "Unknown"
        : mechanics.find(m => m._id === uid)?.name || uid;

    let i = 0;

    while (i < sorted.length) {
      const rec = sorted[i];

      if (rec?.type === "clock-in") {
        const next = sorted[i + 1];
        const clockOut =
          next?.type === "clock-out" ? next : undefined;

        const date = new Date(rec.timestamp)
          .toISOString()
          .slice(0, 10);

        let hours: number | undefined;

        if (clockOut) {
          hours =
            (new Date(clockOut.timestamp).getTime() -
              new Date(rec.timestamp).getTime()) /
            3600000;
        }

        pairs.push({
          mechanic_id: uid,
          mechanic_name: mechName,
          date,
          clockIn: rec,
          clockOut,
          hours,
        });

        i += clockOut ? 2 : 1;
      } else {
        i++;
      }
    }
  });

  return pairs;
}, [attendance, mechanics]);
  /* ── Filter sessions to current period ── */
  const periodSessions = useMemo(() =>
    sessions.filter(s => {
      const d = new Date(s.date);
      return d >= range.start && d <= range.end;
    }),
    [sessions, range]
  );

  /* ── Per-mechanic stats in period ── */
  const mechStats = useMemo(() => {
    const map: Record<string, { name: string; totalHours: number; days: Set<string>; sessions: number; incomplete: number }> = {};
    periodSessions.forEach(s => {
      if (!map[s.mechanic_id]) map[s.mechanic_id] = { name: s.mechanic_name, totalHours: 0, days: new Set(), sessions: 0, incomplete: 0 };
      const m = map[s.mechanic_id];
      m.sessions++;
      m.days.add(s.date);
      if (s.hours != null) m.totalHours += s.hours;
      else m.incomplete++;
    });
    return Object.entries(map).map(([id, v]) => ({ id, ...v, daysCount: v.days.size }));
  }, [periodSessions]);

  const totalHours = mechStats.reduce((a, m) => a + m.totalHours, 0);
  const maxHours   = Math.max(...mechStats.map(m => m.totalHours), 1);

  /* ── Detail filtered sessions ── */
  const detailSessions = useMemo(() =>
    periodSessions.filter(s => filterMech === "all" || s.mechanic_id === filterMech),
    [periodSessions, filterMech]
  );

  /* ── Period label ── */
  const periodLabel = useMemo(() => {
    const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    if (period === "weekly") return `${fmt(range.start)} – ${fmt(range.end)}`;
    return range.start.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }, [period, range]);

  /* ── ✅ Handle manual save — authFetch se ── */
  async function handleSave() {
    if (!addMech || !addIn || !addOut || !addDate) {
      setAddMsg({ type: "err", text: "Please fill all required fields." });
      return;
    }
    setSaving(true);
    setAddMsg(null);
    try {
      const mechObj = mechanics.find(m => m.name === addMech);
      const inISO  = new Date(`${addDate}T${addIn}:00`).toISOString();
      const outISO = new Date(`${addDate}T${addOut}:00`).toISOString();

      // ✅ clock-in — authFetch se, Content-Type automatic JSON
      await markAttendance(authFetch, {
        mechanic_id:   mechObj?._id,
        mechanic_name: addMech,
        type:          "clock-in",
        timestamp:     inISO,
        latitude:      0,
        longitude:     0,
        task:          addTask,
      });

      // ✅ clock-out — authFetch se
      await markAttendance(authFetch, {
        mechanic_id:   mechObj?._id,
        mechanic_name: addMech,
        type:          "clock-out",
        timestamp:     outISO,
        latitude:      0,
        longitude:     0,
        task:          addTask,
      });

      setAddMsg({ type: "ok", text: `✅ Attendance saved for ${addMech}` });
      setAddIn(""); setAddOut(""); setAddTask(""); setAddMech("");

      // ✅ Refresh attendance — authFetch se
      const fresh = await fetchAllAttendance(authFetch);
      setAttendance(fresh);
    } catch (e: any) {
      setAddMsg({ type: "err", text: e.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */

  /* ── Access guard — placed AFTER all hooks so the hook order
     is identical on every render (Rules of Hooks). ── */
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "var(--muted-foreground)" }}>
        <AlertCircle size={40} color={C.red} style={{ margin: "0 auto 12px" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: C.red, marginBottom: 6 }}>{t("auth.accessDenied")}</div>
        <div style={{ fontSize: 13 }}>{t("auth.adminOnly")}</div>
      </div>
    );
  }

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="ts-root">

        {/* ── HEADER ── */}
        <div className="ts-header">
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Clock size={20} color="var(--primary-foreground)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>{t("nav.timesheet")}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{t("auth.admin")} · {t("dashboard.recentActivity")}</div>
              </div>
              <div className="ts-tab-bar" style={{ width: "auto" }}>
                {(["weekly", "monthly"] as const).map(p => (
                  <button key={p} className={`ts-tab ${period === p ? "active" : ""}`}
                    onClick={() => { setPeriod(p); setWeekOffset(0); setMonthOffset(0); }}
                    style={{ padding: "6px 14px", fontSize: 12 }}>
                    {t(`timesheet.${p}`)}
                  </button>
                ))}
              </div>
            </div>

            {/* Period nav */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => period === "weekly" ? setWeekOffset(w => w - 1) : setMonthOffset(m => m - 1)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <ChevronLeft size={14} />
              </button>
              <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 13, color: "var(--foreground)" }}>{periodLabel}</div>
              <button
                onClick={() => period === "weekly" ? setWeekOffset(w => w + 1) : setMonthOffset(m => m + 1)}
                disabled={(period === "weekly" && weekOffset >= 0) || (period === "monthly" && monthOffset >= 0)}
                style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)", background: "var(--muted)", color: "var(--foreground)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", opacity: ((period === "weekly" && weekOffset >= 0) || (period === "monthly" && monthOffset >= 0)) ? 0.4 : 1 }}>
                <ChevronRight size={14} />
              </button>
            </div>

            {/* Tab bar */}
            <div className="ts-tab-bar" style={{ marginTop: 14 }}>
              {([
                { val: "overview", label: t("timesheet.overview")   },
                { val: "detail",   label: t("timesheet.detail")     },
                { val: "add",      label: t("timesheet.addManual")  },
              ] as const).map(item => (
                <button key={item.val} className={`ts-tab ${tab === item.val ? "active" : ""}`} onClick={() => setTab(item.val)}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="ts-body">
          <div className="ts-body-inner">

            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60, gap: 10, color: "var(--muted-foreground)", fontSize: 14 }}>
                <Loader2 size={20} className="ts-spin" /> Loading attendance data…
              </div>
            ) : (
              <>
                {/* ═══ TAB: OVERVIEW ═══ */}
                {tab === "overview" && (
                  <div className="ts-fadein">
                    <div className="ts-stat-grid">
                      {[
                        { label: "Total Hours",    value: `${totalHours.toFixed(1)}h`,  icon: <Clock size={16} />,     color: C.accent,  bg: C.accentBg,  border: C.accentBorder },
                        { label: "Active User",value: String(mechStats.length),     icon: <Users size={16} />,     color: C.green,   bg: C.greenBg,   border: C.greenBorder },
                        { label: "Sessions",        value: String(periodSessions.length),icon: <BarChart2 size={16} />, color: C.purple,  bg: C.purpleBg,  border: C.purpleBorder },
                        { label: "Avg Hours/Day",
                          value: mechStats.length && period === "weekly"
                            ? `${(totalHours / Math.max(1, periodSessions.map(s => s.date).filter((v, i, a) => a.indexOf(v) === i).length)).toFixed(1)}h`
                            : `${(totalHours / Math.max(1, mechStats.length)).toFixed(1)}h`,
                          icon: <TrendingUp size={16} />, color: C.orange, bg: C.orangeBg, border: C.orangeBorder,
                        },
                      ].map(({ label, value, icon, color, bg, border }) => (
                        <div key={label} className="ts-stat" style={{ borderColor: border, background: bg }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, color }}>
                            {icon}
                            <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
                          </div>
                          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                        </div>
                      ))}
                    </div>

                    {mechStats.length === 0 ? (
                      <EmptyState text="No attendance data for this period." />
                    ) : (
                      <div className="ts-card">
                        <div className="ts-card-header">
                          <Users size={16} color={C.accent} />
                          <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>Hours</span>
                          <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted-foreground)" }}>{periodLabel}</span>
                        </div>
                        {[...mechStats].sort((a, b) => b.totalHours - a.totalHours).map((m) => {
                          const pct = (m.totalHours / maxHours) * 100;
                          const col = hoursColor(m.totalHours / Math.max(1, m.daysCount));
                          return (
                            <div key={m.id} className="ts-row">
                              <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.accentBg, border: `1.5px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 14, color: C.accent }}>
                                {m.name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                                  <span style={{ fontWeight: 800, fontSize: 15, color: col, flexShrink: 0, marginLeft: 8 }}>{m.totalHours.toFixed(1)}h</span>
                                </div>
                                <div className="ts-bar-bg">
                                  <div className="ts-bar-fill" style={{ width: `${pct}%`, background: col }} />
                                </div>
                                <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{m.daysCount} day{m.daysCount !== 1 ? "s" : ""}</span>
                                  <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{m.sessions} session{m.sessions !== 1 ? "s" : ""}</span>
                                  {m.incomplete > 0 && (
                                    <span style={{ fontSize: 11, color: C.orange }}>⚠ {m.incomplete} missing clock-out</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB: DETAIL LOG ═══ */}
                {tab === "detail" && (
                  <div className="ts-fadein">
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      <Filter size={14} color="var(--muted-foreground)" />
                      <select className="ts-inp" value={filterMech} onChange={e => setFilterMech(e.target.value)} style={{ maxWidth: 220 }}>
                        <option value="all">All Mechanics</option>
                        {[...new Map(periodSessions.map(s => [s.mechanic_id, s])).values()].map(s => (
                          <option key={s.mechanic_id} value={s.mechanic_id}>{s.mechanic_name}</option>
                        ))}
                      </select>
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)", marginLeft: "auto" }}>
                        {detailSessions.length} session{detailSessions.length !== 1 ? "s" : ""}
                      </span>
                    </div>

                    {detailSessions.length === 0 ? (
                      <EmptyState text="No sessions match this filter." />
                    ) : (
                      <div className="ts-card">
                        {[...detailSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((s, i) => {
                          const col = s.hours != null ? hoursColor(s.hours) : C.orange;
                          return (
                            <div key={i} className="ts-row" style={{ gap: 14 }}>
                              <div style={{ width: 34, height: 34, borderRadius: "50%", background: C.accentBg, border: `1.5px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontWeight: 800, fontSize: 13, color: C.accent }}>
                                {s.mechanic_name.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                                  <div>
                                    <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>{s.mechanic_name}</div>
                                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{fmtDate(s.date)}</div>
                                  </div>
                                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                                    {s.hours != null ? (
                                      <span style={{ fontWeight: 800, fontSize: 15, color: col }}>{s.hours.toFixed(1)}h</span>
                                    ) : (
                                      <span style={{ fontSize: 11, fontWeight: 700, color: C.orange, background: C.orangeBg, border: `1px solid ${C.orangeBorder}`, padding: "2px 7px", borderRadius: 99 }}>No Clock-Out</span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.green }} />
                                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>In: <b style={{ color: "var(--foreground)" }}>{fmt12(s.clockIn.timestamp)}</b></span>
                                  </div>
                                  {s.clockOut && (
                                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: C.red }} />
                                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Out: <b style={{ color: "var(--foreground)" }}>{fmt12(s.clockOut.timestamp)}</b></span>
                                    </div>
                                  )}
                                </div>
                                {s.clockIn.address && (
                                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    📍 {s.clockIn.address}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* ═══ TAB: ADD ENTRY ═══ */}
                {tab === "add" && (
                  <div className="ts-fadein">
                    <div className="ts-card">
                      <div className="ts-card-header">
                        <Clock size={16} color={C.accent} />
                        <span style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)" }}>Manual Attendance Entry</span>
                      </div>
                      <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={lbl}>Mechanic <span style={{ color: C.accent }}>*</span></label>
                          <select className="ts-inp" value={addMech} onChange={e => setAddMech(e.target.value)}>
                            <option value="">Select mechanic…</option>
                            {mechanics.map(m => <option key={m._id} value={m.name}>{m.name}</option>)}
                          </select>
                        </div>

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={lbl}>Date <span style={{ color: C.accent }}>*</span></label>
                          <input type="date" className="ts-inp" value={addDate} onChange={e => setAddDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
                        </div>

                        <div>
                          <label style={lbl}>Clock In <span style={{ color: C.accent }}>*</span></label>
                          <input type="time" className="ts-inp" value={addIn} onChange={e => setAddIn(e.target.value)} />
                        </div>

                        <div>
                          <label style={lbl}>Clock Out <span style={{ color: C.accent }}>*</span></label>
                          <input type="time" className="ts-inp" value={addOut} onChange={e => setAddOut(e.target.value)} />
                        </div>

                        {addIn && addOut && (
                          <div style={{ gridColumn: "1 / -1" }}>
                            {(() => {
                              const h = (new Date(`2000-01-01T${addOut}`).getTime() - new Date(`2000-01-01T${addIn}`).getTime()) / 3600000;
                              if (h <= 0) return (
                                <div style={{ padding: "8px 12px", borderRadius: 8, background: C.redBg, border: `1px solid ${C.redBorder}`, fontSize: 12, color: C.red, fontWeight: 600 }}>
                                  ⚠ Clock-out must be after clock-in
                                </div>
                              );
                              const col = hoursColor(h);
                              return (
                                <div style={{ padding: "8px 12px", borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBorder}`, fontSize: 12, color: C.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                                  <Clock size={14} />
                                  Total: <span style={{ color: col, fontSize: 15 }}>{h.toFixed(1)} hours</span>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        <div style={{ gridColumn: "1 / -1" }}>
                          <label style={lbl}>Task / Work Done <span style={{ fontSize: 9, fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
                          <textarea className="ts-inp" rows={3} placeholder="Engine repair, brake service, oil change…" value={addTask} onChange={e => setAddTask(e.target.value)} style={{ resize: "none", lineHeight: 1.6 }} />
                        </div>

                        {addMsg && (
                          <div style={{ gridColumn: "1 / -1", padding: "9px 12px", borderRadius: 8, background: addMsg.type === "ok" ? C.greenBg : C.redBg, border: `1px solid ${addMsg.type === "ok" ? C.greenBorder : C.redBorder}`, fontSize: 13, color: addMsg.type === "ok" ? C.green : C.red, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                            {addMsg.type === "ok" ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                            {addMsg.text}
                          </div>
                        )}

                        <div style={{ gridColumn: "1 / -1" }}>
                          <button onClick={handleSave} disabled={saving}
                            style={{ width: "100%", padding: "13px", borderRadius: 10, border: "none", background: saving ? "var(--muted)" : C.accent, color: saving ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 14, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saving ? "none" : `0 4px 14px ${C.accentBorder}`, transition: "all .15s" }}>
                            {saving
                              ? <><Loader2 size={16} className="ts-spin" /> Saving…</>
                              : <><CheckCircle2 size={16} /> Save Attendance Entry</>
                            }
                          </button>
                        </div>

                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ── Empty state ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted-foreground)", background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 14 }}>
      <Calendar size={36} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
      <div style={{ fontWeight: 600, fontSize: 14 }}>{text}</div>
    </div>
  );
}