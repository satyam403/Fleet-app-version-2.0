import { useState, useEffect, useRef } from "react";
import { MapPin, X, CheckCircle, LogIn, LogOut, AlertTriangle } from "lucide-react";
import type { JSX } from "react/jsx-runtime";
import { useTranslation } from "react-i18next";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl, GEO_TIMEOUT_MS, GEO_MAX_AGE_MS } from "../config";

interface LocationData {
  lat: string;
  lng: string;
}

const CLOCK_IN_KEY = "fleetops-clockin-session";

interface ClockInSession {
  clockedInAt: string;
  location: LocationData | null;
}

// ─── LiveClock ────────────────────────────────────────────────
function LiveClock(): JSX.Element {
  const [time, setTime] = useState<Date>(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: "2.8rem", fontWeight: 200, letterSpacing: "-0.04em", color: "#000", fontFamily: "-apple-system, 'SF Pro Display', sans-serif", lineHeight: 1 }}>
        {time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
      </div>
      <div style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.3rem", fontWeight: 400, letterSpacing: "0.05em", textTransform: "uppercase", fontFamily: "-apple-system, 'SF Pro Text', sans-serif" }}>
        {time.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </div>
    </div>
  );
}

// ─── StepRow ───────────────────────────────────────────────────
interface StepRowProps {
  number: string;
  title: string;
  done: boolean;
  dimmed?: boolean;
  children: React.ReactNode;
}

function StepRow({ number, title, done, dimmed = false, children }: StepRowProps): JSX.Element {
  return (
    <div style={{ opacity: dimmed ? 0.35 : 1, transition: "opacity 0.3s ease", paddingBottom: "1.25rem", borderBottom: "1px solid #f0f0f0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.75rem" }}>
        <div style={{ width: 22, height: 22, borderRadius: "50%", background: done ? "#000" : "transparent", border: `1.5px solid ${done ? "#000" : "#ccc"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.3s" }}>
          {done ? (
            <CheckCircle style={{ width: 13, height: 13, color: "#fff" }} />
          ) : (
            <span style={{ fontSize: "0.65rem", fontWeight: 600, color: "#888" }}>{number}</span>
          )}
        </div>
        <span style={{ fontSize: "0.82rem", fontWeight: 500, color: done ? "#aaa" : "#000", letterSpacing: "-0.01em", fontFamily: "-apple-system, 'SF Pro Text', sans-serif", textDecoration: done ? "line-through" : "none" }}>
          {title}
        </span>
      </div>
      {!done && <div style={{ paddingLeft: "1.9rem" }}>{children}</div>}
    </div>
  );
}

// ─── AppleBtn ─────────────────────────────────────────────────
interface AppleBtnProps {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}

function AppleBtn({ onClick, disabled, variant = "primary", children }: AppleBtnProps): JSX.Element {
  const styles: Record<string, React.CSSProperties> = {
    primary:   { background: "#000", color: "#fff", border: "none" },
    secondary: { background: "#fff", color: "#000", border: "1.5px solid #000" },
    danger:    { background: "#cc0000", color: "#fff", border: "none" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ width: "100%", padding: "0.65rem 1rem", borderRadius: "0.6rem", fontSize: "0.82rem", fontWeight: 500, letterSpacing: "-0.01em", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.3 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", transition: "all 0.2s ease", fontFamily: "-apple-system, 'SF Pro Text', sans-serif", ...styles[variant] }}
    >
      {children}
    </button>
  );
}

// ─── API Helper ───────────────────────────────────────────────
async function markAttendance(
  authFetch: (url: string, options?: RequestInit) => Promise<Response>,
  type: "clock-in" | "clock-out",
  locationData: LocationData | null,
  timestamp?: string
): Promise<void> {
  await authFetch(apiUrl("/users/mark-attendance"), {
    method: "POST",
    body: JSON.stringify({
      type,
      latitude:  locationData ? Number(locationData.lat) : null,
      longitude: locationData ? Number(locationData.lng) : null,
      timestamp: timestamp ?? new Date().toISOString(),
    }),
  });
}

// ─── ClockInOut ───────────────────────────────────────────────
export function ClockInOut(): JSX.Element {
  const { t } = useTranslation();
  const { authFetch } = useAuth();

  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [isClockedIn,    setIsClockedIn]    = useState(false);
  const [elapsed,        setElapsed]        = useState(0);

  const [locationFetched, setLocationFetched] = useState(false);
  const [locationData,    setLocationData]    = useState<LocationData | null>(null);
  const [locationError,   setLocationError]   = useState<string | null>(null);
  const [locLoading,      setLocLoading]      = useState(false);

  // ─── Missed clock-out state ───────────────────────────────
  const [missedSession,    setMissedSession]    = useState<ClockInSession | null>(null);
  const [showMissedBanner, setShowMissedBanner] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── On mount: check for pending session ─────────────────
  useEffect(() => {
    const saved = localStorage.getItem(CLOCK_IN_KEY);
    if (saved) {
      try {
        const session: ClockInSession = JSON.parse(saved);
        const clockedInAt = new Date(session.clockedInAt);
        const elapsedSecs = Math.floor((Date.now() - clockedInAt.getTime()) / 1000);
        const isToday = new Date().toDateString() === clockedInAt.toDateString();

        if (isToday) {
          setIsClockedIn(true);
          setElapsed(elapsedSecs);
          setLocationData(session.location);
          setLocationFetched(!!session.location);
        } else {
          setMissedSession(session);
          setShowMissedBanner(true);
          localStorage.removeItem(CLOCK_IN_KEY);
        }
      } catch {
        localStorage.removeItem(CLOCK_IN_KEY);
      }
    }
  }, []);

  // ─── Timer ────────────────────────────────────────────────
  useEffect(() => {
    if (isClockedIn) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isClockedIn]);

  const formatTime = (secs: number): string => {
    const h = String(Math.floor(secs / 3600)).padStart(2, "0");
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
    const s = String(secs % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  };

  const formatDateTime = (iso: string): string => {
    return new Date(iso).toLocaleString("en-US", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

  const fetchLocation = (): void => {
    setLocationError(null);
    if (!("geolocation" in navigator)) {
      setLocationError(t("clockInOut.locationUnsupported"));
      return;
    }
    setLocLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationData({ lat: pos.coords.latitude.toFixed(5), lng: pos.coords.longitude.toFixed(5) });
        setLocationFetched(true);
        setLocLoading(false);
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED   ? t("clockInOut.locationDenied") :
          err.code === err.POSITION_UNAVAILABLE ? t("clockInOut.locationUnavailable") :
          err.code === err.TIMEOUT             ? t("clockInOut.locationTimeout") :
          t("clockInOut.locationFailed");
        setLocationError(msg);
        setLocLoading(false);
      },
      // enableHighAccuracy=true so the device tries GPS, not just IP/WiFi.
      // Cold-start fixes in a yard or garage can take 15–20s easily.
      { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS }
    );
  };

  // Clock In — location optional hai
  const handleClockIn = async (): Promise<void> => {
    const now = new Date().toISOString();
    await markAttendance(authFetch, "clock-in", locationData, now);

    const session: ClockInSession = { clockedInAt: now, location: locationData };
    localStorage.setItem(CLOCK_IN_KEY, JSON.stringify(session));

    setIsClockedIn(true);
    setElapsed(0);
    setIsModalOpen(false);
  };

  const handleClockOut = async (): Promise<void> => {
    await markAttendance(authFetch, "clock-out", locationData);
    localStorage.removeItem(CLOCK_IN_KEY);
    setIsClockedIn(false);
    setElapsed(0);
  };

  const handleMissedClockOut = async (): Promise<void> => {
    if (!missedSession) return;
    const endOfDay = new Date(missedSession.clockedInAt);
    endOfDay.setHours(23, 59, 59, 0);
    await markAttendance(authFetch, "clock-out", missedSession.location, endOfDay.toISOString());
    setMissedSession(null);
    setShowMissedBanner(false);
  };

  const dismissMissed = (): void => {
    setMissedSession(null);
    setShowMissedBanner(false);
  };

  return (
    <>
      <style>{`
        @keyframes pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
        @keyframes slide-down { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ─── Missed Clock-Out Banner ─── */}
      {showMissedBanner && missedSession && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 9999, background: "#fff", border: "1.5px solid #f0a500", borderRadius: "1rem", padding: "0.9rem 1.2rem", boxShadow: "0 8px 32px rgba(0,0,0,0.15)", maxWidth: 380, width: "calc(100vw - 2rem)", animation: "slide-down 0.3s ease" }}>
          <div style={{ display: "flex", gap: "0.7rem", alignItems: "flex-start" }}>
            <AlertTriangle style={{ width: 18, height: 18, color: "#f0a500", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: "0 0 0.3rem", fontSize: "0.82rem", fontWeight: 600, color: "#000" }}>
                {t("clockInOut.missedClockOut")}
              </p>
              <p style={{ margin: "0 0 0.8rem", fontSize: "0.75rem", color: "#666" }}>
                {t("clockInOut.missedDescription", { when: formatDateTime(missedSession.clockedInAt) })}
              </p>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleMissedClockOut}
                  style={{ flex: 1, padding: "0.45rem 0.8rem", background: "#000", color: "#fff", border: "none", borderRadius: "0.5rem", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", minHeight: 36 }}
                >
                  {t("clockInOut.markClockOut")}
                </button>
                <button
                  onClick={dismissMissed}
                  style={{ padding: "0.45rem 0.8rem", background: "transparent", color: "#888", border: "1px solid #ddd", borderRadius: "0.5rem", fontSize: "0.75rem", cursor: "pointer", minHeight: 36 }}
                >
                  {t("clockInOut.dismiss")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Main Button ─── */}
      {isClockedIn ? (
        <button
          onClick={handleClockOut}
          aria-label={t("clockInOut.clockOut")}
          style={{ background: "#000", color: "#fff", border: "none", borderRadius: "2rem", padding: "0.55rem 1.1rem", minHeight: 40, fontWeight: 500, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", touchAction: "manipulation" }}
        >
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80", animation: "pulse-dot 1.5s ease-in-out infinite" }} />
          <span style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace" }}>{formatTime(elapsed)}</span>
          <LogOut style={{ width: 14, height: 14, opacity: 0.7 }} />
        </button>
      ) : (
        <button
          onClick={() => setIsModalOpen(true)}
          aria-label={t("clockInOut.clockIn")}
          style={{ background: "#000", color: "#fff", border: "none", borderRadius: "2rem", padding: "0.55rem 1.2rem", minHeight: 40, fontWeight: 500, fontSize: "0.8rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.4rem", touchAction: "manipulation" }}
        >
          <LogIn style={{ width: 14, height: 14 }} />
          {t("clockInOut.clockIn")}
        </button>
      )}

      {/* ─── Modal ─── */}
      {isModalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setIsModalOpen(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", zIndex: 1000 }}
        >
          <div style={{ background: "#fff", borderRadius: "1.5rem", width: "100%", maxWidth: "min(390px, calc(100vw - 32px))", maxHeight: "90dvh", overflow: "auto" }}>
            <div style={{ padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f0f0f0" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 600 }}>{t("clockInOut.clockIn")}</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                aria-label={t("common.close")}
                style={{ background: "#f5f5f7", border: "none", cursor: "pointer", width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "manipulation" }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ padding: "1.5rem" }}>
              <LiveClock />

              <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                {/* ─── Optional Location Section ─── */}
                <div style={{ padding: "0.85rem 1rem", borderRadius: "0.75rem", background: "#f9f9f9", border: "1px solid #eee" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: locationFetched || locLoading || locationError ? "0.65rem" : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      <MapPin style={{ width: 13, height: 13, color: locationFetched ? "#000" : "#aaa" }} />
                      <span style={{ fontSize: "0.78rem", fontWeight: 500, color: "#000" }}>
                        {t("clockInOut.shareLocation")}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#aaa", fontStyle: "italic" }}>({t("clockInOut.optional")})</span>
                    </div>
                    {!locationFetched && !locLoading && (
                      <button
                        onClick={fetchLocation}
                        style={{ fontSize: "0.72rem", fontWeight: 600, color: "#000", background: "transparent", border: "1px solid #ddd", borderRadius: "0.4rem", padding: "0.4rem 0.7rem", cursor: "pointer", minHeight: 32 }}
                      >
                        {t("clockInOut.allow")}
                      </button>
                    )}
                    {locationFetched && (
                      <CheckCircle style={{ width: 14, height: 14, color: "#22c55e" }} />
                    )}
                  </div>

                  {locLoading && (
                    <p style={{ fontSize: "0.72rem", color: "#888", margin: 0 }}>{t("clockInOut.fetchingLocation")}</p>
                  )}
                  {locationFetched && locationData && (
                    <p style={{ fontSize: "0.72rem", color: "#555", margin: 0 }}>
                      {locationData.lat}, {locationData.lng}
                    </p>
                  )}
                  {locationError && (
                    <p style={{ fontSize: "0.72rem", color: "#cc0000", margin: 0 }}>{locationError}</p>
                  )}
                </div>

                {/* ─── Clock In Button — always enabled ─── */}
                <AppleBtn onClick={handleClockIn}>
                  <LogIn style={{ width: 14, height: 14 }} />
                  {t("clockInOut.clockInNow")}
                </AppleBtn>

              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}