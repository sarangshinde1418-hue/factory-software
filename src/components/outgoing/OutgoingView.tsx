import React, { useState } from 'react';
import {
  Truck,
  Plus,
  Search,
  FileDown,
  UserCheck,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  X,
  Package,
} from 'lucide-react';
import { Party, SalesOrder, FinishedGood } from '../../types/erp';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { saveParty, recordSalesOrder } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface OutgoingViewProps {
  parties: Party[];
  salesOrders: SalesOrder[];
  finishedGoods: FinishedGood[];
  currency?: string;
}

export const OutgoingView: React.FC<OutgoingViewProps> = ({
  parties,
  salesOrders,
  finishedGoods,
  currency = '₹',
}) => {
  const { userProfile, isOwner, isManager, canMakeOutgoingEntry } = useAuth();

  // Sub tab: 'orders' vs 'parties'
  const [activeSubTab, setActiveSubTab] = useState<'orders' | 'parties'>('orders');

  // Filters for sales orders
  const [partyFilter, setPartyFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [partyModalOpen, setPartyModalOpen] = useState(false);

  // New Outgoing Sales Entry Form
  const [selectedPartyId, setSelectedPartyId] = useState<string>(parties[0]?.id || '');
  const [selectedFgId, setSelectedFgId] = useState<string>(finishedGoods[0]?.id || '');
  const [quantityBoxes, setQuantityBoxes] = useState<number>(10);
  const [unitPrice, setUnitPrice] = useState<number>(1800);
  const [dispatchDate, setDispatchDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [orderNotes, setOrderNotes] = useState<string>('Dispatched via transport truck');
  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  // New Party Form
  const [partyName, setPartyName] = useState('');
  const [partyPerson, setPartyPerson] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [partyCity, setPartyCity] = useState('');
  const [partyState, setPartyState] = useState('Maharashtra');
  const [partyGst, setPartyGst] = useState('');
  const [partySaving, setPartySaving] = useState(false);

  // Distinct batch numbers from sales orders
  const distinctBatches = Array.from(
    new Set(salesOrders.map((o) => o.batchNumber).filter(Boolean))
  );

  // Selected finished good
  const activeFg = finishedGoods.find((f) => f.id === selectedFgId);

  // Filtered sales orders
  const filteredOrders = salesOrders.filter((order) => {
    const matchesSearch =
      order.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.batchNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesParty = partyFilter === 'all' || order.partyId === partyFilter;
    const matchesBatch = batchFilter === 'all' || order.batchNumber === batchFilter;

    return matchesSearch && matchesParty && matchesBatch;
  });

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPartyId || !selectedFgId || quantityBoxes <= 0) return;

    const pty = parties.find((p) => p.id === selectedPartyId);
    if (!pty) return;

    try {
      setOrderSubmitting(true);
      setOrderError(null);

      await recordSalesOrder({
        partyId: pty.id,
        partyName: pty.name,
        finishedGoodId: selectedFgId,
        quantityBoxes,
        unitPrice,
        date: dispatchDate,
        notes: orderNotes,
        userEmail: userProfile?.email || 'admin',
        userName: userProfile?.displayName || 'Staff',
      });

      setOrderModalOpen(false);
    } catch (err: any) {
      console.error('Order creation error:', err);
      setOrderError(err.message || 'Sales dispatch entry failed');
    } finally {
      setOrderSubmitting(false);
    }
  };

  const handleCreateParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partyName.trim()) return;

    try {
      setPartySaving(true);
      await saveParty(
        {
          code: `PTY-${Math.floor(100 + Math.random() * 900)}`,
          name: partyName.trim(),
          contactPerson: partyPerson.trim(),
          phone: partyPhone.trim(),
          city: partyCity.trim(),
          state: partyState.trim(),
          gstNumber: partyGst.trim(),
          status: 'active',
        },
        undefined,
        userProfile?.email || 'admin'
      );
      setPartyModalOpen(false);
      setPartyName('');
      setPartyPerson('');
      setPartyPhone('');
      setPartyCity('');
      setPartyGst('');
    } catch (err) {
      console.error('Error saving party:', err);
    } finally {
      setPartySaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Invoice #',
      'Date',
      'Party (Customer)',
      'Product Name',
      'Pack Size',
      'Batch Number',
      'Boxes Sold',
      'Units Sold',
      'Unit Price',
      'Total Amount',
      'Dispatched By',
      'Notes',
    ];
    const rows = filteredOrders.map((o) => [
      o.invoiceNumber,
      o.date,
      o.partyName,
      o.productName,
      o.packSize,
      o.batchNumber,
      o.quantityBoxes,
      o.quantityUnits,
      o.unitPrice,
      o.totalAmount,
      o.dispatchedByName,
      o.notes || '',
    ]);
    exportToCSV('Outgoing_Sales_Report', headers, rows);
  };

  const totalSalesRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalBoxesSold = filteredOrders.reduce((sum, o) => sum + (o.quantityBoxes || 0), 0);

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Outgoing & Sales Dispatch</h1>
              <p className="text-xs text-slate-500">
                Record customer dispatches by party and batch number. Automatically deducts finished warehouse stock.
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
            <span>Export Sales CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setPartyModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Building2 className="w-4 h-4 text-slate-600" />
            <span>Add Customer / Party</span>
          </button>

          {canMakeOutgoingEntry && (
            <button
              type="button"
              onClick={() => {
                if (finishedGoods.length === 0) {
                  alert('No finished goods available in warehouse. Record a production batch first!');
                  return;
                }
                setOrderError(null);
                setOrderModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Outgoing Entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Sub tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('orders')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'orders'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Outgoing Dispatches ({salesOrders.length})
        </button>

        <button
          onClick={() => setActiveSubTab('parties')}
          className={`pb-3 px-4 text-xs font-bold border-b-2 transition-all ${
            activeSubTab === 'parties'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Registered Parties / Dealers ({parties.length})
        </button>
      </div>

      {/* TAB 1: OUTGOING ORDERS */}
      {activeSubTab === 'orders' && (
        <div className="space-y-4">
          
          {/* KPI Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Dispatches</span>
              <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{salesOrders.length}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Boxes Sold</span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
                {formatQuantity(totalBoxesSold)} boxes
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Sales Value</span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
                {formatCurrency(totalSalesRevenue, currency)}
              </span>
            </div>
          </div>

          {/* Filters: Party & Batch Filter as requested */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by invoice #, party, product, or batch..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter by Party */}
            <div className="w-full md:w-56">
              <select
                value={partyFilter}
                onChange={(e) => setPartyFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-medium"
              >
                <option value="all">All Parties / Customers</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Filter by Batch Number */}
            <div className="w-full md:w-48">
              <select
                value={batchFilter}
                onChange={(e) => setBatchFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono font-medium"
              >
                <option value="all">All Batch Numbers</option>
                {distinctBatches.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Party (Customer)</th>
                    <th className="py-3 px-3">Product & Pack</th>
                    <th className="py-3 px-3 font-mono">Batch #</th>
                    <th className="py-3 px-3 text-right">Boxes Sold</th>
                    <th className="py-3 px-3 text-right">Units</th>
                    <th className="py-3 px-3 text-right">Price / Box</th>
                    <th className="py-3 px-3 text-right">Total Amount</th>
                    <th className="py-3 px-4">Dispatched By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400">
                        No sales dispatches match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{o.invoiceNumber}</td>
                        <td className="py-3 px-3 text-slate-500 font-mono">{o.date}</td>
                        <td className="py-3 px-3 font-bold text-slate-800">{o.partyName}</td>
                        <td className="py-3 px-3">
                          <span className="font-semibold text-slate-800">{o.productName}</span>
                          <span className="block text-[11px] text-emerald-800 font-mono font-bold">
                            {o.packSize}
                          </span>
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-slate-700">{o.batchNumber}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                          {formatQuantity(o.quantityBoxes)} boxes
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600">
                          {formatQuantity(o.quantityUnits)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-700">
                          {formatCurrency(o.unitPrice, currency)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-extrabold text-emerald-700">
                          {formatCurrency(o.totalAmount, currency)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-[120px]">
                          {o.dispatchedByName}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PARTIES DIRECTORY */}
      {activeSubTab === 'parties' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {parties.map((p) => (
            <div
              key={p.id}
              className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-emerald-300 transition-all"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="font-mono text-[10px] font-bold text-slate-400">{p.code}</span>
                  <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  {p.city}, {p.state}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-0.5">
                <div>Contact: <span className="font-semibold text-slate-800">{p.contactPerson}</span></div>
                <div>Phone: <span className="font-mono text-slate-700">{p.phone}</span></div>
                {p.gstNumber && <div>GST: <span className="font-mono text-slate-500">{p.gstNumber}</span></div>}
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Balance Due:</span>
                <span className="font-bold font-mono text-slate-800">
                  {p.balanceDue ? formatCurrency(p.balanceDue, currency) : 'Nil'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: New Outgoing Sales Entry */}
      {orderModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Outgoing Sales Entry</h3>
                <p className="text-xs text-slate-500">Deducts finished stock and logs sales order.</p>
              </div>
              <button onClick={() => setOrderModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {orderError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{orderError}</span>
              </div>
            )}

            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Customer / Party <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedPartyId}
                  onChange={(e) => setSelectedPartyId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold text-slate-800"
                >
                  {parties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Finished Goods Batch (in Warehouse) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedFgId}
                  onChange={(e) => setSelectedFgId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-bold text-slate-900"
                >
                  {finishedGoods.map((fg) => (
                    <option key={fg.id} value={fg.id}>
                      {fg.productName} ({fg.packSize}) — Batch: {fg.batchNumber} [Available: {fg.availableBoxes} boxes]
                    </option>
                  ))}
                </select>
                {activeFg && (
                  <span className="text-[11px] text-emerald-700 font-medium block mt-1">
                    Available in warehouse: {activeFg.availableBoxes} boxes ({activeFg.availableUnits} units)
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Boxes to Dispatch <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={activeFg?.availableBoxes || 9999}
                    required
                    value={quantityBoxes}
                    onChange={(e) => setQuantityBoxes(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Price per Box ({currency}) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Dispatch Date
                  </label>
                  <input
                    type="date"
                    required
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Estimated Total Bill
                  </label>
                  <div className="px-3 py-2 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-lg font-mono font-bold text-sm">
                    {formatCurrency(quantityBoxes * unitPrice, currency)}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Dispatch Notes / Vehicle #
                </label>
                <input
                  type="text"
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Transport name, LR number, vehicle number"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setOrderModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={orderSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {orderSubmitting ? 'Recording Dispatch...' : 'Confirm Outgoing Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Party */}
      {partyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Customer / Party Record</h3>
              <button onClick={() => setPartyModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateParty} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Party / Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  placeholder="e.g. Kisan Krishi Seva Kendra"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={partyPerson}
                    onChange={(e) => setPartyPerson(e.target.value)}
                    placeholder="Owner name"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={partyPhone}
                    onChange={(e) => setPartyPhone(e.target.value)}
                    placeholder="+91 98220..."
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={partyCity}
                    onChange={(e) => setPartyCity(e.target.value)}
                    placeholder="e.g. Akola"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    value={partyState}
                    onChange={(e) => setPartyState(e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={partyGst}
                  onChange={(e) => setPartyGst(e.target.value)}
                  placeholder="27AABCK..."
                  className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setPartyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={partySaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {partySaving ? 'Saving...' : 'Save Party'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
