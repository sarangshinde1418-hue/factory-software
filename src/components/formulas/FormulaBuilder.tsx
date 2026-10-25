import React, { useState } from 'react';
import {
  Beaker,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Package,
  Layers,
  ArrowRight,
  Info,
  X,
  Edit,
  Sparkles,
} from 'lucide-react';
import {
  Formula,
  FormulaIngredient,
  FormulaPackagingComponent,
  Product,
  RawMaterial,
  PackagingMaterial,
  PackagingCategory,
  StandardUnit,
} from '../../types/erp';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { saveFormula, deleteFormula } from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface FormulaBuilderProps {
  initialFormula?: Formula | null;
  products: Product[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  onSaveSuccess: (formulaId: string) => void;
  onCancel: () => void;
  currency?: string;
}

export const FormulaBuilder: React.FC<FormulaBuilderProps> = ({
  initialFormula,
  products,
  rawMaterials,
  packagingMaterials,
  onSaveSuccess,
  onCancel,
  currency = '₹',
}) => {
  const { userProfile, isOwner } = useAuth();

  const [productId, setProductId] = useState<string>(
    initialFormula?.productId || products[0]?.id || ''
  );
  const selectedProduct = products.find((p) => p.id === productId);

  const [packSize, setPackSize] = useState<string>(
    initialFormula?.packSize || selectedProduct?.packSizes[0] || '1L'
  );
  const [version, setVersion] = useState<string>(initialFormula?.version || '1.0');
  const [referenceBatchSize, setReferenceBatchSize] = useState<number>(
    initialFormula?.referenceBatchSize || 1
  );
  const [referenceBatchUnit, setReferenceBatchUnit] = useState<StandardUnit>(
    initialFormula?.referenceBatchUnit || 'boxes'
  );

  // Ingredients (Raw Materials)
  const [ingredients, setIngredients] = useState<FormulaIngredient[]>(
    initialFormula?.ingredients && initialFormula.ingredients.length > 0
      ? initialFormula.ingredients
      : [
          {
            rawMaterialId: rawMaterials[0]?.id || '',
            materialName: rawMaterials[0]?.name || '',
            materialCode: rawMaterials[0]?.code || '',
            quantity: 2.0,
            unit: 'kg',
          },
        ]
  );

  // Packaging Components (Labels, Bottles, Boxes, Sleeves, Buckets, Bags, Drums, Pouches)
  const [packagingComponents, setPackagingComponents] = useState<FormulaPackagingComponent[]>(
    initialFormula?.packagingComponents && initialFormula.packagingComponents.length > 0
      ? initialFormula.packagingComponents
      : [
          {
            packagingMaterialId: packagingMaterials[0]?.id || '',
            materialName: packagingMaterials[0]?.name || '',
            materialCategory: packagingMaterials[0]?.category || 'Bottles',
            quantityPerUnitOrBox: 10,
            unit: 'pieces',
          },
        ]
  );

  // Custom Fields (Option to add new fields anytime!)
  const [customFields, setCustomFields] = useState<{ [key: string]: string }>(
    initialFormula?.customFields || {}
  );
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');

  const [notes, setNotes] = useState(initialFormula?.notes || '');
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Quick Load Defaults Helper
  const applyPresetDefault = () => {
    if (!selectedProduct) return;
    const pName = selectedProduct.name.toLowerCase();

    if (pName.includes('humistar') || pName.includes('panchratna') || selectedProduct.productType === 'liquid') {
      // Find PET bottle, labels, sleeve, box
      const petBottle = packagingMaterials.find((m) => m.category === 'Bottles' && m.name.includes('1 Litre')) || packagingMaterials[0];
      const label = packagingMaterials.find((m) => m.category === 'Labels') || packagingMaterials[1];
      const sleeve = packagingMaterials.find((m) => m.category === 'Shrink Sleeves') || packagingMaterials[2];
      const box = packagingMaterials.find((m) => m.category === 'Cardboard Boxes') || packagingMaterials[3];

      setPackagingComponents([
        {
          packagingMaterialId: petBottle.id,
          materialName: petBottle.name,
          materialCategory: petBottle.category,
          quantityPerUnitOrBox: 10,
          unit: 'pieces',
          notes: '10 bottles per box',
        },
        {
          packagingMaterialId: label?.id || petBottle.id,
          materialName: label?.name || 'Label',
          materialCategory: 'Labels',
          quantityPerUnitOrBox: 10,
          unit: 'pieces',
        },
        {
          packagingMaterialId: sleeve?.id || petBottle.id,
          materialName: sleeve?.name || 'Shrink Sleeve',
          materialCategory: 'Shrink Sleeves',
          quantityPerUnitOrBox: 10,
          unit: 'pieces',
        },
        {
          packagingMaterialId: box?.id || petBottle.id,
          materialName: box?.name || 'Cardboard Box',
          materialCategory: 'Cardboard Boxes',
          quantityPerUnitOrBox: 1,
          unit: 'pieces',
        },
      ]);
    } else if (pName.includes('bioshakti') || pName.includes('humipower')) {
      const bucket = packagingMaterials.find((m) => m.category === 'Buckets') || packagingMaterials[0];
      const bag = packagingMaterials.find((m) => m.category === 'Bags') || packagingMaterials[0];
      const drum = packagingMaterials.find((m) => m.category === 'Drums') || packagingMaterials[0];
      const label = packagingMaterials.find((m) => m.category === 'Labels') || packagingMaterials[1];

      if (packSize.includes('10kg')) {
        setPackagingComponents([
          { packagingMaterialId: bucket.id, materialName: bucket.name, materialCategory: 'Buckets', quantityPerUnitOrBox: 1, unit: 'pieces' },
          { packagingMaterialId: label.id, materialName: label.name, materialCategory: 'Labels', quantityPerUnitOrBox: 1, unit: 'pieces' },
        ]);
      } else if (packSize.includes('25kg')) {
        setPackagingComponents([
          { packagingMaterialId: bag.id, materialName: bag.name, materialCategory: 'Bags', quantityPerUnitOrBox: 1, unit: 'pieces' },
          { packagingMaterialId: label.id, materialName: label.name, materialCategory: 'Labels', quantityPerUnitOrBox: 1, unit: 'pieces' },
        ]);
      } else {
        setPackagingComponents([
          { packagingMaterialId: drum.id, materialName: drum.name, materialCategory: 'Drums', quantityPerUnitOrBox: 1, unit: 'pieces' },
          { packagingMaterialId: label.id, materialName: label.name, materialCategory: 'Labels', quantityPerUnitOrBox: 1, unit: 'pieces' },
        ]);
      }
    }
  };

  // Add / Remove Ingredient
  const addIngredient = () => {
    if (rawMaterials.length === 0) return;
    const first = rawMaterials[0];
    setIngredients([
      ...ingredients,
      {
        rawMaterialId: first.id,
        materialName: first.name,
        materialCode: first.code,
        quantity: 1.0,
        unit: first.unit,
      },
    ]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  // Add / Remove Packaging
  const addPackaging = () => {
    if (packagingMaterials.length === 0) return;
    const first = packagingMaterials[0];
    setPackagingComponents([
      ...packagingComponents,
      {
        packagingMaterialId: first.id,
        materialName: first.name,
        materialCategory: first.category,
        quantityPerUnitOrBox: 1,
        unit: first.unit,
      },
    ]);
  };

  const removePackaging = (idx: number) => {
    setPackagingComponents(packagingComponents.filter((_, i) => i !== idx));
  };

  // Custom fields
  const handleAddCustomField = () => {
    if (!newFieldKey.trim()) return;
    setCustomFields({
      ...customFields,
      [newFieldKey.trim()]: newFieldValue.trim(),
    });
    setNewFieldKey('');
    setNewFieldValue('');
  };

  const handleRemoveCustomField = (key: string) => {
    const updated = { ...customFields };
    delete updated[key];
    setCustomFields(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !packSize) {
      setErrorMessage('Please select Product and Pack Size.');
      return;
    }
    if (ingredients.length === 0) {
      setErrorMessage('Please add at least one raw material ingredient.');
      return;
    }

    try {
      setSaving(true);
      setErrorMessage(null);

      const prod = products.find((p) => p.id === productId);

      const formulaId = await saveFormula(
        {
          productId,
          productName: prod ? prod.name : 'Product',
          productCode: prod ? prod.code : 'CODE',
          packSize,
          version,
          status: 'approved',
          referenceBatchSize: Number(referenceBatchSize) || 1,
          referenceBatchUnit,
          ingredients,
          packagingComponents,
          customFields,
          notes,
          createdBy: userProfile?.email || 'admin',
          createdByName: userProfile?.displayName || 'Owner',
        },
        initialFormula?.id,
        userProfile?.email || 'admin',
        userProfile?.displayName || 'Owner'
      );

      onSaveSuccess(formulaId);
    } catch (err: any) {
      console.error('Save formula error:', err);
      setErrorMessage(err.message || 'Failed to save formula');
    } finally {
      setSaving(false);
    }
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
              <h1 className="text-xl font-bold text-slate-900">
                {initialFormula ? `Edit Formula: ${initialFormula.productName}` : 'Formula Engine: Create Formula'}
              </h1>
              <p className="text-xs text-slate-500">
                Define raw materials per unit/box + packing items (bottles, caps, boxes, sleeves). Editing never deducts stock.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={applyPresetDefault}
            className="px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg flex items-center gap-1.5"
            title="Auto-fill standard defaults for this product"
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Apply Defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Formula'}</span>
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Product & Pack Size Config */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Product <span className="text-rose-500">*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              const p = products.find((x) => x.id === e.target.value);
              if (p && p.packSizes.length > 0) setPackSize(p.packSizes[0]);
            }}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-bold text-slate-900"
          >
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} [{p.code}] ({p.category})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Pack Size <span className="text-rose-500">*</span>
          </label>
          <select
            value={packSize}
            onChange={(e) => setPackSize(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold"
          >
            {selectedProduct?.packSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Reference Batch Size
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              value={referenceBatchSize}
              onChange={(e) => setReferenceBatchSize(Number(e.target.value))}
              className="w-full px-3 py-2 text-xs font-bold font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none"
            />
            <select
              value={referenceBatchUnit}
              onChange={(e) => setReferenceBatchUnit(e.target.value)}
              className="w-24 px-2 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none font-semibold"
            >
              <option value="boxes">boxes</option>
              <option value="units">units</option>
              <option value="buckets">buckets</option>
              <option value="drums">drums</option>
              <option value="bags">bags</option>
              <option value="l">Litres</option>
              <option value="kg">kg</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
            Formula Version
          </label>
          <input
            type="text"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-3 py-2 text-xs font-mono font-semibold bg-slate-50 border border-slate-300 rounded-lg outline-none"
            placeholder="1.0"
          />
        </div>
      </div>

      {/* Section 1: Raw Materials Formulation */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>1. Raw Materials Required (Per {referenceBatchSize} {referenceBatchUnit})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Humic, bentonite, fulvic, solvents, and chemical active ingredients.
            </p>
          </div>
          <button
            type="button"
            onClick={addIngredient}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Raw Material</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {ingredients.map((ing, idx) => {
            const rm = rawMaterials.find((m) => m.id === ing.rawMaterialId);

            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex-1 w-full sm:w-auto">
                  <select
                    value={ing.rawMaterialId}
                    onChange={(e) => {
                      const sel = rawMaterials.find((m) => m.id === e.target.value);
                      const updated = [...ingredients];
                      if (sel) {
                        updated[idx] = {
                          ...updated[idx],
                          rawMaterialId: sel.id,
                          materialName: sel.name,
                          materialCode: sel.code,
                          unit: sel.unit,
                        };
                        setIngredients(updated);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded outline-none font-semibold"
                  >
                    {rawMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.code}] — In Stock: {formatQuantity(m.currentStock)} {m.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={ing.quantity}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[idx].quantity = Number(e.target.value);
                      setIngredients(updated);
                    }}
                    className="w-28 px-2.5 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded outline-none text-right"
                    placeholder="Qty"
                  />
                  <span className="w-12 text-xs font-bold text-slate-700 font-mono">
                    {ing.unit}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeIngredient(idx)}
                    disabled={ingredients.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: Packing Materials Specification */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-100/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-600" />
              <span>2. Packing Material Specification (Per {referenceBatchSize} {referenceBatchUnit})</span>
            </h3>
            <p className="text-xs text-slate-500">
              Labels, bottles (Imida, Mono, Ludo, D.D, PET, A.T, V.V, Gold, Amrut), cardboard boxes, shrink sleeves, buckets, bags, drums, pouches.
            </p>
          </div>
          <button
            type="button"
            onClick={addPackaging}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Packing Item</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          {packagingComponents.map((pkg, idx) => {
            return (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg"
              >
                <div className="flex-1 w-full sm:w-auto">
                  <select
                    value={pkg.packagingMaterialId}
                    onChange={(e) => {
                      const sel = packagingMaterials.find((m) => m.id === e.target.value);
                      const updated = [...packagingComponents];
                      if (sel) {
                        updated[idx] = {
                          ...updated[idx],
                          packagingMaterialId: sel.id,
                          materialName: sel.name,
                          materialCategory: sel.category,
                          unit: sel.unit,
                        };
                        setPackagingComponents(updated);
                      }
                    }}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded outline-none font-semibold"
                  >
                    {packagingMaterials.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} [{m.category}{m.bottleType ? ` • ${m.bottleType}` : ''}] — Stock: {formatQuantity(m.currentStock)} {m.unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={pkg.quantityPerUnitOrBox}
                    onChange={(e) => {
                      const updated = [...packagingComponents];
                      updated[idx].quantityPerUnitOrBox = Number(e.target.value);
                      setPackagingComponents(updated);
                    }}
                    className="w-28 px-2.5 py-1.5 text-xs font-bold font-mono bg-white border border-slate-300 rounded outline-none text-right"
                    placeholder="Qty"
                  />
                  <span className="w-16 text-xs text-slate-500 font-mono">
                    {pkg.unit}
                  </span>

                  <button
                    type="button"
                    onClick={() => removePackaging(idx)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                    title="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Custom Fields (Add new fields anytime!) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
            <span>Custom Formula Fields & Parameters</span>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
              Optional / Extensible
            </span>
          </h3>
          <p className="text-xs text-slate-500">
            Add custom fields anytime (e.g. Mixing RPM, Reaction Temperature, Viscosity Spec, Induction Sealing Temp).
          </p>
        </div>

        {/* Existing Custom Fields */}
        {Object.keys(customFields).length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(customFields).map(([key, val]) => (
              <div
                key={key}
                className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs"
              >
                <div>
                  <span className="font-bold text-slate-800 block">{key}</span>
                  <span className="text-slate-600 font-mono">{val}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveCustomField(key)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add Field Inputs */}
        <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={newFieldKey}
            onChange={(e) => setNewFieldKey(e.target.value)}
            placeholder="Field Name (e.g. Target pH, Stirring Time)"
            className="w-full sm:w-1/3 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
          />
          <input
            type="text"
            value={newFieldValue}
            onChange={(e) => setNewFieldValue(e.target.value)}
            placeholder="Field Value (e.g. 7.5 - 8.2, 45 mins)"
            className="w-full sm:w-1/2 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none"
          />
          <button
            type="button"
            onClick={handleAddCustomField}
            disabled={!newFieldKey.trim()}
            className="w-full sm:w-auto px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-2xs whitespace-nowrap"
          >
            + Add Field
          </button>
        </div>
      </div>

      {/* Section 4: Notes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          Manufacturing Instructions & Notes
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Add Humic acid slowly to avoid foaming. Mix for 30 minutes at room temperature."
          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

    </div>
  );
};
