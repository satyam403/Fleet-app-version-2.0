import { lazy, Suspense, type ReactNode } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";

// Login & Register stay eager — they're tiny and we want zero-latency auth.
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";

// Everything else is lazy so the initial bundle on a 4G phone doesn't have to
// parse Dashboard + WorkOrders + Inspections (each ~tens of thousands of
// lines) before showing the login page or any individual screen.
const Dashboard          = lazy(() => import("./pages/Dashboard").then(m => ({ default: m.Dashboard })));
const Inspection         = lazy(() => import("./pages/InspectionDOT").then(m => ({ default: m.Inspection })));
const Inspectionself     = lazy(() => import("./pages/Inspection").then(m => ({ default: m.Inspectionself })));
const WorkOrders         = lazy(() => import("./pages/WorkOrders").then(m => ({ default: m.WorkOrders })));
const Inventory          = lazy(() => import("./pages/Inventory").then(m => ({ default: m.Inventory })));
const Settings           = lazy(() => import("./pages/Settings").then(m => ({ default: m.Settings })));
//const Geofencing         = lazy(() => import("./pages/Geofencing").then(m => ({ default: m.Geofencing })));
const PurchaseOrder      = lazy(() => import("./pages/BillsandReceipt").then(m => ({ default: m.PurchaseOrder })));
const NotFound           = lazy(() => import("./pages/NotFound").then(m => ({ default: m.NotFound })));
const WorkOrderComplete  = lazy(() => import("./pages/workordercomplete").then(m => ({ default: m.WorkOrderComplete })));
const Timesheet          = lazy(() => import("./pages/timesheet"));
const ReportsPage        = lazy(() => import("./pages/report"));

/** Lightweight fallback shown while a chunk is downloading. Matches the
 *  ProtectedRoute hydration spinner so the visual experience is consistent. */
function RouteFallback() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "3px solid rgba(0,0,0,0.08)",
          borderTopColor: "#1d1d1f",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const lazyEl = (node: ReactNode) => <Suspense fallback={<RouteFallback />}>{node}</Suspense>;

export const router = createBrowserRouter([
  { path: "/login",    Component: Login },
  { path: "/register", Component: Register },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
    children: [






      { index: true,                   element: lazyEl(<Dashboard />) },
      { path: "inspection",            element: lazyEl(<Inspection />) },
      { path: "inspection-self",       element: lazyEl(<Inspectionself />) },
      { path: "purchase-order",        element: lazyEl(<PurchaseOrder />) },
      { path: "work-orders",           element: lazyEl(<WorkOrders />) },
      { path: "complete-work-order",   element: lazyEl(<WorkOrderComplete />) },
      { path: "inventory",             element: lazyEl(<Inventory />) },
      { path: "settings",              element: lazyEl(<Settings />) },
      { path: "timesheet",             element: lazyEl(<Timesheet />) },
      { path: "reports",               element: lazyEl(<ReportsPage />) },

      /* ─── Legacy paths — redirect to clean URLs ─── */
      { path: "Inspectionself",        element: <Navigate to="/inspection-self"      replace /> },
      { path: "Geofancing",            element: <Navigate to="/geofencing"           replace /> },
      { path: "PurchaseOrder",         element: <Navigate to="/purchase-order"       replace /> },
      { path: "completeworkOrder",     element: <Navigate to="/complete-work-order"  replace /> },

      { path: "*", element: lazyEl(<NotFound />) },
    ],
  },
]);
