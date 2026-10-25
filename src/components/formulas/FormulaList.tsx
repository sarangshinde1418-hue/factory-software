import React, { useState } from 'react';
import {
  Beaker,
  Plus,
  Search,
  FileDown,
  Edit,
  Trash2,
  Package,
  Layers,
  Sparkles,
  ChevronRight,
} from 'lucide-react';
import { Formula, Product, RawMaterial, PackagingMaterial } from '../../types/erp';
import { exportToCSV } from '../../utils/export';
import { deleteFormula } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface FormulaListProps {
  formulas: Formula[];
  products: Product[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  onNewFormula: () => void;
  onEditFormula: (formula: Formula) => void;
}

export const FormulaList: React.FC<FormulaListProps> = ({
  formulas,
  products,
  rawMaterials,
  packagingMaterials,
  onNewFormula,
  onEditFormula,
}) => {
  const { userProfile, isOwner } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState('all');

  const filteredFormulas = formulas.filter((f) => {
    const matchesSearch =
      f.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.productCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.packSize.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesProd = productFilter === 'all' || f.productId === productFilter;
    return matchesSearch && matchesProd;
  });

  const handleDelete = async (formula: Formula) => {
    if (window.confirm(`Delete formula for ${formula.productName} (${formula.packSize})?`)) {
      try {
        await deleteFormula(formula.id, userProfile?.email || 'admin');
      } catch (err) {
        console.error('Delete formula error:', err);
      }
    }
  };

  const handleExportCSV = () => {
    const headers = [
      'Product Code',
      'Product Name',
      'Pack Size',
      'Version',
      'Batch Unit',
      'Raw Ingredients Count',
      'Raw Ingredients Summary',
      'Packing Items Count',
      'Packing Items Summary',
      'Notes',
    ];
    const rows = filteredFormulas.map((f) => [
      f.productCode,
      f.productName,
      f.packSize,
      f.version,
      f.referenceBatchUnit,
      f.ingredients.length,
      f.ingredients.map((i) => `${i.materialName}: ${i.quantity}${i.unit}`).join('; '),
      (f.packagingComponents || []).length,
      (f.packagingComponents || []).map((p) => `${p.materialName}: ${p.quantityPerUnitOrBox}${p.unit}`).join('; '),
      f.notes || '',
    ]);
    exportToCSV('Agro_Fertilizer_Formulas', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Beaker className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Formula Engine</h1>
              <p className="text-xs text-slate-500">
                Product formulations with raw material & packing material specifications per box/unit.
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

          {isOwner && (
            <button
              type="button"
              onClick={onNewFormula}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create New Formula</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search formulas by product name, code, pack size..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="w-full md:w-56">
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formulas List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredFormulas.map((f) => {
          return (
            <div
              key={f.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-emerald-300 transition-all space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-slate-900">{f.productName}</h3>
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                      {f.packSize}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500 bg-slate-100">
                      v{f.version}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-slate-400 font-semibold block mt-0.5">
                    {f.productCode} • Scale: 1 {f.referenceBatchUnit}
                  </span>
                </div>

                {isOwner && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditFormula(f)}
                      className="p-1.5 text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg"
                      title="Edit Formula"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(f)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Raw Material Breakdown */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5 text-xs">
                <span className="font-bold text-slate-700 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Raw Materials ({f.ingredients.length} items)</span>
                </span>
                <ul className="space-y-1 text-slate-600 text-[11px]">
                  {f.ingredients.map((ing, i) => (
                    <li key={i} className="flex justify-between font-mono">
                      <span className="truncate max-w-[200px] text-slate-700">{ing.materialName}</span>
                      <span className="font-bold text-slate-900">{ing.quantity} {ing.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Packaging Breakdown */}
              <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1.5 text-xs">
                <span className="font-bold text-emerald-900 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <Package className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Packing Items ({f.packagingComponents?.length || 0} items)</span>
                </span>
                <ul className="space-y-1 text-emerald-800 text-[11px]">
                  {(f.packagingComponents || []).map((pkg, i) => (
                    <li key={i} className="flex justify-between font-mono">
                      <span className="truncate max-w-[200px]">{pkg.materialName}</span>
                      <span className="font-bold text-emerald-950">{pkg.quantityPerUnitOrBox} {pkg.unit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {f.notes && (
                <p className="text-xs text-slate-500 italic border-t border-slate-100 pt-2">
                  Note: {f.notes}
                </p>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
};
