import React, { useState } from 'react';
import { 
  Sprout, 
  Shield, 
  LogIn, 
  LogOut, 
  Database, 
  RefreshCw, 
  Menu, 
  X,
  Sparkles,
  Users,
  CheckCircle2,
  CloudUpload
} from 'lucide-react';
import { useAuth, PRESET_WORKERS, WorkerInfo } from '../../context/AuthContext';
import { UserRole } from '../../types/erp';
import { seedAgroFertilizerData, backupToGoogleSheet } from '../../services/db';

interface NavbarProps {
  onToggleSidebar: () => void;
  isSidebarOpen: boolean;
  googleSheetUrl?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, isSidebarOpen, googleSheetUrl }) => {
  const { currentUser, role, switchRole, activeWorker, setActiveWorker, isWorker, signInWithGoogle, logout } = useAuth();
  const [seeding, setSeeding] = useState(false);
  const [seedSuccess, setSeedSuccess] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const handleSeed = async () => {
    try {
      setSeeding(true);
      await seedAgroFertilizerData(currentUser?.email || 'sarangshinde1418@gmail.com');
      setSeedSuccess(true);
      setTimeout(() => setSeedSuccess(false), 3500);
    } catch (err) {
      console.error('Error seeding data:', err);
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickBackup = async () => {
    if (!googleSheetUrl) {
      alert('Please configure Google Apps Script URL in Data & Cloud Backup tab first.');
      return;
    }
    try {
      setBackingUp(true);
      await backupToGoogleSheet(googleSheetUrl, currentUser?.email || 'admin');
      setBackupSuccess(true);
      setTimeout(() => setBackupSuccess(false), 3500);
    } catch (err: any) {
      alert(err.message || 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const rolesList: { id: UserRole; label: string; name: string }[] = [
    { id: 'owner', label: 'Owner', name: 'Manoj Patel (Owner)' },
    { id: 'manager', label: 'Manager', name: 'Rajesh Sharma (Plant Mgr)' },
    { id: 'worker', label: 'Worker', name: `${activeWorker.name} (Worker)` },
  ];

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-2xs">
      <div className="px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
        
        {/* Left: Mobile trigger & Brand */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg lg:hidden"
            aria-label="Toggle navigation"
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-500/20">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 tracking-tight text-base sm:text-lg">
                  AgroFactory <span className="text-emerald-600 font-extrabold">ERP</span>
                </span>
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                  Fertilizer Line Active
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden md:block">
                Factory Inventory, Auto-Deduct Production & Sales Manager
              </p>
            </div>
          </div>
        </div>

        {/* Right: Actions, Role Switcher & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Quick Seed Button */}
          <button
            onClick={handleSeed}
            disabled={seeding}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
              seedSuccess
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
            }`}
            title="Load 18 Agro Products, formulas, packaging and worker data"
          >
            {seeding ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : seedSuccess ? (
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Database className="w-3.5 h-3.5 text-slate-500" />
            )}
            <span className="hidden sm:inline">
              {seedSuccess ? '18 Products Loaded!' : seeding ? 'Loading Data...' : 'Load Agro Demo'}
            </span>
          </button>

          {/* Quick Google Sheet Backup Button if configured */}
          {googleSheetUrl && (
            <button
              onClick={handleQuickBackup}
              disabled={backingUp}
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                backupSuccess
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                  : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
              title="Backup database snapshot to Google Sheet"
            >
              {backingUp ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-600" />
              ) : backupSuccess ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <CloudUpload className="w-3.5 h-3.5 text-slate-500" />
              )}
              <span>{backupSuccess ? 'Backed up!' : backingUp ? 'Backing up...' : 'Sheet Backup'}</span>
            </button>
          )}

          {/* Role Switcher Pill */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 pl-1 hidden lg:inline">
              Role:
            </span>
            <select
              value={role}
              onChange={(e) => switchRole(e.target.value as UserRole)}
              className="bg-white border-0 text-xs font-bold text-slate-800 rounded shadow-2xs py-1 px-2 cursor-pointer focus:ring-1 focus:ring-emerald-500 outline-none"
              title="Switch role between Owner, Manager, and Worker"
            >
              {rolesList.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* If Worker role is active, choose worker name */}
          {isWorker && (
            <div className="hidden sm:flex items-center gap-1 bg-emerald-50 border border-emerald-200 p-1 rounded-lg">
              <Users className="w-3.5 h-3.5 text-emerald-700 ml-1" />
              <select
                value={activeWorker.id}
                onChange={(e) => {
                  const w = PRESET_WORKERS.find((x) => x.id === e.target.value);
                  if (w) setActiveWorker(w);
                }}
                className="bg-transparent border-0 text-xs font-bold text-emerald-900 cursor-pointer outline-none"
              >
                {PRESET_WORKERS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* User & Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-2">
              <div className="hidden xl:flex flex-col text-right">
                <span className="text-xs font-semibold text-slate-900 leading-tight">
                  {role === 'owner' ? 'Manoj Patel' : role === 'manager' ? 'Rajesh Sharma' : activeWorker.name}
                </span>
                <span className="text-[10px] text-emerald-600 font-bold uppercase">
                  {role}
                </span>
              </div>
              <button
                onClick={logout}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg shadow-2xs transition-all"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-600" />
              <span>Login</span>
            </button>
          )}

        </div>
      </div>
    </header>
  );
};
