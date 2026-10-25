import React, { useState } from 'react';
import {
  Cog,
  Plus,
  Search,
  Filter,
  Layers,
  ChevronRight,
  FileDown,
  Calendar,
  User,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  ProductionBatch,
  Product,
  Formula,
  PackagingFormula,
  RawMaterial,
  PackagingMaterial,
  ConversionRule,
  BatchStatus,
} from '../../types/erp';
import { Badge } from '../common/Badge';
import { formatQuantity } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { useAuth } from '../../context/AuthContext';
import { NewBatchModal } from './NewBatchModal';
import { BatchDetailModal } from './BatchDetailModal';

interface ProductionBatchListProps {
  batches: ProductionBatch[];
  products: Product[];
  formulas: Formula[];
  packagingFormulas: PackagingFormula[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  conversionRules: ConversionRule[];
  currency?: string;
}

export const ProductionBatchList: React.FC<ProductionBatchListProps> = ({
  batches,
  products,
  formulas,
  packagingFormulas,
  rawMaterials,
  packagingMaterials,
  conversionRules,
  currency = '$',
}) => {
  const { canApproveBatch } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isNewBatchOpen, setIsNewBatchOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<ProductionBatch | null>(null);

  // Filtered batches
  const filteredBatches = batches.filter((b) => {
    const matchesSearch =
      b.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.productCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Batch Number',
      'Product',
      'Product Code',
      'Formula Version',
      'Batch Size',
      'Unit',
      'Target Packs',
      'Good Packs',
      'Yield %',
      'Status',
      'Scheduled Date',
      'Operator',
      'Created At',
    ];
    const rows = filteredBatches.map((b) => [
      b.batchNumber,
      b.productName,
      b.productCode,
      b.formulaVersion,
      b.requestedBatchSize,
      b.batchUnit,
      b.targetPacksCount || '',
      b.goodOutputPacks || '',
      b.yieldPercentage ? `${b.yieldPercentage}%` : '',
      b.status,
      b.scheduledDate,
      b.assignedOperatorName || b.assignedOperator || '',
      b.createdAt,
    ]);

    exportToCSV('Production_Batches', headers, rows);
  };

  const activeCount = batches.filter((b) => b.status === 'in_production').length;
  const completedCount = batches.filter((b) => b.status === 'completed').length;
  const pendingCount = batches.filter((b) => (b.status as any) === 'planned' || (b.status as any) === 'approved').length;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Cog className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Production & Batch Orders</h1>
              <p className="text-xs text-slate-500">
                Execute batches, track compounding, deduct inventory atomically, and inspect QA yield.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
          >
            <FileDown className="w-4 h-4 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsNewBatchOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Create Production Batch</span>
          </button>
        </div>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Batches</span>
          <span className="text-xl font-extrabold text-slate-900 mt-1 block">{batches.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 block">In Production</span>
          <span className="text-xl font-extrabold text-blue-600 mt-1 block">{activeCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Pending / Planned</span>
          <span className="text-xl font-extrabold text-amber-600 mt-1 block">{pendingCount}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Completed Batches</span>
          <span className="text-xl font-extrabold text-emerald-600 mt-1 block">{completedCount}</span>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by batch number, product name, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch md:self-auto overflow-x-auto">
          {(['all', 'planned', 'approved', 'in_production', 'qa_pending', 'completed'] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all whitespace-nowrap capitalize ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status.replace(/_/g, ' ')}
              </button>
            )
          )}
        </div>
      </div>

      {/* Batches Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredBatches.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Cog className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Batches Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              No production orders match your filter criteria. Click "Create Production Batch" to plan a new run.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Batch #</th>
                  <th className="py-3 px-3">Product</th>
                  <th className="py-3 px-3">Formula Version</th>
                  <th className="py-3 px-3 text-right">Batch Size</th>
                  <th className="py-3 px-3 text-right">Target Output</th>
                  <th className="py-3 px-3">Scheduled Date</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredBatches.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => setSelectedBatch(b)}
                    className="hover:bg-slate-50/70 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-xs text-blue-600">
                        {b.batchNumber}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 text-xs">{b.productName}</div>
                      <span className="text-[11px] font-mono text-slate-400">{b.productCode}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        v{b.formulaVersion}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-semibold text-xs text-slate-900">
                      {formatQuantity(b.requestedBatchSize)} {b.batchUnit}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-700">
                      {formatQuantity(b.goodOutputPacks || b.targetPacksCount)} {b.targetPackSize}
                      {b.yieldPercentage !== undefined && (
                        <span className="block text-[10px] text-emerald-600 font-bold">
                          {b.yieldPercentage}% Yield
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600">
                      {b.scheduledDate}
                    </td>

                    <td className="py-3 px-3">
                      <Badge status={(b.status || 'in_production') as any} />
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBatch(b);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                      >
                        <span>Manage</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Batch Wizard Modal */}
      {isNewBatchOpen && (
        <NewBatchModal
          products={products}
          formulas={formulas}
          packagingFormulas={packagingFormulas}
          rawMaterials={rawMaterials}
          packagingMaterials={packagingMaterials}
          conversionRules={conversionRules}
          currency={currency}
          onClose={() => setIsNewBatchOpen(false)}
          onSuccess={(newId) => {
            setIsNewBatchOpen(false);
          }}
        />
      )}

      {/* Batch Execution Detail Modal */}
      {selectedBatch && (
        <BatchDetailModal
          batch={selectedBatch}
          currency={currency}
          onClose={() => setSelectedBatch(null)}
          onUpdated={() => {
            // Find updated batch or close
            setSelectedBatch(null);
          }}
        />
      )}

    </div>
  );
};
