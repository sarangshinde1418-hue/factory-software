import React, { useState } from 'react';
import {
  Cog,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Package,
  Layers,
  Calendar,
  User,
  Search,
  FileDown,
  Sparkles,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  Product,
  Formula,
  RawMaterial,
  PackagingMaterial,
  ProductionLog,
} from '../../types/erp';
import { formatQuantity } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { recordProductionEntry } from '../../services/db';
import { useAuth, PRESET_WORKERS } from '../../context/AuthContext';

interface ProductionViewProps {
  products: Product[];
  formulas: Formula[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  productionLogs: ProductionLog[];
  initialSelectedProduct?: Product | null;
}

export const ProductionView: React.FC<ProductionViewProps> = ({
  products,
  formulas,
  rawMaterials,
  packagingMaterials,
  productionLogs,
  initialSelectedProduct,
}) => {
  const { userProfile, activeWorker } = useAuth();

  // Production Form State
  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialSelectedProduct?.id || products[0]?.id || ''
  );
  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const [selectedPackSize, setSelectedPackSize] = useState<string>(
    selectedProduct?.packSizes[0] || '1L'
  );
  const [numberOfBoxes, setNumberOfBoxes] = useState<number>(50);
  const [batchNumber, setBatchNumber] = useState<string>(() => {
    const ym = new Date().toISOString().slice(2, 7).replace('-', '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `BATCH-${ym}-${rand}`;
  });
  const [batchDate, setBatchDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedOperatorId, setSelectedOperatorId] = useState<string>(activeWorker.id);
  const [notes, setNotes] = useState<string>('Standard production run');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Search in production logs
  const [searchTerm, setSearchTerm] = useState('');

  // Find corresponding formula
  const activeFormula = formulas.find(
    (f) => f.productId === selectedProductId && (f.packSize === selectedPackSize || f.packSize === 'Standard')
  ) || formulas.find((f) => f.productId === selectedProductId);

  // Calculate box units and required quantities
  const boxRule = selectedProduct?.boxRules?.find((r) => r.packSize === selectedPackSize);
  const unitsPerBox = boxRule ? boxRule.unitsPerBox : 1;
  const totalUnitsCalculated = numberOfBoxes * unitsPerBox;

  // Real-time stock check for Raw Materials
  const rawCheck = (activeFormula?.ingredients || []).map((ing) => {
    const rm = rawMaterials.find((m) => m.id === ing.rawMaterialId);
    const available = rm ? rm.currentStock : 0;
    const required = ing.quantity * numberOfBoxes;
    const isSufficient = available >= required;
    const shortage = isSufficient ? 0 : required - available;

    return {
      name: ing.materialName,
      unit: ing.unit,
      available,
      required,
      isSufficient,
      shortage,
    };
  });

  // Real-time stock check for Packaging
  const pkgCheck = (activeFormula?.packagingComponents || []).map((pkg) => {
    const pm = packagingMaterials.find((m) => m.id === pkg.packagingMaterialId);
    const available = pm ? pm.currentStock : 0;
    const required = pkg.quantityPerUnitOrBox * numberOfBoxes;
    const isSufficient = available >= required;
    const shortage = isSufficient ? 0 : required - available;

    return {
      name: pkg.materialName,
      unit: pkg.unit,
      available,
      required,
      isSufficient,
      shortage,
    };
  });

  const totalRawShortages = rawCheck.filter((r) => !r.isSufficient).length;
  const totalPkgShortages = pkgCheck.filter((p) => !p.isSufficient).length;
  const hasInsufficientStock = totalRawShortages > 0 || totalPkgShortages > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !selectedPackSize || numberOfBoxes <= 0) return;

    if (!activeFormula) {
      setStatusMessage({
        type: 'error',
        text: `No active formula exists for ${selectedProduct?.name} (${selectedPackSize}). Please create a formula first.`,
      });
      return;
    }

    if (hasInsufficientStock) {
      setStatusMessage({
        type: 'error',
        text: `Cannot proceed! Insufficient stock detected for ${totalRawShortages + totalPkgShortages} items. Production is blocked to protect inventory integrity.`,
      });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);

      const op = PRESET_WORKERS.find((w) => w.id === selectedOperatorId);

      await recordProductionEntry({
        productId: selectedProductId,
        packSize: selectedPackSize,
        numberOfBoxes,
        batchNumber,
        batchDate,
        operatorId: selectedOperatorId,
        operatorName: op ? op.name : activeWorker.name,
        notes,
        userEmail: userProfile?.email || 'admin',
        userName: userProfile?.displayName || 'Worker',
      });

      setStatusMessage({
        type: 'success',
        text: `Production Batch ${batchNumber} successfully recorded! ${numberOfBoxes} boxes (${totalUnitsCalculated} units) added to Finished Goods. Raw and packing materials were auto-deducted.`,
      });

      // Regenerate new batch number
      const ym = new Date().toISOString().slice(2, 7).replace('-', '');
      const rand = Math.floor(100 + Math.random() * 900);
      setBatchNumber(`BATCH-${ym}-${rand}`);
    } catch (err: any) {
      console.error('Production entry error:', err);
      setStatusMessage({
        type: 'error',
        text: err.message || 'Production entry failed',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Filter logs
  const filteredLogs = productionLogs.filter((log) => {
    const matchesSearch =
      log.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.packSize.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.operatorName && log.operatorName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Batch Number',
      'Product Name',
      'Pack Size',
      'Boxes Produced',
      'Total Units',
      'Operator',
      'Raw Materials Deducted',
      'Packaging Deducted',
      'Notes',
    ];
    const rows = filteredLogs.map((l) => [
      l.batchDate,
      l.batchNumber,
      l.productName,
      l.packSize,
      l.numberOfBoxes,
      l.totalUnits,
      l.operatorName || '',
      l.rawMaterialsDeducted.map((r) => `${r.materialName}: ${r.quantityDeducted} ${r.unit}`).join('; '),
      l.packagingMaterialsDeducted.map((p) => `${p.materialName}: ${p.quantityDeducted} ${p.unit}`).join('; '),
      l.notes || '',
    ]);
    exportToCSV('Agro_Production_Batches_Log', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Cog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Production Entry & Auto-Deduct</h1>
              <p className="text-xs text-slate-500">
                Produce boxes/units. The app validates inventory, blocks entry if stock is low, and auto-deducts materials.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleExportCSV}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
        >
          <FileDown className="w-4 h-4 text-slate-500" />
          <span>Export Production Log CSV</span>
        </button>
      </div>

      {statusMessage && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center gap-2.5 border ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : 'bg-rose-50 text-rose-900 border-rose-300'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Production Entry Form */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="border-b border-slate-200 pb-3">
          <h2 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
            <span>New Production Entry</span>
            <span className="text-xs font-normal text-slate-500">
              (Auto-Deducts Raw Materials + Packing Material per Formula)
            </span>
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            
            {/* 1. Product */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Select Product <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  setSelectedProductId(e.target.value);
                  const p = products.find((x) => x.id === e.target.value);
                  if (p && p.packSizes.length > 0) setSelectedPackSize(p.packSizes[0]);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.code}]
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Pack Size */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Pack Size <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedPackSize}
                onChange={(e) => setSelectedPackSize(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500"
              >
                {selectedProduct?.packSizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Number of Boxes / Units */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Number of Boxes <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1"
                  required
                  value={numberOfBoxes}
                  onChange={(e) => setNumberOfBoxes(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-500 whitespace-nowrap font-mono">
                  = {totalUnitsCalculated} units
                </span>
              </div>
            </div>

            {/* 4. Batch Number */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Batch Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Batch Date
              </label>
              <input
                type="date"
                required
                value={batchDate}
                onChange={(e) => setBatchDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Machine Operator / Worker
              </label>
              <select
                value={selectedOperatorId}
                onChange={(e) => setSelectedOperatorId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium"
              >
                {PRESET_WORKERS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({w.role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Production Notes
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Shift 1, reactor line 2, quality approved"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>
          </div>

          {/* REAL-TIME PREVIEW OF AUTO-DEDUCTIONS & STOCK CHECK */}
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Real-Time Material Stock Verification ({numberOfBoxes} boxes)
              </span>

              {hasInsufficientStock ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1 animate-pulse">
                  <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                  <span>Insufficient Stock ({totalRawShortages + totalPkgShortages} items low) — BLOCKED</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>All Materials In Stock — Ready to Produce</span>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 text-xs">
              
              {/* Raw Materials Check */}
              <div className="p-4 space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Raw Materials to Deduct</span>
                </span>
                {rawCheck.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No formula found</span>
                ) : (
                  <div className="space-y-1.5">
                    {rawCheck.map((r, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded border flex items-center justify-between font-mono ${
                          r.isSufficient
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-rose-50 border-rose-300 text-rose-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">{r.name}</span>
                          <span className="text-[10px] text-slate-500">
                            Available: {formatQuantity(r.available)} {r.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs">
                            -{formatQuantity(r.required)} {r.unit}
                          </span>
                          {!r.isSufficient && (
                            <span className="block text-[10px] text-rose-600 font-bold uppercase">
                              Short by {formatQuantity(r.shortage)} {r.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Packaging Check */}
              <div className="p-4 space-y-2">
                <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Packing Items to Deduct</span>
                </span>
                {pkgCheck.length === 0 ? (
                  <span className="text-xs text-slate-400 italic">No packaging formula</span>
                ) : (
                  <div className="space-y-1.5">
                    {pkgCheck.map((p, i) => (
                      <div
                        key={i}
                        className={`p-2 rounded border flex items-center justify-between font-mono ${
                          p.isSufficient
                            ? 'bg-slate-50 border-slate-200 text-slate-700'
                            : 'bg-rose-50 border-rose-300 text-rose-800'
                        }`}
                      >
                        <div>
                          <span className="font-bold block">{p.name}</span>
                          <span className="text-[10px] text-slate-500">
                            Available: {formatQuantity(p.available)} {p.unit}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-xs">
                            -{formatQuantity(p.required)} {p.unit}
                          </span>
                          {!p.isSufficient && (
                            <span className="block text-[10px] text-rose-600 font-bold uppercase">
                              Short by {formatQuantity(p.shortage)} {p.unit}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200">
            <span className="text-xs text-slate-500">
              {hasInsufficientStock
                ? 'Cannot submit: replenish missing stock first.'
                : 'Submitting will atomically deduct materials and add to finished goods inventory.'}
            </span>

            <button
              type="submit"
              disabled={submitting || hasInsufficientStock}
              className={`px-6 py-2.5 text-xs font-bold rounded-lg shadow-2xs flex items-center gap-2 transition-all ${
                hasInsufficientStock
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              }`}
            >
              <Cog className={`w-4 h-4 ${submitting ? 'animate-spin' : ''}`} />
              <span>{submitting ? 'Recording & Deducting...' : 'Submit Production Entry'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Production Logs History */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              Production History & Saved Logs
            </h3>
            <p className="text-xs text-slate-500">
              Complete historical record of all completed agro-fertilizer batches.
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Filter batch logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
            />
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No production logs recorded yet. Create your first production entry above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Batch #</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Pack Size</th>
                  <th className="py-2.5 px-3 text-right">Boxes Produced</th>
                  <th className="py-2.5 px-3 text-right">Total Units</th>
                  <th className="py-2.5 px-3">Operator</th>
                  <th className="py-2.5 px-3">Materials Deducted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{log.batchDate}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{log.batchNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">{log.productName}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-emerald-800">
                      {log.packSize}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(log.numberOfBoxes)} boxes
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                      {formatQuantity(log.totalUnits)} units
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{log.operatorName || '-'}</td>
                    <td className="py-2.5 px-3 text-[11px] text-slate-500 max-w-xs truncate">
                      {log.rawMaterialsDeducted.length} raw + {log.packagingMaterialsDeducted.length} packaging
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
};
