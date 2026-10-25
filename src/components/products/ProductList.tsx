import React, { useState } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  FileDown,
  Edit,
  CheckCircle2,
  PackageCheck,
  Layers,
  Sparkles,
  X,
  Save,
  HelpCircle,
} from 'lucide-react';
import { Product, BoxPackingRule } from '../../types/erp';
import { exportToCSV } from '../../utils/export';
import { saveProduct } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface ProductListProps {
  products: Product[];
  onSelectProductForFormula?: (product: Product) => void;
  onSelectProductForProduction?: (product: Product) => void;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  onSelectProductForFormula,
  onSelectProductForProduction,
}) => {
  const { userProfile, isOwner } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState<Product['category']>('Liquid Fertilizer');
  const [productType, setProductType] = useState<'liquid' | 'powder' | 'granules'>('liquid');
  const [packSizes, setPackSizes] = useState<string[]>(['1L', '500ml', '250ml']);
  const [packSizesInput, setPackSizesInput] = useState('1L, 500ml, 250ml');
  const [boxRules, setBoxRules] = useState<BoxPackingRule[]>([
    { packSize: '1L', unitsPerBox: 10, containerType: 'bottle', labelCountPerBox: 10, sleeveCountPerBox: 10, boxCountPerBox: 1 },
    { packSize: '500ml', unitsPerBox: 20, containerType: 'bottle', labelCountPerBox: 20, sleeveCountPerBox: 20, boxCountPerBox: 1 },
  ]);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Categories list
  const categories = Array.from(new Set(products.map((p) => p.category).filter(Boolean)));

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesType = typeFilter === 'all' || p.productType === typeFilter;

    return matchesSearch && matchesCat && matchesType;
  });

  const openModal = (p?: Product) => {
    if (p) {
      setEditingProduct(p);
      setName(p.name);
      setCode(p.code);
      setCategory(p.category);
      setProductType(p.productType);
      setPackSizes(p.packSizes || []);
      setPackSizesInput((p.packSizes || []).join(', '));
      setBoxRules(p.boxRules || []);
      setDescription(p.description || '');
    } else {
      setEditingProduct(null);
      setName('');
      setCode(`AGRO-${Math.floor(100 + Math.random() * 900)}`);
      setCategory('Liquid Fertilizer');
      setProductType('liquid');
      setPackSizes(['1L', '500ml', '250ml']);
      setPackSizesInput('1L, 500ml, 250ml');
      setBoxRules([
        { packSize: '1L', unitsPerBox: 10, containerType: 'bottle', labelCountPerBox: 10, sleeveCountPerBox: 10, boxCountPerBox: 1 },
        { packSize: '500ml', unitsPerBox: 20, containerType: 'bottle', labelCountPerBox: 20, sleeveCountPerBox: 20, boxCountPerBox: 1 },
      ]);
      setDescription('');
    }
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    try {
      setSaving(true);
      const parsedPackSizes = packSizesInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      await saveProduct(
        {
          code: code.trim().toUpperCase(),
          name: name.trim(),
          category,
          productType,
          packSizes: parsedPackSizes,
          boxRules,
          description,
          status: 'active',
        },
        editingProduct?.id,
        userProfile?.email || 'admin'
      );
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving product:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Code', 'Product Name', 'Category', 'Form Type', 'Pack Sizes', 'Box Rules', 'Status'];
    const rows = filteredProducts.map((p) => [
      p.code,
      p.name,
      p.category,
      p.productType,
      (p.packSizes || []).join('; '),
      (p.boxRules || []).map((r) => `${r.packSize} x${r.unitsPerBox} = 1 box`).join('; '),
      p.status,
    ]);
    exportToCSV('Agro_Fertilizer_Products_Catalog', headers, rows);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Agro Products Catalog</h1>
              <p className="text-xs text-slate-500">
                18 Agro-Fertilizers with configured pack sizes, box packaging rules, and unit scaling.
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
              onClick={() => openModal()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Product</span>
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
            placeholder="Search products by name (e.g. Humistar, Bioshakti G, Amrutgold)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="w-full md:w-52">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-stretch md:self-auto">
          {(['all', 'liquid', 'powder', 'granules'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all capitalize ${
                typeFilter === t
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((p) => {
          return (
            <div
              key={p.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs hover:border-emerald-300 transition-all flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      {p.code}
                    </span>
                    <h3 className="text-base font-extrabold text-slate-900 mt-0.5">{p.name}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 capitalize">
                    {p.productType}
                  </span>
                </div>

                <div className="mt-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{p.category}</span>
                </div>

                {/* Pack Sizes */}
                <div className="mt-3 space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Available Pack Sizes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {p.packSizes.map((size) => (
                      <span
                        key={size}
                        className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                      >
                        {size}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Box Rules */}
                <div className="mt-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
                  <span className="font-bold text-slate-700 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Box Packaging Rules</span>
                  </span>
                  {p.boxRules && p.boxRules.length > 0 ? (
                    <ul className="space-y-0.5 text-slate-600 text-[11px]">
                      {p.boxRules.map((r, i) => (
                        <li key={i} className="flex justify-between font-mono">
                          <span>{r.packSize}</span>
                          <span className="font-bold text-slate-800">{r.unitsPerBox} {r.containerType}s = 1 Box</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-[11px] text-slate-400 italic">Standard 1 unit packing</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => openModal(p)}
                    className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1"
                  >
                    <Edit className="w-3.5 h-3.5" />
                    <span>Edit Specs</span>
                  </button>
                )}

                <div className="flex items-center gap-1.5 ml-auto">
                  {onSelectProductForProduction && (
                    <button
                      type="button"
                      onClick={() => onSelectProductForProduction(p)}
                      className="px-2.5 py-1 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-all"
                    >
                      Produce
                    </button>
                  )}
                  {onSelectProductForFormula && (
                    <button
                      type="button"
                      onClick={() => onSelectProductForFormula(p)}
                      className="px-2.5 py-1 text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-all"
                    >
                      Formula
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal: Add / Edit Product */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                {editingProduct ? `Edit ${editingProduct.name}` : 'Add New Agro Product'}
              </h3>
              <button onClick={() => setModalOpen(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Humistar, Bioshakti G"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Product Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. AGRO-019"
                    className="w-full px-3 py-2 text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Product['category'])}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                  >
                    <option value="Liquid Fertilizer">Liquid Fertilizer</option>
                    <option value="Granular Fertilizer">Granular Fertilizer</option>
                    <option value="Bio-Stimulant">Bio-Stimulant</option>
                    <option value="Organic PGR">Organic PGR</option>
                    <option value="Micronutrient">Micronutrient</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Form Type</label>
                  <select
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as any)}
                    className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none capitalize"
                  >
                    <option value="liquid">Liquid</option>
                    <option value="powder">Powder</option>
                    <option value="granules">Granules</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Pack Sizes (Comma separated)
                </label>
                <input
                  type="text"
                  value={packSizesInput}
                  onChange={(e) => setPackSizesInput(e.target.value)}
                  placeholder="e.g. 1L, 500ml, 250ml, 100ml"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="High yield agro formulation notes"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
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
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
                >
                  {saving ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
