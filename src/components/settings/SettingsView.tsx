import React, { useState } from 'react';
import {
  Settings,
  Save,
  Shield,
  Building2,
  DollarSign,
  AlertTriangle,
  Mail,
  Phone,
  MapPin,
  History,
  CheckCircle2,
} from 'lucide-react';
import { FactorySettings, AuditLog } from '../../types/erp';
import { saveSettings } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface SettingsViewProps {
  settings: FactorySettings;
  auditLogs: AuditLog[];
}

export const SettingsView: React.FC<SettingsViewProps> = ({ settings, auditLogs }) => {
  const { currentUser, role, canManageSettings } = useAuth();

  const [companyName, setCompanyName] = useState(settings.companyName || 'Apex Industrial Formulations Ltd.');
  const [companyTagline, setCompanyTagline] = useState(settings.companyTagline || '');
  const [currency, setCurrency] = useState(settings.currency || '$');
  const [address, setAddress] = useState(settings.address || '');
  const [phone, setPhone] = useState(settings.phone || '');
  const [email, setEmail] = useState(settings.email || '');
  const [lowStockThresholdDefault, setLowStockThresholdDefault] = useState<number>(
    settings.lowStockThresholdDefault || 200
  );
  const [allowNegativeStock, setAllowNegativeStock] = useState<boolean>(
    settings.allowNegativeStock || false
  );
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageSettings) return;

    try {
      setSaving(true);
      await saveSettings(
        {
          ...settings,
          companyName,
          companyTagline,
          currency,
          address,
          phone,
          email,
          lowStockThresholdDefault: Number(lowStockThresholdDefault),
          allowNegativeStock,
        },
        currentUser?.email || 'admin'
      );
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Factory System Settings</h1>
              <p className="text-xs text-slate-500">
                Configure plant parameters, currency, stock policies, and inspect audit activity logs.
              </p>
            </div>
          </div>
        </div>

        {savedSuccess && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-semibold rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings Saved!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Settings Form */}
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
          <form onSubmit={handleSave} className="space-y-4">
            
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Company & Facility Identity</h3>
              <p className="text-xs text-slate-500">Appears on batch production records and reports.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Company / Plant Name</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tagline / Industry Subtitle</label>
                <input
                  type="text"
                  value={companyTagline}
                  onChange={(e) => setCompanyTagline(e.target.value)}
                  disabled={!canManageSettings}
                  placeholder="Precision Chemical & FMCG Manufacturing"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Primary Plant Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Plant Contact Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Physical Plant Address</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                disabled={!canManageSettings}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div className="border-b border-slate-200 pt-3 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Inventory & Accounting Policies</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Operating Currency Symbol</label>
                <input
                  type="text"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  placeholder="$"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Default Low-Stock Threshold
                </label>
                <input
                  type="number"
                  min="0"
                  value={lowStockThresholdDefault}
                  onChange={(e) => setLowStockThresholdDefault(Number(e.target.value))}
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowNegativeStock}
                  onChange={(e) => setAllowNegativeStock(e.target.checked)}
                  disabled={!canManageSettings}
                  className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    Allow Negative Inventory Movements
                  </span>
                  <span className="text-[11px] text-slate-500 leading-normal block">
                    When disabled (recommended), the system rejects any transaction that would result in less than 0 stock.
                  </span>
                </div>
              </label>
            </div>

            {canManageSettings ? (
              <div className="flex justify-end pt-4 border-t border-slate-200">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded border border-amber-200">
                Only Admin users can modify factory configuration settings.
              </p>
            )}
          </form>
        </div>

        {/* Roles & Audit Log summary */}
        <div className="space-y-4">
          
          {/* Role Access Matrix */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-blue-600" />
              <span>RBAC Permission Hierarchy</span>
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900">Admin</div>
                <div className="text-[11px] text-slate-500">
                  Full control: system settings, user roles, formulas, batches, all inventories.
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900">Plant Manager</div>
                <div className="text-[11px] text-slate-500">
                  Approve master formulas, approve production batches, QA inspection approval.
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900">Storekeeper</div>
                <div className="text-[11px] text-slate-500">
                  Manage raw materials, packaging receipts, issue materials to batches.
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <div className="font-bold text-slate-900">Machine Operator</div>
                <div className="text-[11px] text-slate-500">
                  Execute active batches, log physical output, view formulation cards.
                </div>
              </div>
            </div>
          </div>

          {/* Recent Audit Logs */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <History className="w-4 h-4 text-slate-600" />
              <span>System Audit Trail</span>
            </h3>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {auditLogs.slice(0, 8).map((log) => (
                <div key={log.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-[11px]">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="font-bold text-slate-700 uppercase font-mono">{log.action}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-slate-800 font-medium mt-0.5">{log.details}</div>
                  <div className="text-slate-400 text-[10px] mt-0.5">By {log.performedBy}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
