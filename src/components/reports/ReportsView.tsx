import React, { useState } from 'react';
import {
  BarChart3,
  FileDown,
  Printer,
  Search,
  Filter,
  Layers,
  FlaskConical,
  Package,
  Calendar,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  RawMaterial,
  PackagingMaterial,
  ProductionBatch,
  FinishedGood,
  InventoryTransaction,
  Formula,
} from '../../types/erp';
import { Badge } from '../common/Badge';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { exportToCSV, triggerPrint } from '../../utils/export';

interface ReportsViewProps {
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  batches: ProductionBatch[];
  finishedGoods: FinishedGood[];
  transactions: InventoryTransaction[];
  formulas: Formula[];
  currency?: string;
}

type ReportType =
  | 'consumption'
  | 'yield'
  | 'packaging'
  | 'finished_goods'
  | 'expiry_low_stock';

export const ReportsView: React.FC<ReportsViewProps> = ({
  rawMaterials,
  packagingMaterials,
  batches,
  finishedGoods,
  transactions,
  formulas,
  currency = '$',
}) => {
  const [activeReport, setActiveReport] = useState<ReportType>('consumption');
  const [searchTerm, setSearchTerm] = useState('');

  // 1. MATERIAL CONSUMPTION CALCULATION
  const consumptionData = rawMaterials.map((rm) => {
    // Sum all issue transactions for this material
    const issues = transactions.filter(
      (t) => t.itemId === rm.id && t.transactionType === 'issue'
    );
    const totalConsumed = issues.reduce((sum, t) => sum + Math.abs(t.quantity || 0), 0);
    const totalCost = Number((totalConsumed * (rm.unitCost || 0)).toFixed(2));

    return {
      material: rm,
      totalConsumed,
      totalCost,
      issueCount: issues.length,
    };
  });

  // 2. YIELD ANALYSIS
  const yieldData = batches.map((b) => {
    const good = b.goodOutputPacks ?? b.targetPacksCount ?? 0;
    const target = b.targetPacksCount ?? good ?? 1;
    const yieldPct = b.yieldPercentage ?? (target > 0 ? Number(((good / target) * 100).toFixed(1)) : 100);
    const rejected = b.rejectedOutputPacks ?? 0;

    return {
      batch: b,
      good,
      rejected,
      yieldPct,
    };
  });

  // 3. PACKAGING CONSUMPTION
  const packagingConsumptionData = packagingMaterials.map((pm) => {
    const issues = transactions.filter(
      (t) => t.itemId === pm.id && t.transactionType === 'issue'
    );
    const totalConsumed = issues.reduce((sum, t) => sum + Math.abs(t.quantity || 0), 0);
    const totalCost = Number((totalConsumed * (pm.unitCost || 0)).toFixed(2));

    return {
      packaging: pm,
      totalConsumed,
      totalCost,
    };
  });

  // 4. LOW STOCK & EXPIRY SCHEDULE
  const today = new Date();
  const alertItems = [
    ...rawMaterials
      .filter((m) => m.currentStock <= m.minimumStock || (m.expiryDate && new Date(m.expiryDate) < new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000)))
      .map((m) => ({
        type: 'Raw Material',
        name: m.name,
        code: m.code,
        stock: m.currentStock,
        min: m.minimumStock,
        unit: m.unit,
        lot: m.lotNumber || '-',
        expiry: m.expiryDate || 'N/A',
        isExpired: m.expiryDate ? new Date(m.expiryDate) <= today : false,
        isLow: m.currentStock <= m.minimumStock,
      })),
    ...packagingMaterials
      .filter((p) => p.currentStock <= p.minimumStock)
      .map((p) => ({
        type: 'Packaging',
        name: p.name,
        code: p.code,
        stock: p.currentStock,
        min: p.minimumStock,
        unit: p.unit,
        lot: '-',
        expiry: 'N/A',
        isExpired: false,
        isLow: p.currentStock <= p.minimumStock,
      })),
  ];

  // EXPORT CURRENT REPORT
  const handleExport = () => {
    if (activeReport === 'consumption') {
      const headers = ['Code', 'Material Name', 'Category', 'Unit', 'Total Quantity Consumed', 'Unit Cost', 'Total Cost', 'Issues Count'];
      const rows = consumptionData.map((c) => [
        c.material.code,
        c.material.name,
        c.material.category,
        c.material.unit,
        c.totalConsumed,
        c.material.unitCost,
        c.totalCost,
        c.issueCount,
      ]);
      exportToCSV('Material_Consumption_Report', headers, rows);
    } else if (activeReport === 'yield') {
      const headers = ['Batch #', 'Product', 'Target Packs', 'Good Packs', 'Rejected Packs', 'Yield %', 'Status', 'Date'];
      const rows = yieldData.map((y) => [
        y.batch.batchNumber,
        y.batch.productName,
        y.batch.targetPacksCount || '',
        y.good,
        y.rejected,
        `${y.yieldPct}%`,
        y.batch.status,
        y.batch.scheduledDate,
      ]);
      exportToCSV('Batch_Yield_Wastage_Report', headers, rows);
    } else if (activeReport === 'packaging') {
      const headers = ['Code', 'Packaging Item', 'Type', 'Unit', 'Total Consumed', 'Total Cost'];
      const rows = packagingConsumptionData.map((p) => [
        p.packaging.code,
        p.packaging.name,
        p.packaging.type,
        p.packaging.unit,
        p.totalConsumed,
        p.totalCost,
      ]);
      exportToCSV('Packaging_Consumption_Report', headers, rows);
    } else if (activeReport === 'finished_goods') {
      const headers = ['Product', 'Code', 'Pack Size', 'Batch #', 'Available Boxes', 'Available Units', 'Unit', 'QA Status', 'Expiry Date', 'Location'];
      const rows = finishedGoods.map((f) => [
        f.productName,
        f.productCode,
        f.packSize,
        f.batchNumber,
        f.availableBoxes ?? f.availableQuantity ?? 0,
        f.availableUnits ?? 0,
        f.unit,
        f.qaStatus,
        f.expiryDate,
        f.warehouseLocation,
      ]);
      exportToCSV('Finished_Goods_Valuation_Report', headers, rows);
    } else if (activeReport === 'expiry_low_stock') {
      const headers = ['Category', 'Item Name', 'Code', 'Stock', 'Min Threshold', 'Unit', 'Lot #', 'Expiry Date', 'Alert Reason'];
      const rows = alertItems.map((a) => [
        a.type,
        a.name,
        a.code,
        a.stock,
        a.min,
        a.unit,
        a.lot,
        a.expiry,
        a.isExpired ? 'EXPIRED' : a.isLow ? 'LOW STOCK' : 'EXPIRING SOON',
      ]);
      exportToCSV('Low_Stock_and_Expiry_Schedule', headers, rows);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Reports & Summary</h1>
              <p className="text-xs text-slate-500">
                View how much materials were used, production yield rates, packaging usage, and expiry dates.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerPrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Print Report</span>
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-2xs"
          >
            <FileDown className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Report Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 text-xs">
        {[
          { id: 'consumption', label: 'Materials Used' },
          { id: 'yield', label: 'Batch Output & Quality' },
          { id: 'packaging', label: 'Packaging Used' },
          { id: 'finished_goods', label: 'Finished Goods in Warehouse' },
          { id: 'expiry_low_stock', label: 'Low Stock & Expiring Items' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveReport(tab.id as ReportType)}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
              activeReport === tab.id
                ? 'bg-white text-blue-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* REPORT 1: RAW MATERIAL CONSUMPTION */}
      {activeReport === 'consumption' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Raw Materials Used & Total Cost
              </h2>
              <p className="text-xs text-slate-500">
                Calculated directly from all factory production batches.
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Issued Cost:</span>
              <span className="text-base font-extrabold text-blue-700 font-mono">
                {formatCurrency(
                  consumptionData.reduce((sum, c) => sum + c.totalCost, 0),
                  currency
                )}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Raw Material</th>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3 text-right">Total Consumed</th>
                  <th className="py-2.5 px-3 text-right">Unit Price</th>
                  <th className="py-2.5 px-3 text-right">Total Cost</th>
                  <th className="py-2.5 px-3 text-right">Store Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {consumptionData.map((c) => (
                  <tr key={c.material.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{c.material.code}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{c.material.name}</td>
                    <td className="py-2.5 px-3 text-slate-600">{c.material.category}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(c.totalConsumed)} {c.material.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatCurrency(c.material.unitCost, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">
                      {formatCurrency(c.totalCost, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {c.issueCount} issues
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: BATCH YIELD & DEFECT RATES */}
      {activeReport === 'yield' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Batch Production Yield & Quality Defect Analysis
              </h2>
              <p className="text-xs text-slate-500">
                Comparison of planned target packs vs accepted good output vs rejected QA packs.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Batch Number</th>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3 text-right">Target Output</th>
                  <th className="py-2.5 px-3 text-right">Good Output</th>
                  <th className="py-2.5 px-3 text-right">Rejects</th>
                  <th className="py-2.5 px-3 text-right">Yield %</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {yieldData.map((y) => (
                  <tr key={y.batch.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600">{y.batch.batchNumber}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{y.batch.productName}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatQuantity(y.batch.targetPacksCount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                      {formatQuantity(y.good)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                      {formatQuantity(y.rejected)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-extrabold text-slate-900">
                      {y.yieldPct}%
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge status={(y.batch.status || 'in_production') as any} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 text-slate-500">{y.batch.scheduledDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: PACKAGING USAGE */}
      {activeReport === 'packaging' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Packaging Material Consumption & Costs
            </h2>
            <p className="text-xs text-slate-500">
              Breakdown of bottles, caps, labels, pouches, and cartons issued for finished goods packing.
            </p>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3">Packaging Component</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3 text-right">Total Units Consumed</th>
                  <th className="py-2.5 px-3 text-right">Unit Cost</th>
                  <th className="py-2.5 px-3 text-right">Total Packaging Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {packagingConsumptionData.map((p) => (
                  <tr key={p.packaging.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{p.packaging.code}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{p.packaging.name}</td>
                    <td className="py-2.5 px-3 capitalize text-slate-600">{p.packaging.type}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(p.totalConsumed)} {p.packaging.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                      {formatCurrency(p.packaging.unitCost, currency)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600">
                      {formatCurrency(p.totalCost, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 4: FINISHED GOODS VALUATION */}
      {activeReport === 'finished_goods' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Finished Goods Stock & Warehouse Location
            </h2>
            <p className="text-xs text-slate-500">
              Complete inventory status of manufactured finished goods ready for customer dispatch.
            </p>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Product Name</th>
                  <th className="py-2.5 px-3">Pack Size</th>
                  <th className="py-2.5 px-3">Batch #</th>
                  <th className="py-2.5 px-3 text-right">Available Qty</th>
                  <th className="py-2.5 px-3">QA Status</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3">Warehouse Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {finishedGoods.map((f) => (
                  <tr key={f.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-bold text-slate-900">{f.productName}</td>
                    <td className="py-2.5 px-3 font-semibold text-blue-600">{f.packSize}</td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-600">{f.batchNumber}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(f.availableBoxes ?? f.availableQuantity ?? 0)} {f.unit}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge status={f.qaStatus} size="sm" />
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{f.expiryDate}</td>
                    <td className="py-2.5 px-3 text-slate-500">{f.warehouseLocation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 5: LOW STOCK & EXPIRY SCHEDULE */}
      {activeReport === 'expiry_low_stock' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden space-y-4 p-5">
          <div className="border-b border-slate-200 pb-3">
            <h2 className="text-sm font-bold text-slate-900">
              Low-Stock Warnings & 60-Day Expiry Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Items requiring immediate purchase reorder or near chemical shelf-life expiration.
            </p>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[11px] font-bold">
                <tr>
                  <th className="py-2.5 px-3">Category</th>
                  <th className="py-2.5 px-3">Item Name</th>
                  <th className="py-2.5 px-3">Code</th>
                  <th className="py-2.5 px-3 text-right">Current Stock</th>
                  <th className="py-2.5 px-3 text-right">Min Threshold</th>
                  <th className="py-2.5 px-3">Lot Number</th>
                  <th className="py-2.5 px-3">Expiry Date</th>
                  <th className="py-2.5 px-3 text-right">Alert Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alertItems.map((a, i) => (
                  <tr key={i} className={a.isExpired ? 'bg-rose-50/50' : a.isLow ? 'bg-amber-50/40' : ''}>
                    <td className="py-2.5 px-3 font-semibold text-slate-600">{a.type}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-900">{a.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-400">{a.code}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                      {formatQuantity(a.stock)} {a.unit}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                      {formatQuantity(a.min)} {a.unit}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{a.lot}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{a.expiry}</td>
                    <td className="py-2.5 px-3 text-right">
                      {a.isExpired ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                          Expired
                        </span>
                      ) : a.isLow ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">
                          Expiring Soon
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
