import React, { useState } from 'react';
import {
  Warehouse,
  Truck,
  Search,
  FileDown,
  X,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  MapPin,
} from 'lucide-react';
import { FinishedGood } from '../../types/erp';
import { Badge } from '../common/Badge';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { dispatchFinishedGoods } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface FinishedGoodsViewProps {
  finishedGoods: FinishedGood[];
  currency?: string;
}

export const FinishedGoodsView: React.FC<FinishedGoodsViewProps> = ({
  finishedGoods,
  currency = '$',
}) => {
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [qaStatusFilter, setQaStatusFilter] = useState<string>('all');
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FinishedGood | null>(null);

  // Dispatch form state
  const [dispatchQty, setDispatchQty] = useState<number>(100);
  const [destination, setDestination] = useState<string>('Regional Distribution Center East');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const getAvailable = (fg: FinishedGood) => fg.availableBoxes ?? fg.availableQuantity ?? 0;
  const getTotal = (fg: FinishedGood) => fg.quantityBoxes ?? fg.quantity ?? 0;

  const openDispatch = (fg: FinishedGood) => {
    setSelectedItem(fg);
    const avail = getAvailable(fg);
    setDispatchQty(Math.min(avail, 50));
    setDestination('Customer Order / Regional Agro Distributor');
    setErrorMessage(null);
    setDispatchModalOpen(true);
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    const avail = getAvailable(selectedItem);
    if (dispatchQty <= 0 || dispatchQty > avail) {
      setErrorMessage(`Please enter a valid quantity between 1 and ${avail} boxes.`);
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      await dispatchFinishedGoods(
        selectedItem.id,
        Number(dispatchQty),
        destination,
        currentUser?.email || 'admin',
        currentUser?.displayName || 'Admin'
      );

      setDispatchModalOpen(false);
    } catch (err: any) {
      console.error('Dispatch error:', err);
      setErrorMessage(err.message || 'Dispatch failed.');
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = finishedGoods.filter((item) => {
    const matchesSearch =
      item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.batchNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.packSize.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = qaStatusFilter === 'all' || item.qaStatus === qaStatusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleExportCSV = () => {
    const headers = [
      'Product Name',
      'Code',
      'Pack Size',
      'Batch Number',
      'Available Boxes',
      'Total Boxes',
      'Available Units',
      'Unit',
      'QA Status',
      'Mfg Date',
      'Expiry Date',
      'Warehouse Location',
      'Notes',
    ];
    const rows = filteredItems.map((item) => [
      item.productName,
      item.productCode,
      item.packSize,
      item.batchNumber,
      getAvailable(item),
      getTotal(item),
      item.availableUnits || 0,
      item.unit,
      item.qaStatus.toUpperCase(),
      item.mfgDate,
      item.expiryDate,
      item.warehouseLocation,
      item.notes || '',
    ]);

    exportToCSV('Finished_Goods_Warehouse', headers, rows);
  };

  const totalAvailablePacks = filteredItems.reduce(
    (sum, item) => sum + getAvailable(item),
    0
  );

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Warehouse className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Finished Goods Warehouse</h1>
              <p className="text-xs text-slate-500">
                View products made by your factory, ready packs in stock, and send shipments to customers.
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
          <span>Export CSV</span>
        </button>
      </div>

      {/* KPI mini-cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Products</span>
          <span className="text-xl font-extrabold text-slate-900 mt-1 block">{finishedGoods.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">Ready to Ship</span>
          <span className="text-xl font-extrabold text-emerald-600 mt-1 block font-mono">
            {formatQuantity(totalAvailablePacks)} units
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Waiting Quality Check</span>
          <span className="text-xl font-extrabold text-amber-600 mt-1 block">
            {finishedGoods.filter((i) => i.qaStatus === 'quarantine').length} batches
          </span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search finished goods by product, batch number, or pack size..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch md:self-auto">
          {(['all', 'approved', 'quarantine', 'rejected'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setQaStatusFilter(status)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                qaStatusFilter === status
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* Finished Goods Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Warehouse className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Finished Goods in Stock</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Completed batches that passed quality check will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-3 px-4">Product & Pack Size</th>
                  <th className="py-3 px-3">Batch Number</th>
                  <th className="py-3 px-3 text-right">Available Qty</th>
                  <th className="py-3 px-3">QA Release Status</th>
                  <th className="py-3 px-3">Manufacturing Date</th>
                  <th className="py-3 px-3">Expiry Date</th>
                  <th className="py-3 px-3">Warehouse Bay</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-xs">{item.productName}</div>
                      <span className="font-semibold text-blue-600 text-xs">{item.packSize}</span>
                      <span className="text-slate-400 text-xs ml-2 font-mono">[{item.productCode}]</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {item.batchNumber}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-xs text-slate-900">
                      {formatQuantity(getAvailable(item))} {item.unit}
                    </td>

                    <td className="py-3 px-3">
                      <Badge status={item.qaStatus} />
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600 font-mono">
                      {item.mfgDate}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600 font-mono">
                      {item.expiryDate}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {item.warehouseLocation}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      {getAvailable(item) > 0 && item.qaStatus === 'approved' ? (
                        <button
                          type="button"
                          onClick={() => openDispatch(item)}
                          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                        >
                          <Truck className="w-3.5 h-3.5" />
                          <span>Dispatch</span>
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dispatch Modal */}
      {dispatchModalOpen && selectedItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                Dispatch Finished Goods
              </h3>
              <button onClick={() => setDispatchModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleDispatch} className="space-y-3">
              <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
                <div><strong>Product:</strong> {selectedItem.productName} ({selectedItem.packSize})</div>
                <div><strong>Batch Number:</strong> {selectedItem.batchNumber}</div>
                <div><strong>Available in Warehouse:</strong> {formatQuantity(getAvailable(selectedItem))} {selectedItem.unit}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity to Dispatch ({selectedItem.unit})
                </label>
                <input
                  type="number"
                  min="1"
                  max={getAvailable(selectedItem)}
                  required
                  value={dispatchQty}
                  onChange={(e) => setDispatchQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer / Destination Hub
                </label>
                <input
                  type="text"
                  required
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g. Metro Retail Order #1084"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Truck className="w-4 h-4" />
                  <span>{saving ? 'Processing...' : 'Confirm Dispatch'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
