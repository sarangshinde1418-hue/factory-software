import React, { useState, useEffect } from 'react';
import {
  X,
  Cog,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  User,
  Calculator,
  ArrowRight,
  Package,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  Product,
  Formula,
  PackagingFormula,
  RawMaterial,
  PackagingMaterial,
  ConversionRule,
  BatchIngredientRequirement,
  BatchPackagingRequirement,
  ProductionBatch,
} from '../../types/erp';
import {
  calculateDynamicRequirement,
  convertUnit,
  formatQuantity,
  formatCurrency,
} from '../../utils/units';
import { createProductionBatch } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface NewBatchModalProps {
  products: Product[];
  formulas: Formula[];
  packagingFormulas: PackagingFormula[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  conversionRules: ConversionRule[];
  onClose: () => void;
  onSuccess: (batchId: string) => void;
  currency?: string;
}

export const NewBatchModal: React.FC<NewBatchModalProps> = ({
  products,
  formulas,
  packagingFormulas,
  rawMaterials,
  packagingMaterials,
  conversionRules,
  onClose,
  onSuccess,
  currency = '$',
}) => {
  const { currentUser, role } = useAuth();

  // Wizard state
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>('');
  const [selectedPackFormulaId, setSelectedPackFormulaId] = useState<string>('');
  const [requestedBatchSize, setRequestedBatchSize] = useState<number>(1000);
  const [targetPackSize, setTargetPackSize] = useState<string>('500ml');
  const [targetPacksCount, setTargetPacksCount] = useState<number>(2000);
  const [assignedOperator, setAssignedOperator] = useState<string>('Elena Rostova (Operator)');
  const [scheduledDate, setScheduledDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [batchNotes, setBatchNotes] = useState<string>('');
  
  // Auto-generate batch number
  const [batchNumber, setBatchNumber] = useState<string>(() => {
    const ym = new Date().toISOString().slice(0, 7).replace('-', '');
    const rand = Math.floor(100 + Math.random() * 900);
    return `BATCH-${ym}-${rand}`;
  });

  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Available formulas for selected product
  const productFormulas = formulas.filter(
    (f) => f.productId === selectedProductId && f.status === 'approved'
  );
  const allProductFormulas = formulas.filter((f) => f.productId === selectedProductId);

  // Packaging formulas for selected product
  const productPackFormulas = packagingFormulas.filter(
    (pf) => pf.productId === selectedProductId
  );

  // Select approved formula by default
  useEffect(() => {
    if (productFormulas.length > 0) {
      setSelectedFormulaId(productFormulas[0].id);
      setRequestedBatchSize(productFormulas[0].referenceBatchSize || 1000);
    } else if (allProductFormulas.length > 0) {
      setSelectedFormulaId(allProductFormulas[0].id);
      setRequestedBatchSize(allProductFormulas[0].referenceBatchSize || 1000);
    } else {
      setSelectedFormulaId('');
    }
  }, [selectedProductId, formulas]);

  // Select packaging formula
  useEffect(() => {
    if (productPackFormulas.length > 0) {
      setSelectedPackFormulaId(productPackFormulas[0].id);
      setTargetPackSize(productPackFormulas[0].packSize);
    } else {
      setSelectedPackFormulaId('');
    }
  }, [selectedProductId, packagingFormulas]);

  const activeFormula = formulas.find((f) => f.id === selectedFormulaId);
  const activePackFormula = packagingFormulas.find((pf) => pf.id === selectedPackFormulaId);

  // Calculate Raw Material Requirements with live stock check
  const calculatedRawRequirements: any[] = (
    activeFormula?.ingredients || []
  ).map((ing) => {
    const rm = rawMaterials.find((m) => m.id === ing.rawMaterialId);
    const availableStock = rm ? rm.currentStock : 0;
    const unitCost = rm ? rm.unitCost : 0;

    const scaledQty = calculateDynamicRequirement(
      ing.quantity,
      requestedBatchSize,
      activeFormula?.referenceBatchSize || 1
    );

    let requiredInRmUnit = scaledQty;
    if (rm && rm.unit && ing.unit !== rm.unit) {
      const conv = convertUnit(scaledQty, ing.unit, rm.unit, rm.id, conversionRules);
      if (conv.success) requiredInRmUnit = conv.value;
    }

    const shortage = Math.max(0, requiredInRmUnit - availableStock);
    const estimatedCost = Number((requiredInRmUnit * unitCost).toFixed(2));

    return {
      materialId: ing.rawMaterialId,
      rawMaterialId: ing.rawMaterialId,
      materialName: ing.materialName,
      materialCode: ing.materialCode,
      requiredQuantity: Number(requiredInRmUnit.toFixed(4)),
      unit: rm?.unit || ing.unit,
      availableStock,
      shortage: Number(shortage.toFixed(4)),
      unitCost,
      estimatedCost,
    };
  });

  // Calculate Packaging Requirements with live stock check
  const calculatedPackagingRequirements: any[] = (
    activePackFormula?.components || []
  ).map((comp: any) => {
    const pm = packagingMaterials.find((m) => m.id === comp.packagingMaterialId);
    const availableStock = pm ? pm.currentStock : 0;
    const unitCost = pm ? pm.unitCost : 0;

    const qtyPerUnit = comp.quantityPerUnitOrBox ?? comp.quantityPerUnit ?? 1;
    const requiredQty = Number((qtyPerUnit * targetPacksCount).toFixed(4));
    const shortage = Math.max(0, requiredQty - availableStock);
    const estimatedCost = Number((requiredQty * unitCost).toFixed(2));

    return {
      packagingId: comp.packagingMaterialId,
      packagingMaterialId: comp.packagingMaterialId,
      materialName: comp.materialName,
      materialCode: comp.materialCode || '',
      requiredQuantity: requiredQty,
      unit: comp.unit,
      availableStock,
      shortage: Number(shortage.toFixed(4)),
      unitCost,
      estimatedCost,
    };
  });

  const totalRawShortages = calculatedRawRequirements.filter((r) => r.shortage > 0).length;
  const totalPkgShortages = calculatedPackagingRequirements.filter((p) => p.shortage > 0).length;
  const totalEstimatedBatchCost =
    calculatedRawRequirements.reduce((sum, r) => sum + r.estimatedCost, 0) +
    calculatedPackagingRequirements.reduce((sum, p) => sum + p.estimatedCost, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId || !activeFormula) {
      setErrorMessage('Please select a Product and an Approved Formula.');
      return;
    }
    if (requestedBatchSize <= 0) {
      setErrorMessage('Requested batch size must be greater than zero.');
      return;
    }

    const prod = products.find((p) => p.id === selectedProductId);
    if (!prod) return;

    try {
      setSaving(true);
      setErrorMessage(null);

      const batchPayload: Omit<ProductionBatch, 'id' | 'createdAt' | 'updatedAt'> = {
        batchNumber,
        productId: prod.id,
        productName: prod.name,
        productCode: prod.code,
        formulaId: activeFormula.id,
        formulaVersion: activeFormula.version,
        formulaSnapshot: activeFormula, // Immutable snapshot
        packagingFormulaId: activePackFormula?.id,
        packagingSnapshot: activePackFormula,
        requestedBatchSize,
        batchUnit: activeFormula.referenceBatchUnit,
        targetPackSize: targetPackSize || 'Standard',
        targetPacksCount: Number(targetPacksCount) || 0,
        status: 'planned',
        assignedOperator,
        assignedOperatorName: assignedOperator,
        scheduledDate,
        rawMaterialRequirements: calculatedRawRequirements,
        packagingRequirements: calculatedPackagingRequirements,
        actualConsumption: [],
        actualPackagingConsumption: [],
        notes: batchNotes,
        createdBy: currentUser?.email || 'admin',
        createdByName: currentUser?.displayName || 'Admin',
      };

      const newId = await createProductionBatch(
        batchPayload,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'Admin'
      );
      onSuccess(newId);
    } catch (err: any) {
      console.error('Error creating batch:', err);
      setErrorMessage(err.message || 'Failed to create production batch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-5">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Cog className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Create Production Batch Order
              </h2>
              <p className="text-xs text-slate-500">
                Calculate live material & packaging requirements and check inventory shortages.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          
          {/* Section 1: Batch Identification & Product */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Batch Number
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Product <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.code}]
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                Approved Formula Version
              </label>
              <select
                value={selectedFormulaId}
                onChange={(e) => setSelectedFormulaId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
              >
                {allProductFormulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    v{f.version} — {f.status.toUpperCase()} ({formatQuantity(f.referenceBatchSize)} {f.referenceBatchUnit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Section 2: Batch Sizing & Packaging Target */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Batch Size to Make
              </label>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={requestedBatchSize}
                  onChange={(e) => setRequestedBatchSize(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="px-2.5 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
                  {activeFormula?.referenceBatchUnit || 'l'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Pack Size & Packaging Rule
              </label>
              <select
                value={selectedPackFormulaId}
                onChange={(e) => {
                  setSelectedPackFormulaId(e.target.value);
                  const pf = productPackFormulas.find((x) => x.id === e.target.value);
                  if (pf) setTargetPackSize(pf.packSize);
                }}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- No Packaging Rule --</option>
                {productPackFormulas.map((pf) => (
                  <option key={pf.id} value={pf.id}>
                    {pf.packSize} ({pf.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Number of Packs to Fill
              </label>
              <input
                type="number"
                min="0"
                value={targetPacksCount}
                onChange={(e) => setTargetPacksCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="2000"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Scheduled Date
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Section 3: Live Requirement Breakdown & Shortage Verification */}
          <div className="space-y-4">
            
            {/* Raw Material Breakdown */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  1. Raw Materials Needed ({calculatedRawRequirements.length} ingredients)
                </span>
                {totalRawShortages > 0 ? (
                  <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>{totalRawShortages} Material(s) Missing or Low</span>
                  </span>
                ) : (
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>All Materials In Stock</span>
                  </span>
                )}
              </div>

              <div className="overflow-x-auto text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="py-2 px-3">Ingredient</th>
                      <th className="py-2 px-3 text-right">Required</th>
                      <th className="py-2 px-3 text-right">In Stock</th>
                      <th className="py-2 px-3 text-right">Status / Shortage</th>
                      <th className="py-2 px-3 text-right">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {calculatedRawRequirements.map((r, i) => (
                      <tr key={i} className={r.shortage > 0 ? 'bg-rose-50/40' : ''}>
                        <td className="py-2 px-3 font-semibold text-slate-900">
                          {r.materialName} <span className="font-mono text-slate-400">[{r.materialCode}]</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                          {formatQuantity(r.requiredQuantity)} {r.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-600">
                          {formatQuantity(r.availableStock)} {r.unit}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {r.shortage > 0 ? (
                            <span className="text-rose-600">Short: -{formatQuantity(r.shortage)} {r.unit}</span>
                          ) : (
                            <span className="text-emerald-700">In Stock</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(r.estimatedCost, currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Packaging Component Breakdown */}
            {calculatedPackagingRequirements.length > 0 && (
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="p-3 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    2. Packaging Items Needed ({calculatedPackagingRequirements.length} items)
                  </span>
                  {totalPkgShortages > 0 ? (
                    <span className="text-xs font-bold text-rose-700 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300 flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{totalPkgShortages} Item(s) Missing or Low</span>
                    </span>
                  ) : (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>All Packaging In Stock</span>
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <tr>
                        <th className="py-2 px-3">Packaging Component</th>
                        <th className="py-2 px-3 text-right">Required</th>
                        <th className="py-2 px-3 text-right">In Stock</th>
                        <th className="py-2 px-3 text-right">Status / Shortage</th>
                        <th className="py-2 px-3 text-right">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {calculatedPackagingRequirements.map((p, i) => (
                        <tr key={i} className={p.shortage > 0 ? 'bg-rose-50/40' : ''}>
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {p.materialName} <span className="font-mono text-slate-400">[{p.materialCode}]</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                            {formatQuantity(p.requiredQuantity)} {p.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {formatQuantity(p.availableStock)} {p.unit}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {p.shortage > 0 ? (
                              <span className="text-rose-600">Short: -{formatQuantity(p.shortage)} {p.unit}</span>
                            ) : (
                              <span className="text-emerald-700">In Stock</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {formatCurrency(p.estimatedCost, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Total Batch Cost Summary */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-600">
                Total Estimated Materials & Packaging Cost:
              </span>
              <span className="text-sm font-bold text-slate-900 font-mono">
                {formatCurrency(totalEstimatedBatchCost, currency)}
              </span>
            </div>
          </div>

          {/* Section 4: Operator & Notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Assigned Production Operator
              </label>
              <input
                type="text"
                value={assignedOperator}
                onChange={(e) => setAssignedOperator(e.target.value)}
                placeholder="Operator name and shift"
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Production Order Notes / Instructions
              </label>
              <input
                type="text"
                value={batchNotes}
                onChange={(e) => setBatchNotes(e.target.value)}
                placeholder="Specific instructions, kettle allocation, priority..."
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
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
              <Cog className="w-4 h-4" />
              <span>{saving ? 'Creating...' : 'Create Production Batch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
