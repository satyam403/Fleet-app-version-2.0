import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import type { Trailer as TrailerBase } from '../types';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Loader2, Camera, CheckCircle2, XCircle,
  ChevronRight, ChevronLeft, X,
  ClipboardCheck, Calendar, AlertCircle,
} from 'lucide-react';
import { Truck as TruckIcon } from 'lucide-react';
import { useAuth } from "../contexts/AuthContext";
import { apiUrl } from "../config";

/* ─────────────────────────────────────────────────────
   TYPES
───────────────────────────────────────────────────── */
type Trailer = TrailerBase & {
  customerName?: string;
  inspectionDate?: string;
  plate?: string;
  vin?: string;
  year?: string | number;
  make?: string;
};

interface InspectionItem {
  id: string;
  label: string;
  status: 'pass' | 'fail' | '';
  photo?: string;
  notes?: string;
}

interface InspectionSection {
  title: string;
  items: InspectionItem[];
}

type SearchResult =
  | { kind: 'trailer'; data: Trailer }
  | { kind: 'truck'; data: TruckAsset };

type SelectedAsset =
  | { kind: 'trailer'; data: Trailer }
  | { kind: 'truck'; data: TruckAsset }
  | null;

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
}

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

/* ─────────────────────────────────────────────────────
   STEPS
───────────────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: 'Trailer' },
  { id: 2, label: 'Details' },
  { id: 3, label: 'Inspect' },
  { id: 4, label: 'Photos' },
  { id: 5, label: 'Review' },
];

/* The 4 mandatory vehicle-side photos captured at the Photos step. Filenames
   (front/rear/driver-side/passenger-side) flow through the backend image
   pipeline into the inspection's photo attachments. */
const VEHICLE_SIDES = [
  { key: 'front',           label: 'Front' },
  { key: 'rear',            label: 'Rear / Back' },
  { key: 'driver-side',     label: 'Driver Side' },
  { key: 'passenger-side',  label: 'Passenger Side' },
  { key: 'underneath-rear', label: 'Underneath (from Rear)' },
  { key: 'roll-door-grease', label: 'Roll Door Grease' },
  { key: 'swing-door-locks', label: 'Swing Door Locks' },
  { key: 'tandem-check', label: 'Tandem Check (Springs & Tires)' },
  { key: 'swing-door-gate', label: 'Swing Door / Gate Condition' },
] as const;

/* ─────────────────────────────────────────────────────
   FETCH HELPERS — sab authFetch parameter se lenge
   ✅ Hooks yahan nahi — sirf component ke andar
───────────────────────────────────────────────────── */
const API_BASE = apiUrl("/users");

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
  // ✅ Dono calls parallel — authFetch se, localStorage nahi
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
    userName:      userData.data?.name || "",
    userRole:      userData.data?.role || "",
  };
}

async function submitInspection(authFetch: AuthFetch, formData: FormData): Promise<any> {
  // ✅ FormData ke liye headers empty — authFetch khud Content-Type skip karega (FormData detect karke)
  const res = await authFetch(`${API_BASE}/createInspection`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || "API failed");
  }
  return res.json();
}

/* ─────────────────────────────────────────────────────
   TRAILER CHECKLIST
───────────────────────────────────────────────────── */
const TRAILER_SECTIONS: InspectionSection[] = [
  { title: 'Brake System', items: [
    { id: 'brake_adjustment',  label: 'Brake Adjustment',     status: 'pass' },
    { id: 'brake_connections', label: 'Brake Connections',    status: 'pass' },
    { id: 'brake_drums',       label: 'Brake Drums / Rotors', status: 'pass' },
    { id: 'brake_hoses',       label: 'Brake Hoses',          status: 'pass' },
    { id: 'brake_tubing',      label: 'Brake Tubing',         status: 'pass' },
  ]},
  { title: 'Coupling', items: [
    { id: 'fifth_wheel',   label: 'Fifth Wheel',            status: 'pass' },
    { id: 'pintle_hooks',  label: 'Pintle Hooks',           status: 'pass' },
    { id: 'drawbar_eye',   label: 'Drawbar / Towbar / Eye', status: 'pass' },
    { id: 'safety_chains', label: 'Safety Chains',          status: 'pass' },
  ]},
  { title: 'Lighting', items: [
    { id: 'tail_lights',      label: 'Tail Lights',      status: 'pass' },
    { id: 'brake_lights',     label: 'Brake Lights',     status: 'pass' },
    { id: 'turn_signals',     label: 'Turn Signals',     status: 'pass' },
    { id: 'clearance_lights', label: 'Clearance Lights', status: 'pass' },
    { id: 'reflectors',       label: 'Reflectors',       status: 'pass' },
  ]},
  { title: 'Loading', items: [
    { id: 'cargo_securement', label: 'Cargo Securement', status: 'pass' },
    { id: 'tailgate',         label: 'Tailgate / Doors', status: 'pass' },
    { id: 'doors',            label: 'Side Doors',       status: 'pass' },
  ]},
  { title: 'Suspension', items: [
    { id: 'spring_assembly', label: 'Spring Assembly',     status: 'pass' },
    { id: 'torque_arm',      label: 'Torque / Radius Arm', status: 'pass' },
  ]},
  { title: 'Tires', items: [
    { id: 'tire_condition',   label: 'Tire Condition', status: 'pass' },
    { id: 'tire_tread_depth', label: 'Tread Depth',    status: 'pass' },
  ]},
  { title: 'Wheels', items: [
    { id: 'wheels_rims',     label: 'Wheels / Rims',   status: 'pass' },
    { id: 'wheel_fasteners', label: 'Wheel Fasteners', status: 'pass' },
  ]},
  { title: 'Frame',     items: [{ id: 'frame_members', label: 'Frame Members',             status: 'pass' }] },
  { title: 'Mud Flaps', items: [{ id: 'mud_flaps',     label: 'Mud Flaps / Splash Guards', status: 'pass' }] },
];

/* ─────────────────────────────────────────────────────
   TRUCK CHECKLIST
───────────────────────────────────────────────────── */
const TRUCK_SECTIONS: InspectionSection[] = [
  { title: 'Brake System', items: [
    { id: 'brake_adjustment',  label: 'Brake Adjustment',     status: 'pass' },
    { id: 'brake_connections', label: 'Brake Connections',    status: 'pass' },
    { id: 'brake_drums',       label: 'Brake Drums / Rotors', status: 'pass' },
    { id: 'brake_hoses',       label: 'Brake Hoses',          status: 'pass' },
    { id: 'brake_tubing',      label: 'Brake Tubing',         status: 'pass' },
    { id: 'parking_brake',     label: 'Parking Brake',        status: 'pass' },
  ]},
  { title: 'Engine', items: [
    { id: 'engine_oil',    label: 'Engine Oil Level', status: 'pass' },
    { id: 'coolant',       label: 'Coolant Level',    status: 'pass' },
    { id: 'belts_hoses',   label: 'Belts & Hoses',    status: 'pass' },
    { id: 'air_filter',    label: 'Air Filter',       status: 'pass' },
    { id: 'engine_mounts', label: 'Engine Mounts',    status: 'pass' },
  ]},
  { title: 'Lighting', items: [
    { id: 'headlights',       label: 'Headlights',       status: 'pass' },
    { id: 'tail_lights',      label: 'Tail Lights',      status: 'pass' },
    { id: 'brake_lights',     label: 'Brake Lights',     status: 'pass' },
    { id: 'turn_signals',     label: 'Turn Signals',     status: 'pass' },
    { id: 'clearance_lights', label: 'Clearance Lights', status: 'pass' },
    { id: 'reflectors',       label: 'Reflectors',       status: 'pass' },
    { id: 'reverse_lights',   label: 'Reverse Lights',   status: 'pass' },
  ]},
  { title: 'Steering', items: [
    { id: 'steering_wheel',  label: 'Steering Wheel',    status: 'pass' },
    { id: 'steering_column', label: 'Steering Column',   status: 'pass' },
    { id: 'steering_gear',   label: 'Steering Gear Box', status: 'pass' },
    { id: 'pitman_arm',      label: 'Pitman Arm',        status: 'pass' },
    { id: 'power_steering',  label: 'Power Steering',    status: 'pass' },
    { id: 'tie_rods',        label: 'Tie Rods',          status: 'pass' },
  ]},
  { title: 'Suspension', items: [
    { id: 'spring_assembly', label: 'Spring Assembly',     status: 'pass' },
    { id: 'torque_arm',      label: 'Torque / Radius Arm', status: 'pass' },
    { id: 'shock_absorbers', label: 'Shock Absorbers',     status: 'pass' },
  ]},
  { title: 'Tires', items: [
    { id: 'tire_condition',   label: 'Tire Condition', status: 'pass' },
    { id: 'tire_tread_depth', label: 'Tread Depth',    status: 'pass' },
    { id: 'tire_pressure',    label: 'Tire Pressure',  status: 'pass' },
  ]},
  { title: 'Wheels', items: [
    { id: 'wheels_rims',     label: 'Wheels / Rims',   status: 'pass' },
    { id: 'wheel_fasteners', label: 'Wheel Fasteners', status: 'pass' },
    { id: 'wheel_seals',     label: 'Wheel Seals',     status: 'pass' },
  ]},
  { title: 'Exhaust', items: [
    { id: 'exhaust_system', label: 'Exhaust System',   status: 'pass' },
    { id: 'dpf_filter',     label: 'DPF / DEF System', status: 'pass' },
  ]},
  { title: 'Fuel', items: [
    { id: 'fuel_tank',  label: 'Fuel Tank',  status: 'pass' },
    { id: 'fuel_lines', label: 'Fuel Lines', status: 'pass' },
    { id: 'def_tank',   label: 'DEF Tank',   status: 'pass' },
  ]},
  { title: 'Cab / Interior', items: [
    { id: 'windshield_condition', label: 'Windshield Condition',     status: 'pass' },
    { id: 'windshield_wipers',    label: 'Wipers / Washers',         status: 'pass' },
    { id: 'horn',                 label: 'Horn',                     status: 'pass' },
    { id: 'mirrors',              label: 'Mirrors',                  status: 'pass' },
    { id: 'seatbelt',             label: 'Seat Belt',                status: 'pass' },
    { id: 'dashboard_warning',    label: 'Dashboard Warning Lights', status: 'pass' },
  ]},
  { title: 'Frame & Body', items: [
    { id: 'frame_members',  label: 'Frame Members',             status: 'pass' },
    { id: 'mud_flaps',      label: 'Mud Flaps / Splash Guards', status: 'pass' },
    { id: 'fifth_wheel_cp', label: 'Fifth Wheel / Coupling',    status: 'pass' },
  ]},
  { title: 'Transmission', items: [
    { id: 'transmission_fluid', label: 'Transmission Fluid', status: 'pass' },
    { id: 'clutch',             label: 'Clutch Operation',   status: 'pass' },
  ]},
];

/* ─────────────────────────────────────────────────────
   ANIMATION
───────────────────────────────────────────────────── */
const slideVariants = {
  enter:  (d: number) => ({ x: d > 0 ?  48 : -48, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:   (d: number) => ({ x: d > 0 ? -48 :  48, opacity: 0 }),
};

/* ─────────────────────────────────────────────────────
   DATE HELPERS
───────────────────────────────────────────────────── */
// Inspection validity = 3 calendar months (matches the dashboard alerts).
function addMonthsStr(ds: string | undefined, months: number): string | null {
  if (!ds) return null;
  const d = new Date(ds);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + months);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function isExpiringSoon(ds: string | undefined): boolean {
  if (!ds) return false;
  const exp = new Date(ds); exp.setMonth(exp.getMonth() + 3);
  const diff = (exp.getTime() - Date.now()) / 86400000;
  return diff <= 7 && diff >= 0;
}
function isExpired(ds: string | undefined): boolean {
  if (!ds) return false;
  const exp = new Date(ds); exp.setMonth(exp.getMonth() + 3);
  return exp.getTime() < Date.now();
}

/* ─────────────────────────────────────────────────────
   COLOURS
───────────────────────────────────────────────────── */
const C = {
  accent:       '#000000',
  accentBg:     'rgba(0,0,0,0.05)',
  accentBorder: 'rgba(0,0,0,0.18)',
  green:        '#1a7a3c', greenBg:  '#f0faf4', greenBorder:  '#a8d5b8',
  red:          '#c0392b', redBg:    '#fdf2f1', redBorder:    '#e8b4b0',
  orange:       '#b45309', orangeBg: '#fdf8f0', orangeBorder: '#d4a96a',
  grey:         '#6b7280',
};

/* ─────────────────────────────────────────────────────
   GLOBAL CSS
───────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  .insp-root {
    display: flex;
    flex-direction: column;
    margin-top: 80px;
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--background);
  }
  .insp-header {
    flex-shrink: 0;
    background: var(--card);
    border-bottom: 1px solid var(--border);
    z-index: 20;
  }
  .insp-header-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 12px 16px 0;
    width: 100%;
    box-sizing: border-box;
  }
  .insp-body {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }
  .insp-body-inner {
    max-width: 720px;
    margin: 0 auto;
    padding: 16px 16px 120px;
    width: 100%;
    box-sizing: border-box;
  }
  .insp-footer {
    flex-shrink: 0;
    background: var(--card);
    border-top: 1px solid var(--border);
    z-index: 20;
  }
  .insp-footer-inner {
    max-width: 720px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 16px;
    width: 100%;
    box-sizing: border-box;
  }
  .insp-tabs {
    display: flex;
    gap: 6px;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    scrollbar-width: none;
    -ms-overflow-style: none;
    padding-bottom: 2px;
    margin-bottom: 10px;
  }
  .insp-tabs::-webkit-scrollbar { display: none; }
  .insp-sidebar { display: none; }
  @media (min-width: 768px) {
    .insp-sidebar { display: flex !important; }
    .insp-tabs    { display: none  !important; }
  }
  * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
  @keyframes insp-spin { to { transform: rotate(360deg); } }
  .insp-spin { animation: insp-spin 1s linear infinite; }
  @keyframes insp-fadein {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: none; }
  }
  .insp-fadein { animation: insp-fadein 0.22s ease both; }
`;

/* ─────────────────────────────────────────────────────
   INPUT STYLE (shared)
───────────────────────────────────────────────────── */
const inp: React.CSSProperties = {
  width: '100%',
  padding: '11px 12px',
  background: 'var(--input-background, var(--muted))',
  border: '1.5px solid var(--border)',
  borderRadius: 8,
  fontSize: 16, /* 16px prevents iOS Safari zoom-on-focus */
  fontWeight: 600,
  color: 'var(--foreground)',
  outline: 'none',
  fontFamily: 'inherit',
  cursor: 'pointer',
};

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export function Inspection() {
  const { t } = useTranslation();
  const { authFetch } = useAuth(); // ✅ hook sirf yahan — component ke andar
  const [searchParams] = useSearchParams();

  const [step,           setStep]           = useState(1);
  const [dir,            setDir]            = useState(1);
  const [trailers,       setTrailers]       = useState<Trailer[]>([]);
  const [trucks,         setTrucks]         = useState<TruckAsset[]>([]);
  const [selectedAsset,  setSelectedAsset]  = useState<SelectedAsset>(null);
  const [loading,        setLoading]        = useState(false);

  // ── Inspector state ──
  const [inspector,       setInspector]       = useState('');
  const [mechanicOptions, setMechanicOptions] = useState<string[]>([]);
  const [loggedInName,    setLoggedInName]    = useState<string | null>(null);
  const [isAdmin,         setIsAdmin]         = useState(false);

  const [dotNumber,      setDotNumber]      = useState('');
  const [vin,            setVin]            = useState('');
  const [submitting,     setSubmitting]     = useState(false);
  const [searchQuery,    setSearchQuery]    = useState('');
  const [showDropdown,   setShowDropdown]   = useState(false);
  const [imageFiles,     setImageFiles]     = useState<File[]>([]);
  const [imagePreviews,  setImagePreviews]  = useState<string[]>([]);
  // 4 mandatory vehicle-side photos: key → { file, preview }
  const [sidePhotos,     setSidePhotos]     = useState<Record<string, { file: File; preview: string }>>({});
  const [activeSec,      setActiveSec]      = useState(0);
  const [sections,       setSections]       = useState<InspectionSection[]>(
    () => JSON.parse(JSON.stringify(TRAILER_SECTIONS))
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef  = useRef<HTMLDivElement>(null);
  const prefillDone  = useRef(false);




 async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onload = (e) => {
      img.src = e.target?.result as string;
    };

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      const MAX_WIDTH = 1280;
      const scale = Math.min(1, MAX_WIDTH / img.width);

      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);

          const compressedFile = new File([blob], file.name, {
            type: "image/jpeg",
          });

          resolve(compressedFile);
        },
        "image/jpeg",
        0.6
      );
    };

    reader.readAsDataURL(file);
  });
}
  useEffect(() => {
    const load = async () => {
      try {
        const { mechanicNames, userName, userRole } = await fetchMechanicsAndUser(authFetch);

       

        setMechanicOptions(mechanicNames);

        const adminFlag = userRole.toLowerCase() === "admin";
        setLoggedInName(userName || null);
        setIsAdmin(adminFlag);

        // ✅ Mechanic auto-select — API se, localStorage se nahi
        if (!adminFlag && userName && mechanicNames.includes(userName)) {
          setInspector(userName);
        }
      } catch (err) {
        console.error("Mechanics/user fetch error:", err);
      }
    };
    load();
  }, [authFetch]); // ✅ dependency

  /* ── ✅ Load trailers + trucks — authFetch se ── */
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchTrailers(authFetch), fetchTrucks(authFetch)])
      .then(([trailerData, truckData]) => {
        const formatted: Trailer[] = trailerData.map(t => ({
          ...t,
          year: Number(t.year),
        }));
        setTrailers(formatted);
        setTrucks(truckData);
      })
      .catch(() => toast.error('Failed to load assets'))
      .finally(() => setLoading(false));
  }, [authFetch]); // ✅ dependency

  /* ── Pre-fill asset from ?asset=<number> (e.g. clicked from a Dashboard
        inspection alert → "Start DOT Inspection"). Runs once, after assets load. ── */
  useEffect(() => {
    if (prefillDone.current) return;
    const assetParam = searchParams.get('asset');
    if (!assetParam) return;
    if (!trailers.length && !trucks.length) return; // wait until assets load
    const norm = (s?: string) => (s ?? '').toString().trim().toLowerCase();
    const tr = trailers.find(t => norm(t.number) === norm(assetParam));
    const tk = trucks.find(t => norm(t.number) === norm(assetParam));
    if (tr)      { prefillDone.current = true; selectAsset({ kind: 'trailer', data: tr }); }
    else if (tk) { prefillDone.current = true; selectAsset({ kind: 'truck',   data: tk }); }
    else         { prefillDone.current = true; setSearchQuery(assetParam); } // no match — at least fill the box
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trailers, trucks, searchParams]);

  /* ── Close dropdown on outside click ── */
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowDropdown(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  function goTo(next: number) { setDir(next > step ? 1 : -1); setStep(next); }

 const filteredResults: SearchResult[] = [
  ...trailers
    .filter(t => (t.number ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
    .map(t => ({ kind: 'trailer' as const, data: t })),
  ...trucks
    .filter(t => (t.number ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
    //           ^^^^^^^^^^^^^^^ undefined safe
    .map(t => ({ kind: 'truck' as const, data: t })),
].slice(0, 10);

  function selectAsset(result: SearchResult) {
    setSelectedAsset(result);
    setSearchQuery(result.data.number);
    setShowDropdown(false);
    setActiveSec(0);
    if (result.kind === 'truck') {
      setSections(JSON.parse(JSON.stringify(TRUCK_SECTIONS)));
      if (result.data.vin) setVin(result.data.vin);
    } else {
      setSections(JSON.parse(JSON.stringify(TRAILER_SECTIONS)));
      if ((result.data as Trailer).vin) setVin((result.data as Trailer).vin!);
    }
  }

  function updateItem(si: number, ii: number, field: 'status' | 'notes' | 'photo', val: string) {
    setSections(prev => prev.map((s, sIdx) =>
      sIdx !== si ? s : {
        ...s,
        items: s.items.map((item, iIdx) =>
          iIdx !== ii ? item : { ...item, [field]: val }
        ),
      }
    ));
  }

  /* ── Inspector field renderer ── */
  function renderInspectorField() {
    // Loading state
    if (mechanicOptions.length === 0) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0', color: 'var(--muted-foreground)', fontSize: 13 }}>
          <Loader2 size={16} className="insp-spin" />
          Loading mechanic list…
        </div>
      );
    }

    // Non-admin whose name is in mechanics list → locked chip
    if (!isAdmin && loggedInName && mechanicOptions.includes(loggedInName)) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px',
          background: 'var(--muted)',
          border: '1.5px solid var(--border)',
          borderRadius: 10,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: C.accentBg, border: `1.5px solid ${C.accentBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 15, color: C.accent, flexShrink: 0,
          }}>
            {loggedInName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--foreground)' }}>{loggedInName}</div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              Mechanic · Auto-selected
            </div>
          </div>
          <span style={{ fontSize: 16 }}>🔒</span>
        </div>
      );
    }

    // Admin → full mechanics dropdown
    if (isAdmin && mechanicOptions.length > 0) {
      return (
        <select
          value={inspector}
          onChange={e => setInspector(e.target.value)}
          style={inp}
          onFocus={e => (e.target.style.borderColor = C.accent)}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
        >
          <option value=''>Select mechanic…</option>
          {mechanicOptions.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      );
    }

    // Non-admin not in list → filtered dropdown (others only)
    if (!isAdmin && mechanicOptions.length > 0) {
      const filtered = loggedInName
        ? mechanicOptions.filter(n => n !== loggedInName)
        : mechanicOptions;
      return (
        <select
          value={inspector}
          onChange={e => setInspector(e.target.value)}
          style={inp}
          onFocus={e => (e.target.style.borderColor = C.accent)}
          onBlur={e  => (e.target.style.borderColor = 'var(--border)')}
        >
          <option value=''>Select mechanic…</option>
          {filtered.map(name => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>
      );
    }

    // Fallback → plain text input
    return (
      <input
        value={inspector}
        onChange={e => setInspector(e.target.value)}
        placeholder='Your full name'
        autoFocus
        style={{
          width: '100%', background: 'transparent', border: 'none',
          borderBottom: '2px solid var(--border)', padding: '4px 0',
          fontSize: 16, fontWeight: 600, color: 'var(--foreground)',
          outline: 'none', fontFamily: 'inherit',
        }}
        onFocus={e => (e.target.style.borderBottomColor = C.accent)}
        onBlur={e  => (e.target.style.borderBottomColor = 'var(--border)')}
      />
    );
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
  const files = Array.from(e.target.files ?? []).filter(f => {
    if (!f.type.startsWith('image/')) {
      toast.error(`${f.name} is not an image`);
      return false;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error(`${f.name} too large`);
      return false;
    }
    return true;
  });

  if (!files.length) return;

  (async () => {
    const compressedFiles: File[] = [];

    for (const file of files) {
      const compressed = await compressImage(file); // 🔥 compression
      compressedFiles.push(compressed);

      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews(prev => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(compressed);
    }

    setImageFiles(prev => [...prev, ...compressedFiles]);
    toast.success(t('inspection.photosAdded', { count: compressedFiles.length }));
  })();

  e.target.value = '';
}

  async function handleSidePhoto(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { toast.error(`${f.name} is not an image`); return; }
    if (f.size > 10 * 1024 * 1024)    { toast.error(`${f.name} too large`); return; }
    const compressed = await compressImage(f);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setSidePhotos(prev => ({ ...prev, [key]: { file: compressed, preview: ev.target?.result as string } }));
    };
    reader.readAsDataURL(compressed);
  }

  const totalItems   = sections.reduce((a, s) => a + s.items.length, 0);
  const doneItems    = sections.reduce((a, s) => a + s.items.filter(i => i.status !== '').length, 0);
  const progress     = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0;
  const allItems     = sections.flatMap(s => s.items);
  const passCount    = allItems.filter(i => i.status === 'pass').length;
  const failCount    = allItems.filter(i => i.status === 'fail').length;
  const skippedCount = allItems.filter(i => i.status === '').length;

  const canNext =
  step === 1 ? !!selectedAsset :
  step === 2 ? !!inspector.trim() :
  step === 3 ? sections.every(s => s.items.every(i => i.status !== '')) :
  step === 4 ? VEHICLE_SIDES.every(s => !!sidePhotos[s.key]) : // all 4 sides required
  true;

  const activeSec_ = sections[activeSec];
  const selNumber  = selectedAsset?.data.number ?? '';

  /* ══════════════════════════════════════════════════
     SUBMIT — ✅ authFetch use karo, fetch nahi
  ══════════════════════════════════════════════════ */
  async function handleSubmit() {
    if (!selectedAsset || !inspector.trim()) return;
    setSubmitting(true);
    try {
      const defects: string[] = [];
      sections.forEach(sec => {
        sec.items.forEach(item => {
          if (item.status === 'fail') defects.push(`${item.label}: ${item.notes || 'Failed'}`);
        });
      });

      const formData = new FormData();
      formData.append("inspection_number", `INS-${Date.now()}`);
      formData.append("asset_id",          selectedAsset.data.id);
      formData.append("asset_type",        selectedAsset.kind);
      formData.append("asset_number",      selectedAsset.data.number);
      formData.append("technician_name",   inspector.trim());
      formData.append("inspection_type",   "DOT Annual");
      formData.append("dot_number",        dotNumber);
      formData.append("vin",               vin);
      formData.append("overall_status",    failCount > 0 ? "failed" : "passed");
      formData.append("defects_found",     defects.join("\n"));
      formData.append("checklist_data",    JSON.stringify(
        allItems.map(i => ({
          id:     i.id     ?? "",
          label:  i.label  ?? "",
          status: i.status ?? "",
          notes:  i.notes  ?? "",
        }))
      ));
      imageFiles.forEach(file => formData.append("images", file));

      // ✅ 4 vehicle-side photos — named so they're identifiable among the
      //    inspection's photo attachments (front / rear / driver-side / passenger-side).
      for (const s of VEHICLE_SIDES) {
        const sp = sidePhotos[s.key];
        if (sp?.file) {
          formData.append("images", new File([sp.file], `${s.key}.jpg`, { type: "image/jpeg" }));
        }
      }

      // ✅ Step 3 checklist item photos (base64 → File + compression).
      // Send photos for BOTH pass AND fail items. Filename prefix indicates
      // intent so the backend can differentiate:
      //   issue-<itemId>.jpg → photo documenting a defect (status=fail)
      //   pass-<itemId>.jpg  → photo proving inspected & OK (status=pass)
      // Backend can also cross-reference item.id with the `sections` JSON
      // payload's status field if it needs the canonical mapping.
      for (const sec of sections) {
        for (const item of sec.items) {
          if (!item.photo || (item.status !== "fail" && item.status !== "pass")) continue;
          try {
            const res = await fetch(item.photo);
            const blob = await res.blob();

            const prefix = item.status === "pass" ? "pass" : "issue";
            let file = new File([blob], `${prefix}-${item.id}.jpg`, {
              type: "image/jpeg",
            });

            // 🔥 compression apply
            file = await compressImage(file);

            formData.append("images", file);
          } catch (e) {
            console.warn(`Photo convert failed for ${item.id}`, e);
          }
        }
      }


      // ✅ authFetch use karo — token automatic lagega, FormData detect hoga
      await submitInspection(authFetch, formData);

      toast.success("Inspection submitted!", {
        description: `${passCount} passed · ${failCount} failed`,
      });

      // Reset
      setSelectedAsset(null); setSearchQuery(''); setInspector('');
      setDotNumber(''); setVin(''); setImageFiles([]); setImagePreviews([]); setSidePhotos({});
      setSections(JSON.parse(JSON.stringify(TRAILER_SECTIONS)));
      setStep(1); setActiveSec(0);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit inspection");
    } finally {
      setSubmitting(false);
    }
  }

  /* ═══════════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════════ */
  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <div className="insp-root mt-4">

        {/* ══ HEADER ══ */}
        <div className="insp-header">
          <div className="insp-header-inner">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ClipboardCheck size={18} color="var(--primary-foreground)" />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--foreground)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('inspection.title')}</div>
                <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>{t('common.step')} {step} / {STEPS.length}</div>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100, border: `1px solid ${C.accentBorder}`, color: C.accent, background: C.accentBg, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {step}/{STEPS.length}
              </div>
            </div>

            {/* Step bar */}
            <div style={{ display: 'flex', gap: 4 }}>
              {STEPS.map(s => {
                const isActive = step === s.id;
                const isDone   = step > s.id;
                return (
                  <div key={s.id} style={{ minWidth: 0, flex: 1, paddingBottom: 10, borderBottom: `1.5px solid ${isActive ? 'var(--foreground)' : isDone ? C.accent : 'var(--border)'}`, fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', textAlign: 'center', whiteSpace: 'nowrap', color: isActive ? 'var(--foreground)' : isDone ? C.accent : 'var(--muted-foreground)', transition: 'all 0.2s' }}>
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ══ SCROLLABLE BODY ══ */}
        <div className="insp-body">
          <div className="insp-body-inner">
            <AnimatePresence mode="wait" custom={dir}>
              <motion.div
                key={step} custom={dir}
                variants={slideVariants}
                initial="enter" animate="center" exit="exit"
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
              >

                {/* ──────── STEP 1: SELECT ASSET ──────── */}
                {step === 1 && (
                  <div style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
                    <PageTitle title="Select Trailer or Truck" sub="Search for the unit to inspect" />

                    <div ref={dropdownRef} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ padding: 10, position: 'relative' }}>
                        <Search size={14} style={{ position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-foreground)', pointerEvents: 'none' }} />
                        <input
                          type="text" value={searchQuery}
                          onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                          onFocus={() => setShowDropdown(true)}
                          onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
                          placeholder="Search trailer or truck…"
                          autoFocus
                          style={{ width: '100%', paddingLeft: 34, paddingRight: 10, paddingTop: 10, paddingBottom: 10, background: 'var(--input-background)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 14, color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit' }}
                        />
                      </div>

                      <AnimatePresence>
                        {showDropdown && filteredResults.length > 0 && (
                          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                            style={{ borderTop: '1px solid var(--border)', maxHeight: 260, overflowY: 'auto' }}>
                            {filteredResults.map((result, i) => {
                              const isTruck = result.kind === 'truck';
                              const sub = isTruck
                                ? `Truck · ${(result.data as TruckAsset).make ?? ''} ${(result.data as TruckAsset).year ?? ''}`.trim()
                                : `Trailer · ${(result.data as Trailer).customerName ?? ''}`.trim();
                              return (
                                <button key={result.data.id} onMouseDown={() => selectAsset(result)}
                                  style={{ width: '100%', textAlign: 'left', padding: '11px 14px', background: 'transparent', border: 'none', borderBottom: i < filteredResults.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', color: 'var(--foreground)', fontFamily: 'inherit' }}
                                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent)')}
                                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                >
                                  <div style={{ width: 32, height: 32, borderRadius: 7, flexShrink: 0, background: isTruck ? 'rgba(234,88,12,0.1)' : C.accentBg, border: `1px solid ${isTruck ? C.orangeBorder : C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <TruckIcon size={14} color={isTruck ? C.orange : C.accent} />
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 600, fontSize: 14 }}>{result.data.number}</span>
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 99, textTransform: 'uppercase', background: isTruck ? 'rgba(234,88,12,0.1)' : C.accentBg, color: isTruck ? C.orange : C.accent, border: `1px solid ${isTruck ? C.orangeBorder : C.accentBorder}` }}>
                                        {isTruck ? 'Truck' : 'Trailer'}
                                      </span>
                                    </div>
                                    {sub && <div style={{ fontSize: 12, color: 'var(--muted-foreground)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
                                  </div>
                                  <ChevronRight size={13} style={{ color: 'var(--muted-foreground)', flexShrink: 0 }} />
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {loading && (
                        <div style={{ padding: '12px 14px', color: 'var(--muted-foreground)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Loader2 size={14} className="insp-spin" /> Loading…
                        </div>
                      )}
                    </div>

                    {selectedAsset && (
                      <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        style={{ background: 'var(--card)', border: `1.5px solid ${C.accent}`, borderRadius: 12, overflow: 'hidden' }}>
                        {selectedAsset.kind === 'truck'
                          ? <TruckCard   truck={selectedAsset.data}   />
                          : <TrailerCard trailer={selectedAsset.data} />
                        }
                      </motion.div>
                    )}
                  </div>
                )}

                {/* ──────── STEP 2: DETAILS ──────── */}
                {step === 2 && (
                  <div style={{ maxWidth: 500, margin: '0 auto', width: '100%' }}>
                    <PageTitle title="Inspection Details" sub="Enter your information" />

                    {selectedAsset && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', marginBottom: 14, borderRadius: 10, background: selectedAsset.kind === 'truck' ? 'rgba(234,88,12,0.08)' : C.accentBg, border: `1.5px solid ${selectedAsset.kind === 'truck' ? C.orangeBorder : C.accentBorder}` }}>
                        <TruckIcon size={14} color={selectedAsset.kind === 'truck' ? C.orange : C.accent} />
                        <span style={{ fontWeight: 700, fontSize: 13, color: selectedAsset.kind === 'truck' ? C.orange : C.accent }}>{selectedAsset.data.number}</span>
                        <span style={{ fontSize: 12, color: 'var(--muted-foreground)' }}>
                          · {selectedAsset.kind === 'truck'
                              ? `Truck (${TRUCK_SECTIONS.reduce((a, s) => a + s.items.length, 0)} items)`
                              : `Trailer (${TRAILER_SECTIONS.reduce((a, s) => a + s.items.length, 0)} items)`}
                        </span>
                      </div>
                    )}

                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                          Technician Name <span style={{ color: C.accent }}>*</span>
                        </label>
                        {renderInspectorField()}
                      </div>

                      {([
                        { label: 'DOT Number', required: false, value: dotNumber, onChange: setDotNumber, placeholder: 'Optional' },
                        { label: 'VIN Number', required: false, value: vin,       onChange: setVin,       placeholder: 'Optional' },
                      ] as { label: string; required: boolean; value: string; onChange: (v: string) => void; placeholder: string }[]).map(({ label, required, value, onChange, placeholder }, i, arr) => (
                        <div key={label} style={{ padding: '14px 16px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                            {label} {required && <span style={{ color: C.accent }}>*</span>}
                          </label>
                          <input
                            type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                            style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid var(--border)', padding: '4px 0', fontSize: 16, fontWeight: 600, color: 'var(--foreground)', outline: 'none', fontFamily: 'inherit' }}
                            onFocus={e => (e.target.style.borderBottomColor = C.accent)}
                            onBlur={e  => (e.target.style.borderBottomColor = 'var(--border)')}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ──────── STEP 3: CHECKLIST ──────── */}
                {step === 3 && (
                  <div style={{ width: '100%' }}>
                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '12px 14px', marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted-foreground)' }}>{doneItems} / {totalItems} checked</span>
                        <span style={{ fontSize: 15, fontWeight: 800, color: C.accent }}>{progress}%</span>
                      </div>
                      <div style={{ height: 7, background: 'var(--muted)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: C.accent, borderRadius: 999, width: `${progress}%`, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* Desktop sidebar */}
                      <div className="insp-sidebar" style={{ flexDirection: 'column', gap: 3, width: 180, flexShrink: 0, background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, padding: 6, position: 'sticky', top: 0, maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' }}>
                        {sections.map((sec, idx) => {
                          const done    = sec.items.filter(i => i.status !== '').length;
                          const hasFail = sec.items.some(i => i.status === 'fail');
                          const allDone = done === sec.items.length;
                          const active  = activeSec === idx;
                          return (
                            <button key={sec.title} onClick={() => setActiveSec(idx)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 9px', borderRadius: 8, width: '100%', cursor: 'pointer', background: active ? C.accent : hasFail ? C.redBg : allDone ? C.greenBg : 'transparent', color: active ? '#fff' : hasFail ? C.red : allDone ? C.green : 'var(--muted-foreground)', border: active ? 'none' : hasFail ? `1px solid ${C.redBorder}` : allDone ? `1px solid ${C.greenBorder}` : 'none', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left', transition: 'all .12s', fontFamily: 'inherit' }}>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{sec.title}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, marginLeft: 6, flexShrink: 0, opacity: 0.75 }}>{done}/{sec.items.length}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Main area */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Mobile section tabs */}
                        <div className="insp-tabs">
                          {sections.map((sec, idx) => {
                            const done    = sec.items.filter(i => i.status !== '').length;
                            const hasFail = sec.items.some(i => i.status === 'fail');
                            const allDone = done === sec.items.length;
                            const active  = activeSec === idx;
                            return (
                              <button key={sec.title} onClick={() => setActiveSec(idx)}
                                style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 8, border: `2px solid ${active ? C.accent : hasFail ? C.redBorder : allDone ? C.greenBorder : 'var(--border)'}`, background: active ? C.accent : hasFail ? C.redBg : allDone ? C.greenBg : 'var(--muted)', color: active ? '#fff' : hasFail ? C.red : allDone ? C.green : 'var(--muted-foreground)', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit', transition: 'all .12s', touchAction: 'manipulation' }}>
                                {sec.title}
                                <span style={{ marginLeft: 4, opacity: 0.65, fontSize: 10 }}>({done}/{sec.items.length})</span>
                              </button>
                            );
                          })}
                        </div>

                        <SectionPanel
                          sec={activeSec_} secIdx={activeSec}
                          onUpdate={updateItem}
                          onPrev={activeSec > 0 ? () => setActiveSec(p => p - 1) : undefined}
                          onNext={activeSec < sections.length - 1 ? () => setActiveSec(p => p + 1) : undefined}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ──────── STEP 4: PHOTOS ──────── */}
                {step === 4 && (
                  <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
                    <PageTitle title="Photos" sub="Capture all 4 vehicle sides, plus any defect photos" />

                    {/* ── 4 mandatory vehicle-side photos ── */}
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                        <span style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--foreground)' }}>Vehicle Photos</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: Object.keys(sidePhotos).length === VEHICLE_SIDES.length ? '#34c759' : C.accent }}>
                          {Object.keys(sidePhotos).length}/{VEHICLE_SIDES.length}
                        </span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                        {VEHICLE_SIDES.map(s => {
                          const sp = sidePhotos[s.key];
                          return (
                            <label key={s.key} style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `1.5px ${sp ? 'solid #34c759' : 'dashed var(--border)'}`, background: sp ? 'var(--muted)' : 'var(--card)', aspectRatio: '4 / 3', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer' }}>
                              <input type="file" accept="image/*" capture="environment" onChange={e => handleSidePhoto(s.key, e)} style={{ display: 'none' }} />
                              {sp ? (
                                <>
                                  <img src={sp.preview} alt={s.label} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                  <div style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', background: '#34c759', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CheckCircle2 size={13} /></div>
                                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '4px 8px', textAlign: 'center' }}>{s.label}</div>
                                </>
                              ) : (
                                <>
                                  <Camera size={22} color={C.accent} />
                                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{s.label}</span>
                                  <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>Tap to capture</span>
                                </>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--foreground)', marginBottom: 9 }}>Other / Defect Photos</div>
                    <button onClick={() => fileInputRef.current?.click()}
                      style={{ width: '100%', border: '1.5px dashed var(--border)', background: 'var(--card)', borderRadius: 12, padding: '2.5rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, cursor: 'pointer', marginBottom: 14, fontFamily: 'inherit', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.background = C.accentBg; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--card)'; }}
                    >
                      <div style={{ width: 52, height: 52, borderRadius: '50%', background: C.accentBg, border: `2px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={24} color={C.accent} />
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 15, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Add Photos</div>
                      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>Tap to select or take a photo</div>
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" onChange={handleImageSelect} style={{ display: 'none' }} />

                    {imagePreviews.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 8 }}>
                        {imagePreviews.map((src, i) => (
                          <div key={i} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)', aspectRatio: '1', background: 'var(--muted)' }}>
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                            <button onClick={() => { setImageFiles(p => p.filter((_, j) => j !== i)); setImagePreviews(p => p.filter((_, j) => j !== i)); }}
                              style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: C.red, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ──────── STEP 5: REVIEW ──────── */}
                {step === 5 && (
                  <div style={{ maxWidth: 600, margin: '0 auto', width: '100%' }}>
                    <PageTitle title="Review & Submit" sub="Verify details before submitting" />

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
                      {[
                        { count: passCount,    label: 'Passed',  bg: C.greenBg,      border: C.greenBorder,   color: C.green },
                        { count: failCount,    label: 'Failed',  bg: C.redBg,        border: C.redBorder,     color: C.red   },
                        { count: skippedCount, label: 'Skipped', bg: 'var(--muted)', border: 'var(--border)', color: C.grey  },
                      ].map(({ count, label, bg, border, color }) => (
                        <div key={label} style={{ background: bg, border: `1.5px solid ${border}`, borderRadius: 12, padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{count}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.12em', marginTop: 4 }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
                      {((): [string, string][] => [
                        [selectedAsset?.kind === 'truck' ? 'Truck' : 'Trailer', selNumber],
                        ['Technician', inspector],
                        ...(dotNumber ? [['DOT #', dotNumber] as [string, string]] : []),
                        ...(vin       ? [['VIN',   vin]        as [string, string]] : []),
                        ['Photos', `${Object.keys(sidePhotos).length}/${VEHICLE_SIDES.length} required · ${imagePreviews.length} other`],
                        ['Date',   new Date().toLocaleDateString()],
                      ])().map(([k, v], i, arr) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '11px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <span style={{ fontSize: 13, color: 'var(--muted-foreground)', fontWeight: 500, flexShrink: 0 }}>{k}</span>
                          <span style={{ fontWeight: 700, color: 'var(--foreground)', fontSize: 14, textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
                        </div>
                      ))}
                    </div>

                    <div style={{ borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10, background: failCount > 0 ? C.redBg : C.greenBg, border: `2px solid ${failCount > 0 ? C.redBorder : C.greenBorder}` }}>
                      {failCount > 0
                        ? <XCircle      size={20} color={C.red}   style={{ flexShrink: 0 }} />
                        : <CheckCircle2 size={20} color={C.green} style={{ flexShrink: 0 }} />
                      }
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 14, color: failCount > 0 ? C.red : C.green }}>
                          {failCount > 0 ? `${failCount} Defect(s) Found` : 'All Items Passed'}
                        </div>
                        <div style={{ fontSize: 12, marginTop: 2, color: failCount > 0 ? '#b91c1c' : '#15803d' }}>
                          {failCount > 0 ? 'Inspection will be marked as FAILED' : 'Inspection will be marked as PASSED'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* ══ FOOTER ══ */}
        <div className="insp-footer">
          <div className="insp-footer-inner">
            {step > 1 ? (
              <button onClick={() => goTo(step - 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 18px', minHeight: 46, borderRadius: 10, border: '1.5px solid var(--border)', background: 'var(--muted)', color: 'var(--muted-foreground)', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>
                <ChevronLeft size={15} /> Back
              </button>
            ) : <div />}

            {step < STEPS.length && (
              <button onClick={() => canNext && goTo(step + 1)} disabled={!canNext}
                style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '10px 22px', minHeight: 46, borderRadius: 10, border: 'none', background: !canNext ? 'var(--muted)' : C.accent, color: !canNext ? 'var(--muted-foreground)' : '#fff', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: !canNext ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: canNext ? `0 4px 14px ${C.accentBorder}` : 'none', touchAction: 'manipulation' }}>
                Next <ChevronRight size={15} />
              </button>
            )}

            {step === STEPS.length && (
              <button onClick={handleSubmit} disabled={submitting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px', minHeight: 46, borderRadius: 10, border: 'none', background: submitting ? 'var(--muted)' : C.green, color: submitting ? 'var(--muted-foreground)' : '#fff', fontWeight: 700, fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit', boxShadow: submitting ? 'none' : `0 4px 14px ${C.greenBorder}`, touchAction: 'manipulation' }}>
                {submitting
                  ? <><Loader2 size={14} className="insp-spin" /> Submitting…</>
                  : <><CheckCircle2 size={14} /> Submit Inspection</>
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
   TRUCK CARD
═══════════════════════════════════════════════════════ */
function TruckCard({ truck }: { truck: TruckAsset }) {
  const insp = truck.inspectionDate;
  const exp  = addMonthsStr(insp, 3);
  const soon = isExpiringSoon(insp);
  const over = isExpired(insp);
  const ec   = over ? C.red    : soon ? C.orange    : C.green;
  const eb   = over ? C.redBg  : soon ? C.orangeBg  : C.greenBg;
  const ebr  = over ? C.redBorder : soon ? C.orangeBorder : C.greenBorder;

  return (
    <div>
      {truck.photo && (
        <div style={{ width: '100%', height: 130, overflow: 'hidden', background: 'var(--muted)' }}>
          <img src={truck.photo} alt="Truck" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
      )}
      <div style={{ padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: 'rgba(234,88,12,0.1)', border: `1px solid ${C.orangeBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TruckIcon size={15} color={C.orange} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.orange, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>Truck · Selected</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--foreground)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{truck.number}</div>
          </div>
          <CheckCircle2 size={19} color={C.accent} style={{ flexShrink: 0 }} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
          {([
            { label: 'Status', value: truck.status || '—', hi: truck.status?.toLowerCase() === 'active' },
            { label: 'Make',   value: truck.make   || '—' },
            { label: 'Year',   value: String(truck.year || '—') },
            { label: 'VIN',    value: truck.vin    || '—' },
            ...(truck.plate ? [{ label: 'Plate', value: truck.plate }] : []),
            ...(truck.owner ? [{ label: 'Owner', value: truck.owner }] : []),
          ] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
            <div key={label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '7px 9px' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
              <div style={{ fontWeight: 700, fontSize: 12, color: hi ? C.green : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ background: eb, border: `1.5px solid ${ebr}`, borderRadius: 9, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
          {(over || soon) ? <AlertCircle size={15} color={ec} style={{ flexShrink: 0 }} /> : <Calendar size={15} color={ec} style={{ flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ec, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {over ? 'Inspection Expired' : soon ? 'Expiring Soon' : 'Inspection Valid'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
              Last: {insp ? new Date(insp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
              {exp && <> · Exp: <span style={{ fontWeight: 700, color: ec }}>{exp}</span></>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   TRAILER CARD
═══════════════════════════════════════════════════════ */
function TrailerCard({ trailer }: { trailer: Trailer }) {
  const insp = trailer.inspectionDate;
  const exp  = addMonthsStr(insp, 3);
  const soon = isExpiringSoon(insp);
  const over = isExpired(insp);
  const ec   = over ? C.red    : soon ? C.orange    : C.green;
  const eb   = over ? C.redBg  : soon ? C.orangeBg  : C.greenBg;
  const ebr  = over ? C.redBorder : soon ? C.orangeBorder : C.greenBorder;

  return (
    <div style={{ padding: '13px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 34, height: 34, borderRadius: 8, flexShrink: 0, background: C.accentBg, border: `1px solid ${C.accentBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TruckIcon size={15} color={C.accent} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.accent, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 1 }}>Trailer · Selected</div>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--foreground)', lineHeight: 1.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trailer.number}</div>
        </div>
        <CheckCircle2 size={19} color={C.accent} style={{ flexShrink: 0 }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 12 }}>
        {([
          { label: 'Status', value: trailer.status || '—', hi: trailer.status?.toLowerCase() === 'active' },
          ...(trailer.customerName ? [{ label: 'Owner', value: trailer.customerName }] : []),
          ...(trailer.plate        ? [{ label: 'Plate', value: trailer.plate }]        : []),
          ...(trailer.vin          ? [{ label: 'VIN',   value: trailer.vin }]          : []),
          ...(trailer.make         ? [{ label: 'Make',  value: trailer.make }]         : []),
          ...(trailer.year         ? [{ label: 'Year',  value: String(trailer.year) }] : []),
        ] as { label: string; value: string; hi?: boolean }[]).map(({ label, value, hi }) => (
          <div key={label} style={{ background: 'var(--muted)', borderRadius: 8, padding: '7px 9px' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontWeight: 700, fontSize: 12, color: hi ? C.green : 'var(--foreground)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ background: eb, border: `1.5px solid ${ebr}`, borderRadius: 9, padding: '9px 11px', display: 'flex', alignItems: 'center', gap: 9 }}>
        {(over || soon) ? <AlertCircle size={15} color={ec} style={{ flexShrink: 0 }} /> : <Calendar size={15} color={ec} style={{ flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: ec, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {over ? 'Inspection Expired' : soon ? 'Expiring Soon' : insp ? 'Inspection Valid' : 'No Inspection Date'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 1 }}>
            Last: {insp ? new Date(insp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
            {exp && <> · Exp: <span style={{ fontWeight: 700, color: ec }}>{exp}</span></>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PAGE TITLE
═══════════════════════════════════════════════════════ */
function PageTitle({ title, sub }: { title: string; sub: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--foreground)', margin: 0 }}>{title}</h2>
      <p style={{ color: 'var(--muted-foreground)', fontSize: 13, margin: '3px 0 0' }}>{sub}</p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   SECTION PANEL
═══════════════════════════════════════════════════════ */
function SectionPanel({ sec, secIdx, onUpdate, onPrev, onNext }: {
  sec: InspectionSection;
  secIdx: number;
  onUpdate: (si: number, ii: number, field: 'status' | 'notes' | 'photo', val: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const { t } = useTranslation();
  const G = '#16a34a'; const GB = '#dcfce7'; const GBR = '#86efac';
  const R = '#dc2626'; const RB = '#fee2e2'; const RBR = '#fca5a5';

  return (
    <motion.div
      key={secIdx}
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      style={{ background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}
    >
      <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)', background: 'var(--muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--foreground)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{sec.title}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted-foreground)' }}>{sec.items.filter(i => i.status !== '').length} / {sec.items.length}</span>
      </div>

      {sec.items.map((item, ii) => (
        <div key={item.id} style={{ padding: '14px', borderBottom: ii < sec.items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ fontWeight: 600, color: 'var(--foreground)', fontSize: 15, marginBottom: 10 }}>{item.label}</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {([
              { val: 'pass', label: '✔  Pass', bg: GB, color: G, border: GBR, activeBg: G, activeColor: '#fff', activeBorder: G },
              { val: 'fail', label: '✘  Fail', bg: RB, color: R, border: RBR, activeBg: R, activeColor: '#fff', activeBorder: R },
            ] as { val: 'pass' | 'fail'; label: string; bg: string; color: string; border: string; activeBg: string; activeColor: string; activeBorder: string }[]).map(btn => {
              const sel = item.status === btn.val;
              return (
                <button key={btn.val} onClick={() => onUpdate(secIdx, ii, 'status', btn.val)}
                  style={{ padding: '13px 8px', minHeight: 52, borderRadius: 10, border: `2px solid ${sel ? btn.activeBorder : btn.border}`, background: sel ? btn.activeBg : btn.bg, color: sel ? btn.activeColor : btn.color, fontWeight: 700, fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', transition: 'all .12s', fontFamily: 'inherit', touchAction: 'manipulation' }}>
                  {btn.label}
                </button>
              );
            })}
          </div>

          <AnimatePresence>
            {/* Notes input — only on FAIL (proof photos for pass don't need a note) */}
            {item.status === 'fail' && (
              <motion.div
                key="notes"
                initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                style={{ overflow: 'hidden' }}
              >
                <input
                  value={item.notes ?? ''}
                  onChange={e => onUpdate(secIdx, ii, 'notes', e.target.value)}
                  placeholder={t('inspection.describeIssue')}
                  style={{ marginTop: 8, width: '100%', padding: '9px 11px', borderRadius: 8, border: `1.5px solid ${RBR}`, background: RB, color: R, fontSize: 16, outline: 'none', fontFamily: 'inherit' }}
                  onFocus={e => (e.target.style.borderColor = R)}
                  onBlur={e  => (e.target.style.borderColor = RBR)}
                />
              </motion.div>
            )}

            {/* Photo upload — shown for BOTH pass and fail.
                Green palette for pass (proof photo), red for fail (issue photo). */}
            {(item.status === 'pass' || item.status === 'fail') && (() => {
              const isPass = item.status === 'pass';
              const COLOR  = isPass ? G   : R;
              const BG     = isPass ? GB  : RB;
              const BORDER = isPass ? GBR : RBR;
              const SOFT_BG = isPass ? '#f8fff8' : '#fff8f8';
              const labelKey = isPass ? 'inspection.uploadProofPhoto' : 'inspection.uploadIssuePhoto';
              return (
                <motion.div
                  key={`photo-${item.status}`}
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  style={{ overflow: 'hidden' }}
                >
                  {!item.photo ? (
                    <label
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 7, padding: '11px 12px', minHeight: 44, border: `1.5px dashed ${BORDER}`, borderRadius: 8, background: SOFT_BG, color: COLOR, fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, touchAction: 'manipulation' }}
                    >
                      <Camera size={14} /> {t(labelKey)}
                      <input
                        type="file" accept="image/*" capture="environment"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = () => onUpdate(secIdx, ii, 'photo', reader.result as string);
                          reader.readAsDataURL(f);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  ) : (
                    <div style={{ marginTop: 7, position: 'relative' }}>
                      <motion.img
                        src={item.photo} alt={isPass ? 'Pass proof' : 'Issue'}
                        initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
                        style={{ width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${BORDER}`, display: 'block', background: BG }}
                      />
                      <button
                        type="button"
                        onClick={() => onUpdate(secIdx, ii, 'photo', '')}
                        aria-label={t('common.delete')}
                        style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: COLOR, color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, touchAction: 'manipulation' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </AnimatePresence>
        </div>
      ))}

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--muted)' }}>
        {onPrev ? (
          <button onClick={onPrev} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 14px', minHeight: 42, borderRadius: 8, background: 'var(--card)', border: '1.5px solid var(--border)', color: 'var(--muted-foreground)', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>
            <ChevronLeft size={14} /> Prev
          </button>
        ) : <div />}
        {onNext && (
          <button onClick={onNext} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '9px 16px', minHeight: 42, borderRadius: 8, background: C.accent, border: 'none', color: '#fff', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.07em', cursor: 'pointer', fontFamily: 'inherit', touchAction: 'manipulation' }}>
            Next <ChevronRight size={14} />
          </button>
        )}
      </div>
    </motion.div>
  );
}