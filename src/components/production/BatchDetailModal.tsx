import React, { useState } from 'react';
import {
  X,
  Cog,
  CheckCircle2,
  AlertTriangle,
  Play,
  ClipboardCheck,
  PackageCheck,
  Printer,
  Calendar,
  User,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { ProductionBatch } from '../../types/erp';
import { Badge } from '../common/Badge';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { triggerPrint } from '../../utils/export';
import {
  approveBatch,
  issueAndStartBatch,
  submitBatchQA,
  completeProductionBatch,
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface BatchDetailModalProps {
  batch: ProductionBatch;
  onClose: () => void;
  onUpdated: () => void;
  currency?: string;
}

export const BatchDetailModal: React.FC<BatchDetailModalProps> = ({
  batch,
  onClose,
  onUpdated,
  currency = '$',
}) => {
  const { currentUser, role, canApproveBatch, canIssueStock, canPerformQA } = useAuth();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // QA Form State
  const [goodPacks, setGoodPacks] = useState<number>(
    batch.goodOutputPacks ?? batch.targetPacksCount ?? 1000
  );
  const [rejectedPacks, setRejectedPacks] = useState<number>(batch.rejectedOutputPacks ?? 0);
  const [qaPassed, setQaPassed] = useState<boolean>(batch.qaPassed ?? true);
  const [qaNotes, setQaNotes] = useState<string>(
    batch.qaNotes || 'All organoleptic, pH, and viscosity release parameters within master formulation specs.'
  );

  // Warehouse location for finished goods inward
  const [fgLocation, setFgLocation] = useState<string>('Main FG Warehouse - Rack A3');
  const [shelfLifeMonths, setShelfLifeMonths] = useState<number>(24);

  // Workflow Action Handlers
  const handleApprove = async () => {
    try {
      setLoading(true);
      setError(null);
      await approveBatch(
        batch.id,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'Admin'
      );
      onUpdated();
    } catch (err: any) {
      console.error('Error approving batch:', err);
      setError(err.message || 'Failed to approve batch.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProduction = async () => {
    try {
      setLoading(true);
      setError(null);
      await issueAndStartBatch(
        batch,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'Admin'
      );
      onUpdated();
    } catch (err: any) {
      console.error('Error starting production:', err);
      setError(err.message || 'Failed to issue materials and start batch.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitQA = async () => {
    try {
      setLoading(true);
      setError(null);
      await submitBatchQA(
        batch.id,
        Number(goodPacks),
        Number(rejectedPacks),
        qaPassed,
        qaNotes,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'QA Inspector'
      );
      onUpdated();
    } catch (err: any) {
      console.error('Error submitting QA:', err);
      setError(err.message || 'Failed to submit QA inspection.');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteBatch = async () => {
    try {
      setLoading(true);
      setError(null);
      await completeProductionBatch(
        batch.id,
        Number(goodPacks),
        batch.targetPackSize || 'Standard',
        fgLocation,
        shelfLifeMonths,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'Admin'
      );
      onUpdated();
    } catch (err: any) {
      console.error('Error completing batch:', err);
      setError(err.message || 'Failed to complete batch and update finished goods inventory.');
    } finally {
      setLoading(false);
    }
  };

  // Workflow steps progress
  const steps: { id: ProductionBatch['status']; label: string }[] = [
    { id: 'planned', label: '1. Planned' },
    { id: 'approved', label: '2. Approved' },
    { id: 'in_production', label: '3. Making' },
    { id: 'qa_pending', label: '4. Quality Check' },
    { id: 'completed', label: '5. Finished' },
  ];

  const currentStepIdx = steps.findIndex((s) => s.id === batch.status);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-extrabold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                #{batch.batchNumber}
              </span>
              <Badge status={batch.status} />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mt-1">
              {batch.productName} ({batch.productCode})
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
              <span>Date: {batch.scheduledDate}</span>
              <span>•</span>
              <span>Batch Size: <strong>{formatQuantity(batch.requestedBatchSize)} {batch.batchUnit}</strong></span>
              <span>•</span>
              <span>Target Output: <strong>{formatQuantity(batch.targetPacksCount)} {batch.targetPackSize} packs</strong></span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={triggerPrint}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title="Print Batch Sheet"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Progress Bar */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-5 gap-2 text-center text-xs">
            {steps.map((st, idx) => {
              const isDone = currentStepIdx >= idx;
              const isCurrent = batch.status === st.id;
              return (
                <div
                  key={st.id}
                  className={`p-2 rounded-lg font-semibold transition-all ${
                    isCurrent
                      ? 'bg-blue-600 text-white shadow-xs'
                      : isDone
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-white text-slate-400 border border-slate-200'
                  }`}
                >
                  {st.label}
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dynamic Action Trigger Box based on Status */}
        <div className="p-4 bg-blue-50/70 rounded-xl border border-blue-200 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-blue-900">
              Next Step for This Batch
            </h3>
            <span className="text-xs text-blue-700 font-medium">
              Signed in as: <strong className="uppercase">{role}</strong>
            </span>
          </div>

          {/* Planned -> Approve */}
          {batch.status === 'planned' && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">
                This batch is planned. Check the ingredients needed, then click approve to make it ready.
              </p>
              {canApproveBatch ? (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{loading ? 'Approving...' : 'Approve Batch'}</span>
                </button>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
                  Manager or Admin role needed to approve
                </span>
              )}
            </div>
          )}

          {/* Approved -> Issue & Start */}
          {batch.status === 'approved' && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Batch is approved! Click below to deduct ingredients from stock and start making the product.
              </p>
              {canIssueStock ? (
                <button
                  type="button"
                  onClick={handleStartProduction}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Play className="w-4 h-4" />
                  <span>{loading ? 'Deducting Stock...' : 'Deduct Stock & Start Making'}</span>
                </button>
              ) : (
                <span className="text-xs text-amber-700 bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-300">
                  Storekeeper or Manager role needed to issue materials
                </span>
              )}
            </div>
          )}

          {/* In Production -> Record QA */}
          {batch.status === 'in_production' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Product is being made. Once done, enter the number of good packs and rejected packs for quality check.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Good Output (Packs)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={goodPacks}
                    onChange={(e) => setGoodPacks(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Damaged / Rejected Packs
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={rejectedPacks}
                    onChange={(e) => setRejectedPacks(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2">
                    <input
                      type="checkbox"
                      checked={qaPassed}
                      onChange={(e) => setQaPassed(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Quality Check Passed
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quality Inspector Notes
                </label>
                <input
                  type="text"
                  value={qaNotes}
                  onChange={(e) => setQaNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded outline-none"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleSubmitQA}
                  disabled={loading}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <ClipboardCheck className="w-4 h-4" />
                  <span>{loading ? 'Saving...' : 'Save Quality Check'}</span>
                </button>
              </div>
            </div>
          )}

          {/* QA Pending -> Complete and Inward to Finished Goods */}
          {batch.status === 'qa_pending' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-100 p-2.5 rounded-lg border border-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Quality check passed! Total good output: {formatQuantity(batch.goodOutputPacks)} packs ({batch.yieldPercentage}% yield).
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Store in Warehouse Location:
                  </label>
                  <input
                    type="text"
                    value={fgLocation}
                    onChange={(e) => setFgLocation(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Shelf Life (Months):
                  </label>
                  <input
                    type="number"
                    value={shelfLifeMonths}
                    onChange={(e) => setShelfLifeMonths(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleCompleteBatch}
                  disabled={loading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>{loading ? 'Adding to Stock...' : 'Finish Batch & Add to Warehouse'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Completed */}
          {batch.status === 'completed' && (
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>
                Batch successfully manufactured and completed. Finished goods added to warehouse inventory with complete ledger trail.
              </span>
            </div>
          )}
        </div>

        {/* Section 2: Immutable Formula Snapshot */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-blue-600" />
            <span>Master Formula Snapshot (v{batch.formulaVersion})</span>
          </h3>

          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Ingredient</th>
                  <th className="py-2.5 px-3 text-right">Scaled Required Qty</th>
                  <th className="py-2.5 px-3 text-right">Available in Stock</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {((batch as any).rawMaterialRequirements || []).map((req: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2.5 px-3 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {req.materialName} <span className="font-mono text-slate-400">[{req.materialCode}]</span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(req.requiredQuantity)} {req.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatQuantity(req.availableStock)} {req.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatCurrency(req.unitCost, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatCurrency(req.estimatedCost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Packaging Components Snapshot */}
        {batch.packagingRequirements && batch.packagingRequirements.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Packaging Components Spec Snapshot ({batch.targetPackSize})
            </h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3">Packaging Component</th>
                    <th className="py-2.5 px-3 text-right">Required</th>
                    <th className="py-2.5 px-3 text-right">Unit Cost</th>
                    <th className="py-2.5 px-3 text-right">Total Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {((batch as any).packagingRequirements || []).map((pkg: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {pkg.materialName} <span className="font-mono text-slate-400">[{pkg.materialCode}]</span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatQuantity(pkg.requiredQuantity)} {pkg.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {formatCurrency(pkg.unitCost, currency)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {formatCurrency(pkg.estimatedCost, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Audit & Execution Logs */}
        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <span className="text-slate-400 block">Created By:</span>
            <span className="font-semibold text-slate-800">{batch.createdByName || batch.createdBy}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Operator:</span>
            <span className="font-semibold text-slate-800">{(batch as any).assignedOperatorName || (batch as any).assignedOperator || 'Unassigned'}</span>
          </div>
          <div>
            <span className="text-slate-400 block">Approved By:</span>
            <span className="font-semibold text-slate-800">{(batch as any).approvedByName || 'Pending Approval'}</span>
          </div>
          <div>
            <span className="text-slate-400 block">QA Inspector:</span>
            <span className="font-semibold text-slate-800">{(batch as any).qaInspector || 'Pending QA'}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
