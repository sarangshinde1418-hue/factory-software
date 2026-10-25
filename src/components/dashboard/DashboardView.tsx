import React from 'react';
import {
  Boxes,
  FlaskConical,
  Package,
  Cog,
  Warehouse,
  Truck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  Plus,
  ArrowRight,
  ShieldCheck,
  History,
  Beaker,
  Users,
  Calendar,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  Product,
  RawMaterial,
  PackagingMaterial,
  FinishedGood,
  SalesOrder,
  ProductionLog,
  WorkerTask,
  WorkerAttendance,
  Formula,
} from '../../types/erp';
import { formatQuantity, formatCurrency } from '../../utils/units';
import { NavTab } from '../layout/Sidebar';
import { useAuth } from '../../context/AuthContext';

interface DashboardViewProps {
  products: Product[];
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  productionLogs: ProductionLog[];
  finishedGoods: FinishedGood[];
  salesOrders: SalesOrder[];
  tasks: WorkerTask[];
  attendance: WorkerAttendance[];
  formulas: Formula[];
  onNavigate: (tab: NavTab) => void;
  currency?: string;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  products,
  rawMaterials,
  packagingMaterials,
  productionLogs,
  finishedGoods,
  salesOrders,
  tasks,
  attendance,
  formulas,
  onNavigate,
  currency = '₹',
}) => {
  const { userProfile, role, isOwner, isManager, isWorker, activeWorker } = useAuth();

  const todayStr = new Date().toISOString().split('T')[0];
  const thisMonthStr = todayStr.slice(0, 7);

  // 1. Raw Materials Stock Totals
  const totalRawStockKg = rawMaterials
    .filter((m) => m.unit === 'kg')
    .reduce((sum, m) => sum + (m.currentStock || 0), 0);
  const totalRawStockL = rawMaterials
    .filter((m) => m.unit === 'l' || m.unit === 'litres')
    .reduce((sum, m) => sum + (m.currentStock || 0), 0);
  const lowStockRaw = rawMaterials.filter((m) => m.currentStock <= m.minimumStock && m.status !== 'archived');

  // 2. Packaging Materials Stock Totals
  const totalPackingUnits = packagingMaterials.reduce((sum, p) => sum + (p.currentStock || 0), 0);
  const lowStockPackaging = packagingMaterials.filter((p) => p.currentStock <= p.minimumStock && p.status !== 'archived');

  // 3. Finished Goods in Stock
  const totalAvailableBoxes = finishedGoods.reduce(
    (sum, f) => sum + (f.availableBoxes ?? f.availableQuantity ?? 0),
    0
  );
  const totalAvailableUnits = finishedGoods.reduce((sum, f) => sum + (f.availableUnits || 0), 0);

  // 4. Outgoing Sales Today and This Month
  const todayOrders = salesOrders.filter((s) => s.date === todayStr);
  const todayBoxesDispatched = todayOrders.reduce((sum, s) => sum + (s.quantityBoxes || 0), 0);
  const todayRevenue = todayOrders.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  const monthOrders = salesOrders.filter((s) => (s.date || '').startsWith(thisMonthStr));
  const monthBoxesDispatched = monthOrders.reduce((sum, s) => sum + (s.quantityBoxes || 0), 0);
  const monthRevenue = monthOrders.reduce((sum, s) => sum + (s.totalAmount || 0), 0);

  // 5. Total Alerts Count
  const totalAlerts = lowStockRaw.length + lowStockPackaging.length;

  // 6. Production vs Outgoing Chart Data (Last 7 Days)
  const last7Days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    last7Days.push(d.toISOString().split('T')[0]);
  }

  const productionVsSalesData = last7Days.map((dateStr) => {
    const dayLabel = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
    const dayProduction = productionLogs
      .filter((p) => p.batchDate === dateStr)
      .reduce((sum, p) => sum + (p.numberOfBoxes || 0), 0);
    const daySales = salesOrders
      .filter((s) => s.date === dateStr)
      .reduce((sum, s) => sum + (s.quantityBoxes || 0), 0);

    return {
      day: dayLabel,
      'Produced Boxes': dayProduction,
      'Dispatched Boxes': daySales,
    };
  });

  // 7. Top Finished Goods In Stock Chart Data
  const finishedGoodsChartData = finishedGoods
    .slice(0, 6)
    .map((fg) => ({
      name: `${fg.productName} (${fg.packSize})`,
      Boxes: fg.availableBoxes ?? fg.availableQuantity ?? 0,
    }));

  // 8. Today's Attendance Snapshot
  const presentWorkersCount = attendance.filter((a) => a.date === todayStr && a.status === 'present').length;
  const pendingTasksCount = tasks.filter((t) => t.status === 'pending' || t.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 rounded-2xl p-6 text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 border border-slate-700/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Agro-Fertilizer Factory
            </span>
            <span className="text-xs text-slate-400">
              • {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            Hello, {userProfile?.displayName || 'Factory Team'}
          </h1>
          <p className="text-xs text-slate-300 mt-0.5 max-w-xl">
            {isOwner
              ? 'Owner Portal: Full view of raw stocks, packaging inventory, today production & sales reports.'
              : isManager
              ? 'Manager Portal: Inward stock, assign worker jobs, and monitor daily batch output.'
              : `Worker Portal: Logged in as ${activeWorker.name}. Check your assigned tasks and record batch entries.`}
          </p>
        </div>

        {/* Quick actions row */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigate('production')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-900 bg-white hover:bg-slate-100 rounded-lg shadow-sm transition-all"
          >
            <Cog className="w-3.5 h-3.5 text-emerald-600" />
            <span>New Production Entry</span>
          </button>

          <button
            onClick={() => onNavigate('outgoing')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-all"
          >
            <Truck className="w-3.5 h-3.5 text-white" />
            <span>New Outgoing Dispatch</span>
          </button>
        </div>
      </div>

      {/* 4 PRIMARY METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Remaining Raw Materials */}
        <div
          onClick={() => onNavigate('raw_materials')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Raw Materials Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-xl font-black text-slate-900">
              {formatQuantity(totalRawStockKg)} <span className="text-xs font-semibold text-slate-500">kg</span>
              <span className="text-slate-300 font-light mx-1">|</span>
              {formatQuantity(totalRawStockL)} <span className="text-xs font-semibold text-slate-500">L</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{rawMaterials.length} Items registered</span>
              {lowStockRaw.length > 0 ? (
                <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                  {lowStockRaw.length} Low Stock
                </span>
              ) : (
                <span className="text-emerald-600 font-bold text-[10px]">Stock Healthy</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Packing Materials */}
        <div
          onClick={() => onNavigate('packing_material')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-blue-300 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Packing Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-xl font-black text-slate-900">
              {formatQuantity(totalPackingUnits)} <span className="text-xs font-semibold text-slate-500">Units</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Bottles, Boxes, Buckets</span>
              {lowStockPackaging.length > 0 ? (
                <span className="text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                  {lowStockPackaging.length} Low Stock
                </span>
              ) : (
                <span className="text-emerald-600 font-bold text-[10px]">Stock Healthy</span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Finished Goods Ready */}
        <div
          onClick={() => onNavigate('finished_goods')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-purple-300 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Finished Goods Stock
            </span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-xl font-black text-slate-900">
              {formatQuantity(totalAvailableBoxes)} <span className="text-xs font-semibold text-slate-500">Boxes</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>{formatQuantity(totalAvailableUnits)} Individual Bottles/Packs</span>
              <span className="text-purple-600 font-bold text-[10px]">Ready to Dispatch</span>
            </div>
          </div>
        </div>

        {/* Card 4: Outgoing Dispatches */}
        <div
          onClick={() => onNavigate('outgoing')}
          className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs hover:border-amber-300 cursor-pointer transition-all space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Outgoing / Sales Dispatched
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>

          <div>
            <div className="text-xl font-black text-slate-900">
              {todayBoxesDispatched} <span className="text-xs font-semibold text-slate-500">Boxes Today</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
              <span>Today: {currency}{formatQuantity(todayRevenue)}</span>
              <span className="text-slate-700 font-bold text-[10px]">
                Month: {monthBoxesDispatched} Boxes
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* LOW STOCK ALERTS BANNER (If any item is low) */}
      {totalAlerts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-amber-900">
                Low-Stock Warning: {totalAlerts} items require inward stock replenishment
              </h3>
              <p className="text-[11px] text-amber-700">
                {lowStockRaw.length > 0 && `${lowStockRaw.length} raw material(s) `}
                {lowStockPackaging.length > 0 && `${lowStockPackaging.length} packaging item(s) `}
                are currently at or below their re-order threshold.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {lowStockRaw.length > 0 && (
              <button
                onClick={() => onNavigate('raw_materials')}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 transition-colors"
              >
                Inward Raw Stock
              </button>
            )}
            {lowStockPackaging.length > 0 && (
              <button
                onClick={() => onNavigate('packing_material')}
                className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-white hover:bg-amber-100 rounded-lg border border-amber-300 transition-colors"
              >
                Inward Packing Stock
              </button>
            )}
          </div>
        </div>
      )}

      {/* INTERACTIVE CHARTS (RECHARTS) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Production vs Outgoing Comparison */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Production vs Outgoing Dispatches
              </h2>
              <span className="text-[11px] text-slate-400">Total boxes made vs boxes shipped over last 7 days</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
              Boxes Trend
            </span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionVsSalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '11px',
                    border: 'none',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="Produced Boxes" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Dispatched Boxes" fill="#2563eb" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Finished Goods Ready In Stock */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Warehouse Stock By Product
              </h2>
              <span className="text-[11px] text-slate-400">Available boxes ready in finished goods warehouse</span>
            </div>
            <button
              onClick={() => onNavigate('finished_goods')}
              className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="h-64 w-full pt-2">
            {finishedGoodsChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={finishedGoodsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 20, left: 40, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 10, fill: '#334155' }}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '11px',
                      border: 'none',
                    }}
                  />
                  <Bar dataKey="Boxes" fill="#7c3aed" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                <Warehouse className="w-8 h-8 mb-2 opacity-50" />
                <span>No finished goods recorded yet</span>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* RECENT PRODUCTION LOGS & DISPATCHES */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left: Recent Production Batches */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Cog className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Production Entries
              </h3>
            </div>
            <button
              onClick={() => onNavigate('production')}
              className="text-[11px] font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <span>Production Tab</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {productionLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{log.productName} ({log.packSize})</div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    Batch: {log.batchNumber} • Date: {log.batchDate}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] border border-emerald-200">
                    +{log.numberOfBoxes} Boxes
                  </span>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {log.operatorName || 'Operator'}
                  </div>
                </div>
              </div>
            ))}
            {productionLogs.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                No production batches recorded yet.
              </div>
            )}
          </div>
        </div>

        {/* Right: Recent Sales Dispatches */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Recent Outgoing Dispatches
              </h3>
            </div>
            <button
              onClick={() => onNavigate('outgoing')}
              className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1"
            >
              <span>Sales Tab</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {salesOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">{order.partyName}</div>
                  <span className="text-[11px] text-slate-500">
                    {order.productName} ({order.packSize}) • {order.invoiceNumber}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px] border border-blue-200">
                    {order.quantityBoxes} Boxes
                  </span>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {currency}{formatQuantity(order.totalAmount)}
                  </div>
                </div>
              </div>
            ))}
            {salesOrders.length === 0 && (
              <div className="text-center py-6 text-slate-400 text-xs italic">
                No outgoing sales orders dispatched yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* TODAY WORKER TASKS & ATTENDANCE BAR */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-700" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Today's Factory Workers & Active Tasks
            </h3>
          </div>
          <button
            onClick={() => onNavigate('tasks')}
            className="text-[11px] font-bold text-slate-700 hover:text-slate-900 flex items-center gap-1"
          >
            <span>View Tasks & Attendance</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {tasks.slice(0, 4).map((t) => (
            <div key={t.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                  {t.entryType}
                </span>
                <span className={`text-[10px] font-bold capitalize ${
                  t.status === 'completed' ? 'text-emerald-700' : 'text-amber-700'
                }`}>
                  {t.status.replace('_', ' ')}
                </span>
              </div>
              <div className="font-bold text-slate-900 text-xs line-clamp-1">{t.title}</div>
              <div className="text-[11px] text-slate-500">
                Assigned to: <strong className="text-slate-700">{t.assignedToWorkerName}</strong>
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="col-span-4 text-center py-4 text-slate-400 text-xs italic">
              No tasks currently pending. Click "Assign Worker Task" to allocate jobs.
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
