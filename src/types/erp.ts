export type UserRole = 'owner' | 'manager' | 'worker';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  phone?: string;
  createdAt: string;
  updatedAt: string;
}

export type PhysicalForm = 'liquid' | 'powder' | 'granules' | 'chemical' | 'paste' | 'solid' | 'custom';

export type StandardUnit = 
  | 'kg' 
  | 'g' 
  | 'mg' 
  | 'l' 
  | 'ml' 
  | 'pieces' 
  | 'bottles' 
  | 'bags' 
  | 'buckets' 
  | 'drums' 
  | 'boxes' 
  | 'pouches' 
  | string;

export interface RawMaterial {
  id: string;
  code: string;
  name: string;
  category: string; // e.g. "Granules", "Bentonite", "Chemicals", "Humic Acid", "Amino Acids", "Fulvic", "Solvents"
  physicalForm: PhysicalForm;
  unit: StandardUnit; // 'kg' or 'l'
  currentStock: number;
  openingStock: number;
  minimumStock: number;
  unitCost: number;
  supplierId?: string;
  supplierName?: string;
  lotNumber?: string;
  mfgDate?: string;
  expiryDate?: string;
  location?: string;
  notes?: string;
  batch200Qty?: number; // Quantity needed per 200 batch
  batch500Qty?: number; // Quantity needed per 500 batch
  status: 'active' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export type BottleType =
  | 'Imida'
  | 'Mono'
  | 'Ludo'
  | 'D.D'
  | 'PET'
  | 'A.T'
  | 'V.V'
  | '24 Carat Gold'
  | 'PET Amrut'
  | 'Custom';

export type PackagingCategory =
  | 'Labels'
  | 'Bottles'
  | 'Cardboard Boxes'
  | 'Shrink Sleeves'
  | 'Buckets'
  | 'Bags'
  | 'Drums'
  | 'Pouches'
  | 'Other';

export interface PackagingMaterial {
  id: string;
  code: string;
  name: string;
  category: PackagingCategory;
  type: string; // 'bottle', 'label', 'box', 'bucket', 'bag', 'drum', 'sleeve', 'pouch'
  bottleType?: BottleType; // For bottle items
  unit: StandardUnit;
  currentStock: number;
  openingStock: number;
  minimumStock: number;
  unitCost: number;
  supplierId?: string;
  supplierName?: string;
  location?: string;
  status: 'active' | 'archived';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BoxPackingRule {
  packSize: string; // e.g. "1L", "500ml", "250ml", "100g", "10kg"
  unitsPerBox: number; // e.g. 1L x10 = 1 box, 500ml x20 = 1 box
  containerType: 'bottle' | 'pouch' | 'bucket' | 'bag' | 'drum';
  labelCountPerBox: number; // e.g. 10
  sleeveCountPerBox: number; // e.g. 10
  boxCountPerBox: number; // e.g. 1
}

export interface Product {
  id: string;
  code: string;
  name: string; // Humistar, Black Diamond, Supreme Shakti, Bioshakti G, etc.
  category: 'Liquid Fertilizer' | 'Granular Fertilizer' | 'Bio-Stimulant' | 'Micronutrient' | 'Organic PGR';
  productType: 'liquid' | 'powder' | 'granules';
  activeFormulaId?: string;
  activeFormulaVersion?: string;
  packSizes: string[]; // e.g. ["1L", "500ml", "250ml", "100ml"] or ["10kg bucket", "25kg bag", "50kg drum"]
  boxRules: BoxPackingRule[];
  description?: string;
  status: 'active' | 'draft' | 'discontinued';
  createdAt: string;
  updatedAt: string;
}

export interface FormulaIngredient {
  rawMaterialId: string;
  materialName: string;
  materialCode: string;
  quantity: number; // Quantity required per 1 Unit (or per Reference Batch)
  unit: StandardUnit;
  percentage?: number;
  phase?: string;
  instructions?: string;
}

export interface FormulaPackagingComponent {
  packagingMaterialId: string;
  materialName: string;
  materialCode?: string;
  materialCategory: PackagingCategory;
  quantityPerUnitOrBox: number; // e.g. 10 bottles per 1 box, or 1 bucket per 10kg
  quantityPerUnit?: number;
  unit: StandardUnit;
  notes?: string;
}

export interface Formula {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  packSize: string; // e.g. "1L", "10kg", "Standard"
  version: string; // e.g. "1.0", "1.1"
  status: 'draft' | 'approved' | 'archived';
  referenceBatchSize: number; // e.g. 1 box or 1000 Litres
  referenceBatchUnit: StandardUnit;
  ingredients: FormulaIngredient[];
  packagingComponents: FormulaPackagingComponent[];
  preparationSteps?: string[];
  customFields?: { [key: string]: string };
  notes?: string;
  createdBy: string;
  createdByName?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Party {
  id: string;
  code: string;
  name: string; // e.g. "Kisan Krishi Kendra", "Maha Agro Distributers"
  contactPerson: string;
  phone: string;
  email?: string;
  city: string;
  state: string;
  gstNumber?: string;
  creditLimit?: number;
  balanceDue?: number;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export interface SalesOrder {
  id: string;
  invoiceNumber: string;
  partyId: string;
  partyName: string;
  productId: string;
  productName: string;
  productCode: string;
  packSize: string;
  batchNumber: string;
  quantityBoxes: number;
  quantityUnits: number;
  unitPrice: number;
  totalAmount: number;
  date: string; // YYYY-MM-DD
  dispatchedBy: string;
  dispatchedByName: string;
  status: 'dispatched' | 'pending' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export type TaskType = 
  | 'Mixing' 
  | 'Granulation' 
  | 'Filling' 
  | 'Packing' 
  | 'Loading' 
  | 'Maintenance' 
  | 'Inventory Count' 
  | 'General';

export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkerTask {
  id: string;
  title: string;
  description: string;
  entryType: TaskType;
  assignedToWorkerId: string;
  assignedToWorkerName: string;
  priority: TaskPriority;
  status: TaskStatus;
  batchNumber?: string;
  productName?: string;
  assignedBy: string;
  assignedByName: string;
  assignedAt: string;
  dueDate?: string;
  completedAt?: string;
  workLog?: string;
  notes?: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'half_day' | 'leave';

export interface WorkerAttendance {
  id: string;
  workerId: string;
  workerName: string;
  workerRole?: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  workLog?: string;
  overtimeHours?: number;
  recordedBy: string;
  recordedByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface FinishedGood {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  packSize: string;
  batchNumber: string;
  mfgDate: string;
  expiryDate: string;
  quantityBoxes: number; // number of boxes
  quantityUnits: number; // total bottles/packs
  availableBoxes: number;
  availableUnits: number;
  availableQuantity?: number; // legacy backwards-compatible alias
  quantity?: number; // legacy backwards-compatible alias
  unit: string; // 'boxes', 'bottles', 'buckets'
  unitCost?: number;
  warehouseLocation: string;
  qaStatus: 'approved' | 'quarantine' | 'rejected';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductionLog {
  id: string;
  batchNumber: string;
  productId: string;
  productName: string;
  productCode: string;
  packSize: string;
  formulaId: string;
  formulaVersion: string;
  numberOfBoxes: number;
  totalUnits: number;
  batchDate: string; // YYYY-MM-DD
  operatorId?: string;
  operatorName?: string;
  rawMaterialsDeducted: {
    materialId: string;
    materialName: string;
    quantityDeducted: number;
    unit: StandardUnit;
  }[];
  packagingMaterialsDeducted: {
    packagingId: string;
    materialName: string;
    quantityDeducted: number;
    unit: StandardUnit;
  }[];
  notes?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
}

export interface InventoryTransaction {
  id: string;
  transactionType: 'opening' | 'receipt' | 'issue' | 'return' | 'wastage' | 'adjustment' | 'dispatch';
  materialType: 'raw' | 'packaging' | 'finished';
  itemId: string;
  itemName: string;
  itemCode: string;
  batchNumber?: string;
  lotNumber?: string;
  quantity: number;
  unit: StandardUnit;
  unitCost: number;
  totalCost?: number;
  referenceType: 'production_batch' | 'purchase_order' | 'manual' | 'dispatch' | 'adjustment_reversal';
  referenceId?: string;
  notes?: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  details: string;
  beforeState?: string;
  afterState?: string;
  quantityDelta?: number;
  performedBy: string;
  userEmail: string;
  timestamp: string;
}

export interface FactorySettings {
  id: string;
  companyName: string;
  companyTagline?: string;
  currency: string;
  address: string;
  phone: string;
  email: string;
  lowStockThresholdDefault: number;
  googleAppsScriptUrl?: string;
  lastBackupAt?: string;
  autoBackupOnWrite: boolean;
  allowNegativeStock?: boolean;
  defaultAdminEmail: string;
  updatedAt: string;
}

export interface ConversionRule {
  id: string;
  name: string;
  materialId?: string;
  materialName?: string;
  fromUnit: StandardUnit;
  toUnit: StandardUnit;
  factor: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  rating: number;
  paymentTerms: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'opening' | 'receipt' | 'issue' | 'return' | 'wastage' | 'adjustment' | 'dispatch';
export type MaterialType = 'raw' | 'packaging' | 'finished';
export type BatchStatus = 'planned' | 'in_production' | 'qa_pending' | 'completed' | 'cancelled';

export interface BatchIngredientRequirement {
  materialId?: string;
  rawMaterialId?: string;
  materialName: string;
  materialCode: string;
  requiredQuantity: number;
  availableStock: number;
  unit: StandardUnit;
  shortage: number;
  unitCost?: number;
  totalCost?: number;
  estimatedCost?: number;
}

export interface BatchPackagingRequirement {
  packagingId?: string;
  packagingMaterialId?: string;
  materialName: string;
  materialCode?: any;
  requiredQuantity: number;
  availableStock: number;
  unit: StandardUnit;
  shortage: number;
  unitCost?: number;
  totalCost?: number;
  estimatedCost?: number;
}

export interface PackagingFormula {
  id: string;
  name?: string;
  productId: string;
  productName: string;
  packSize: string;
  containerType: string;
  components: FormulaPackagingComponent[];
}

export interface ProductionBatch extends ProductionLog {
  status?: BatchStatus | string;
  targetQuantity?: number;
  targetUnit?: string;
  plannedStartDate?: string;
  actualStartDate?: string;
  completedAt?: string;
  operatorNotes?: string;
  qaNotes?: string;
  ingredientsRequired?: BatchIngredientRequirement[];
  packagingRequired?: BatchPackagingRequirement[];
  ingredientsRequirements?: any[];
  packagingRequirements?: any[];
  rawMaterialRequirements?: any[];
  requestedBatchSize?: number;
  batchUnit?: string;
  targetPacksCount?: number;
  goodOutputPacks?: number;
  yieldPercentage?: number;
  rejectedOutputPacks?: number;
  scheduledDate?: string;
  targetPackSize?: string;
  assignedOperatorName?: string;
  assignedOperator?: string;
  approvedByName?: string;
  qaInspector?: string;
  formulaSnapshot?: any;
}


