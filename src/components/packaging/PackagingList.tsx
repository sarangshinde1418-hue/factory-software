import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  FileDown,
  Edit,
  ArrowDownToLine,
  MinusCircle,
  AlertTriangle,
  X,
  Save,
  Layers,
} from 'lucide-react';
import { PackagingMaterial, PackagingCategory, BottleType, StandardUnit } from '../../types/erp';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV } from '../../utils/export';
import { savePackagingMaterial, addPackagingStock, recordStockTransaction } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface PackagingListProps {
  packagingMaterials: PackagingMaterial[];
  currency?: string;
}

const CATEGORIES: PackagingCategory[] = [
  'Bottles',
  'Labels',
  'Cardboard Boxes',
  'Shrink Sleeves',
  'Buckets',
  'Bags',
  'Drums',
  'Pouches',
  'Other',
];

const BOTTLE_TYPES: BottleType[] = [
  'Imida',
  'Mono',
  'Ludo',
  'D.D',
  'PET',
  'A.T',
  'V.V',
  '24 Carat Gold',
  'PET Amrut',
];

export const PackagingList: React.FC<PackagingListProps> = ({
  packagingMaterials,
  currency = '₹',
}) => {
  const { userProfile, isOwner, isManager, canAddStock } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [bottleTypeFilter, setBottleTypeFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

  // Modals
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PackagingMaterial | null>(null);

  // Add Stock Modal
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [selectedForStock, setSelectedForStock] = useState<PackagingMaterial | null>(null);
  const [stockQty, setStockQty] = useState<number>(500);
  const [stockNotes, setStockNotes] = useState('');
  const [stockSaving, setStockSaving] = useState(false);

  // Deduct Stock Modal (Deduct bottle-wise / category-wise)
  const [deductModalOpen, setDeductModalOpen] = useState(false);
  const [selectedForDeduct, setSelectedForDeduct] = useState<PackagingMaterial | null>(null);
  const [deductQty, setDeductQty] = useState<number>(50);
  const [deductReason, setDeductReason] = useState('Damaged during capping / line reject');
  const [deductSaving, setDeductSaving] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<PackagingCategory>('Bottles');
  const [bottleType, setBottleType] = useState<BottleType>('PET');
  const [unit, setUnit] = useState<StandardUnit>('pieces');
  const [openingStock, setOpeningStock] = useState<number>(0);
  const [minimumStock, setMinimumStock] = useState<number>(500);
  const [unitCost, setUnitCost] = useState<number>(15);
  const [location, setLocation] = useState('Packaging Warehouse');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const filteredItems = packagingMaterials.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.bottleType && item.bottleType.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCat = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesBottle =
      bottleTypeFilter === 'all' || (item.category === 'Bottles' && item.bottleType === bottleTypeFilter);

    let matchesStock = true;
    if (stockFilter === 'low') matchesStock = item.currentStock > 0 && item.currentStock <= item.minimumStock;
    if (stockFilter === 'out') matchesStock = item.currentStock <= 0;

    return matchesSearch && matchesCat && matchesBottle && matchesStock;
  });

  const openAddEditModal = (item?: PackagingMaterial) => {
    if (item) {
      setEditingItem(item);
      setName(item.name);
      setCode(item.code);
      setCategory(item.category);
      setBottleType(item.bottleType || 'PET');
      setUnit(item.unit);
      setOpeningStock(item.openingStock);
      setMinimumStock(item.minimumStock);
      setUnitCost(item.unitCost);
      setLocation(item.location || '');
      setNotes(item.notes || '');
    } else {
      setEditingItem(null);
      setName('');
      setCode(`PKG-${Math.floor(100 + Math.random() * 900)}`);
      setCategory('Bottles');
      setBottleType('PET');
      setUnit('pieces');
      setOpeningStock(0);
      setMinimumStock(500);
      setUnitCost(15);
      setLocation('Packaging Bay P-01');
      setNotes('');
    }
    setMaterialModalOpen(true);
  };

  const handleSaveMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      setSaving(true);
      await savePackagingMaterial(
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          category,
          type: category.toLowerCase().replace(' ', '_'),
          bottleType: category === 'Bottles' ? bottleType : undefined,
          unit,
          openingStock: Number(openingStock) || 0,
          currentStock: editingItem ? editingItem.currentStock : Number(openingStock) || 0,
          minimumStock: Number(minimumStock) || 0,
          unitCost: Number(unitCost) || 0,
          location,
          notes,
          status: 'active',
        },
        editingItem?.id,
        userProfile?.email || 'admin'
      );
      setMaterialModalOpen(false);
    } catch (err) {
      console.error('Error saving packaging item:', err);
    } finally {
      setSaving(false);
    }
  };

  const openAddStock = (item: PackagingMaterial) => {
    setSelectedForStock(item);
    setStockQty(500);
    setStockNotes('New purchase inward from supplier');
    setStockModalOpen(true);
  };

  const handleAddStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForStock || stockQty <= 0) return;

    try {
      setStockSaving(true);
      await addPackagingStock(
        selectedForStock.id,
        Number(stockQty),
        stockNotes,
        userProfile?.email || 'admin',
        userProfile?.displayName || 'Admin'
      );
      setStockModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to add stock');
    } finally {
      setStockSaving(false);
    }
  };

  const openDeductModal = (item: PackagingMaterial) => {
    setSelectedForDeduct(item);
    setDeductQty(10);
    setDeductReason('Damaged / Broken / Machine rejection');
    setDeductModalOpen(true);
  };

  const handleDeductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForDeduct || deductQty <= 0) return;

    if (deductQty > selectedForDeduct.currentStock) {
      alert(`Cannot deduct ${deductQty} ${selectedForDeduct.unit}. Only ${selectedForDeduct.currentStock} in stock.`);
      return;
    }

    try {
      setDeductSaving(true);
      // Deduct stock using negative transaction and update
      await recordStockTransaction({
        transactionType: 'wastage',
        materialType: 'packaging',
        itemId: selectedForDeduct.id,
        itemName: selectedForDeduct.name,
        itemCode: selectedForDeduct.code,
        quantity: -Number(deductQty),
        unit: selectedForDeduct.unit,
        unitCost: selectedForDeduct.unitCost || 0,
        referenceType: 'manual',
        notes: deductReason,
        performedBy: userProfile?.email || 'admin',
        performedByName: userProfile?.displayName || 'Admin',
      });

      // Update packaging material stock
      await savePackagingMaterial(
        {
          code: selectedForDeduct.code,
          name: selectedForDeduct.name,
          category: selectedForDeduct.category,
          type: selectedForDeduct.type,
          bottleType: selectedForDeduct.bottleType,
          unit: selectedForDeduct.unit,
          openingStock: selectedForDeduct.openingStock,
          currentStock: selectedForDeduct.currentStock - Number(deductQty),
          minimumStock: selectedForDeduct.minimumStock,
          unitCost: selectedForDeduct.unitCost,
          location: selectedForDeduct.location,
          notes: selectedForDeduct.notes,
          status: selectedForDeduct.status,
        },
        selectedForDeduct.id,
        userProfile?.email || 'admin'
      );

      setDeductModalOpen(false);
    } catch (err: any) {
      alert(err.message || 'Failed to deduct stock');
    } finally {
      setDeductSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Code',
      'Item Name',
      'Category',
      'Bottle Type',
      'Current Stock',
      'Unit',
      'Min Alert',
      'Unit Cost',
      'Total Value',
      'Location',
    ];
    const rows = filteredItems.map((item) => [
      item.code,
      item.name,
      item.category,
      item.bottleType || '-',
      item.currentStock,
      item.unit,
      item.minimumStock,
      item.unitCost,
      (item.currentStock * item.unitCost).toFixed(2),
      item.location || '',
    ]);
    exportToCSV('Agro_Packing_Material_Stock', headers, rows);
  };

  const totalValue = filteredItems.reduce(
    (sum, item) => sum + (item.currentStock || 0) * (item.unitCost || 0),
    0
  );

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Packing Material Inventory</h1>
              <p className="text-xs text-slate-500">
                Manage bottles (Imida, Mono, Ludo, D.D, PET, A.T, V.V, Gold, Amrut), labels, boxes, sleeves, buckets, bags, drums & pouches.
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
              <span>Add Packing Item</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Packing SKUs</span>
          <span className="text-2xl font-extrabold text-slate-900 mt-1 block">{packagingMaterials.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block">Bottle Varieties</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block">
            {packagingMaterials.filter((i) => i.category === 'Bottles').length} types
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">Low Stock Alert</span>
          <span className="text-2xl font-extrabold text-amber-600 mt-1 block">
            {packagingMaterials.filter((i) => i.currentStock > 0 && i.currentStock <= i.minimumStock).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">Total Packaging Value</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
            {formatCurrency(totalValue, currency)}
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search packaging by name, bottle type, code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Category */}
        <div className="w-full md:w-44">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              if (e.target.value !== 'Bottles') setBottleTypeFilter('all');
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Bottle Type filter (if category is Bottles or all) */}
        {(categoryFilter === 'all' || categoryFilter === 'Bottles') && (
          <div className="w-full md:w-44">
            <select
              value={bottleTypeFilter}
              onChange={(e) => setBottleTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-emerald-50 border border-emerald-300 rounded-lg outline-none text-emerald-900 font-semibold"
            >
              <option value="all">All Bottle Types</option>
              {BOTTLE_TYPES.map((bt) => (
                <option key={bt} value={bt}>
                  {bt}
                </option>
              ))}
            </select>
          </div>
        )}

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
              {filter === 'all' ? 'All' : filter === 'low' ? 'Low Stock' : 'Zero'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100/70 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <th className="py-3 px-4">Item Name & Code</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Bottle Type Spec</th>
                <th className="py-3 px-3 text-right">In Stock</th>
                <th className="py-3 px-3 text-right">Min Alert</th>
                <th className="py-3 px-3 text-right">Unit Price</th>
                <th className="py-3 px-3">Location</th>
                <th className="py-3 px-4 text-right">Stock Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {filteredItems.map((item) => {
                const isLow = item.currentStock > 0 && item.currentStock <= item.minimumStock;
                const isOut = item.currentStock <= 0;

                return (
                  <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <span className="font-mono text-xs text-slate-500 font-semibold">{item.code}</span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {item.bottleType ? (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          {item.bottleType}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-xs">
                      <span className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-slate-900'}>
                        {formatQuantity(item.currentStock)} {item.unit}
                      </span>
                      {isLow && (
                        <span className="block text-[10px] text-amber-600 font-bold uppercase">
                          Low Stock
                        </span>
                      )}
                      {isOut && (
                        <span className="block text-[10px] text-rose-600 font-bold uppercase">
                          Depleted
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-500">
                      {formatQuantity(item.minimumStock)} {item.unit}
                    </td>

                    <td className="py-3 px-3 text-right font-mono text-xs text-slate-700">
                      {formatCurrency(item.unitCost, currency)}
                    </td>

                    <td className="py-3 px-3 text-xs text-slate-500">
                      {item.location || 'Warehouse'}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {canAddStock && (
                          <>
                            <button
                              type="button"
                              onClick={() => openAddStock(item)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                              title="Add incoming stock"
                            >
                              <ArrowDownToLine className="w-3.5 h-3.5" />
                              <span>Inward</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openDeductModal(item)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all"
                              title="Deduct bottle-wise or damaged items"
                            >
                              <MinusCircle className="w-3.5 h-3.5" />
                              <span>Deduct</span>
                            </button>
                          </>
                        )}

                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => openAddEditModal(item)}
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

      {/* Modal: Add Stock */}
      {stockModalOpen && selectedForStock && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Inward Stock: {selectedForStock.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Current: {formatQuantity(selectedForStock.currentStock)} {selectedForStock.unit}
                </span>
              </div>
              <button onClick={() => setStockModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddStockSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Quantity ({selectedForStock.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={stockQty}
                  onChange={(e) => setStockQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Supplier / Inward Notes
                </label>
                <input
                  type="text"
                  value={stockNotes}
                  onChange={(e) => setStockNotes(e.target.value)}
                  placeholder="e.g. Received 5,000 bottles from PET vendor"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setStockModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={stockSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {stockSaving ? 'Submitting...' : 'Submit Add Stock'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Deduct Stock (Bottle-wise / category-wise) */}
      {deductModalOpen && selectedForDeduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div>
                <h3 className="text-base font-bold text-rose-800">
                  Deduct Stock: {selectedForDeduct.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Available in Stock: {formatQuantity(selectedForDeduct.currentStock)} {selectedForDeduct.unit}
                </span>
              </div>
              <button onClick={() => setDeductModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleDeductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Quantity to Deduct ({selectedForDeduct.unit}) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedForDeduct.currentStock}
                  required
                  value={deductQty}
                  onChange={(e) => setDeductQty(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold font-mono bg-slate-50 border border-rose-300 text-rose-900 rounded-lg outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Reason for Deduction
                </label>
                <input
                  type="text"
                  required
                  value={deductReason}
                  onChange={(e) => setDeductReason(e.target.value)}
                  placeholder="e.g. Line breakage, damaged cartons, scrap"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setDeductModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deductSaving}
                  className="px-5 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs"
                >
                  {deductSaving ? 'Deducting...' : 'Confirm Deduction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Material */}
      {materialModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingItem ? `Edit: ${editingItem.name}` : 'Add Packing Item'}
              </h3>
              <button onClick={() => setMaterialModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMaterial} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. 1L Imida HDPE Round Bottle"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. PKG-BTL-1L-IMIDA"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PackagingCategory)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {category === 'Bottles' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bottle Type</label>
                    <select
                      value={bottleType}
                      onChange={(e) => setBottleType(e.target.value as BottleType)}
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold"
                    >
                      {BOTTLE_TYPES.map((bt) => (
                        <option key={bt} value={bt}>
                          {bt}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Unit</label>
                    <select
                      value={unit}
                      onChange={(e) => setUnit(e.target.value)}
                      className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                    >
                      <option value="pieces">pieces</option>
                      <option value="boxes">boxes</option>
                      <option value="meters">meters</option>
                      <option value="kg">kg</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {editingItem ? 'Current Stock' : 'Opening Stock'}
                  </label>
                  <input
                    type="number"
                    value={editingItem ? editingItem.currentStock : openingStock}
                    onChange={(e) => setOpeningStock(Number(e.target.value))}
                    disabled={!!editingItem}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Min Alert</label>
                  <input
                    type="number"
                    value={minimumStock}
                    onChange={(e) => setMinimumStock(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Unit Cost ({currency})</label>
                  <input
                    type="number"
                    step="any"
                    value={unitCost}
                    onChange={(e) => setUnitCost(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Warehouse Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Packaging Bay P-01"
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {saving ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
