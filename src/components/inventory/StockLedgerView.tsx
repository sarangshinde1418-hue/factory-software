import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  FileDown,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  SlidersHorizontal,
  X,
  AlertTriangle,
  History,
} from 'lucide-react';
import {
  InventoryTransaction,
  RawMaterial,
  PackagingMaterial,
  FinishedGood,
  TransactionType,
  MaterialType,
  StandardUnit,
} from '../../types/erp';
import { Badge } from '../common/Badge';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { recordStockTransaction } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface StockLedgerViewProps {
  transactions: InventoryTransaction[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  finishedGoods: FinishedGood[];
  currency?: string;
}

export const StockLedgerView: React.FC<StockLedgerViewProps> = ({
  transactions,
  rawMaterials,
  packagingMaterials,
  finishedGoods,
  currency = '$',
}) => {
  const { currentUser, role } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [materialTypeFilter, setMaterialTypeFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // New Transaction Form State
  const [txType, setTxType] = useState<TransactionType>('receipt');
  const [matType, setMatType] = useState<MaterialType>('raw');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(100);
  const [lotNumber, setLotNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Items for selector
  const availableItems =
    matType === 'raw'
      ? rawMaterials.map((m) => ({ id: m.id, name: m.name, code: m.code, unit: m.unit, cost: m.unitCost }))
      : matType === 'packaging'
      ? packagingMaterials.map((p) => ({ id: p.id, name: p.name, code: p.code, unit: p.unit, cost: p.unitCost }))
      : finishedGoods.map((f) => ({ id: f.id, name: `${f.productName} (${f.packSize})`, code: f.productCode, unit: f.unit, cost: f.unitCost || 0 }));

  const activeItem = availableItems.find((i) => i.id === selectedItemId) || availableItems[0];

  const handleOpenModal = () => {
    setSelectedItemId(availableItems[0]?.id || '');
    setLotNumber('');
    setNotes('');
    setErrorMessage(null);
    setModalOpen(true);
  };

  const handleRecordTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || quantity <= 0) {
      setErrorMessage('Please select an item and enter a valid quantity.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      await recordStockTransaction({
        transactionType: txType,
        materialType: matType,
        itemId: activeItem.id,
        itemName: activeItem.name,
        itemCode: activeItem.code,
        lotNumber: lotNumber || undefined,
        quantity: Number(quantity),
        unit: activeItem.unit,
        unitCost: activeItem.cost || 0,
        referenceType: 'manual',
        notes: notes || `Manual stock ${txType}`,
        performedBy: currentUser?.email || 'admin',
        performedByName: currentUser?.displayName || 'Admin',
      });

      setModalOpen(false);
    } catch (err: any) {
      console.error('Stock transaction error:', err);
      setErrorMessage(err.message || 'Transaction failed.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered transactions
  const filteredTxs = transactions.filter((t) => {
    const matchesSearch =
      t.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.itemCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.batchNumber && t.batchNumber.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (t.lotNumber && t.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType = typeFilter === 'all' || t.transactionType === typeFilter;
    const matchesMat = materialTypeFilter === 'all' || t.materialType === materialTypeFilter;
    return matchesSearch && matchesType && matchesMat;
  });

  const handleExportCSV = () => {
    const headers = [
      'Date & Time',
      'Transaction Type',
      'Category',
      'Item Name',
      'Item Code',
      'Lot / Batch #',
      'Quantity Delta',
      'Unit',
      'Unit Cost',
      'Total Valuation',
      'Reference',
      'Notes',
      'Performed By',
    ];
    const rows = filteredTxs.map((t) => [
      t.createdAt,
      t.transactionType.toUpperCase(),
      t.materialType.toUpperCase(),
      t.itemName,
      t.itemCode,
      t.batchNumber || t.lotNumber || '',
      t.quantity,
      t.unit,
      t.unitCost || 0,
      t.totalCost || 0,
      t.referenceType,
      t.notes || '',
      t.performedByName || t.performedBy,
    ]);

    exportToCSV('Inventory_Stock_Ledger', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Stock In / Out History (Ledger)</h1>
              <p className="text-xs text-slate-500">
                Complete record of materials entering and leaving your factory. Automatically prevents negative stock.
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
            onClick={handleOpenModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock In / Out</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search movements by item name, code, lot number, or batch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Material Type Filter */}
        <div className="w-full md:w-44">
          <select
            value={materialTypeFilter}
            onChange={(e) => setMaterialTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Material Types</option>
            <option value="raw">Raw Materials</option>
            <option value="packaging">Packaging Items</option>
            <option value="finished">Finished Goods</option>
          </select>
        </div>

        {/* Transaction Type Filter */}
        <div className="w-full md:w-44">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 capitalize"
          >
            <option value="all">All Movements</option>
            <option value="opening">Opening Balance</option>
            <option value="receipt">Receipt / Purchase</option>
            <option value="issue">Production Issue</option>
            <option value="return">Production Return</option>
            <option value="wastage">Wastage / Scrap</option>
            <option value="adjustment">Physical Adjustment</option>
            <option value="dispatch">Dispatch</option>
          </select>
        </div>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredTxs.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <History className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Transactions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Transactions occur automatically when production batches issue or complete, or when manual receipts are recorded.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Date & Time</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-4">Item Details</th>
                  <th className="py-3 px-3 text-right">Quantity Delta</th>
                  <th className="py-3 px-3 text-right">Total Value</th>
                  <th className="py-3 px-3">Reference / Notes</th>
                  <th className="py-3 px-4 text-right">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredTxs.map((tx) => {
                  const isPositive = tx.quantity > 0;
                  return (
                    <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">
                        {new Date(tx.createdAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="py-3 px-3">
                        <Badge status={tx.transactionType} />
                      </td>

                      <td className="py-3 px-3 text-xs uppercase font-bold text-slate-500 font-mono">
                        {tx.materialType}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 text-xs">{tx.itemName}</div>
                        <span className="font-mono text-[11px] text-slate-400">
                          {tx.itemCode}
                          {tx.batchNumber && ` • Batch: ${tx.batchNumber}`}
                          {tx.lotNumber && ` • Lot: ${tx.lotNumber}`}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold text-xs">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-700'
                              : 'text-rose-600'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {formatQuantity(tx.quantity)} {tx.unit}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right font-mono text-xs text-slate-700">
                        {tx.totalCost ? formatCurrency(tx.totalCost, currency) : '-'}
                      </td>

                      <td className="py-3 px-3 text-xs text-slate-600 max-w-xs truncate">
                        {tx.notes || tx.referenceType}
                      </td>

                      <td className="py-3 px-4 text-right text-xs text-slate-500 truncate max-w-[140px]">
                        {tx.performedByName || tx.performedBy}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Movement / Receipt Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Add Stock In / Out
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleRecordTransaction} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Movement Type
                  </label>
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as TransactionType)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="receipt">Received New Stock (Purchase)</option>
                    <option value="return">Returned from Production</option>
                    <option value="wastage">Damaged / Scrap / Wastage</option>
                    <option value="adjustment">Stock Count Correction</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Material Category
                  </label>
                  <select
                    value={matType}
                    onChange={(e) => {
                      const newMat = e.target.value as MaterialType;
                      setMatType(newMat);
                      const list =
                        newMat === 'raw'
                          ? rawMaterials
                          : newMat === 'packaging'
                          ? packagingMaterials
                          : finishedGoods;
                      setSelectedItemId(list[0]?.id || '');
                    }}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none capitalize"
                  >
                    <option value="raw">Raw Material</option>
                    <option value="packaging">Packaging Material</option>
                    <option value="finished">Finished Good</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Item Selection
                </label>
                <select
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                >
                  {availableItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} [{item.code}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Quantity ({activeItem?.unit || 'units'})
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.0001"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lot / PO Reference
                  </label>
                  <input
                    type="text"
                    value={lotNumber}
                    onChange={(e) => setLotNumber(e.target.value)}
                    placeholder="e.g. PO-9941 / LOT-44"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Received shipment from supplier, quality inspected."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs"
                >
                  {saving ? 'Saving...' : 'Save Stock Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
