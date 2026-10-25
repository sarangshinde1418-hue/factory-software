import React from 'react';
import {
  LayoutDashboard,
  FlaskConical,
  Package,
  Boxes,
  Beaker,
  Cog,
  Truck,
  CheckSquare,
  Users,
  Warehouse,
  BarChart3,
  Database,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab =
  | 'dashboard'
  | 'raw_materials'
  | 'packing_material'
  | 'products'
  | 'formulas'
  | 'production'
  | 'outgoing'
  | 'tasks'
  | 'attendance'
  | 'finished_goods'
  | 'reports'
  | 'backup';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  isOpen: boolean;
  onClose: () => void;
  lowStockCount?: number;
  pendingTaskCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpen,
  onClose,
  lowStockCount = 0,
  pendingTaskCount = 0,
}) => {
  const { role, isOwner, isManager, isWorker } = useAuth();

  const navItems: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
    roleRequired?: ('owner' | 'manager' | 'worker')[];
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'raw_materials',
      label: 'Raw Materials',
      icon: FlaskConical,
      badge: lowStockCount > 0 ? lowStockCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
    },
    {
      id: 'packing_material',
      label: 'Packing Materials',
      icon: Package,
    },
    {
      id: 'products',
      label: 'Products (18 Catalog)',
      icon: Boxes,
    },
    {
      id: 'formulas',
      label: 'Formula Engine',
      icon: Beaker,
      roleRequired: ['owner', 'manager'],
    },
    {
      id: 'production',
      label: 'Production Entry',
      icon: Cog,
    },
    {
      id: 'outgoing',
      label: 'Outgoing / Sales',
      icon: Truck,
    },
    {
      id: 'tasks',
      label: 'Tasks & Work Orders',
      icon: CheckSquare,
      badge: pendingTaskCount > 0 ? pendingTaskCount : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    {
      id: 'attendance',
      label: 'Worker Attendance',
      icon: Users,
    },
    {
      id: 'finished_goods',
      label: 'Finished Goods Stock',
      icon: Warehouse,
    },
    {
      id: 'reports',
      label: 'Sales & Inventory Reports',
      icon: BarChart3,
      roleRequired: ['owner', 'manager'],
    },
    {
      id: 'backup',
      label: 'Data & Cloud Backup',
      icon: Database,
    },
  ];

  const visibleItems = navItems.filter((item) => {
    if (!item.roleRequired) return true;
    return item.roleRequired.includes(role);
  });

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      <aside
        className={`fixed lg:static top-16 bottom-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 flex flex-col border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-3">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
            <span>Factory Menu</span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                isOwner
                  ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                  : isManager
                  ? 'bg-blue-500/20 text-blue-300 border-blue-400/30'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
              }`}
            >
              {role} Mode
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  onClose();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all text-left ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-xs font-bold'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-white' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>

                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${item.badgeColor}`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500">
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-slate-400 text-[11px]">Agro-Fertilizer ERP</span>
            <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-1.5 py-0.2 rounded font-mono">
              v2.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Auto-deducts stock per formula, box packaging rules & daily work logs.
          </p>
        </div>
      </aside>
    </>
  );
};
