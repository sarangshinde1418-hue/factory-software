import React, { useState } from 'react';
import { X, Save, AlertCircle } from 'lucide-react';
import { RawMaterial, PhysicalForm, StandardUnit, Supplier } from '../../types/erp';
import { saveRawMaterial } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface RawMaterialModalProps {
  material?: RawMaterial | null;
  suppliers: Supplier[];
  onClose: () => void;
  onSuccess: (id: string) => void;
  currency?: string;
}

const PHYSICAL_FORMS: PhysicalForm[] = [
  'liquid',
  'powder',
  'granules',
  'chemical',
  'paste',
  'solid',
  'custom',
];

const COMMON_UNITS: StandardUnit[] = [
  'kg',
  'g',
  'mg',
  'l',
  'ml',
  'pieces',
  'bags',
  'drums',
  'buckets',
];

export const RawMaterialModal: React.FC<RawMaterialModalProps> = ({
  material,
  suppliers,
  onClose,
  onSuccess,
  currency = '$',
}) => {
  const { currentUser } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [code, setCode] = useState(material?.code || `RM-${Math.floor(100 + Math.random() * 900)}`);
  const [name, setName] = useState(material?.name || '');
  const [category, setCategory] = useState(material?.category || 'Active Ingredient');
  const [physicalForm, setPhysicalForm] = useState<PhysicalForm>(material?.physicalForm || 'liquid');
  const [unit, setUnit] = useState<StandardUnit>(material?.unit || 'kg');
  const [openingStock, setOpeningStock] = useState<number>(material?.openingStock || 0);
  const [currentStock, setCurrentStock] = useState<number>(material?.currentStock || 0);
  const [minimumStock, setMinimumStock] = useState<number>(material?.minimumStock || 100);
  const [unitCost, setUnitCost] = useState<number>(material?.unitCost || 0);
  const [supplierId, setSupplierId] = useState(material?.supplierId || '');
  const [lotNumber, setLotNumber] = useState(material?.lotNumber || '');
  const [mfgDate, setMfgDate] = useState(material?.mfgDate || '');
  const [expiryDate, setExpiryDate] = useState(material?.expiryDate || '');
  const [location, setLocation] = useState(material?.location || 'Warehouse A');
  const [notes, setNotes] = useState(material?.notes || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Material Name is required.');
      return;
    }
    if (!code.trim()) {
      setError('Material Code is required.');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const supplierObj = suppliers.find((s) => s.id === supplierId);

      const payload = {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        category: category.trim(),
        physicalForm,
        unit,
        openingStock: Number(openingStock) || 0,
        currentStock: material ? Number(currentStock) : Number(openingStock) || 0,
        minimumStock: Number(minimumStock) || 0,
        unitCost: Number(unitCost) || 0,
        supplierId: supplierId || undefined,
        supplierName: supplierObj?.name,
        lotNumber: lotNumber.trim() || undefined,
        mfgDate: mfgDate || undefined,
        expiryDate: expiryDate || undefined,
        location: location.trim() || undefined,
        notes: notes.trim() || undefined,
        status: material?.status || 'active',
      };

      const id = await saveRawMaterial(payload, material?.id, currentUser?.email || 'admin');
      onSuccess(id);
    } catch (err: any) {
      console.error('Error saving raw material:', err);
      setError(err.message || 'Failed to save raw material.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <h2 className="text-base font-bold text-slate-900">
            {material ? `Edit Material: ${material.name}` : 'Add New Raw Material'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Material Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sodium Laureth Sulfate 70%"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Material Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. RM-001"
                className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Surfactant, Solvent, Preservative, Fragrance..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Physical Form
              </label>
              <select
                value={physicalForm}
                onChange={(e) => setPhysicalForm(e.target.value as PhysicalForm)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none capitalize"
              >
                {PHYSICAL_FORMS.map((form) => (
                  <option key={form} value={form}>
                    {form}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Measurement Unit <span className="text-rose-500">*</span>
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as StandardUnit)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Purchase Price per Unit ({currency})
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={unitCost}
                onChange={(e) => setUnitCost(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="0.00"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                {material ? 'Current Warehouse Stock' : 'Opening Stock'}
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={material ? currentStock : openingStock}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (material) setCurrentStock(val);
                  else setOpeningStock(val);
                }}
                className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Measured in {unit}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Minimum Stock Alert Level
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Warn me when stock drops below this amount
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Supplier
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Lot / Batch Number
              </label>
              <input
                type="text"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                placeholder="e.g. SLES-70-2026-B"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Manufacturing Date
              </label>
              <input
                type="date"
                value={mfgDate}
                onChange={(e) => setMfgDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Storage Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Warehouse A - Bay 2 - Pallet 14"
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
              Material Notes & Safety Handling
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Keep tightly sealed, avoid direct sunlight, ambient storage 15-25°C."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : material ? 'Update Material' : 'Save Material'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
