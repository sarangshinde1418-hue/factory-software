import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { DashboardView } from './components/dashboard/DashboardView';
import { RawMaterialList } from './components/rawMaterials/RawMaterialList';
import { PackagingList } from './components/packaging/PackagingList';
import { ProductList } from './components/products/ProductList';
import { FormulaList } from './components/formulas/FormulaList';
import { FormulaBuilder } from './components/formulas/FormulaBuilder';
import { ProductionView } from './components/production/ProductionView';
import { OutgoingView } from './components/outgoing/OutgoingView';
import { TasksAttendanceView } from './components/tasks/TasksAttendanceView';
import { FinishedGoodsView } from './components/finishedGoods/FinishedGoodsView';
import { ReportsView } from './components/reports/ReportsView';
import { DataBackupView } from './components/backup/DataBackupView';
import {
  RawMaterial,
  PackagingMaterial,
  Product,
  Formula,
  FinishedGood,
  SalesOrder,
  ProductionLog,
  WorkerTask,
  WorkerAttendance,
  Party,
  FactorySettings,
  InventoryTransaction,
} from './types/erp';
import {
  subscribeRawMaterials,
  subscribePackagingMaterials,
  subscribeProducts,
  subscribeFormulas,
  subscribeFinishedGoods,
  subscribeSalesOrders,
  subscribeProductionLogs,
  subscribeTasks,
  subscribeAttendance,
  subscribeParties,
  subscribeSettings,
  subscribeInventoryTransactions,
  seedAgroFertilizerData,
} from './services/db';
import { Loader2 } from 'lucide-react';

function ERPAppContent() {
  const { userProfile, role } = useAuth();

  // Navigation State
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Selected item contexts
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isBuildingFormula, setIsBuildingFormula] = useState(false);
  const [editingFormula, setEditingFormula] = useState<Formula | null>(null);

  // Real-time Database Collections
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([]);
  const [packagingMaterials, setPackagingMaterials] = useState<PackagingMaterial[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [finishedGoods, setFinishedGoods] = useState<FinishedGood[]>([]);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [attendance, setAttendance] = useState<WorkerAttendance[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [settings, setSettings] = useState<FactorySettings>({
    id: 'global',
    companyName: 'Maha Agro-Fertilizers Pvt Ltd',
    companyTagline: 'Precision Bio-Fertilizer & Organic Micronutrient Formulations',
    currency: '₹',
    address: 'Plot No. 42-B, MIDC Industrial Area, Akola, Maharashtra',
    phone: '+91 98220 54321',
    email: 'operations@mahaagro.com',
    lowStockThresholdDefault: 200,
    googleAppsScriptUrl: '',
    autoBackupOnWrite: false,
    defaultAdminEmail: 'sarangshinde1418@gmail.com',
    updatedAt: new Date().toISOString(),
  });

  const [loadingInitial, setLoadingInitial] = useState(true);

  // Subscribe to all collections on mount
  useEffect(() => {
    let loadedCount = 0;
    const checkLoaded = () => {
      loadedCount++;
      if (loadedCount >= 3) {
        setLoadingInitial(false);
      }
    };

    const unsubRM = subscribeRawMaterials((data) => {
      setRawMaterials(data);
      checkLoaded();
      // Auto-seed agro catalog if database is empty on first boot
      if (data.length === 0) {
        seedAgroFertilizerData('sarangshinde1418@gmail.com').catch((err) => {
          console.log('Auto-seed agro data:', err);
        });
      }
    });

    const unsubPM = subscribePackagingMaterials((data) => {
      setPackagingMaterials(data);
      checkLoaded();
    });

    const unsubProd = subscribeProducts((data) => {
      setProducts(data);
      checkLoaded();
    });

    const unsubFormulas = subscribeFormulas((data) => setFormulas(data));
    const unsubFG = subscribeFinishedGoods((data) => setFinishedGoods(data));
    const unsubSales = subscribeSalesOrders((data) => setSalesOrders(data));
    const unsubLogs = subscribeProductionLogs((data) => setProductionLogs(data));
    const unsubTasks = subscribeTasks((data) => setTasks(data));
    const unsubAtt = subscribeAttendance('', (data) => setAttendance(data));
    const unsubParties = subscribeParties((data) => setParties(data));
    const unsubTxs = subscribeInventoryTransactions((data) => setTransactions(data));
    const unsubSettings = subscribeSettings((data) => setSettings(data));

    return () => {
      unsubRM();
      unsubPM();
      unsubProd();
      unsubFormulas();
      unsubFG();
      unsubSales();
      unsubLogs();
      unsubTasks();
      unsubAtt();
      unsubParties();
      unsubTxs();
      unsubSettings();
    };
  }, []);

  // Badge calculations
  const lowStockCount = rawMaterials.filter(
    (m) => m.currentStock <= m.minimumStock && m.status !== 'archived'
  ).length;

  const pendingTaskCount = tasks.filter(
    (t) => t.status === 'pending' || t.status === 'in_progress'
  ).length;

  // Formula Builder navigation actions
  const handleOpenFormulaBuilder = (formulaToEdit?: Formula) => {
    setEditingFormula(formulaToEdit || null);
    setIsBuildingFormula(true);
    setActiveTab('formulas');
  };

  const handleCloseFormulaBuilder = () => {
    setIsBuildingFormula(false);
    setEditingFormula(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans antialiased text-slate-800">
      
      {/* Top Navbar with quick role switcher, active worker selector & backup button */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        isSidebarOpen={isSidebarOpen}
        googleSheetUrl={settings.googleAppsScriptUrl}
      />

      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (12 modules) */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setActiveTab(tab);
            if (tab !== 'formulas') {
              setIsBuildingFormula(false);
            }
          }}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          lowStockCount={lowStockCount}
          pendingTaskCount={pendingTaskCount}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-6">
            
            {loadingInitial && rawMaterials.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-28 space-y-3">
                <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
                <span className="text-xs font-semibold text-slate-500">
                  Connecting to Factory ERP Database...
                </span>
              </div>
            ) : (
              <>
                {/* 1. DASHBOARD */}
                {activeTab === 'dashboard' && (
                  <DashboardView
                    products={products}
                    rawMaterials={rawMaterials}
                    packagingMaterials={packagingMaterials}
                    productionLogs={productionLogs}
                    finishedGoods={finishedGoods}
                    salesOrders={salesOrders}
                    tasks={tasks}
                    attendance={attendance}
                    formulas={formulas}
                    onNavigate={(tab) => {
                      setActiveTab(tab);
                      if (tab !== 'formulas') setIsBuildingFormula(false);
                    }}
                    currency={settings.currency}
                  />
                )}

                {/* 2. RAW MATERIALS */}
                {activeTab === 'raw_materials' && (
                  <RawMaterialList
                    materials={rawMaterials}
                    currency={settings.currency}
                  />
                )}

                {/* 3. PACKING MATERIALS */}
                {activeTab === 'packing_material' && (
                  <PackagingList
                    packagingMaterials={packagingMaterials}
                    currency={settings.currency}
                  />
                )}

                {/* 4. PRODUCTS (18 CATALOG) */}
                {activeTab === 'products' && (
                  <ProductList
                    products={products}
                    onSelectProductForFormula={(prod) => {
                      setSelectedProduct(prod);
                      setActiveTab('formulas');
                      setIsBuildingFormula(true);
                    }}
                    onSelectProductForProduction={(prod) => {
                      setSelectedProduct(prod);
                      setActiveTab('production');
                    }}
                  />
                )}

                {/* 5. FORMULA ENGINE (EDITABLE) */}
                {activeTab === 'formulas' && (
                  <>
                    {isBuildingFormula ? (
                      <FormulaBuilder
                        initialFormula={editingFormula}
                        products={products}
                        rawMaterials={rawMaterials}
                        packagingMaterials={packagingMaterials}
                        currency={settings.currency}
                        onSaveSuccess={(formulaId) => {
                          handleCloseFormulaBuilder();
                        }}
                        onCancel={handleCloseFormulaBuilder}
                      />
                    ) : (
                      <FormulaList
                        formulas={formulas}
                        products={products}
                        rawMaterials={rawMaterials}
                        packagingMaterials={packagingMaterials}
                        onNewFormula={() => handleOpenFormulaBuilder()}
                        onEditFormula={(formula) => handleOpenFormulaBuilder(formula)}
                      />
                    )}
                  </>
                )}

                {/* 6. PRODUCTION ENTRY */}
                {activeTab === 'production' && (
                  <ProductionView
                    products={products}
                    formulas={formulas}
                    rawMaterials={rawMaterials}
                    packagingMaterials={packagingMaterials}
                    productionLogs={productionLogs}
                    initialSelectedProduct={selectedProduct}
                  />
                )}

                {/* 7. OUTGOING / SALES */}
                {activeTab === 'outgoing' && (
                  <OutgoingView
                    parties={parties}
                    salesOrders={salesOrders}
                    finishedGoods={finishedGoods}
                    currency={settings.currency}
                  />
                )}

                {/* 8. TASKS & WORK ORDERS */}
                {activeTab === 'tasks' && (
                  <TasksAttendanceView
                    tasks={tasks}
                    attendanceRecords={attendance}
                    initialTab="tasks"
                  />
                )}

                {/* 9. WORKER ATTENDANCE */}
                {activeTab === 'attendance' && (
                  <TasksAttendanceView
                    tasks={tasks}
                    attendanceRecords={attendance}
                    initialTab="attendance"
                  />
                )}

                {/* 10. FINISHED GOODS WAREHOUSE */}
                {activeTab === 'finished_goods' && (
                  <FinishedGoodsView
                    finishedGoods={finishedGoods}
                    currency={settings.currency}
                  />
                )}

                {/* 11. REPORTS & ANALYTICS */}
                {activeTab === 'reports' && (
                  <ReportsView
                    rawMaterials={rawMaterials}
                    packagingMaterials={packagingMaterials}
                    batches={productionLogs}
                    finishedGoods={finishedGoods}
                    transactions={transactions}
                    formulas={formulas}
                    currency={settings.currency}
                  />
                )}

                {/* 12. DATA & CLOUD BACKUP */}
                {activeTab === 'backup' && (
                  <DataBackupView
                    rawMaterials={rawMaterials}
                    packagingMaterials={packagingMaterials}
                    products={products}
                    formulas={formulas}
                    finishedGoods={finishedGoods}
                    salesOrders={salesOrders}
                    productionLogs={productionLogs}
                    tasks={tasks}
                    attendance={attendance}
                    parties={parties}
                    settings={settings}
                    currency={settings.currency}
                  />
                )}
              </>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ERPAppContent />
    </AuthProvider>
  );
}
