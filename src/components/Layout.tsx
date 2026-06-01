import { Outlet, NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, 
  ClipboardCheck, 
  FileText, 
  Package,
  Boxes,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  Globe,
  List
} from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useState } from 'react';

import {ClockInOut} from "./ClockInOut"

import "./layout.css"

export function Layout() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { path: '/',                      label: t('nav.dashboard'),                       icon: LayoutDashboard, end: true },
    { path: '/inspection',            label: t('nav.inspection'),                      icon: ClipboardCheck },
    { path: '/inspection-self',       label: t('Inspectionself'),                      icon: ClipboardCheck },
    { path: '/work-orders',           label: t('nav.workOrders'),                      icon: FileText },
    { path: '/complete-work-order',   label: t('Complete Work Order'),                 icon: FileText },
    { path: '/inventory',             label: t('nav.inventory'),                       icon: Package },
    { path: '/inventory-management',  label: t('nav.inventoryManagement'),             icon: Boxes },
    { path: '/purchase-order',        label: t('PurchaseOrder'),                       icon: List },
   // { path: '/geofencing',            label: t('Geofencing', { defaultValue: 'Geofencing' }), icon: Globe },
    { path: '/timesheet',             label: t('Timesheet'),                           icon: List },
    { path: '/reports',               label: t('Reports'),                             icon: FileText },
    { path: '/settings',              label: t('nav.settings'),                        icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Mobile sidebar backdrop (single overlay; lock body scroll while open) */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
        aria-hidden={!sidebarOpen ? undefined : false}
      >
        
        {/* Logo Section */}
        <div className="sidebar-logo">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <h1>{t("app.name")}</h1>
              <p>{t("app.tagline")}</p>
            </div>

            {/* Close button (mobile only) */}
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#fff",
                cursor: "pointer",
                display: "block",
              }}
              className="sidebar-close-btn"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* User Section */}
        {user && (
          <div className="sidebar-user">
            <div className="user-card">
              <div className="user-avatar">
                <User size={18} />
              </div>
              <div>
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                isActive ? "sidebar-link active" : "sidebar-link"
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="sidebar-footer">
          © 2026 FleetOps
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-3 sm:px-6 py-2 sm:py-3 flex items-center gap-2 sticky top-0 z-30 topbar-safe">
          <button
            type="button"
            aria-label={t('nav.openMenu', 'Open menu')}
            className="lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-700 hover:bg-gray-100 active:bg-gray-200 transition -ml-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <div className="flex-1 min-w-0" />

          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <ClockInOut />
            <LanguageSwitcher />

            {user && (
              <button
                onClick={logout}
                aria-label={t('auth.logout')}
                className="inline-flex items-center justify-center
                           w-11 h-11 sm:w-auto sm:h-auto
                           sm:px-4 sm:py-2
                           rounded-lg
                           border border-red-500
                           text-red-600
                           hover:bg-red-500 hover:text-white
                           active:bg-red-600 active:text-white
                           transition-all duration-200"
              >
                <LogOut className="w-5 h-5" />
                <span className="hidden sm:inline ml-2">
                  {t('auth.logout')}
                </span>
              </button>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-3 overflow-auto pb-safe">
          <Outlet />
        </main>
      </div>
    </div>
  );
}