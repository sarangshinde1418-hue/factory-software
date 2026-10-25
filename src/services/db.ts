import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  RawMaterial,
  PackagingMaterial,
  Product,
  Formula,
  Party,
  SalesOrder,
  WorkerTask,
  WorkerAttendance,
  FinishedGood,
  ProductionLog,
  InventoryTransaction,
  AuditLog,
  FactorySettings,
} from '../types/erp';
import { PRESET_WORKERS } from '../context/AuthContext';

// ==========================================
// AUDIT LOG HELPER
// ==========================================
export async function logAuditEvent(
  entityType: string,
  entityId: string,
  action: string,
  details: string,
  userEmail: string = 'system',
  performedBy: string = 'System',
  beforeState?: string,
  afterState?: string,
  quantityDelta?: number
) {
  try {
    const logRef = doc(collection(db, 'auditLogs'));
    const auditData: AuditLog = {
      id: logRef.id,
      entityType,
      entityId,
      action,
      details,
      beforeState,
      afterState,
      quantityDelta,
      performedBy,
      userEmail,
      timestamp: new Date().toISOString(),
    };
    await setDoc(logRef, auditData);
  } catch (err) {
    console.error('Audit log write error:', err);
  }
}

// ==========================================
// 1. RAW MATERIALS
// ==========================================
export function subscribeRawMaterials(
  onData: (materials: RawMaterial[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'rawMaterials'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: RawMaterial[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as RawMaterial);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'rawMaterials');
    }
  );
}

export async function saveRawMaterial(
  material: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
  userEmail: string = 'admin'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'rawMaterials', id);
      await updateDoc(docRef, {
        ...material,
        updatedAt: now,
      });
      await logAuditEvent('RawMaterial', id, 'UPDATE', `Updated ${material.name} (${material.code})`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'rawMaterials'));
      const newMaterial: RawMaterial = {
        id: docRef.id,
        ...material,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newMaterial);

      if (material.openingStock > 0) {
        await recordStockTransaction({
          transactionType: 'opening',
          materialType: 'raw',
          itemId: docRef.id,
          itemName: material.name,
          itemCode: material.code,
          quantity: material.openingStock,
          unit: material.unit,
          unitCost: material.unitCost || 0,
          referenceType: 'manual',
          notes: 'Opening balance',
          performedBy: userEmail,
          performedByName: userEmail,
        });
      }

      await logAuditEvent('RawMaterial', docRef.id, 'CREATE', `Created raw material ${material.name}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'rawMaterials');
    throw err;
  }
}

export async function addRawMaterialStock(
  materialId: string,
  quantity: number,
  batchNumber?: string,
  lotNumber?: string,
  notes?: string,
  userEmail: string = 'admin',
  userName: string = 'Admin'
) {
  try {
    await runTransaction(db, async (txn) => {
      const docRef = doc(db, 'rawMaterials', materialId);
      const snap = await txn.get(docRef);
      if (!snap.exists()) throw new Error('Raw material not found');

      const data = snap.data() as RawMaterial;
      const beforeStock = data.currentStock || 0;
      const newStock = beforeStock + quantity;

      txn.update(docRef, {
        currentStock: newStock,
        lotNumber: lotNumber || data.lotNumber,
        updatedAt: new Date().toISOString(),
      });

      const txRef = doc(collection(db, 'inventoryTransactions'));
      txn.set(txRef, {
        id: txRef.id,
        transactionType: 'receipt',
        materialType: 'raw',
        itemId: materialId,
        itemName: data.name,
        itemCode: data.code,
        batchNumber: batchNumber || undefined,
        lotNumber: lotNumber || data.lotNumber || undefined,
        quantity,
        unit: data.unit,
        unitCost: data.unitCost || 0,
        totalCost: Number((quantity * (data.unitCost || 0)).toFixed(2)),
        referenceType: 'manual',
        notes: notes || `Stock added to batch ${batchNumber || 'N/A'}`,
        performedBy: userEmail,
        performedByName: userName,
        createdAt: new Date().toISOString(),
      });

      const auditRef = doc(collection(db, 'auditLogs'));
      txn.set(auditRef, {
        id: auditRef.id,
        entityType: 'RawMaterial',
        entityId: materialId,
        action: 'STOCK_ADD',
        details: `Added ${quantity} ${data.unit} to ${data.name}. New Stock: ${newStock} ${data.unit}`,
        beforeState: `${beforeStock}`,
        afterState: `${newStock}`,
        quantityDelta: quantity,
        performedBy: userName,
        userEmail,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `rawMaterials/${materialId}`);
    throw err;
  }
}

// ==========================================
// 2. PACKING MATERIALS
// ==========================================
export function subscribePackagingMaterials(
  onData: (materials: PackagingMaterial[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'packagingMaterials'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: PackagingMaterial[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as PackagingMaterial);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'packagingMaterials');
    }
  );
}

export async function savePackagingMaterial(
  material: Omit<PackagingMaterial, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
  userEmail: string = 'admin'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'packagingMaterials', id);
      await updateDoc(docRef, {
        ...material,
        updatedAt: now,
      });
      await logAuditEvent('PackagingMaterial', id, 'UPDATE', `Updated ${material.name}`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'packagingMaterials'));
      const newMaterial: PackagingMaterial = {
        id: docRef.id,
        ...material,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newMaterial);

      if (material.openingStock > 0) {
        await recordStockTransaction({
          transactionType: 'opening',
          materialType: 'packaging',
          itemId: docRef.id,
          itemName: material.name,
          itemCode: material.code,
          quantity: material.openingStock,
          unit: material.unit,
          unitCost: material.unitCost || 0,
          referenceType: 'manual',
          notes: 'Opening balance',
          performedBy: userEmail,
          performedByName: userEmail,
        });
      }

      await logAuditEvent('PackagingMaterial', docRef.id, 'CREATE', `Created packaging material ${material.name}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'packagingMaterials');
    throw err;
  }
}

export async function addPackagingStock(
  packagingId: string,
  quantity: number,
  notes?: string,
  userEmail: string = 'admin',
  userName: string = 'Admin'
) {
  try {
    await runTransaction(db, async (txn) => {
      const docRef = doc(db, 'packagingMaterials', packagingId);
      const snap = await txn.get(docRef);
      if (!snap.exists()) throw new Error('Packaging material not found');

      const data = snap.data() as PackagingMaterial;
      const beforeStock = data.currentStock || 0;
      const newStock = beforeStock + quantity;

      txn.update(docRef, {
        currentStock: newStock,
        updatedAt: new Date().toISOString(),
      });

      const txRef = doc(collection(db, 'inventoryTransactions'));
      txn.set(txRef, {
        id: txRef.id,
        transactionType: 'receipt',
        materialType: 'packaging',
        itemId: packagingId,
        itemName: data.name,
        itemCode: data.code,
        quantity,
        unit: data.unit,
        unitCost: data.unitCost || 0,
        totalCost: Number((quantity * (data.unitCost || 0)).toFixed(2)),
        referenceType: 'manual',
        notes: notes || 'Packaging stock added',
        performedBy: userEmail,
        performedByName: userName,
        createdAt: new Date().toISOString(),
      });

      const auditRef = doc(collection(db, 'auditLogs'));
      txn.set(auditRef, {
        id: auditRef.id,
        entityType: 'PackagingMaterial',
        entityId: packagingId,
        action: 'STOCK_ADD',
        details: `Added ${quantity} ${data.unit} to ${data.name}. New Stock: ${newStock} ${data.unit}`,
        beforeState: `${beforeStock}`,
        afterState: `${newStock}`,
        quantityDelta: quantity,
        performedBy: userName,
        userEmail,
        timestamp: new Date().toISOString(),
      });
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `packagingMaterials/${packagingId}`);
    throw err;
  }
}

// ==========================================
// 3. PRODUCTS CATALOG
// ==========================================
export function subscribeProducts(
  onData: (products: Product[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'products'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Product[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Product);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'products');
    }
  );
}

export async function saveProduct(
  product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
  userEmail: string = 'admin'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'products', id);
      await updateDoc(docRef, {
        ...product,
        updatedAt: now,
      });
      await logAuditEvent('Product', id, 'UPDATE', `Updated product ${product.name}`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'products'));
      const newProd: Product = {
        id: docRef.id,
        ...product,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newProd);
      await logAuditEvent('Product', docRef.id, 'CREATE', `Created product ${product.name}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'products');
    throw err;
  }
}

// ==========================================
// 4. FORMULA ENGINE
// ==========================================
export function subscribeFormulas(
  onData: (formulas: Formula[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'formulas'), orderBy('productName', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Formula[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Formula);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'formulas');
    }
  );
}

export async function saveFormula(
  formula: Omit<Formula, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
  userEmail: string = 'admin',
  userName: string = 'Admin'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'formulas', id);
      await updateDoc(docRef, {
        ...formula,
        updatedAt: now,
      });
      await logAuditEvent('Formula', id, 'UPDATE', `Updated formula for ${formula.productName} (${formula.packSize}) v${formula.version}`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'formulas'));
      const newFormula: Formula = {
        id: docRef.id,
        ...formula,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newFormula);
      await logAuditEvent('Formula', docRef.id, 'CREATE', `Created formula for ${formula.productName} (${formula.packSize}) v${formula.version}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'formulas');
    throw err;
  }
}

export async function deleteFormula(id: string, userEmail: string = 'admin') {
  try {
    await deleteDoc(doc(db, 'formulas', id));
    await logAuditEvent('Formula', id, 'DELETE', `Deleted formula ${id}`, userEmail);
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, `formulas/${id}`);
    throw err;
  }
}

// ==========================================
// 5. PRODUCTION ENTRY (AUTO-DEDUCT STOCK)
// ==========================================
export function subscribeProductionLogs(
  onData: (logs: ProductionLog[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'productionBatches'), orderBy('createdAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: ProductionLog[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as ProductionLog);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'productionBatches');
    }
  );
}

export interface ProductionEntryInput {
  productId: string;
  packSize: string;
  numberOfBoxes: number;
  batchNumber: string;
  batchDate: string;
  operatorId?: string;
  operatorName?: string;
  notes?: string;
  userEmail: string;
  userName: string;
}

export async function recordProductionEntry(input: ProductionEntryInput) {
  const {
    productId,
    packSize,
    numberOfBoxes,
    batchNumber,
    batchDate,
    operatorId,
    operatorName,
    notes,
    userEmail,
    userName,
  } = input;

  if (numberOfBoxes <= 0) {
    throw new Error('Number of boxes must be greater than zero.');
  }

  // 1. Fetch matching product and formula
  const productDoc = await getDoc(doc(db, 'products', productId));
  if (!productDoc.exists()) throw new Error('Selected product not found.');
  const product = productDoc.data() as Product;

  // Find formula for this product and packSize (or standard)
  const formulasSnap = await getDocs(
    query(collection(db, 'formulas'), where('productId', '==', productId))
  );
  let formula: Formula | null = null;
  formulasSnap.forEach((doc) => {
    const f = doc.data() as Formula;
    if (f.packSize === packSize || !formula) {
      formula = f;
    }
  });

  if (!formula) {
    throw new Error(`No active formula found for ${product.name} (${packSize}). Please create a formula first.`);
  }

  // Find box rule to compute total units
  const boxRule = product.boxRules?.find((r) => r.packSize === packSize);
  const unitsPerBox = boxRule ? boxRule.unitsPerBox : 1;
  const totalUnits = numberOfBoxes * unitsPerBox;

  // Run atomic Firestore transaction
  return await runTransaction(db, async (txn) => {
    // 2. Validate Raw Material Stocks
    const rawDeductions: {
      materialId: string;
      materialName: string;
      required: number;
      unit: string;
      currentStock: number;
    }[] = [];

    for (const ing of (formula as Formula).ingredients) {
      const rmRef = doc(db, 'rawMaterials', ing.rawMaterialId);
      const rmSnap = await txn.get(rmRef);
      if (!rmSnap.exists()) {
        throw new Error(`Raw material ${ing.materialName} not found in database.`);
      }
      const rmData = rmSnap.data() as RawMaterial;
      const required = ing.quantity * numberOfBoxes;

      if (rmData.currentStock < required) {
        throw new Error(
          `Insufficient stock for raw material "${rmData.name}". Required: ${required} ${rmData.unit}, Available: ${rmData.currentStock} ${rmData.unit}. Production blocked!`
        );
      }

      rawDeductions.push({
        materialId: ing.rawMaterialId,
        materialName: rmData.name,
        required,
        unit: rmData.unit,
        currentStock: rmData.currentStock,
      });
    }

    // 3. Validate Packaging Material Stocks
    const pkgDeductions: {
      packagingId: string;
      materialName: string;
      required: number;
      unit: string;
      currentStock: number;
    }[] = [];

    for (const pkg of (formula as Formula).packagingComponents || []) {
      const pmRef = doc(db, 'packagingMaterials', pkg.packagingMaterialId);
      const pmSnap = await txn.get(pmRef);
      if (!pmSnap.exists()) {
        throw new Error(`Packing material ${pkg.materialName} not found in database.`);
      }
      const pmData = pmSnap.data() as PackagingMaterial;
      const required = pkg.quantityPerUnitOrBox * numberOfBoxes;

      if (pmData.currentStock < required) {
        throw new Error(
          `Insufficient stock for packing item "${pmData.name}". Required: ${required} ${pmData.unit}, Available: ${pmData.currentStock} ${pmData.unit}. Production blocked!`
        );
      }

      pkgDeductions.push({
        packagingId: pkg.packagingMaterialId,
        materialName: pmData.name,
        required,
        unit: pmData.unit,
        currentStock: pmData.currentStock,
      });
    }

    // 4. Perform Deductions
    const now = new Date().toISOString();

    for (const rd of rawDeductions) {
      const rmRef = doc(db, 'rawMaterials', rd.materialId);
      const newStock = rd.currentStock - rd.required;
      txn.update(rmRef, {
        currentStock: newStock,
        updatedAt: now,
      });

      // Stock transaction
      const txRef = doc(collection(db, 'inventoryTransactions'));
      txn.set(txRef, {
        id: txRef.id,
        transactionType: 'issue',
        materialType: 'raw',
        itemId: rd.materialId,
        itemName: rd.materialName,
        itemCode: rd.materialId,
        batchNumber,
        quantity: -rd.required,
        unit: rd.unit,
        unitCost: 0,
        referenceType: 'production_batch',
        notes: `Issued for ${product.name} ${numberOfBoxes} boxes (Batch: ${batchNumber})`,
        performedBy: userEmail,
        performedByName: userName,
        createdAt: now,
      });

      // Audit log
      const auditRef = doc(collection(db, 'auditLogs'));
      txn.set(auditRef, {
        id: auditRef.id,
        entityType: 'RawMaterial',
        entityId: rd.materialId,
        action: 'PRODUCTION_DEDUCT',
        details: `Deducted ${rd.required} ${rd.unit} for batch ${batchNumber}. New stock: ${newStock}`,
        beforeState: `${rd.currentStock}`,
        afterState: `${newStock}`,
        quantityDelta: -rd.required,
        performedBy: userName,
        userEmail,
        timestamp: now,
      });
    }

    for (const pd of pkgDeductions) {
      const pmRef = doc(db, 'packagingMaterials', pd.packagingId);
      const newStock = pd.currentStock - pd.required;
      txn.update(pmRef, {
        currentStock: newStock,
        updatedAt: now,
      });

      const txRef = doc(collection(db, 'inventoryTransactions'));
      txn.set(txRef, {
        id: txRef.id,
        transactionType: 'issue',
        materialType: 'packaging',
        itemId: pd.packagingId,
        itemName: pd.materialName,
        itemCode: pd.packagingId,
        batchNumber,
        quantity: -pd.required,
        unit: pd.unit,
        unitCost: 0,
        referenceType: 'production_batch',
        notes: `Issued packaging for ${product.name} ${numberOfBoxes} boxes (Batch: ${batchNumber})`,
        performedBy: userEmail,
        performedByName: userName,
        createdAt: now,
      });

      const auditRef = doc(collection(db, 'auditLogs'));
      txn.set(auditRef, {
        id: auditRef.id,
        entityType: 'PackagingMaterial',
        entityId: pd.packagingId,
        action: 'PRODUCTION_DEDUCT',
        details: `Deducted ${pd.required} ${pd.unit} for batch ${batchNumber}. New stock: ${newStock}`,
        beforeState: `${pd.currentStock}`,
        afterState: `${newStock}`,
        quantityDelta: -pd.required,
        performedBy: userName,
        userEmail,
        timestamp: now,
      });
    }

    // 5. Add to Finished Goods Inventory
    const fgQuerySnap = await getDocs(
      query(
        collection(db, 'finishedGoods'),
        where('productId', '==', productId),
        where('packSize', '==', packSize),
        where('batchNumber', '==', batchNumber)
      )
    );

    let fgId: string;
    if (!fgQuerySnap.empty) {
      const existingFg = fgQuerySnap.docs[0];
      fgId = existingFg.id;
      const fgData = existingFg.data() as FinishedGood;
      const updatedBoxes = (fgData.availableBoxes || 0) + numberOfBoxes;
      const updatedUnits = (fgData.availableUnits || 0) + totalUnits;

      txn.update(doc(db, 'finishedGoods', fgId), {
        quantityBoxes: (fgData.quantityBoxes || 0) + numberOfBoxes,
        quantityUnits: (fgData.quantityUnits || 0) + totalUnits,
        availableBoxes: updatedBoxes,
        availableUnits: updatedUnits,
        updatedAt: now,
      });
    } else {
      const newFgRef = doc(collection(db, 'finishedGoods'));
      fgId = newFgRef.id;
      const newFg: FinishedGood = {
        id: fgId,
        productId,
        productName: product.name,
        productCode: product.code,
        packSize,
        batchNumber,
        mfgDate: batchDate,
        expiryDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 years
        quantityBoxes: numberOfBoxes,
        quantityUnits: totalUnits,
        availableBoxes: numberOfBoxes,
        availableUnits: totalUnits,
        unit: 'boxes',
        warehouseLocation: 'Main FG Warehouse - Bay A',
        qaStatus: 'approved',
        createdAt: now,
        updatedAt: now,
      };
      txn.set(newFgRef, newFg);
    }

    // 6. Save Production Log
    const logRef = doc(collection(db, 'productionBatches'));
    const prodLog: ProductionLog = {
      id: logRef.id,
      batchNumber,
      productId,
      productName: product.name,
      productCode: product.code,
      packSize,
      formulaId: (formula as Formula).id,
      formulaVersion: (formula as Formula).version,
      numberOfBoxes,
      totalUnits,
      batchDate,
      operatorId,
      operatorName,
      rawMaterialsDeducted: rawDeductions.map((r) => ({
        materialId: r.materialId,
        materialName: r.materialName,
        quantityDeducted: r.required,
        unit: r.unit,
      })),
      packagingMaterialsDeducted: pkgDeductions.map((p) => ({
        packagingId: p.packagingId,
        materialName: p.materialName,
        quantityDeducted: p.required,
        unit: p.unit,
      })),
      notes,
      createdBy: userEmail,
      createdByName: userName,
      createdAt: now,
    };
    txn.set(logRef, prodLog);

    return logRef.id;
  });
}

// ==========================================
// 6. FINISHED GOODS & OUTGOING / SALES
// ==========================================
export function subscribeFinishedGoods(
  onData: (items: FinishedGood[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'finishedGoods'), orderBy('productName', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: FinishedGood[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as FinishedGood);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'finishedGoods');
    }
  );
}

export function subscribeParties(
  onData: (parties: Party[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'parties'), orderBy('name', 'asc'));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: Party[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as Party);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'parties');
    }
  );
}

export async function saveParty(
  party: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>,
  id?: string,
  userEmail: string = 'admin'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'parties', id);
      await updateDoc(docRef, {
        ...party,
        updatedAt: now,
      });
      await logAuditEvent('Party', id, 'UPDATE', `Updated party ${party.name}`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'parties'));
      const newParty: Party = {
        id: docRef.id,
        ...party,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newParty);
      await logAuditEvent('Party', docRef.id, 'CREATE', `Created party ${party.name}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'parties');
    throw err;
  }
}

export function subscribeSalesOrders(
  onData: (orders: SalesOrder[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'salesOrders'), orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: SalesOrder[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as SalesOrder);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'salesOrders');
    }
  );
}

export interface OutgoingSalesInput {
  partyId: string;
  partyName: string;
  finishedGoodId: string;
  quantityBoxes: number;
  unitPrice: number;
  date: string;
  notes?: string;
  userEmail: string;
  userName: string;
}

export async function recordSalesOrder(input: OutgoingSalesInput) {
  const {
    partyId,
    partyName,
    finishedGoodId,
    quantityBoxes,
    unitPrice,
    date,
    notes,
    userEmail,
    userName,
  } = input;

  if (quantityBoxes <= 0) {
    throw new Error('Quantity in boxes must be at least 1.');
  }

  return await runTransaction(db, async (txn) => {
    const fgRef = doc(db, 'finishedGoods', finishedGoodId);
    const fgSnap = await txn.get(fgRef);
    if (!fgSnap.exists()) {
      throw new Error('Finished goods item not found in warehouse.');
    }

    const fgData = fgSnap.data() as FinishedGood;
    if (fgData.availableBoxes < quantityBoxes) {
      throw new Error(
        `Insufficient finished goods stock for ${fgData.productName} (${fgData.packSize}, Batch: ${fgData.batchNumber}). Requested: ${quantityBoxes} boxes, Available: ${fgData.availableBoxes} boxes.`
      );
    }

    const now = new Date().toISOString();
    const newAvailableBoxes = fgData.availableBoxes - quantityBoxes;
    const unitsPerBox = fgData.quantityBoxes > 0 ? fgData.quantityUnits / fgData.quantityBoxes : 1;
    const dispatchedUnits = quantityBoxes * unitsPerBox;
    const newAvailableUnits = Math.max(0, fgData.availableUnits - dispatchedUnits);

    // Deduct finished goods stock
    txn.update(fgRef, {
      availableBoxes: newAvailableBoxes,
      availableUnits: newAvailableUnits,
      updatedAt: now,
    });

    const totalAmount = Number((quantityBoxes * unitPrice).toFixed(2));
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    // Create sales order document
    const orderRef = doc(collection(db, 'salesOrders'));
    const order: SalesOrder = {
      id: orderRef.id,
      invoiceNumber,
      partyId,
      partyName,
      productId: fgData.productId,
      productName: fgData.productName,
      productCode: fgData.productCode,
      packSize: fgData.packSize,
      batchNumber: fgData.batchNumber,
      quantityBoxes,
      quantityUnits: dispatchedUnits,
      unitPrice,
      totalAmount,
      date,
      dispatchedBy: userEmail,
      dispatchedByName: userName,
      status: 'dispatched',
      notes,
      createdAt: now,
    };
    txn.set(orderRef, order);

    // Ledger transaction
    const txRef = doc(collection(db, 'inventoryTransactions'));
    txn.set(txRef, {
      id: txRef.id,
      transactionType: 'dispatch',
      materialType: 'finished',
      itemId: fgData.id,
      itemName: `${fgData.productName} (${fgData.packSize})`,
      itemCode: fgData.productCode,
      batchNumber: fgData.batchNumber,
      quantity: -quantityBoxes,
      unit: 'boxes',
      unitCost: unitPrice,
      totalCost: totalAmount,
      referenceType: 'dispatch',
      referenceId: orderRef.id,
      notes: `Dispatched to ${partyName} (Inv: ${invoiceNumber})`,
      performedBy: userEmail,
      performedByName: userName,
      createdAt: now,
    });

    // Audit log
    const auditRef = doc(collection(db, 'auditLogs'));
    txn.set(auditRef, {
      id: auditRef.id,
      entityType: 'FinishedGood',
      entityId: fgData.id,
      action: 'SALES_DISPATCH',
      details: `Dispatched ${quantityBoxes} boxes to ${partyName}. Remaining: ${newAvailableBoxes} boxes.`,
      beforeState: `${fgData.availableBoxes}`,
      afterState: `${newAvailableBoxes}`,
      quantityDelta: -quantityBoxes,
      performedBy: userName,
      userEmail,
      timestamp: now,
    });

    return orderRef.id;
  });
}

export async function dispatchFinishedGoods(
  fgId: string,
  quantityBoxes: number,
  destination: string,
  userEmail: string = 'admin',
  userName: string = 'Admin'
) {
  return await runTransaction(db, async (txn) => {
    const fgRef = doc(db, 'finishedGoods', fgId);
    const snap = await txn.get(fgRef);
    if (!snap.exists()) throw new Error('Finished goods item not found in warehouse');

    const fg = snap.data() as FinishedGood;
    const available = fg.availableBoxes ?? fg.availableQuantity ?? 0;
    if (available < quantityBoxes) {
      throw new Error(`Insufficient stock. Available: ${available} boxes.`);
    }

    const now = new Date().toISOString();
    const newAvailableBoxes = available - quantityBoxes;
    const unitsPerBox = fg.quantityBoxes > 0 ? (fg.quantityUnits / fg.quantityBoxes) : 1;
    const dispatchedUnits = quantityBoxes * unitsPerBox;
    const newAvailableUnits = Math.max(0, (fg.availableUnits ?? fg.quantity ?? 0) - dispatchedUnits);

    txn.update(fgRef, {
      availableBoxes: newAvailableBoxes,
      availableUnits: newAvailableUnits,
      availableQuantity: newAvailableBoxes,
      updatedAt: now,
    });

    const txRef = doc(collection(db, 'inventoryTransactions'));
    txn.set(txRef, {
      id: txRef.id,
      transactionType: 'dispatch',
      materialType: 'finished',
      itemId: fg.id,
      itemName: `${fg.productName} (${fg.packSize})`,
      itemCode: fg.productCode,
      batchNumber: fg.batchNumber,
      quantity: -quantityBoxes,
      unit: 'boxes',
      unitCost: fg.unitCost || 0,
      totalCost: (fg.unitCost || 0) * quantityBoxes,
      referenceType: 'dispatch',
      notes: `Warehouse dispatch to ${destination}`,
      performedBy: userEmail,
      performedByName: userName,
      createdAt: now,
    });

    const auditRef = doc(collection(db, 'auditLogs'));
    txn.set(auditRef, {
      id: auditRef.id,
      entityType: 'FinishedGood',
      entityId: fg.id,
      action: 'DISPATCH',
      details: `Dispatched ${quantityBoxes} boxes to ${destination}`,
      beforeState: `${available}`,
      afterState: `${newAvailableBoxes}`,
      quantityDelta: -quantityBoxes,
      performedBy: userName,
      userEmail,
      timestamp: now,
    });
  });
}

// Aliases for compatibility
export const subscribeProductionBatches = subscribeProductionLogs;
export const seedInitialFactoryData = seedAgroFertilizerData;

// ==========================================
// 7. TASKS & ATTENDANCE
// ==========================================
export function subscribeTasks(
  onData: (tasks: WorkerTask[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'tasks'), orderBy('assignedAt', 'desc'), limit(100));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkerTask[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as WorkerTask);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'tasks');
    }
  );
}

export async function saveWorkerTask(
  task: Omit<WorkerTask, 'id' | 'assignedAt'>,
  id?: string,
  userEmail: string = 'manager',
  userName: string = 'Manager'
): Promise<string> {
  const now = new Date().toISOString();
  try {
    if (id) {
      const docRef = doc(db, 'tasks', id);
      await updateDoc(docRef, {
        ...task,
      });
      await logAuditEvent('Task', id, 'UPDATE', `Updated task: ${task.title}`, userEmail);
      return id;
    } else {
      const docRef = doc(collection(db, 'tasks'));
      const newTask: WorkerTask = {
        id: docRef.id,
        ...task,
        assignedAt: now,
      };
      await setDoc(docRef, newTask);
      await logAuditEvent('Task', docRef.id, 'ASSIGN', `Assigned task "${task.title}" to ${task.assignedToWorkerName}`, userEmail);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'tasks');
    throw err;
  }
}

export async function updateTaskStatus(
  taskId: string,
  status: WorkerTask['status'],
  workLog?: string,
  userEmail: string = 'worker',
  userName: string = 'Worker'
) {
  try {
    const docRef = doc(db, 'tasks', taskId);
    const updates: Partial<WorkerTask> = {
      status,
      workLog: workLog || undefined,
    };
    if (status === 'completed') {
      updates.completedAt = new Date().toISOString();
    }
    await updateDoc(docRef, updates);
    await logAuditEvent('Task', taskId, 'STATUS_CHANGE', `Task changed to ${status}`, userEmail, userName);
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `tasks/${taskId}`);
    throw err;
  }
}

export function subscribeAttendance(
  dateStr: string, // YYYY-MM-DD or empty for recent
  onData: (records: WorkerAttendance[]) => void,
  onError?: (err: unknown) => void
) {
  let q;
  if (dateStr) {
    q = query(collection(db, 'attendance'), where('date', '==', dateStr));
  } else {
    q = query(collection(db, 'attendance'), orderBy('date', 'desc'), limit(100));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      const items: WorkerAttendance[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as WorkerAttendance);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'attendance');
    }
  );
}

export async function recordWorkerAttendance(
  record: Omit<WorkerAttendance, 'id' | 'createdAt' | 'updatedAt'>,
  userEmail: string = 'manager',
  userName: string = 'Manager'
) {
  const now = new Date().toISOString();
  try {
    // Check if record exists for this worker on this date
    const qSnap = await getDocs(
      query(
        collection(db, 'attendance'),
        where('workerId', '==', record.workerId),
        where('date', '==', record.date)
      )
    );

    if (!qSnap.empty) {
      const existingDoc = qSnap.docs[0];
      await updateDoc(doc(db, 'attendance', existingDoc.id), {
        ...record,
        updatedAt: now,
      });
      await logAuditEvent('Attendance', existingDoc.id, 'UPDATE', `Updated attendance for ${record.workerName} on ${record.date} (${record.status})`, userEmail, userName);
      return existingDoc.id;
    } else {
      const docRef = doc(collection(db, 'attendance'));
      const newAttendance: WorkerAttendance = {
        id: docRef.id,
        ...record,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(docRef, newAttendance);
      await logAuditEvent('Attendance', docRef.id, 'RECORD', `Marked attendance for ${record.workerName} as ${record.status}`, userEmail, userName);
      return docRef.id;
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'attendance');
    throw err;
  }
}

// ==========================================
// 8. INVENTORY TRANSACTIONS & AUDIT LOGS
// ==========================================
export function subscribeInventoryTransactions(
  onData: (transactions: InventoryTransaction[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'inventoryTransactions'), orderBy('createdAt', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: InventoryTransaction[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as InventoryTransaction);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'inventoryTransactions');
    }
  );
}

export async function recordStockTransaction(
  transaction: Omit<InventoryTransaction, 'id' | 'createdAt'>
) {
  try {
    const docRef = doc(collection(db, 'inventoryTransactions'));
    const newTx: InventoryTransaction = {
      id: docRef.id,
      ...transaction,
      createdAt: new Date().toISOString(),
    };
    await setDoc(docRef, newTx);
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'inventoryTransactions');
    throw err;
  }
}

export function subscribeAuditLogs(
  onData: (logs: AuditLog[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(150));
  return onSnapshot(
    q,
    (snapshot) => {
      const items: AuditLog[] = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() } as AuditLog);
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'auditLogs');
    }
  );
}

// ==========================================
// 9. FACTORY SETTINGS & GOOGLE SHEET BACKUP
// ==========================================
export function subscribeSettings(
  onData: (settings: FactorySettings) => void,
  onError?: (err: unknown) => void
) {
  const docRef = doc(db, 'settings', 'global');
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        onData({ id: snapshot.id, ...snapshot.data() } as FactorySettings);
      } else {
        const defaultSettings: FactorySettings = {
          id: 'global',
          companyName: 'Maha Agro-Fertilizers Pvt Ltd',
          companyTagline: 'High Yield Organic & Bio-Chemical Formulations',
          currency: '₹',
          address: 'Plot No. 42-B, MIDC Industrial Area, Akola, Maharashtra',
          phone: '+91 98220 54321',
          email: 'factory@mahaagro.com',
          lowStockThresholdDefault: 200,
          googleAppsScriptUrl: '',
          autoBackupOnWrite: false,
          defaultAdminEmail: 'sarangshinde1418@gmail.com',
          updatedAt: new Date().toISOString(),
        };
        onData(defaultSettings);
      }
    },
    (err) => {
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, 'settings/global');
    }
  );
}

export async function saveSettings(
  settings: Partial<FactorySettings>,
  userEmail: string = 'admin'
) {
  try {
    const docRef = doc(db, 'settings', 'global');
    await setDoc(
      docRef,
      {
        ...settings,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await logAuditEvent('Settings', 'global', 'UPDATE', 'Updated factory configuration settings', userEmail);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'settings/global');
    throw err;
  }
}

export async function backupToGoogleSheet(gasUrl: string, userEmail: string = 'admin') {
  if (!gasUrl || !gasUrl.startsWith('http')) {
    throw new Error('Please enter a valid Google Apps Script Web App URL in Settings.');
  }

  // Fetch full data snapshot
  const [rawSnap, pkgSnap, prodSnap, fgSnap, salesSnap, prodLogSnap, taskSnap, attSnap] = await Promise.all([
    getDocs(collection(db, 'rawMaterials')),
    getDocs(collection(db, 'packagingMaterials')),
    getDocs(collection(db, 'products')),
    getDocs(collection(db, 'finishedGoods')),
    getDocs(collection(db, 'salesOrders')),
    getDocs(collection(db, 'productionBatches')),
    getDocs(collection(db, 'tasks')),
    getDocs(collection(db, 'attendance')),
  ]);

  const payload = {
    timestamp: new Date().toISOString(),
    exportedBy: userEmail,
    rawMaterials: rawSnap.docs.map((d) => d.data()),
    packagingMaterials: pkgSnap.docs.map((d) => d.data()),
    products: prodSnap.docs.map((d) => d.data()),
    finishedGoods: fgSnap.docs.map((d) => d.data()),
    salesOrders: salesSnap.docs.map((d) => d.data()),
    productionLogs: prodLogSnap.docs.map((d) => d.data()),
    tasks: taskSnap.docs.map((d) => d.data()),
    attendance: attSnap.docs.map((d) => d.data()),
  };

  try {
    // Send to Google Apps Script endpoint via POST
    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      mode: 'no-cors', // standard for GAS web-apps
    });

    const now = new Date().toISOString();
    await saveSettings({ lastBackupAt: now }, userEmail);
    await logAuditEvent('Backup', 'google_sheet', 'BACKUP_SUCCESS', `Successfully backed up factory data to Google Sheet`, userEmail);
    return true;
  } catch (err: any) {
    console.error('Google Sheet backup error:', err);
    throw new Error(`Failed to send backup to Google Sheet: ${err.message || err}`);
  }
}

// ==========================================
// 10. SEED AGRO-FERTILIZER FACTORY DATA
// ==========================================
export async function seedAgroFertilizerData(userEmail: string = 'sarangshinde1418@gmail.com') {
  const batch = writeBatch(db);
  const now = new Date().toISOString();
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Raw Materials
  const rawList: Omit<RawMaterial, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      code: 'RM-HUM-98',
      name: 'Potassium Humate 98% Flakes',
      category: 'Humic Acid',
      physicalForm: 'powder',
      unit: 'kg',
      openingStock: 2500,
      currentStock: 2500,
      minimumStock: 400,
      unitCost: 165,
      lotNumber: 'PH-26-041',
      location: 'Raw Shed 1 - Bay A',
      batch200Qty: 40,
      batch500Qty: 100,
      status: 'active',
    },
    {
      code: 'RM-FUL-80',
      name: 'Fulvic Acid 80% Super Pure',
      category: 'Fulvic',
      physicalForm: 'powder',
      unit: 'kg',
      openingStock: 1200,
      currentStock: 1200,
      minimumStock: 200,
      unitCost: 280,
      lotNumber: 'FA-26-019',
      location: 'Raw Shed 1 - Bay B',
      batch200Qty: 10,
      batch500Qty: 25,
      status: 'active',
    },
    {
      code: 'RM-BEN-CLAY',
      name: 'Roasted Bentonite Clay Granules (12-25 Mesh)',
      category: 'Bentonite',
      physicalForm: 'granules',
      unit: 'kg',
      openingStock: 18000,
      currentStock: 18000,
      minimumStock: 3000,
      unitCost: 12,
      lotNumber: 'BEN-26-102',
      location: 'Silo 2 - Granules Yard',
      batch200Qty: 180,
      batch500Qty: 450,
      status: 'active',
    },
    {
      code: 'RM-AMINO-80',
      name: 'Amino Acid 80% Soya Extract',
      category: 'Amino Acids',
      physicalForm: 'powder',
      unit: 'kg',
      openingStock: 1800,
      currentStock: 1800,
      minimumStock: 300,
      unitCost: 195,
      lotNumber: 'AA-26-008',
      location: 'Raw Shed 2 - Bay A',
      batch200Qty: 30,
      batch500Qty: 75,
      status: 'active',
    },
    {
      code: 'RM-SEA-LIQ',
      name: 'Ascophyllum Nodosum Seaweed Extract Liquid',
      category: 'Chemicals',
      physicalForm: 'liquid',
      unit: 'l',
      openingStock: 3500,
      currentStock: 3500,
      minimumStock: 500,
      unitCost: 110,
      lotNumber: 'SW-26-077',
      location: 'Tank Compound - T-04',
      batch200Qty: 40,
      batch500Qty: 100,
      status: 'active',
    },
    {
      code: 'RM-NITRO-35',
      name: 'Nitrobenzene 35% Emulsion Grade',
      category: 'Chemicals',
      physicalForm: 'liquid',
      unit: 'l',
      openingStock: 2200,
      currentStock: 2200,
      minimumStock: 400,
      unitCost: 95,
      lotNumber: 'NB-26-014',
      location: 'Chemical Storage Tank 1',
      batch200Qty: 20,
      batch500Qty: 50,
      status: 'active',
    },
    {
      code: 'RM-SURF-ACT',
      name: 'Non-Ionic Silicon Spreader & Surfactant',
      category: 'Chemicals',
      physicalForm: 'liquid',
      unit: 'l',
      openingStock: 850,
      currentStock: 850,
      minimumStock: 150,
      unitCost: 420,
      lotNumber: 'SP-26-033',
      location: 'Chemical Shed - Shelf 3',
      batch200Qty: 6,
      batch500Qty: 15,
      status: 'active',
    },
    {
      code: 'RM-COAT-OIL',
      name: 'Polymer Coating Binder Oil',
      category: 'Solvents',
      physicalForm: 'liquid',
      unit: 'l',
      openingStock: 1500,
      currentStock: 1500,
      minimumStock: 250,
      unitCost: 85,
      lotNumber: 'CO-26-051',
      location: 'Tank 6',
      batch200Qty: 10,
      batch500Qty: 25,
      status: 'active',
    },
    {
      code: 'RM-DM-WATER',
      name: 'Demineralized Water (DM Water)',
      category: 'Solvents',
      physicalForm: 'liquid',
      unit: 'l',
      openingStock: 25000,
      currentStock: 25000,
      minimumStock: 5000,
      unitCost: 1.5,
      lotNumber: 'DM-IN-HOUSE',
      location: 'Water RO Plant Storage',
      batch200Qty: 150,
      batch500Qty: 375,
      status: 'active',
    },
  ];

  const rawMap: { [code: string]: string } = {};
  rawList.forEach((rm) => {
    const ref = doc(collection(db, 'rawMaterials'));
    rawMap[rm.code] = ref.id;
    batch.set(ref, { id: ref.id, ...rm, createdAt: now, updatedAt: now });
  });

  // 2. Packing Materials (with specific Bottle Types)
  const pkgList: Omit<PackagingMaterial, 'id' | 'createdAt' | 'updatedAt'>[] = [
    // Bottles
    {
      code: 'PKG-BTL-1L-PET',
      name: '1 Litre PET White Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'PET',
      unit: 'pieces',
      openingStock: 8000,
      currentStock: 8000,
      minimumStock: 1500,
      unitCost: 14.5,
      location: 'Packaging Bay P-01',
      status: 'active',
    },
    {
      code: 'PKG-BTL-500-MONO',
      name: '500ml Mono Amber Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'Mono',
      unit: 'pieces',
      openingStock: 6000,
      currentStock: 6000,
      minimumStock: 1200,
      unitCost: 11.0,
      location: 'Packaging Bay P-01',
      status: 'active',
    },
    {
      code: 'PKG-BTL-250-LUDO',
      name: '250ml Ludo Shape Green Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'Ludo',
      unit: 'pieces',
      openingStock: 5000,
      currentStock: 5000,
      minimumStock: 1000,
      unitCost: 8.5,
      location: 'Packaging Bay P-02',
      status: 'active',
    },
    {
      code: 'PKG-BTL-1L-IMIDA',
      name: '1 Litre Imida HDPE Round Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'Imida',
      unit: 'pieces',
      openingStock: 4500,
      currentStock: 4500,
      minimumStock: 1000,
      unitCost: 16.0,
      location: 'Packaging Bay P-02',
      status: 'active',
    },
    {
      code: 'PKG-BTL-500-DD',
      name: '500ml D.D Square Shoulder Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'D.D',
      unit: 'pieces',
      openingStock: 4000,
      currentStock: 4000,
      minimumStock: 800,
      unitCost: 12.5,
      location: 'Packaging Bay P-02',
      status: 'active',
    },
    {
      code: 'PKG-BTL-1L-AT',
      name: '1 Litre A.T Heavy Duty Ribbed Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'A.T',
      unit: 'pieces',
      openingStock: 3500,
      currentStock: 3500,
      minimumStock: 800,
      unitCost: 17.0,
      location: 'Packaging Bay P-03',
      status: 'active',
    },
    {
      code: 'PKG-BTL-500-VV',
      name: '500ml V.V High Clarity Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'V.V',
      unit: 'pieces',
      openingStock: 3000,
      currentStock: 3000,
      minimumStock: 600,
      unitCost: 13.0,
      location: 'Packaging Bay P-03',
      status: 'active',
    },
    {
      code: 'PKG-BTL-1L-GOLD',
      name: '1 Litre 24 Carat Gold Metallic Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: '24 Carat Gold',
      unit: 'pieces',
      openingStock: 2500,
      currentStock: 2500,
      minimumStock: 500,
      unitCost: 22.0,
      location: 'Packaging Bay P-04',
      status: 'active',
    },
    {
      code: 'PKG-BTL-500-AMRUT',
      name: '500ml PET Amrut Special Bottle',
      category: 'Bottles',
      type: 'bottle',
      bottleType: 'PET Amrut',
      unit: 'pieces',
      openingStock: 4000,
      currentStock: 4000,
      minimumStock: 800,
      unitCost: 12.0,
      location: 'Packaging Bay P-04',
      status: 'active',
    },

    // Labels
    {
      code: 'PKG-LBL-HUMISTAR-1L',
      name: 'Humistar 1L Metallic Foil Label',
      category: 'Labels',
      type: 'label',
      unit: 'pieces',
      openingStock: 12000,
      currentStock: 12000,
      minimumStock: 2000,
      unitCost: 2.2,
      location: 'Label Store Room',
      status: 'active',
    },
    {
      code: 'PKG-LBL-PANCHRATNA-1L',
      name: 'Panchratna 1L Glossy Label',
      category: 'Labels',
      type: 'label',
      unit: 'pieces',
      openingStock: 9000,
      currentStock: 9000,
      minimumStock: 1500,
      unitCost: 2.0,
      location: 'Label Store Room',
      status: 'active',
    },
    {
      code: 'PKG-LBL-BIOSHAKTI',
      name: 'Bioshakti G Bucket/Bag Front & Back Label',
      category: 'Labels',
      type: 'label',
      unit: 'pieces',
      openingStock: 5000,
      currentStock: 5000,
      minimumStock: 800,
      unitCost: 4.5,
      location: 'Label Store Room',
      status: 'active',
    },

    // Cardboard Boxes
    {
      code: 'PKG-BOX-1L-10',
      name: 'Cardboard Box (1L x 10 Bottles Outer)',
      category: 'Cardboard Boxes',
      type: 'box',
      unit: 'pieces',
      openingStock: 1500,
      currentStock: 1500,
      minimumStock: 300,
      unitCost: 28.0,
      location: 'Corrugated Box Stack 1',
      status: 'active',
    },
    {
      code: 'PKG-BOX-500-20',
      name: 'Cardboard Box (500ml x 20 Bottles Outer)',
      category: 'Cardboard Boxes',
      type: 'box',
      unit: 'pieces',
      openingStock: 1200,
      currentStock: 1200,
      minimumStock: 250,
      unitCost: 32.0,
      location: 'Corrugated Box Stack 2',
      status: 'active',
    },
    {
      code: 'PKG-BOX-250-40',
      name: 'Cardboard Box (250ml x 40 Bottles Outer)',
      category: 'Cardboard Boxes',
      type: 'box',
      unit: 'pieces',
      openingStock: 900,
      currentStock: 900,
      minimumStock: 200,
      unitCost: 36.0,
      location: 'Corrugated Box Stack 2',
      status: 'active',
    },

    // Shrink Sleeves
    {
      code: 'PKG-SLV-1L',
      name: 'PVC Shrink Sleeve 1L Neck & Body',
      category: 'Shrink Sleeves',
      type: 'sleeve',
      unit: 'pieces',
      openingStock: 15000,
      currentStock: 15000,
      minimumStock: 3000,
      unitCost: 1.2,
      location: 'Packaging Bay P-05',
      status: 'active',
    },

    // Bulk Containers
    {
      code: 'PKG-BCK-10KG',
      name: '10kg Heavy Duty Printed Plastic Bucket with Handle',
      category: 'Buckets',
      type: 'bucket',
      unit: 'pieces',
      openingStock: 1800,
      currentStock: 1800,
      minimumStock: 300,
      unitCost: 85.0,
      location: 'Bucket Shed C',
      status: 'active',
    },
    {
      code: 'PKG-BAG-25KG',
      name: '25kg HDPE Woven Laminated Bag',
      category: 'Bags',
      type: 'bag',
      unit: 'pieces',
      openingStock: 3000,
      currentStock: 3000,
      minimumStock: 500,
      unitCost: 26.0,
      location: 'Bag Stack D',
      status: 'active',
    },
    {
      code: 'PKG-DRM-50KG',
      name: '50kg Blue HDPE Open-Top Drum with Ring & Lid',
      category: 'Drums',
      type: 'drum',
      unit: 'pieces',
      openingStock: 450,
      currentStock: 450,
      minimumStock: 80,
      unitCost: 380.0,
      location: 'Drum Yard Outer',
      status: 'active',
    },

    // Pouches
    {
      code: 'PKG-PCH-100G',
      name: 'Amrutgold 100g Multi-Layer Printed Pouch',
      category: 'Pouches',
      type: 'pouch',
      unit: 'pieces',
      openingStock: 8000,
      currentStock: 8000,
      minimumStock: 1500,
      unitCost: 3.2,
      location: 'Pouch Shelf B',
      status: 'active',
    },
    {
      code: 'PKG-BOX-PCH-50',
      name: 'Master Corrugated Box for 100g x 50 Pouches',
      category: 'Cardboard Boxes',
      type: 'box',
      unit: 'pieces',
      openingStock: 600,
      currentStock: 600,
      minimumStock: 100,
      unitCost: 22.0,
      location: 'Box Stack 3',
      status: 'active',
    },
  ];

  const pkgMap: { [code: string]: string } = {};
  pkgList.forEach((pm) => {
    const ref = doc(collection(db, 'packagingMaterials'));
    pkgMap[pm.code] = ref.id;
    batch.set(ref, { id: ref.id, ...pm, createdAt: now, updatedAt: now });
  });

  // 3. Products (Exact 18 Products from prompt)
  const productNames = [
    { name: 'Humistar', cat: 'Liquid Fertilizer', type: 'liquid' },
    { name: 'Black Diamond', cat: 'Bio-Stimulant', type: 'powder' },
    { name: 'Supreme Shakti', cat: 'Organic PGR', type: 'liquid' },
    { name: 'Bioshakti G', cat: 'Granular Fertilizer', type: 'granules' },
    { name: 'Humipower-G', cat: 'Granular Fertilizer', type: 'granules' },
    { name: 'Harita Gold', cat: 'Bio-Stimulant', type: 'liquid' },
    { name: 'Plan 2.0', cat: 'Organic PGR', type: 'liquid' },
    { name: 'Ludo', cat: 'Liquid Fertilizer', type: 'liquid' },
    { name: 'Odin', cat: 'Micronutrient', type: 'liquid' },
    { name: 'Groom', cat: 'Bio-Stimulant', type: 'liquid' },
    { name: '24 Carat', cat: 'Bio-Stimulant', type: 'liquid' },
    { name: 'New Zhyne', cat: 'Organic PGR', type: 'liquid' },
    { name: 'Panchamrut', cat: 'Bio-Stimulant', type: 'liquid' },
    { name: 'Thor', cat: 'Liquid Fertilizer', type: 'liquid' },
    { name: 'Panchratna', cat: 'Liquid Fertilizer', type: 'liquid' },
    { name: 'Amrutgold', cat: 'Bio-Stimulant', type: 'powder' },
    { name: 'Mahashakti Speed', cat: 'Micronutrient', type: 'liquid' },
    { name: 'Maha Agrohume', cat: 'Liquid Fertilizer', type: 'liquid' },
  ];

  const prodMap: { [name: string]: string } = {};

  productNames.forEach((p, idx) => {
    const ref = doc(collection(db, 'products'));
    prodMap[p.name] = ref.id;

    let packSizes: string[];
    let boxRules = [];

    if (p.type === 'liquid') {
      packSizes = ['1L', '500ml', '250ml', '100ml'];
      boxRules = [
        { packSize: '1L', unitsPerBox: 10, containerType: 'bottle' as const, labelCountPerBox: 10, sleeveCountPerBox: 10, boxCountPerBox: 1 },
        { packSize: '500ml', unitsPerBox: 20, containerType: 'bottle' as const, labelCountPerBox: 20, sleeveCountPerBox: 20, boxCountPerBox: 1 },
        { packSize: '250ml', unitsPerBox: 40, containerType: 'bottle' as const, labelCountPerBox: 40, sleeveCountPerBox: 40, boxCountPerBox: 1 },
      ];
    } else if (p.name === 'Bioshakti G' || p.name === 'Humipower-G') {
      packSizes = ['10kg bucket', '25kg bag', '50kg drum'];
      boxRules = [
        { packSize: '10kg bucket', unitsPerBox: 1, containerType: 'bucket' as const, labelCountPerBox: 1, sleeveCountPerBox: 0, boxCountPerBox: 0 },
        { packSize: '25kg bag', unitsPerBox: 1, containerType: 'bag' as const, labelCountPerBox: 1, sleeveCountPerBox: 0, boxCountPerBox: 0 },
        { packSize: '50kg drum', unitsPerBox: 1, containerType: 'drum' as const, labelCountPerBox: 1, sleeveCountPerBox: 0, boxCountPerBox: 0 },
      ];
    } else {
      packSizes = ['100g', '250g', '500g', '1kg'];
      boxRules = [
        { packSize: '100g', unitsPerBox: 50, containerType: 'pouch' as const, labelCountPerBox: 50, sleeveCountPerBox: 0, boxCountPerBox: 1 },
        { packSize: '250g', unitsPerBox: 20, containerType: 'pouch' as const, labelCountPerBox: 20, sleeveCountPerBox: 0, boxCountPerBox: 1 },
        { packSize: '500g', unitsPerBox: 20, containerType: 'pouch' as const, labelCountPerBox: 20, sleeveCountPerBox: 0, boxCountPerBox: 1 },
      ];
    }

    batch.set(ref, {
      id: ref.id,
      code: `AGRO-${String(idx + 1).padStart(3, '0')}`,
      name: p.name,
      category: p.cat,
      productType: p.type,
      packSizes,
      boxRules,
      status: 'active',
      description: `High potency agro formulation: ${p.name}`,
      createdAt: now,
      updatedAt: now,
    });
  });

  // 4. Pre-loaded Formulas
  // Formula A: Humistar 1L (1 box = 10 bottles)
  const humistarFormulaRef = doc(collection(db, 'formulas'));
  batch.set(humistarFormulaRef, {
    id: humistarFormulaRef.id,
    productId: prodMap['Humistar'],
    productName: 'Humistar',
    productCode: 'AGRO-001',
    packSize: '1L',
    version: '1.0',
    status: 'approved',
    referenceBatchSize: 1, // 1 Box (10 Litres)
    referenceBatchUnit: 'boxes',
    ingredients: [
      {
        rawMaterialId: rawMap['RM-HUM-98'],
        materialName: 'Potassium Humate 98% Flakes',
        materialCode: 'RM-HUM-98',
        quantity: 2.0,
        unit: 'kg',
      },
      {
        rawMaterialId: rawMap['RM-FUL-80'],
        materialName: 'Fulvic Acid 80% Super Pure',
        materialCode: 'RM-FUL-80',
        quantity: 0.5,
        unit: 'kg',
      },
      {
        rawMaterialId: rawMap['RM-SURF-ACT'],
        materialName: 'Non-Ionic Silicon Spreader & Surfactant',
        materialCode: 'RM-SURF-ACT',
        quantity: 0.3,
        unit: 'l',
      },
      {
        rawMaterialId: rawMap['RM-DM-WATER'],
        materialName: 'Demineralized Water (DM Water)',
        materialCode: 'RM-DM-WATER',
        quantity: 7.5,
        unit: 'l',
      },
    ],
    packagingComponents: [
      {
        packagingMaterialId: pkgMap['PKG-BTL-1L-PET'],
        materialName: '1 Litre PET White Bottle',
        materialCategory: 'Bottles',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-LBL-HUMISTAR-1L'],
        materialName: 'Humistar 1L Metallic Foil Label',
        materialCategory: 'Labels',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-SLV-1L'],
        materialName: 'PVC Shrink Sleeve 1L Neck & Body',
        materialCategory: 'Shrink Sleeves',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-BOX-1L-10'],
        materialName: 'Cardboard Box (1L x 10 Bottles Outer)',
        materialCategory: 'Cardboard Boxes',
        quantityPerUnitOrBox: 1,
        unit: 'pieces',
      },
    ],
    notes: 'Default standard formulation: 1 box = 10 bottles, 10 labels, 10 shrink sleeves, 1 cardboard box.',
    createdBy: userEmail,
    createdByName: 'Manoj Patel (Owner)',
    approvedBy: userEmail,
    approvedByName: 'Manoj Patel (Owner)',
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Formula B: Panchratna 1L (1 box = 10 bottles)
  const panchFormulaRef = doc(collection(db, 'formulas'));
  batch.set(panchFormulaRef, {
    id: panchFormulaRef.id,
    productId: prodMap['Panchratna'],
    productName: 'Panchratna',
    productCode: 'AGRO-015',
    packSize: '1L',
    version: '1.0',
    status: 'approved',
    referenceBatchSize: 1,
    referenceBatchUnit: 'boxes',
    ingredients: [
      {
        rawMaterialId: rawMap['RM-AMINO-80'],
        materialName: 'Amino Acid 80% Soya Extract',
        materialCode: 'RM-AMINO-80',
        quantity: 1.5,
        unit: 'kg',
      },
      {
        rawMaterialId: rawMap['RM-SEA-LIQ'],
        materialName: 'Ascophyllum Nodosum Seaweed Extract Liquid',
        materialCode: 'RM-SEA-LIQ',
        quantity: 2.0,
        unit: 'l',
      },
      {
        rawMaterialId: rawMap['RM-NITRO-35'],
        materialName: 'Nitrobenzene 35% Emulsion Grade',
        materialCode: 'RM-NITRO-35',
        quantity: 0.5,
        unit: 'l',
      },
      {
        rawMaterialId: rawMap['RM-DM-WATER'],
        materialName: 'Demineralized Water (DM Water)',
        materialCode: 'RM-DM-WATER',
        quantity: 6.5,
        unit: 'l',
      },
    ],
    packagingComponents: [
      {
        packagingMaterialId: pkgMap['PKG-BTL-1L-PET'],
        materialName: '1 Litre PET White Bottle',
        materialCategory: 'Bottles',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-LBL-PANCHRATNA-1L'],
        materialName: 'Panchratna 1L Glossy Label',
        materialCategory: 'Labels',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-SLV-1L'],
        materialName: 'PVC Shrink Sleeve 1L Neck & Body',
        materialCategory: 'Shrink Sleeves',
        quantityPerUnitOrBox: 10,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-BOX-1L-10'],
        materialName: 'Cardboard Box (1L x 10 Bottles Outer)',
        materialCategory: 'Cardboard Boxes',
        quantityPerUnitOrBox: 1,
        unit: 'pieces',
      },
    ],
    notes: 'Panchratna 1 box = 10 bottles, 10 labels, 10 sleeves, 1 box + organic nutrient formula.',
    createdBy: userEmail,
    createdByName: 'Manoj Patel (Owner)',
    approvedBy: userEmail,
    approvedByName: 'Manoj Patel (Owner)',
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // Formula C: Bioshakti G 10kg Bucket
  const bioshakti10FormulaRef = doc(collection(db, 'formulas'));
  batch.set(bioshakti10FormulaRef, {
    id: bioshakti10FormulaRef.id,
    productId: prodMap['Bioshakti G'],
    productName: 'Bioshakti G',
    productCode: 'AGRO-004',
    packSize: '10kg bucket',
    version: '1.0',
    status: 'approved',
    referenceBatchSize: 1, // 1 Bucket (10kg)
    referenceBatchUnit: 'buckets',
    ingredients: [
      {
        rawMaterialId: rawMap['RM-BEN-CLAY'],
        materialName: 'Roasted Bentonite Clay Granules (12-25 Mesh)',
        materialCode: 'RM-BEN-CLAY',
        quantity: 9.0,
        unit: 'kg',
      },
      {
        rawMaterialId: rawMap['RM-HUM-98'],
        materialName: 'Potassium Humate 98% Flakes',
        materialCode: 'RM-HUM-98',
        quantity: 0.8,
        unit: 'kg',
      },
      {
        rawMaterialId: rawMap['RM-COAT-OIL'],
        materialName: 'Polymer Coating Binder Oil',
        materialCode: 'RM-COAT-OIL',
        quantity: 0.2,
        unit: 'l',
      },
    ],
    packagingComponents: [
      {
        packagingMaterialId: pkgMap['PKG-BCK-10KG'],
        materialName: '10kg Heavy Duty Printed Plastic Bucket with Handle',
        materialCategory: 'Buckets',
        quantityPerUnitOrBox: 1,
        unit: 'pieces',
      },
      {
        packagingMaterialId: pkgMap['PKG-LBL-BIOSHAKTI'],
        materialName: 'Bioshakti G Bucket/Bag Front & Back Label',
        materialCategory: 'Labels',
        quantityPerUnitOrBox: 1,
        unit: 'pieces',
      },
    ],
    notes: 'Bioshakti G: 10kg = 1 label + 1 bucket + raw granules & humate coating.',
    createdBy: userEmail,
    createdByName: 'Manoj Patel (Owner)',
    approvedBy: userEmail,
    approvedByName: 'Manoj Patel (Owner)',
    approvedAt: now,
    createdAt: now,
    updatedAt: now,
  });

  // 5. Customer Parties
  const partiesList: Omit<Party, 'id' | 'createdAt' | 'updatedAt'>[] = [
    {
      code: 'PTY-001',
      name: 'Kisan Krishi Seva Kendra',
      contactPerson: 'Suresh Patil',
      phone: '+91 98221 44556',
      city: 'Akola',
      state: 'Maharashtra',
      gstNumber: '27AABCK1234F1Z5',
      balanceDue: 18500,
      status: 'active',
    },
    {
      code: 'PTY-002',
      name: 'Shriram Agro Agency',
      contactPerson: 'Mukesh Sharma',
      phone: '+91 98221 77889',
      city: 'Indore',
      state: 'Madhya Pradesh',
      gstNumber: '23AABCS5678G2Z1',
      balanceDue: 45000,
      status: 'active',
    },
    {
      code: 'PTY-003',
      name: 'Balaji Fertilizers & Seeds',
      contactPerson: 'Govind Shinde',
      phone: '+91 98221 11223',
      city: 'Nashik',
      state: 'Maharashtra',
      gstNumber: '27AABCB9988H1Z8',
      balanceDue: 0,
      status: 'active',
    },
    {
      code: 'PTY-004',
      name: 'Annapurna Krishi Vikas',
      contactPerson: 'Anand Kadam',
      phone: '+91 98221 99001',
      city: 'Kolhapur',
      state: 'Maharashtra',
      gstNumber: '27AABCA3344J1Z2',
      balanceDue: 12000,
      status: 'active',
    },
  ];

  const partyMap: { [name: string]: string } = {};
  partiesList.forEach((pty) => {
    const ref = doc(collection(db, 'parties'));
    partyMap[pty.name] = ref.id;
    batch.set(ref, { id: ref.id, ...pty, createdAt: now, updatedAt: now });
  });

  // 6. Finished Goods
  const fg1Ref = doc(collection(db, 'finishedGoods'));
  batch.set(fg1Ref, {
    id: fg1Ref.id,
    productId: prodMap['Humistar'],
    productName: 'Humistar',
    productCode: 'AGRO-001',
    packSize: '1L',
    batchNumber: 'BATCH-2026-H1',
    mfgDate: todayStr,
    expiryDate: '2028-10-25',
    quantityBoxes: 120,
    quantityUnits: 1200,
    availableBoxes: 120,
    availableUnits: 1200,
    unit: 'boxes',
    warehouseLocation: 'Main FG Warehouse - Bay A',
    qaStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  });

  const fg2Ref = doc(collection(db, 'finishedGoods'));
  batch.set(fg2Ref, {
    id: fg2Ref.id,
    productId: prodMap['Bioshakti G'],
    productName: 'Bioshakti G',
    productCode: 'AGRO-004',
    packSize: '10kg bucket',
    batchNumber: 'BATCH-2026-B1',
    mfgDate: todayStr,
    expiryDate: '2028-10-25',
    quantityBoxes: 80,
    quantityUnits: 80,
    availableBoxes: 80,
    availableUnits: 80,
    unit: 'buckets',
    warehouseLocation: 'Granules Shed Outer',
    qaStatus: 'approved',
    createdAt: now,
    updatedAt: now,
  });

  // 7. Initial Tasks for Workers
  const tasksList: Omit<WorkerTask, 'id' | 'assignedAt'>[] = [
    {
      title: 'Mixing Humistar 1000L Formulation',
      description: 'Charge Reactor 1 with 750L DM Water, add 200kg Potassium Humate flakes, stir at 120 RPM.',
      entryType: 'Mixing',
      assignedToWorkerId: 'w1',
      assignedToWorkerName: 'Ramesh Kumar',
      priority: 'high',
      status: 'in_progress',
      batchNumber: 'BATCH-2026-H2',
      productName: 'Humistar',
      assignedBy: userEmail,
      assignedByName: 'Rajesh Sharma (Manager)',
      dueDate: todayStr,
    },
    {
      title: 'Bottle Filling & Capping for 500ml Ludo',
      description: 'Fill 500ml Mono bottles, tighten cap at 4 Nm torque, check induction heat seal.',
      entryType: 'Filling',
      assignedToWorkerId: 'w3',
      assignedToWorkerName: 'Dinesh Patel',
      priority: 'normal',
      status: 'completed',
      batchNumber: 'BATCH-2026-L1',
      productName: 'Ludo',
      assignedBy: userEmail,
      assignedByName: 'Rajesh Sharma (Manager)',
      completedAt: now,
      workLog: 'Completed 60 boxes (1200 bottles) with 0 leakages.',
    },
    {
      title: 'Granulation Coating & Bagging for Bioshakti G',
      description: 'Run Rotary Coater Drum 2, coat 25kg bags with polymer binder and humate powder.',
      entryType: 'Granulation',
      assignedToWorkerId: 'w2',
      assignedToWorkerName: 'Suresh Yadav',
      priority: 'urgent',
      status: 'pending',
      batchNumber: 'BATCH-2026-BG2',
      productName: 'Bioshakti G',
      assignedBy: userEmail,
      assignedByName: 'Rajesh Sharma (Manager)',
      dueDate: todayStr,
    },
    {
      title: 'Loading 40 Boxes for Kisan Krishi Kendra Dispatch',
      description: 'Verify invoice #INV-8841, load 40 boxes onto Tata 407 truck MH-30-T-9921.',
      entryType: 'Loading',
      assignedToWorkerId: 'w10',
      assignedToWorkerName: 'Ajay Jadhav',
      priority: 'high',
      status: 'pending',
      assignedBy: userEmail,
      assignedByName: 'Rajesh Sharma (Manager)',
      dueDate: todayStr,
    },
  ];

  tasksList.forEach((t) => {
    const ref = doc(collection(db, 'tasks'));
    batch.set(ref, { id: ref.id, ...t, assignedAt: now });
  });

  // 8. Attendance for 10 Preset Workers for Today
  PRESET_WORKERS.forEach((worker, i) => {
    const ref = doc(collection(db, 'attendance'));
    const isPresent = i !== 6; // one on leave
    batch.set(ref, {
      id: ref.id,
      workerId: worker.id,
      workerName: worker.name,
      workerRole: worker.role,
      date: todayStr,
      status: isPresent ? 'present' : 'leave',
      checkInTime: isPresent ? '08:30 AM' : undefined,
      workLog: isPresent ? `Working on ${worker.role}` : 'Medical leave approved',
      overtimeHours: i === 0 ? 1.5 : 0,
      recordedBy: userEmail,
      recordedByName: 'Rajesh Sharma (Manager)',
      createdAt: now,
      updatedAt: now,
    });
  });

  // 9. Initial Sales Order
  const salesRef = doc(collection(db, 'salesOrders'));
  batch.set(salesRef, {
    id: salesRef.id,
    invoiceNumber: 'INV-40912',
    partyId: partyMap['Kisan Krishi Seva Kendra'] || 'p1',
    partyName: 'Kisan Krishi Seva Kendra',
    productId: prodMap['Humistar'],
    productName: 'Humistar',
    productCode: 'AGRO-001',
    packSize: '1L',
    batchNumber: 'BATCH-2026-H1',
    quantityBoxes: 25,
    quantityUnits: 250,
    unitPrice: 2400,
    totalAmount: 60000,
    date: todayStr,
    dispatchedBy: userEmail,
    dispatchedByName: 'Rajesh Sharma (Manager)',
    status: 'dispatched',
    notes: 'Shipped via Express Agro Logistics',
    createdAt: now,
  });

  // Commit batch write
  await batch.commit();

  await logAuditEvent('Factory', 'all', 'SEED_DATA', 'Loaded complete Agro-Fertilizer demo dataset (18 products, bottles, formulas, tasks, attendance)', userEmail);
}

// ==========================================
// COMPATIBILITY HELPERS FOR SECONDARY VIEWS
// ==========================================
export async function createProductionBatch(batchData: any, userEmail: string = 'admin', userName: string = 'Admin') {
  const docRef = doc(collection(db, 'productionBatches'));
  const newBatch = {
    id: docRef.id,
    ...batchData,
    createdAt: new Date().toISOString(),
  };
  await setDoc(docRef, newBatch);
  return docRef.id;
}

export async function approveBatch(id: string, userEmail: string, userName: string) {
  await updateDoc(doc(db, 'productionBatches', id), {
    status: 'in_production',
    approvedBy: userEmail,
    approvedByName: userName,
    approvedAt: new Date().toISOString(),
  });
}

export async function issueAndStartBatch(id: string, userEmail: string, userName: string) {
  await updateDoc(doc(db, 'productionBatches', id), {
    status: 'in_production',
    actualStartDate: new Date().toISOString(),
  });
}

export async function submitBatchQA(id: string, qaStatus: string, notes: string, userEmail: string, userName: string) {
  await updateDoc(doc(db, 'productionBatches', id), {
    status: qaStatus === 'approved' ? 'completed' : 'qa_pending',
    qaNotes: notes,
  });
}

export async function completeProductionBatch(id: string, goodPacks: number, rejectedPacks: number, userEmail: string, userName: string) {
  await updateDoc(doc(db, 'productionBatches', id), {
    status: 'completed',
    goodOutputPacks: goodPacks,
    rejectedOutputPacks: rejectedPacks,
    completedAt: new Date().toISOString(),
  });
}

export function subscribePackagingFormulas(onData: (data: any[]) => void) {
  return onSnapshot(collection(db, 'packagingFormulas'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    onData(list);
  }, () => onData([]));
}

export function subscribeConversionRules(onData: (data: any[]) => void) {
  return onSnapshot(collection(db, 'conversionRules'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    onData(list);
  }, () => onData([]));
}

export async function saveConversionRule(rule: any, id?: string) {
  if (id) {
    await updateDoc(doc(db, 'conversionRules', id), rule);
  } else {
    const ref = doc(collection(db, 'conversionRules'));
    await setDoc(ref, { id: ref.id, ...rule, createdAt: new Date().toISOString() });
  }
}

export async function deleteConversionRule(id: string) {
  await deleteDoc(doc(db, 'conversionRules', id));
}

export function subscribeSuppliers(onData: (data: any[]) => void) {
  return onSnapshot(collection(db, 'suppliers'), (snap) => {
    const list: any[] = [];
    snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
    onData(list);
  }, () => onData([]));
}

export async function saveSupplier(supplier: any, id?: string) {
  if (id) {
    await updateDoc(doc(db, 'suppliers', id), supplier);
  } else {
    const ref = doc(collection(db, 'suppliers'));
    await setDoc(ref, { id: ref.id, ...supplier, createdAt: new Date().toISOString() });
  }
}

