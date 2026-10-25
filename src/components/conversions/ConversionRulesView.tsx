import React, { useState } from 'react';
import {
  Scale,
  Plus,
  Trash2,
  Edit,
  X,
  AlertTriangle,
  Calculator,
  ArrowRight,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { ConversionRule, RawMaterial, StandardUnit } from '../../types/erp';
import { convertUnit, formatQuantity } from '../../utils/units';
import { saveConversionRule, deleteConversionRule } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface ConversionRulesViewProps {
  conversionRules: ConversionRule[];
  rawMaterials: RawMaterial[];
}

const COMMON_UNITS: StandardUnit[] = ['l', 'ml', 'kg', 'g', 'mg', 'ton', 'lbs', 'gal'];

export const ConversionRulesView: React.FC<ConversionRulesViewProps> = ({
  conversionRules,
  rawMaterials,
}) => {
  const { currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ConversionRule | null>(null);

  // Form State
  const [ruleName, setRuleName] = useState('');
  const [materialId, setMaterialId] = useState('');
  const [fromUnit, setFromUnit] = useState<StandardUnit>('l');
  const [toUnit, setToUnit] = useState<StandardUnit>('kg');
  const [factor, setFactor] = useState<number>(1.0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Live Test Calculator state
  const [testAmount, setTestAmount] = useState<number>(10);
  const [testFromUnit, setTestFromUnit] = useState<StandardUnit>('l');
  const [testToUnit, setTestToUnit] = useState<StandardUnit>('kg');
  const [testMaterialId, setTestMaterialId] = useState<string>('');

  const openModal = (rule?: ConversionRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.name);
      setMaterialId(rule.materialId || '');
      setFromUnit(rule.fromUnit);
      setToUnit(rule.toUnit);
      setFactor(rule.factor);
      setNotes(rule.notes || '');
    } else {
      setEditingRule(null);
      setRuleName('');
      setMaterialId('');
      setFromUnit('l');
      setToUnit('kg');
      setFactor(1.05);
      setNotes('Specific gravity density factor');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || factor <= 0) return;

    try {
      setSaving(true);
      const rm = rawMaterials.find((m) => m.id === materialId);
      await saveConversionRule(
        {
          name: ruleName.trim(),
          materialId: materialId || undefined,
          materialName: rm ? rm.name : undefined,
          fromUnit,
          toUnit,
          factor: Number(factor),
          notes: notes.trim() || undefined,
        },
        editingRule?.id,
        currentUser?.email || 'admin'
      );
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving conversion rule:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this conversion rule?')) {
      try {
        await deleteConversionRule(id, currentUser?.email || 'admin');
      } catch (err) {
        console.error('Error deleting rule:', err);
      }
    }
  };

  // Live conversion test
  const testConversionResult = convertUnit(
    testAmount,
    testFromUnit,
    testToUnit,
    testMaterialId || undefined,
    conversionRules
  );

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Unit & Density Conversion Rules</h1>
              <p className="text-xs text-slate-500">
                Convert between weight (kg/g) and liquid volume (L/ml). Formula calculations stay safe using density rules.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs"
        >
          <Plus className="w-4 h-4" />
          <span>Add Density Rule</span>
        </button>
      </div>

      {/* Safety Guard Note */}
      <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-900">
        <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-amber-950 block">Safety Rule:</span>
          <span>
            Units of the same type convert automatically (1 kg = 1,000 g; 1 L = 1,000 ml). Converting weight to liquid volume (e.g., Litres to Kilograms) is only allowed when a density rule is added here.
          </span>
        </div>
      </div>

      {/* Live Density Verification Sandbox */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-blue-600" />
          <span>Live Unit Conversion Calculator</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <label className="block text-slate-600 font-bold mb-1">Raw Material</label>
            <select
              value={testMaterialId}
              onChange={(e) => setTestMaterialId(e.target.value)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
            >
              <option value="">-- Generic / Global Rules --</option>
              {rawMaterials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} [{m.code}]
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-bold mb-1">Input Quantity</label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(Number(e.target.value))}
                className="w-full px-2.5 py-2 font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
              <select
                value={testFromUnit}
                onChange={(e) => setTestFromUnit(e.target.value as StandardUnit)}
                className="w-20 px-1.5 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-600 font-bold mb-1">Target Output Unit</label>
            <select
              value={testToUnit}
              onChange={(e) => setTestToUnit(e.target.value as StandardUnit)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg outline-none"
            >
              {COMMON_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-600 font-bold mb-1">Converted Value</label>
            <div className="px-3 py-2 bg-slate-100 rounded-lg border border-slate-200 font-mono font-bold text-slate-900 flex items-center justify-between">
              <span>{testConversionResult.success ? formatQuantity(testConversionResult.value, 4) : 'Error'}</span>
              <span className="text-slate-500 font-normal">{testToUnit}</span>
            </div>
          </div>
        </div>

        {testConversionResult.explanation && (
          <p className="text-xs text-blue-600 italic">
            {testConversionResult.explanation}
          </p>
        )}
      </div>

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Rule Name</th>
                <th className="py-3 px-3">Linked Material</th>
                <th className="py-3 px-3">From Unit</th>
                <th className="py-3 px-3">To Unit</th>
                <th className="py-3 px-3 text-right">Conversion Multiplier</th>
                <th className="py-3 px-3">Notes</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {conversionRules.map((rule) => (
                <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3 px-4 font-bold text-slate-900 text-xs">{rule.name}</td>
                  <td className="py-3 px-3 text-xs text-slate-700">
                    {rule.materialName || 'Global Rule (All Materials)'}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs uppercase font-semibold text-slate-800">
                    1 {rule.fromUnit}
                  </td>
                  <td className="py-3 px-3 font-mono text-xs uppercase font-semibold text-slate-800">
                    {rule.toUnit}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-xs text-blue-600">
                    {rule.factor}
                  </td>
                  <td className="py-3 px-3 text-xs text-slate-500 max-w-xs truncate">
                    {rule.notes || '-'}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openModal(rule)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingRule ? 'Edit Conversion Rule' : 'New Conversion & Density Rule'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rule Name</label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Glycerin Density (1.26 g/ml)"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Raw Material (Optional)
                </label>
                <select
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                >
                  <option value="">-- Apply to All Materials --</option>
                  {rawMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} [{m.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">1 From Unit</label>
                  <select
                    value={fromUnit}
                    onChange={(e) => setFromUnit(e.target.value as StandardUnit)}
                    className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Factor (=)</label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={factor}
                    onChange={(e) => setFactor(Number(e.target.value))}
                    className="w-full px-2 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
                    placeholder="1.05"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">To Unit</label>
                  <select
                    value={toUnit}
                    onChange={(e) => setToUnit(e.target.value as StandardUnit)}
                    className="w-full px-2 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Laboratory Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Measured at 20°C via hydrometer"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  {saving ? 'Saving...' : 'Save Conversion Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
