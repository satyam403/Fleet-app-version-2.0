// src/pages/Inspectionself.tsx
import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Search, Loader2, Zap, Camera, CheckCircle2, XCircle,
  Image as ImageIcon, X, ClipboardList,
  FileText, Lightbulb, Circle, Settings, Wrench,
  Shield, ChevronRight, ChevronLeft, AlertCircle, Calendar,
} from "lucide-react";
import { Truck as TruckIcon } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type TrailerAsset = {
  id: string;
  number: string;
  status: string;
  customerName?: string;
  inspectionDate?: string;
  plate?: string;
  vin?: string;
  year?: string | number;
  make?: string;
};

type TruckAsset = {
  id: string;
  number: string;
  status: string;
  owner: string;
  vin: string;
  make: string;
  year: number | string;
  photo?: string;
  inspectionDate?: string;
  plate?: string;
};

type SelectedAsset =
  | { kind: "trailer"; data: TrailerAsset }
  | { kind: "truck";   data: TruckAsset }
  | null;

type SearchResult =
  | { kind: "trailer"; data: TrailerAsset }
  | { kind: "truck";   data: TruckAsset };

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
}

/* ─────────────────────────────────────────────────────
   SHARED INPUT STYLE
───────────────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "0.65rem 0.8rem",
  background: "var(--input-background)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: "16px", /* 16px prevents iOS Safari zoom-on-focus */
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color .15s",
};

const API_BASE = apiUrl("/users");

/* ─────────────────────────────────────────────────────
   FETCH HELPERS
───────────────────────────────────────────────────── */

async function fetchTrailers(authFetch: AuthFetch): Promise<TrailerAsset[]> {
  const res = await authFetch(`${API_BASE}/getTrailersdashboard`);
  const result: ApiResponse<TrailerAsset[]> = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch trailers");
  return result.data;
}

async function fetchTrucks(authFetch: AuthFetch): Promise<TruckAsset[]> {
  const res = await authFetch(`${API_BASE}/getTrucksdashboard`);
  const result: ApiResponse<TruckAsset[]> = await res.json();
  if (!res.ok) throw new Error(result?.message || "Failed to fetch trucks");
  return result.data;
}

async function fetchMechanicsAndUser(authFetch: AuthFetch): Promise<{
  mechanicNames: string[];
  userName: string;
  userRole: string;
}> {
  const [mechRes, userRes] = await Promise.all([
    authFetch(`${API_BASE}/getMechanics`),
    authFetch(`${API_BASE}/getCurrentUser`),
  ]);

  if (!mechRes.ok) throw new Error("Failed to fetch mechanics");
  if (!userRes.ok) throw new Error("Failed to fetch user");

  const mechData = await mechRes.json();
  const userData = await userRes.json();

  return {
    mechanicNames: mechData.data || [],
    userName:      userData.data?.name  || "",
    userRole:      userData.data?.role  || "",
  };
}

// ✅ FIX: headers bilkul pass nahi kar rahe — authFetch khud handle karega
// ✅ FIX: FormData ke saath Content-Type kabhi set mat karo — browser boundary set karta hai
async function submitInspection(authFetch: AuthFetch, formData: FormData): Promise<any> {
  const res = await authFetch(`${API_BASE}/createQuickInspection`, {
    method: "POST",
    body: formData,
    // ✅ headers property hi nahi daal rahe
    // authFetch mein agar Content-Type: application/json default set ho raha tha
    // toh woh FormData ko corrupt kar deta tha — especially mobile (Safari/iOS) pe
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "Failed");
  }
  return res.json();
}

/* ─────────────────────────────────────────────────────
   CHECKLIST
───────────────────────────────────────────────────── */
interface QItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  field: string;
  status: "pass" | "fail" | "";
  notes: string;
  photo?: string;
}

const makeQItems = (): QItem[] => [
  { id: "brakes",  label: "Brakes",                 icon: <Shield size={15} />,    field: "brakes_status",               status: "pass", notes: "" },
  { id: "lights",  label: "Lights",                 icon: <Lightbulb size={15} />, field: "lights_status",               status: "pass", notes: "" },
  { id: "tires",   label: "Tires",                  icon: <Circle size={15} />,    field: "tires_status",                status: "pass", notes: "" },
  { id: "docs",    label: "DOT Documents",          icon: <FileText size={15} />,  field: "documents_dot_status",        status: "pass", notes: "" },
  { id: "susp",    label: "Suspension & Axles",     icon: <Settings size={15} />,  field: "suspension_axles_status",     status: "pass", notes: "" },
  { id: "frame",   label: "Frame & Body",           icon: <TruckIcon size={15} />, field: "frame_body_status",           status: "pass", notes: "" },
  { id: "tandems", label: "Tandems & Landing Gear", icon: <Wrench size={15} />,    field: "tandems_landing_gear_status", status: "pass", notes: "" },
];

const STEPS = ["Asset", "Inspector", "Checklist", "Photos", "Review"];

const C = {
  accent:       "#2563eb",
  accentBg:     "rgba(37,99,235,0.08)",
  accentBorder: "rgba(37,99,235,0.28)",
  green:        "#16a34a", greenBg:  "#dcfce7", greenBorder:  "#86efac",
  red:          "#dc2626", redBg:    "#fee2e2", redBorder:    "#fca5a5",
  orange:       "#ea580c", orangeBg: "#fff7ed", orangeBorder: "#fdba74",
  grey:         "#64748b",
};

function addDays(ds: string | undefined, days: number): string | null {
  if (!ds) return null;
  const d = new Date(ds);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
function isExpiringSoon(ds: string | undefined): boolean {
  if (!ds) return false;
  const exp = new Date(ds); exp.setDate(exp.getDate() + 90);
  const diff = (exp.getTime() - Date.now()) / 86400000;
  return diff <= 7 && diff >= 0;
}
function isExpired(ds: string | undefined): boolean {
  if (!ds) return false;
  const exp = new Date(ds); exp.setDate(exp.getDate() + 90);
  return exp.getTime() < Date.now();
}

const GLOBAL_CSS = `
  .qs-root { display: flex; flex-direction: column; min-height: 100%; background: var(--background); }
  .qs-header { background: var(--card); border-bottom: 1px solid var(--border); flex-shrink: 0; }
  .qs-header-inner { max-width: 560px; margin: 0 auto; padding: 12px 16px 0; width: 100%; box-sizing: border-box; }
  .qs-body { flex: 1; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; }
  .qs-body-inner { max-width: 560px; margin: 0 auto; padding: 16px 16px 100px; width: 100%; box-sizing: border-box; }
  .qs-footer { background: var(--card); border-top: 1px solid var(--border); flex-shrink: 0; }
  .qs-footer-inner { max-width: 560px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 16px; width: 100%; box-sizing: border-box; }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  @keyframes qs-spin { to { transform: rotate(360deg); } }
  .qs-spin { animation: qs-spin 1s linear infinite; }
  @keyframes qs-fadein { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .qs-fadein { animation: qs-fadein 0.22s ease both; }
`;

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export function Inspectionself() {
  const { t } = useTranslation();
  const { authFetch } = useAuth();

  const [step,          setStep]          = useState(0);
  const [trailers,      setTrailers]      = useState<TrailerAsset[]>([]);
  const [trucks,        setTrucks]        = useState<TruckAsset[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<SelectedAsset>(null);
  const [query,         setQuery]         = useState("");
  const [showDrop,      setShowDrop]      = useState(false);

  const [inspector,       setInspector]       = useState("");
  const [inspector2,      setInspector2]      = useState("");
  const [inspector3,      setInspector3]      = useState("");
  const [inspectionMode,  setInspectionMode]  = useState<"solo" | "team">("solo");
  const [mechanicOptions, setMechanicOptions] = useState<string[]>([]);
  const [loggedInName,    setLoggedInName]    = useState<string | null>(null);
  const [isAdmin,         setIsAdmin]         = useState(false);

  const [notes,      setNotes]      = useState("");
  const [items,      setItems]      = useState<QItem[]>(makeQItems());
  const [imgs,       setImgs]       = useState<File[]>([]);
  const [previews,   setPreviews]   = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);



// ✅ IMPROVED: Proper async compression with Blob API
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          
          if (!ctx) {
            reject(new Error("Canvas context failed"));
            return;
          }

          // ✅ MAX DIMENSIONS
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          let { width, height } = img;
          const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height, 1);
          
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);

          canvas.width = width;
          canvas.height = height;

          ctx.drawImage(img, 0, 0, width, height);

          // ✅ AGGRESSIVE COMPRESSION USING BLOB API (more reliable than toDataURL)
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Blob creation failed"));
                return;
              }

              const newFile = new File(
                [blob],
                file.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg",
                { type: "image/jpeg" }
              );

              console.log(`✅ Compressed: ${file.name} (${Math.round(file.size / 1024)}KB) → ${Math.round(blob.size / 1024)}KB`);
              resolve(newFile);
            },
            "image/jpeg",
            0.4 // ✅ VERY AGGRESSIVE QUALITY
          );
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () => {
        reject(new Error("Image load failed"));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error("File read failed"));
    };

    reader.readAsDataURL(file);
  });
}


  /* ── Fetch mechanics + current user ── */
  useEffect(() => {
    const load = async () => {
      try {
        const { mechanicNames, userName, userRole } = await fetchMechanicsAndUser(authFetch);
        setMechanicOptions(mechanicNames);
        const adminFlag = userRole.toLowerCase() === "admin";
        setLoggedInName(userName || null);
        setIsAdmin(adminFlag);
        if (!adminFlag && userName && mechanicNames.includes(userName)) {
          setInspector(userName);
        }
      } catch (err) {
        console.error("User/mechanics fetch error:", err);
      }
    };
    load();
  }, [authFetch]);

  /* ── Load trailers + trucks ── */
  useEffect(() => {
    Promise.all([fetchTrailers(authFetch), fetchTrucks(authFetch)])
      .then(([t, tr]) => { setTrailers(t); setTrucks(tr); })
      .catch(() => toast.error("Failed to load assets"))
      .finally(() => setLoading(false));
  }, [authFetch]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setShowDrop(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  /* ── Search results ── */
  const filteredResults: SearchResult[] = [
    ...trailers
      .filter(t => t.number.toLowerCase().includes(query.toLowerCase()))
      .map(t => ({ kind: "trailer" as const, data: t })),
    ...trucks
      .filter(t => t.number.toLowerCase().includes(query.toLowerCase()))
      .map(t => ({ kind: "truck" as const, data: t })),
  ].slice(0, 10);

  function selectAsset(result: SearchResult) {
    setSelectedAsset(result);
    setQuery(result.data.number);
    setShowDrop(false);
  }

  /* ── Checklist helpers ── */
  const done   = items.filter(i => i.status !== "").length;
  const fails  = items.filter(i => i.status === "fail").length;
  const passes = items.filter(i => i.status === "pass").length;
  const pct    = Math.round((done / items.length) * 100);

  function setItem(idx: number, field: "status" | "notes", val: string) {
    setItems(prev => prev.map((it, i) => i !== idx ? it : { ...it, [field]: val }));
  }
  function setItemPhoto(idx: number, photo: string) {
    setItems(p => p.map((it, i) => i !== idx ? it : { ...it, photo }));
  }

  /* ── Image helpers ── */
 async function addImages(files: File[]) {
  const valid = files.filter(f => {
    if (!f.type.startsWith("image/")) {
      toast.error(`${f.name} is not an image`);
      return false;
    }
    return true;
  });

  if (!valid.length) return;

  if (imgs.length + valid.length > 10) {
    toast.error("Max 10 photos allowed");
    return;
  }

  toast.loading("Compressing images...");

  const compressed: File[] = [];
  let processedCount = 0;

  // ✅ SERIAL PROCESSING (not parallel) - prevents CORS issues
  for (const file of valid) {
    try {
      const c = await compressImage(file);
      processedCount++;
      
      // Update toast with progress
      toast.dismiss();
      toast.loading(`Compressing images... ${processedCount}/${valid.length}`);

      if (c.size > 2 * 1024 * 1024) {
        console.warn(`⚠️ Still too large after compression: ${c.name} (${Math.round(c.size / 1024 / 1024 * 100) / 100}MB)`);
        toast.error(`${file.name} too large even after compression`);
        continue;
      }

      compressed.push(c);

    } catch (err) {
      console.error("❌ Compression failed:", file.name, err);
      toast.error(`Failed to compress ${file.name}`);
    }
    
    // ✅ SMALL DELAY between compressions - prevents canvas race condition
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  if (!compressed.length) {
    toast.dismiss();
    toast.error("All images failed compression");
    return;
  }

  setImgs(prev => [...prev, ...compressed]);

  compressed.forEach(f => {
    const url = URL.createObjectURL(f);
    setPreviews(prev => [...prev, url]);
  });

  toast.dismiss();
  toast.success(`✅ ${compressed.length} image(s) compressed & ready`);
}

  function removeImage(i: number) {
    setImgs(p => p.filter((_, x) => x !== i));
    setPreviews(p => p.filter((_, x) => x !== i));
  }

  /* ── Navigation ── */
  function canAdvance() {
    if (step === 0) return !!selectedAsset;
    if (step === 1) return !!inspector.trim();
    if (step === 2) return items.every(i => i.status !== "");
    return true;
  }
  function advance() {
    if (!canAdvance()) {
      const msgs = [
        "Select a trailer or truck to continue",
        "Inspector name is required",
        "Mark all items before continuing",
      ];
      toast.error(msgs[step] ?? "");
      return;
    }
    setStep(s => Math.min(s + 1, STEPS.length - 1));
  }

  const finalInspectorName = inspectionMode === "solo"
    ? inspector.trim()
    : [inspector, inspector2, inspector3].map(n => n.trim()).filter(Boolean).join(" + ");

  /* ══════════════════════════════════════════════════
     SUBMIT
  ══════════════════════════════════════════════════ */
  async function submit() {
    if (!selectedAsset) return;
    setSubmitting(true);
    try {
      const assetData = selectedAsset.data;
      const isTruck   = selectedAsset.kind === "truck";
      const nowISO    = new Date().toISOString();
      const defects: string[] = [];
      let p = 0, f = 0;
      items.forEach(it => {
        if (it.status === "fail") { f++; defects.push(`${it.label}${it.notes ? ": " + it.notes : ""}`); }
        else if (it.status === "pass") { p++; }
      });
      const ok = f === 0;

      const formData = new FormData();
      formData.append("inspection_id",    `QINS-${Date.now()}`);
      formData.append("asset_id",          assetData.id);
      formData.append("asset_unit_number", assetData.number);
      formData.append("asset_type",        isTruck ? "Truck" : "Trailer");
      formData.append("inspector_name",    finalInspectorName);
      formData.append("inspection_type",   "Quick");
      formData.append("overall_status",    ok ? "passed" : "failed");
      formData.append("issues_found",      defects.join("\n") || "None");
      formData.append("checklist_data",    JSON.stringify(items.map(i => ({ id: i.id, label: i.label, status: i.status, notes: i.notes }))));
      formData.append("inspection_score",  p + f > 0 ? Math.round((p / (p + f)) * 100).toString() : "0");
      formData.append("issue_count",       f.toString());
      formData.append("completed_at",      nowISO);
      if (notes.trim()) formData.append("mechanic_notes", notes.trim());

      // ✅ STEP 3: ADD COMPRESSED PHOTOS FROM Gallery
      for (const file of imgs) {
        if (file.size <= 2 * 1024 * 1024) {
          formData.append("photos", file);
        }
      }

      // ✅ STEP 2: COMPRESS FAIL PHOTOS
      let issueCount = 0;
      for (const item of items) {
        if (item.photo && item.status === "fail" && issueCount < 5) {
          try {
            const res = await fetch(item.photo);
            const blob = await res.blob();
            const file = new File([blob], `issue-${item.id}.jpg`, { type: "image/jpeg" });
            
            // ✅ COMPRESS FAIL PHOTOS TOO
            const compressed = await compressImage(file);
            if (compressed.size <= 2 * 1024 * 1024) {
              formData.append("photos", compressed);
              issueCount++;
            }
          } catch (err) {
            console.error("Issue photo error:", err);
          }
        }
      }

      // ✅ TOTAL SIZE CHECK
      const totalSize = imgs.reduce((acc, f) => acc + f.size, 0);
      if (totalSize > 15 * 1024 * 1024) {
        toast.error("Too many images - total exceeds 15MB");
        setSubmitting(false);
        return;
      }

      // ✅ SUBMIT
      const result = await submitInspection(authFetch, formData);

      if (result.workOrdersCreated > 0) {
        toast.success(`${result.workOrdersCreated} Work Order Created`, {
          description: `Assigned to ${finalInspectorName}`,
        });
      }
      toast.success(ok ? "Inspection Passed ✓" : "Inspection Recorded", {
        description: ok ? `All ${p} items passed` : `${f} issue${f > 1 ? "s" : ""} recorded`,
      });

      // Reset
      setSelectedAsset(null); setQuery("");
      setInspector(""); setInspector2(""); setInspector3("");
      setInspectionMode("solo");
      setNotes(""); setImgs([]); setPreviews([]); setItems(makeQItems()); setStep(0);
    } catch (err) {
      console.error(err);
      toast.error("Failed to save. Check connection.");
    } finally {
      setSubmitting(false);
    }
  }

  const selNumber = selectedAsset?.data.number ?? "";

  /* ─────────────────────────────────────────────────
     INSPECTOR FIELD
  ───────────────────────────────────────────────── */
  function renderInspectorField() {
    if (mechanicOptions.length === 0) {
      return (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 0", color: "var(--muted-foreground)", fontSize: 13 }}>
          <Loader2 size={16} className="qs-spin" />
          Loading mechanic list…
        </div>
      );
    }

    const toggleRow = (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {[
          { val: "solo", label: "👤  Solo", desc: "Just me" },
          { val: "team", label: "👥  Team", desc: "Multiple mechanics" },
        ].map(opt => {
          const sel = inspectionMode === opt.val;
          return (
            <button
              key={opt.val}
              onClick={() => {
                setInspectionMode(opt.val as "solo" | "team");
                if (opt.val === "solo") { setInspector2(""); setInspector3(""); }
              }}
              style={{
                padding: "12px 8px", borderRadius: 10,
                border: `2px solid ${sel ? C.accent : "var(--border)"}`,
                background: sel ? C.accentBg : "var(--card)",
                color: sel ? C.accent : "var(--muted-foreground)",
                fontWeight: 700, fontSize: 13, cursor: "pointer",
                fontFamily: "inherit", transition: "all .15s", textAlign: "center" as const,
              }}
            >
              <div>{opt.label}</div>
              <div style={{ fontSize: 10, fontWeight: 400, marginTop: 2, opacity: 0.8 }}>{opt.desc}</div>
            </button>
          );
        })}
      </div>
    );

    // ── NON-ADMIN (Mechanic) ──
    if (!isAdmin && loggedInName) {
      const partners = mechanicOptions.filter(name => name !== loggedInName);
      return (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Your Name <span style={{ color: C.accent }}>*</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: "var(--muted)", border: "1.5px solid var(--border)", borderRadius: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.accentBg, border: `1.5px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: C.accent, flexShrink: 0 }}>
                {loggedInName.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--foreground)" }}>{loggedInName}</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>Mechanic · Auto-selected</div>
              </div>
              <span style={{ fontSize: 16 }}>🔒</span>
            </div>
          </div>

          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
            Inspection Type
          </label>
          {toggleRow}

          {inspectionMode === "team" && (
            <div style={{ animation: "qs-fadein 0.2s ease both" }}>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                Partner Mechanic <span style={{ color: C.accent }}>*</span>
              </label>
              <select value={inspector2} onChange={e => setInspector2(e.target.value)} style={inp}
                onFocus={e => (e.target.style.borderColor = C.accent)}
                onBlur={e  => (e.target.style.borderColor = "var(--border)")}
              >
                <option value="">Select partner…</option>
                {partners.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              {inspector2 && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBorder}`, fontSize: 12, color: C.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  👥 Team: {loggedInName} + {inspector2}
                </div>
              )}
            </div>
          )}

          {inspectionMode === "solo" && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBorder}`, fontSize: 12, color: C.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              👤 Solo Inspection — {loggedInName}
            </div>
          )}
        </>
      );
    }

    // ── ADMIN ──
    if (isAdmin) {
      const opts2 = mechanicOptions.filter(n => n !== inspector);
      const opts3 = mechanicOptions.filter(n => n !== inspector && n !== inspector2);
      const teamNames = [inspector, inspector2, inspector3].filter(Boolean);

      return (
        <>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              Lead Mechanic <span style={{ color: C.accent }}>*</span>
            </label>
            <select
              value={inspector}
              onChange={e => {
                setInspector(e.target.value);
                if (e.target.value === inspector2) setInspector2("");
                if (e.target.value === inspector3) setInspector3("");
              }}
              style={inp}
              onFocus={e => (e.target.style.borderColor = C.accent)}
              onBlur={e  => (e.target.style.borderColor = "var(--border)")}
            >
              <option value="">Select lead mechanic…</option>
              {mechanicOptions.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>

          {inspector && (
            <>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                Inspection Type
              </label>
              {toggleRow}
            </>
          )}

          {inspector && inspectionMode === "team" && (
            <div style={{ animation: "qs-fadein 0.2s ease both" }}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                  Mechanic 2 <span style={{ color: C.accent }}>*</span>
                </label>
                <select value={inspector2}
                  onChange={e => { setInspector2(e.target.value); if (e.target.value === inspector3) setInspector3(""); }}
                  style={inp}
                  onFocus={e => (e.target.style.borderColor = C.accent)}
                  onBlur={e  => (e.target.style.borderColor = "var(--border)")}
                >
                  <option value="">Select mechanic 2…</option>
                  {opts2.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              {inspector2 && (
                <div style={{ marginBottom: 4 }}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                    Mechanic 3
                    <span style={{ fontSize: 9, fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>(optional)</span>
                  </label>
                  <select value={inspector3} onChange={e => setInspector3(e.target.value)} style={inp}
                    onFocus={e => (e.target.style.borderColor = C.accent)}
                    onBlur={e  => (e.target.style.borderColor = "var(--border)")}
                  >
                    <option value="">None</option>
                    {opts3.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
              )}

              {teamNames.length >= 2 && (
                <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: C.accentBg, border: `1px solid ${C.accentBorder}`, fontSize: 12, color: C.accent, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  👥 Team Inspection: {teamNames.join(" + ")}
                </div>
              )}
            </div>
          )}

          {inspector && inspectionMode === "solo" && (
            <div style={{ padding: "8px 10px", borderRadius: 8, background: C.greenBg, border: `1px solid ${C.greenBorder}`, fontSize: 12, color: C.green, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              👤 Solo Inspection — {inspector}
            </div>
          )}
        </>
      );
    }

    // ── Fallback ──
    return (
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
          Select Mechanic <span style={{ color: C.accent }}>*</span>
        </label>
        <select value={inspector} onChange={e => setInspector(e.target.value)} style={inp}
          onFocus={e => (e.target.style.borderColor = C.accent)}
          onBlur={e  => (e.target.style.borderColor = "var(--border)")}
        >
          <option value="">Select mechanic…</option>
          {mechanicOptions.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      </div>
    );
  }

  /* ═════════════════════════════════════════════
     RENDER
  ═════════════════════════════════════════════ */
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="qs-root">

        {/* ══ HEADER ══ */}
        <div className="qs-header">
          <div className="qs-header-inner">
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClipboardList size={18} color="var(--primary-foreground)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--foreground)", lineHeight: 1.2 }}>Quick Inspection</div>
                <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>{STEPS[step]} · Step {step + 1} of {STEPS.length}</div>
              </div>
              {step === 2 && done > 0 && (
                <div style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 100, background: fails > 0 ? C.redBg : C.accentBg, color: fails > 0 ? C.red : C.accent, border: `1px solid ${fails > 0 ? C.redBorder : C.accentBorder}` }}>
                  {done}/{items.length}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {STEPS.map((label, i) => {
                const isActive = i === step;
                const isDone   = i < step;
                return (
                  <div key={i} style={{ flex: 1, paddingBottom: 10, borderBottom: `1.5px solid ${isActive ? "var(--foreground)" : isDone ? C.accent : "var(--border)"}`, fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", textAlign: "center", whiteSpace: "nowrap", color: isActive ? "var(--foreground)" : isDone ? C.accent : "var(--muted-foreground)", transition: "all 0.2s" }}>
                    {label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ SCROLLABLE BODY ══ */}
        <div className="qs-body">
          <div className="qs-body-inner">

            {/* ─── STEP 0: SELECT ASSET ─── */}
            {step === 0 && (
              <div className="qs-fadein">
                <PageTitle title="Select Asset" sub="Search for a trailer or truck to inspect" />
                <div ref={dropRef} style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ padding: 10, position: "relative" }}>
                    <Search size={14} style={{ position: "absolute", left: 22, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
                    <input value={query} onChange={e => { setQuery(e.target.value); setShowDrop(true); }} onFocus={() => setShowDrop(true)} placeholder="Search trailer or truck…" autoFocus
                      style={{ width: "100%", paddingLeft: 34, paddingRight: 10, paddingTop: 10, paddingBottom: 10, background: "var(--input-background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, color: "var(--foreground)", outline: "none", fontFamily: "inherit" }}
                    />
                  </div>
                  {showDrop && filteredResults.length > 0 && (
                    <div style={{ borderTop: "1px solid var(--border)", maxHeight: 260, overflowY: "auto" }}>
                      {filteredResults.map((result, i) => {
                        const isTruck = result.kind === "truck";
                        const sub = isTruck
                          ? `Truck · ${(result.data as TruckAsset).make ?? ""} ${(result.data as TruckAsset).year ?? ""}`.trim()
                          : `Trailer · ${(result.data as TrailerAsset).customerName ?? ""}`.trim();
                        return (
                          <button key={result.data.id} onMouseDown={() => selectAsset(result)}
                            style={{ width: "100%", textAlign: "left", padding: "11px 14px", background: "transparent", border: "none", borderBottom: i < filteredResults.length - 1 ? "1px solid var(--border)" : "none", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "var(--foreground)", fontFamily: "inherit" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "var(--accent)")}
                            onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                          >
                            <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: isTruck ? "rgba(234,88,12,0.1)" : C.accentBg, border: `1px solid ${isTruck ? C.orangeBorder : C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <TruckIcon size={14} color={isTruck ? C.orange : C.accent} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span style={{ fontWeight: 600, fontSize: 14 }}>{result.data.number}</span>
                                <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 99, textTransform: "uppercase", background: isTruck ? "rgba(234,88,12,0.1)" : C.accentBg, color: isTruck ? C.orange : C.accent, border: `1px solid ${isTruck ? C.orangeBorder : C.accentBorder}` }}>
                                  {isTruck ? "Truck" : "Trailer"}
                                </span>
                              </div>
                              {sub && <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
                            </div>
                            <ChevronRight size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {loading && (
                    <div style={{ padding: "12px 14px", color: "var(--muted-foreground)", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
                      <Loader2 size={14} className="qs-spin" /> Loading assets…
                    </div>
                  )}
                </div>
                {selectedAsset && (
                  <div style={{ background: "var(--card)", border: `1.5px solid ${C.accent}`, borderRadius: 12, overflow: "hidden" }}>
                    {selectedAsset.kind === "truck"
                      ? <TruckInfoCard truck={selectedAsset.data} />
                      : <TrailerInfoCard trailer={selectedAsset.data} />}
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 1: INSPECTOR ─── */}
            {step === 1 && (
              <div className="qs-fadein">
                <PageTitle title="Inspector Details" sub="Who is performing this inspection?" />
                {selectedAsset && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", marginBottom: 14, borderRadius: 10, background: selectedAsset.kind === "truck" ? "rgba(234,88,12,0.08)" : C.accentBg, border: `1.5px solid ${selectedAsset.kind === "truck" ? C.orangeBorder : C.accentBorder}` }}>
                    <TruckIcon size={14} color={selectedAsset.kind === "truck" ? C.orange : C.accent} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: selectedAsset.kind === "truck" ? C.orange : C.accent }}>{selNumber}</span>
                    <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>· {selectedAsset.kind === "truck" ? "Truck" : "Trailer"}</span>
                  </div>
                )}
                <div style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                    {renderInspectorField()}
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                      Mechanic Notes{" "}
                      <span style={{ fontSize: 9, fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
                    </label>
                    <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Additional observations…" rows={3}
                      style={{ width: "100%", background: "transparent", border: "none", borderBottom: "2px solid var(--border)", padding: "4px 0", fontSize: 14, color: "var(--foreground)", outline: "none", fontFamily: "inherit", resize: "none", lineHeight: 1.6 }}
                      onFocus={e => (e.target.style.borderBottomColor = C.accent)}
                      onBlur={e  => (e.target.style.borderBottomColor = "var(--border)")}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── STEP 2: CHECKLIST ─── */}
            {step === 2 && (
              <div className="qs-fadein">
                <PageTitle title="Quick Checklist" sub="Mark each item pass or fail" />
                <div style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--muted-foreground)" }}>{done} / {items.length} checked</span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: fails > 0 ? C.red : C.accent }}>{pct}%</span>
                  </div>
                  <div style={{ height: 7, background: "var(--muted)", borderRadius: 999, overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, transition: "width 0.4s ease", background: fails > 0 ? C.red : pct === 100 ? C.green : C.accent }} />
                  </div>
                </div>
                <div style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                  {items.map((item, idx) => (
                    <div key={item.id} style={{ padding: "14px", borderBottom: idx < items.length - 1 ? "1px solid var(--border)" : "none", background: item.status === "pass" ? C.greenBg : item.status === "fail" ? C.redBg : "transparent", transition: "background 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: item.status === "pass" ? C.green : item.status === "fail" ? C.red : "var(--muted)", color: item.status !== "" ? "#fff" : "var(--muted-foreground)", transition: "all 0.15s" }}>
                          {item.icon}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 15, flex: 1 }}>{item.label}</span>
                        {item.status !== "" && (
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "3px 8px", borderRadius: 99, background: item.status === "pass" ? C.greenBg : C.redBg, color: item.status === "pass" ? C.green : C.red, border: `1px solid ${item.status === "pass" ? C.greenBorder : C.redBorder}` }}>
                            {item.status}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        {[
                          { val: "pass" as const, label: "✔  Pass", selBg: C.green, selBorder: C.green, idleBg: C.greenBg, idleColor: C.green, idleBorder: C.greenBorder },
                          { val: "fail" as const, label: "✘  Fail", selBg: C.red,   selBorder: C.red,   idleBg: C.redBg,   idleColor: C.red,   idleBorder: C.redBorder   },
                        ].map(btn => {
                          const sel = item.status === btn.val;
                          return (
                            <button key={btn.val} onClick={() => setItem(idx, "status", item.status === btn.val ? "" : btn.val)}
                              style={{ padding: "13px 8px", minHeight: 52, borderRadius: 10, border: `2px solid ${sel ? btn.selBorder : btn.idleBorder}`, background: sel ? btn.selBg : btn.idleBg, color: sel ? "#fff" : btn.idleColor, fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.04em", cursor: "pointer", transition: "all .12s", fontFamily: "inherit", touchAction: "manipulation" }}>
                              {btn.label}
                            </button>
                          );
                        })}
                      </div>
                      {item.status === "fail" && (
                        <div style={{ marginTop: 8 }}>
                          <input value={item.notes} onChange={e => setItem(idx, "notes", e.target.value)} placeholder="Describe the issue…"
                            style={{ width: "100%", padding: "9px 11px", borderRadius: 8, border: `1.5px solid ${C.redBorder}`, background: "#fff8f8", color: C.red, fontSize: 14, outline: "none", fontFamily: "inherit", marginBottom: 8 }}
                            onFocus={e => (e.target.style.borderColor = C.red)}
                            onBlur={e  => (e.target.style.borderColor = C.redBorder)}
                          />
                          {!item.photo ? (
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 12px", borderRadius: 8, border: `1.5px dashed ${C.redBorder}`, background: "#fff8f8", color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer", textAlign: "center" as const }}>
                              <Camera size={14} /> Upload issue photo
                              <input type="file" accept="image/*" capture="environment" style={{ display: "none" }}
                                onChange={e => { const f = e.target.files?.[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => setItemPhoto(idx, reader.result as string); reader.readAsDataURL(f); e.target.value = ""; }}
                              />
                            </label>
                          ) : (
                            <div style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: `1.5px solid ${C.redBorder}` }}>
                              <img src={item.photo} alt="Issue" style={{ width: "100%", maxHeight: 160, objectFit: "cover", display: "block" }} />
                              <button onClick={() => setItemPhoto(idx, "")} style={{ position: "absolute", top: 6, right: 6, width: 24, height: 24, borderRadius: "50%", background: C.red, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                                <X size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── STEP 3: PHOTOS ─── */}
            {step === 3 && (
              <div className="qs-fadein">
                <PageTitle title="Photos" sub="Optional — attach defect or vehicle photos" />
                <input
  ref={fileRef}
  type="file"
  accept="image/*"
  multiple
  capture="environment"
  onChange={e => addImages(Array.from(e.target.files || []))}
  style={{ display: "none" }}
/>
                {previews.length === 0 ? (
                  <button onClick={() => fileRef.current?.click()}
                    style={{ width: "100%", border: "1.5px dashed var(--border)", borderRadius: 12, background: "var(--card)", padding: "2.5rem 1rem", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 14, fontFamily: "inherit", transition: "all .15s" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.background = C.accentBg; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--card)"; }}
                  >
                    <div style={{ width: 52, height: 52, borderRadius: "50%", background: C.accentBg, border: `2px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ImageIcon size={24} color={C.accent} />
                    </div>
                    <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: 15, textTransform: "uppercase", letterSpacing: "0.07em" }}>Add Photos</div>
                    <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Tap to select or take a photo · max 10MB</div>
                  </button>
                ) : (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(90px, 1fr))", gap: 8, marginBottom: 10 }}>
                      {previews.map((src, i) => (
                        <div key={i} style={{ position: "relative", borderRadius: 8, overflow: "hidden", border: "1.5px solid var(--border)", aspectRatio: "1", background: "var(--muted)" }}>
                          <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                          <button onClick={() => removeImage(i)} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: C.red, color: "#fff", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: "1", borderRadius: 8, border: "1.5px dashed var(--border)", background: "var(--card)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, cursor: "pointer", color: "var(--muted-foreground)", fontFamily: "inherit" }}>
                        <Camera size={18} />
                        <span style={{ fontSize: 11, fontWeight: 500 }}>Add</span>
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--muted-foreground)", textAlign: "center" }}>
                      {previews.length} photo{previews.length !== 1 ? "s" : ""} attached
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── STEP 4: REVIEW ─── */}
            {step === 4 && (
              <div className="qs-fadein">
                <PageTitle title="Review & Submit" sub="Verify details before submitting" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { count: passes,          label: "Passed", bg: C.greenBg,      border: C.greenBorder,   color: C.green },
                    { count: fails,           label: "Failed", bg: C.redBg,        border: C.redBorder,     color: C.red   },
                    { count: previews.length, label: "Photos", bg: "var(--muted)", border: "var(--border)", color: C.grey  },
                  ].map(({ count, label, bg, border, color }) => (
                    <div key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.12em", marginTop: 4 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: "var(--card)", border: "1.5px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                  {((): [string, string][] => [
                    [selectedAsset?.kind === "truck" ? "Truck" : "Trailer", selNumber],
                    ...((selectedAsset?.kind === "trailer" && (selectedAsset.data as TrailerAsset).customerName)
                      ? [["Customer", (selectedAsset.data as TrailerAsset).customerName!] as [string, string]] : []),
                    ["Inspector",   finalInspectorName],
                    ["Date",        new Date().toLocaleDateString()],
                    ["Photos",      `${previews.length} attached`],
                    ...(fails > 0 ? [["Work Orders", `${fails} will be created on submit`] as [string, string]] : []),
                    ...(notes ? [["Notes", notes] as [string, string]] : []),
                  ])().map(([k, v], i, arr) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderBottom: i < arr.length - 1 ? "1px solid var(--border)" : "none" }}>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)", fontWeight: 500, flexShrink: 0 }}>{k}</span>
                      <span style={{ fontWeight: 700, fontSize: 14, textAlign: "right", wordBreak: "break-all", color: k === "Work Orders" ? C.orange : "var(--foreground)" }}>{v}</span>
                    </div>
                  ))}
                </div>
                {fails > 0 && (
                  <div style={{ background: C.redBg, border: `1px solid ${C.redBorder}`, borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
                    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.redBorder}`, display: "flex", alignItems: "center", gap: 8 }}>
                      <XCircle size={14} color={C.red} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>Failed Items — {fails} Work Order{fails > 1 ? "s" : ""} will be created</span>
                    </div>
                    {items.filter(i => i.status === "fail").map(item => (
                      <div key={item.id} style={{ padding: "10px 16px", borderBottom: `1px solid ${C.redBorder}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <Wrench size={12} color={C.orange} style={{ flexShrink: 0 }} />
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#b91c1c" }}>{item.label}</span>
                        </div>
                        {item.notes && <div style={{ fontSize: 12, color: C.red, marginTop: 2, paddingLeft: 18 }}>{item.notes}</div>}
                        {item.photo && <img src={item.photo} alt="Issue" style={{ marginTop: 6, width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 6, border: `1px solid ${C.redBorder}`, display: "block" }} />}
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10, background: fails > 0 ? C.redBg : C.greenBg, border: `2px solid ${fails > 0 ? C.redBorder : C.greenBorder}` }}>
                  {fails > 0 ? <XCircle size={20} color={C.red} style={{ flexShrink: 0 }} /> : <CheckCircle2 size={20} color={C.green} style={{ flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: fails > 0 ? C.red : C.green }}>
                      {fails > 0 ? `${fails} Issue${fails > 1 ? "s" : ""} Found` : "All Items Passed"}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2, color: fails > 0 ? "#b91c1c" : "#15803d" }}>
                      {fails > 0
                        ? `Marked FAILED · ${fails} Work Order${fails > 1 ? "s" : ""} assigned to ${finalInspectorName}`
                        : "Will be marked PASSED"
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="qs-footer">
          <div className="qs-footer-inner">
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 18px", minHeight: 46, borderRadius: 10, border: "1.5px solid var(--border)", background: "var(--muted)", color: "var(--muted-foreground)", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.07em", cursor: "pointer", fontFamily: "inherit", touchAction: "manipulation" }}>
                <ChevronLeft size={15} /> Back
              </button>
            ) : <div />}
            {step < STEPS.length - 1 ? (
              <button onClick={advance}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "10px 22px", minHeight: 46, borderRadius: 10, border: "none", background: !canAdvance() ? "var(--muted)" : C.accent, color: !canAdvance() ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.07em", cursor: !canAdvance() ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: canAdvance() ? `0 4px 14px ${C.accentBorder}` : "none", touchAction: "manipulation" }}>
                Continue <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={submit} disabled={submitting}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 22px", minHeight: 46, borderRadius: 10, border: "none", background: submitting ? "var(--muted)" : fails > 0 ? C.red : C.green, color: submitting ? "var(--muted-foreground)" : "#fff", fontWeight: 700, fontSize: 13, textTransform: "uppercase", letterSpacing: "0.07em", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit", boxShadow: submitting ? "none" : `0 4px 14px ${fails > 0 ? C.redBorder : C.greenBorder}`, touchAction: "manipulation" }}>
                {submitting
                  ? <><Loader2 size={14} className="qs-spin" /> Saving…</>
                  : fails > 0
                  ? <><XCircle size={14} /> Submit · {fails} Issue{fails > 1 ? "s" : ""}</>
                  : <><Zap size={14} /> Submit Inspection</>
                }
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════
   TRUCK INFO CARD
═══════════════════════════════════════════════════════ */
function TruckInfoCard({ truck }: { truck: TruckAsset }) {
  const insp = truck.inspectionDate;
  const exp  = addDays(insp, 90);
  const soon = isExpiringSoon(insp);
  const over = isExpired(insp);
  const ec   = over ? C.red    : soon ? C.orange    : C.green;
  const eb   = over ? C.redBg  : soon ? C.orangeBg  : C.greenBg;
  const ebr  = over ? C.redBorder : soon ? C.orangeBorder : C.greenBorder;
  return (
    <div>
      {truck.photo && (
        <div style={{ width: "100%", height: 120, overflow: "hidden", background: "var(--muted)" }}>
          <img src={truck.photo} alt="Truck" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      )}
      <div style={{ padding: "13px 15px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: "rgba(234,88,12,0.1)", border: `1px solid ${C.orangeBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <TruckIcon size={15} color={C.orange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 1 }}>Truck · Selected</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--foreground)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{truck.number}</div>
          </div>
          <CheckCircle2 size={19} color={C.accent} style={{ flexShrink: 0 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
          {([
            { label: "Status", value: truck.status || "—", hi: truck.status?.toLowerCase() === "active" },
            { label: "Make",   value: truck.make   || "—" },
            { label: "Year",   value: String(truck.year || "—") },
            { label: "VIN",    value: truck.vin    || "—" },
            ...(truck.plate ? [{ label: "Plate", value: truck.plate }] : []),
            ...(truck.owner ? [{ label: "Owner", value: truck.owner }] : []),
          ] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
            <div key={label} style={{ background: "var(--muted)", borderRadius: 8, padding: "7px 9px" }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: hi ? C.green : "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
            </div>
          ))}
        </div>
        <div style={{ background: eb, border: `1.5px solid ${ebr}`, borderRadius: 9, padding: "9px 11px", display: "flex", alignItems: "center", gap: 9 }}>
          {(over || soon) ? <AlertCircle size={15} color={ec} style={{ flexShrink: 0 }} /> : <Calendar size={15} color={ec} style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ec, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              {over ? "Inspection Expired" : soon ? "Expiring Soon" : "Inspection Valid"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
              Last: {insp ? new Date(insp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
              {exp && <> · Exp: <span style={{ fontWeight: 700, color: ec }}>{exp}</span></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TRAILER INFO CARD
═══════════════════════════════════════════════════════ */
function TrailerInfoCard({ trailer }: { trailer: TrailerAsset }) {
  const insp = trailer.inspectionDate;
  const exp  = addDays(insp, 90);
  const soon = isExpiringSoon(insp);
  const over = isExpired(insp);
  const ec   = over ? C.red    : soon ? C.orange    : C.green;
  const eb   = over ? C.redBg  : soon ? C.orangeBg  : C.greenBg;
  const ebr  = over ? C.redBorder : soon ? C.orangeBorder : C.greenBorder;
  return (
    <div style={{ padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: C.accentBg, border: `1px solid ${C.accentBorder}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <TruckIcon size={15} color={C.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 1 }}>Trailer · Selected</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: "var(--foreground)", lineHeight: 1.1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{trailer.number}</div>
        </div>
        <CheckCircle2 size={19} color={C.accent} style={{ flexShrink: 0 }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 12 }}>
        {([
          { label: "Status", value: trailer.status || "—", hi: trailer.status?.toLowerCase() === "active" },
          ...(trailer.customerName ? [{ label: "Owner", value: trailer.customerName }] : []),
          ...(trailer.plate        ? [{ label: "Plate", value: trailer.plate }]        : []),
          ...(trailer.vin          ? [{ label: "VIN",   value: trailer.vin }]          : []),
          ...(trailer.make         ? [{ label: "Make",  value: trailer.make }]         : []),
          ...(trailer.year         ? [{ label: "Year",  value: String(trailer.year) }] : []),
        ] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
          <div key={label} style={{ background: "var(--muted)", borderRadius: 8, padding: "7px 9px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 2 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: hi ? C.green : "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</div>
          </div>
        ))}
      </div>
      <div style={{ background: eb, border: `1.5px solid ${ebr}`, borderRadius: 9, padding: "9px 11px", display: "flex", alignItems: "center", gap: 9 }}>
        {(over || soon) ? <AlertCircle size={15} color={ec} style={{ flexShrink: 0 }} /> : <Calendar size={15} color={ec} style={{ flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ec, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            {over ? "Inspection Expired" : soon ? "Expiring Soon" : insp ? "Inspection Valid" : "No Inspection Date"}
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 1 }}>
            Last: {insp ? new Date(insp).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A"}
            {exp && <> · Exp: <span style={{ fontWeight: 700, color: ec }}>{exp}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--foreground)", margin: 0 }}>{title}</h2>
      <p style={{ color: "var(--muted-foreground)", fontSize: 13, margin: "3px 0 0" }}>{sub}</p>
    </div>
  );
}