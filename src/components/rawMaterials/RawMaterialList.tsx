import React, { useState } from 'react';
import {
  FlaskConical,
  Plus,
  Search,
  Filter,
  FileDown,
  Edit,
  ArrowDownToLine,
  AlertTriangle,
  Layers,
  Sparkles,
  X,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { RawMaterial, StandardUnit, PhysicalForm } from '../../types/erp';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { saveRawMaterial, addRawMaterialStock } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface RawMaterialListProps {
  materials: RawMaterial[];
  currency?: string;
}

const CATEGORIES = [
  'Granules',
  'Bentonite',
  'Chemicals',
  'Humic Acid',
  'Fulvic',
  'Amino Acids',
  'Solvents',
  'Micronutrients',
  'Other',
];

export const RawMaterialList: React.FC<RawMaterialListProps> = ({
  materials,
  currency = '₹',
}) => {
  const { userProfile, isOwner, isManager, canAddStock } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);

  const [addStockModalOpen, setAddStockModalOpen] = useState(false);
  const [selectedForStock, setSelectedForStock] = useState<RawMaterial | null>(null);
  const [stockAmount, setStockAmount] = useState<number>(100);
  const [batchNum, setBatchNum] = useState<string>('');
  const [lotNum, setLotNum] = useState<string>('');
  const [stockNotes, setStockNotes] = useState<string>('');
  const [stockSaving, setStockSaving] = useState<boolean>(false);

  // Material Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Granules');
  const [physicalForm, setPhysicalForm] = useState<PhysicalForm>('granules');
  const [unit, setUnit] = useState<StandardUnit>('kg');
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [minimumStock, setMinimumStock] = useState<number>(200);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [batch200Qty, setBatch200Qty] = useState<number>(20);
  const [batch500Qty, setBatch500Qty] = useState<number>(50);
  const [location, setLocation] = useState('Raw Material Shed A');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Filter
  const filteredMaterials = materials.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.category && m.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (m.lotNumber && m.lotNumber.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = categoryFilter === 'all' || m.category === categoryFilter;

    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = m.currentStock > 0 && m.currentStock <= m.minimumStock;
    if (stockFilter === 'out') matchesStock = m.currentStock <= 0;

    return matchesSearch && matchesCat && matchesStock;
  });

  const openAddEditModal = (item?: RawMaterial) => {
    if (item) {
      setEditingMaterial(item);
      setName(item.name);
      setCode(item.code);
      setCategory(item.category);
      setPhysicalForm(item.physicalForm);
      setUnit(item.unit);
      setOpeningStock(item.openingStock);
      setMinimumStock(item.minimumStock);
      setUnitCost(item.unitCost);
      setBatch200Qty(item.batch200Qty || 20);
      setBatch500Qty(item.batch500Qty || 50);
      setLocation(item.location || '');
      setNotes(item.notes || '');
    } else {
      setEditingMaterial(null);
      setName('');
      setCode(`RM-${Math.floor(100 + Math.random() * 900)}`);
      setCategory('Granules');
      setPhysicalForm('granules');
      setUnit('kg');
      setOpeningStock(0);
      setMinimumStock(200);
      setUnitCost(50);
      setBatch200Qty(20);
      setBatch500Qty(50);
      setLocation('Raw Material Shed A');
      setNotes('');
    }
    setMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      setSaving(true);
      await saveRawMaterial(
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          category,
          physicalForm,
          unit,
          openingStock: Number(openingStock) || 0,
          currentStock: editingMaterial ? editingMaterial.currentStock : Number(openingStock) || 0,
          minimumStock: Number(minimumStock) || 0,
          unitCost: Number(unitCost) || 0,
          batch200Qty: Number(batch200Qty) || 0,
          batch500Qty: Number(batch500Qty) || 0,
          location,
          notes,
          status: 'active',
        },
        editingMaterial?.id,
        userProfile?.email || 'admin'
      );
      setMaterialModalOpen(false);
    } catch (err) {
      console.error('Error saving raw material:', err);
    } finally {
      setSaving(false);
    }
  };

  const openAddStockModal = (item: RawMaterial) => {
    setSelectedForStock(item);
    setStockAmount(100);
    setBatchNum(`B200-${new Date().toISOString().slice(2, 7).replace('-', '')}`);
    setLotNum(item.lotNumber || `LOT-${Math.floor(1000 + Math.random() * 9000)}`);
    setStockNotes('Purchase receipt inward');
    setAddStockModalOpen(true);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForStock || stockAmount <= 0) return;

    try {
      setStockSaving(true);
      await addRawMaterialStock(
        selectedForStock.id,
        Number(stockAmount),
        batchNum,
        lotNum,
        stockNotes,
        userProfile?.email || 'admin',
        userProfile?.displayName || 'Admin'
      );
      setAddStockModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add stock');
    } finally {
      setStockSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Code',
      'Material Name',
      'Category',
      'Form',
      'Current Stock',
      'Unit',
      '200 Batch Req',
      '500 Batch Req',
      '200 Batches Possible',
      'Min Stock',
      'Unit Cost',
      'Total Value',
      'Lot #',
      'Location',
    ];
    const rows = filteredMaterials.map((m) => {
      const batches200 = m.batch200Qty && m.batch200Qty > 0 ? (m.currentStock / m.batch200Qty).toFixed(1) : '-';
      return [
        m.code,
        m.name,
        m.category,
        m.physicalForm,
        m.currentStock,
        m.unit,
        m.batch200Qty || '-',
        m.batch500Qty || '-',
        batches200,
        m.minimumStock,
        m.unitCost,
        (m.currentStock * m.unitCost).toFixed(2),
        m.lotNumber || '',
        m.location || '',
      ];
    });
    exportToCSV('Agro_Raw_Materials_Stock', headers, rows);
  };

  const totalRawStockValuation = filteredMaterials.reduce(
    (sum, m) => sum + (m.currentStock || 0) * (m.unitCost || 0),
    0
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <FlaskConical className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Raw Material Management</h1>
              <p className="text-xs text-slate-500">
                Track granules, bentonite, humic, fulvic, and chemicals with dedicated 200/500 batch planning columns.
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

          {(isOwner || isManager) && (
            <button
              type="button"
              onClick={() => openAddEditModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Raw Material</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Materials</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{materials.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Low Stock Alert</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
            {materials.filter((m) => m.currentStock > 0 && m.currentStock <= m.minimumStock).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600 block">Depleted / Zero</span>
          <span className="text-2xl font-extrabold text-rose-600 mt-1 block">
            {materials.filter((m) => m.currentStock <= 0).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Stock Value</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
            {formatCurrency(totalRawStockValuation, currency)}
          </span>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search raw materials by name, code, category, or lot..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="w-full md:w-52">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch md:self-auto">
          {(['all', 'low', 'out'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setStockFilter(filter)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                stockFilter === filter
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {filter === 'all' ? 'All Stock' : filter === 'low' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      {/* Table with separate batch columns (200 batch / 500 batch) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Material Details</th>
                <th className="py-3 px-3">Category & Form</th>
                <th className="py-3 px-3 text-right">In Stock</th>
                <th className="py-3 px-3 text-center bg-blue-50/50 text-blue-900 border-x border-blue-100">
                  200 Batch Req
                </th>
                <th className="py-3 px-3 text-center bg-indigo-50/50 text-indigo-900 border-r border-indigo-100">
                  500 Batch Req
                </th>
                <th className="py-3 px-3 text-right">Min Stock</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3">Lot # / Location</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredMaterials.map((m) => {
                const isLow = m.currentStock > 0 && m.currentStock <= m.minimumStock;
                const isOut = m.currentStock <= 0;
                const batches200Possible = m.batch200Qty && m.batch200Qty > 0 ? (m.currentStock / m.batch200Qty).toFixed(1) : '-';

                return (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{m.name}</div>
                      <span className="font-mono text-xs font-semibold text-slate-500">{m.code}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {m.category}
                      </span>
                      <span className="block text-[11px] text-slate-400 capitalize mt-0.5">
                        {m.physicalForm} ({m.unit})
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-xs">
                      <span
                        className={
                          isOut
                            ? 'text-rose-600'
                            : isLow
                            ? 'text-amber-600'
                            : 'text-slate-900'
                        }
                      >
                        {formatQuantity(m.currentStock)} {m.unit}
                      </span>
                      {isLow && (
                        <span className="block text-[10px] text-amber-600 font-bold uppercase">
                          Low Stock
                        </span>
                      )}
                      {isOut && (
                        <span className="block text-[10px] text-rose-600 font-bold uppercase">
                          Empty
                        </span>
                      )}
                    </td>

                    {/* 200 Batch Column */}
                    <td className="py-3 px-3 text-center bg-blue-50/30 border-x border-blue-100 text-xs font-mono">
                      <span className="font-bold text-blue-900 block">
                        {m.batch200Qty ? `${m.batch200Qty} ${m.unit}` : '-'}
                      </span>
                      <span className="text-[10px] text-blue-600">
                        {batches200Possible !== '-' ? `(${batches200Possible} batches)` : ''}
                      </span>
                    </td>

                    {/* 500 Batch Column */}
                    <td className="py-3 px-3 text-center bg-indigo-50/30 border-r border-indigo-100 text-xs font-mono font-bold text-indigo-900">
                      {m.batch500Qty ? `${m.batch500Qty} ${m.unit}` : '-'}
                    </td>

                    <td className="py-3 px-3 text-right text-xs font-mono text-slate-500">
                      {formatQuantity(m.minimumStock)} {m.unit}
                    </td>

                    <td className="py-3 px-3 text-right text-xs font-mono text-slate-700">
                      {formatCurrency(m.unitCost, currency)}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-600">
                      <div className="font-mono text-slate-800 font-medium">
                        {m.lotNumber ? `Lot: ${m.lotNumber}` : '-'}
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block max-w-[140px]">
                        {m.location || 'Warehouse'}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canAddStock && (
                          <button
                            type="button"
                            onClick={() => openAddStockModal(m)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                            title="Add stock for this material"
                          >
                            <ArrowDownToLine className="w-3.5 h-3.5" />
                            <span>Add Stock</span>
                          </button>
                        )}

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => openAddEditModal(m)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal 1: Add Stock Form with Submit Button */}
      {addStockModalOpen && selectedForStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Add Stock: {selectedForStock.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Current Stock: {formatQuantity(selectedForStock.currentStock)} {selectedForStock.unit}
                </span>
              </div>
              <button
                onClick={() => setAddStockModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Quantity to Add ({selectedForStock.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  required
                  value={stockAmount}
                  onChange={(e) => setStockAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="e.g. 500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Batch Allocation
                  </label>
                  <input
                    type="text"
                    value={batchNum}
                    onChange={(e) => setBatchNum(e.target.value)}
                    placeholder="e.g. 200 batch / B-01"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Lot Number
                  </label>
                  <input
                    type="text"
                    value={lotNum}
                    onChange={(e) => setLotNum(e.target.value)}
                    placeholder="e.g. LOT-4912"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Notes / Receipt Ref
                </label>
                <input
                  type="text"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  placeholder="Invoice number, supplier name, quality check"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAddStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-4 h-4" />
                  <span>{stockSaving ? 'Submitting...' : 'Submit Inward Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Material */}
      {materialModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingMaterial ? `Edit: ${editingMaterial.name}` : 'Add New Raw Material'}
              </h3>
              <button
                onClick={() => setMaterialModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Material Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Potassium Humate 98%"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Material Code <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. RM-HUM-98"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Form</label>
                  <select
                    value={physicalForm}
                    onChange={(e) => setPhysicalForm(e.target.value as PhysicalForm)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none capitalize"
                  >
                    <option value="granules">Granules</option>
                    <option value="powder">Powder</option>
                    <option value="liquid">Liquid</option>
                    <option value="chemical">Chemical</option>
                    <option value="paste">Paste</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="kg">kg</option>
                    <option value="l">Litre (L)</option>
                    <option value="g">gram (g)</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingMaterial ? 'Current Stock' : 'Opening Stock'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={editingMaterial ? editingMaterial.currentStock : openingStock}
                    onChange={(e) => setOpeningStock(Number(e.target.value))}
                    disabled={!!editingMaterial}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Alert Stock</label>
                  <input
                    type="number"
                    step="any"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Cost / Unit ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              {/* Dedicated 200 / 500 Batch Sizing Inputs */}
              <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-lg space-y-2">
                <span className="text-xs font-bold text-emerald-900 block">
                  Batch Sizing Standard Quantities
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                      Qty for 200 Batch ({unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={batch200Qty}
                      onChange={(e) => setBatch200Qty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded outline-none"
                      placeholder="e.g. 40"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-emerald-800 mb-1">
                      Qty for 500 Batch ({unit})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={batch500Qty}
                      onChange={(e) => setBatch500Qty(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded outline-none"
                      placeholder="e.g. 100"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Raw Material Shed 1, Bay B"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setMaterialModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Saving...' : editingMaterial ? 'Update Material' : 'Save Material'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
