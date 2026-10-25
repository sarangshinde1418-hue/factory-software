import React, { useState } from 'react';
import {
  Database,
  CloudUpload,
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Copy,
  ExternalLink,
  RefreshCw,
  FileText,
  Layers,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
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
} from '../../types/erp';
import { exportToCSV } from '../../utils/export';
import {
  backupToGoogleSheet,
  saveSettings,
  saveRawMaterial,
  savePackagingMaterial,
  saveProduct,
  saveParty,
} from '../../services/db';
import { useAuth } from '../../context/AuthContext';

interface DataBackupViewProps {
  rawMaterials: RawMaterial[];
  packagingMaterials: PackagingMaterial[];
  products: Product[];
  formulas: Formula[];
  finishedGoods: FinishedGood[];
  salesOrders: SalesOrder[];
  productionLogs: ProductionLog[];
  tasks: WorkerTask[];
  attendance: WorkerAttendance[];
  parties: Party[];
  settings: FactorySettings;
  currency?: string;
}

export const DataBackupView: React.FC<DataBackupViewProps> = ({
  rawMaterials,
  packagingMaterials,
  products,
  formulas,
  finishedGoods,
  salesOrders,
  productionLogs,
  tasks,
  attendance,
  parties,
  settings,
  currency = '₹',
}) => {
  const { userProfile, isOwner } = useAuth();
  const [activeTab, setActiveTab] = useState<'google_sheet' | 'import_csv' | 'export_data'>('google_sheet');

  // Google Sheet state
  const [gasUrl, setGasUrl] = useState(settings.googleAppsScriptUrl || '');
  const [autoBackup, setAutoBackup] = useState(settings.autoBackupOnWrite || false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  // Import state
  const [importTarget, setImportTarget] = useState<'raw' | 'packaging' | 'products' | 'parties'>('raw');
  const [csvText, setCsvText] = useState('');
  const [parsedHeaders, setParsedHeaders] = useState<string[]>([]);
  const [parsedRows, setParsedRows] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [erpField: string]: string }>({});
  const [importing, setImporting] = useState(false);
  const [importSuccessCount, setImportSuccessCount] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Save Google Sheet URL
  const handleSaveGoogleSheetUrl = async () => {
    try {
      setSavingSettings(true);
      await saveSettings(
        {
          googleAppsScriptUrl: gasUrl.trim(),
          autoBackupOnWrite: autoBackup,
        },
        userProfile?.email || 'admin'
      );
      setBackupMessage({ type: 'success', text: 'Google Sheet backup settings saved successfully!' });
      setTimeout(() => setBackupMessage(null), 4000);
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'Failed to save settings.' });
    } finally {
      setSavingSettings(false);
    }
  };

  // Run Manual Backup
  const handleRunBackup = async () => {
    if (!gasUrl || !gasUrl.startsWith('http')) {
      setBackupMessage({ type: 'error', text: 'Please enter a valid Google Apps Script Web App URL first.' });
      return;
    }

    try {
      setBackingUp(true);
      setBackupMessage(null);
      await backupToGoogleSheet(gasUrl.trim(), userProfile?.email || 'admin');
      setBackupMessage({
        type: 'success',
        text: `Backup successfully sent to Google Sheet! (${new Date().toLocaleTimeString()})`,
      });
    } catch (err: any) {
      setBackupMessage({ type: 'error', text: err.message || 'Backup failed.' });
    } finally {
      setBackingUp(false);
    }
  };

  // Google Apps Script source code
  const googleAppsScriptCode = `/**
 * Factory Inventory & Production Manager - Google Sheet Cloud Backup
 * 
 * Instructions:
 * 1. Open Google Sheets -> Extensions -> Apps Script
 * 2. Replace all code with this script
 * 3. Click 'Deploy' -> 'New deployment'
 * 4. Select type: 'Web app'
 * 5. Set 'Execute as': Me
 * 6. Set 'Who has access': Anyone
 * 7. Click Deploy, copy the Web App URL, and paste it into your Factory ERP Settings.
 */

function doPost(e) {
  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // 1. Raw Materials Sheet
    if (data.rawMaterials && data.rawMaterials.length > 0) {
      writeSheet(ss, "Raw Materials", [
        "Code", "Name", "Category", "Unit", "Current Stock", "Min Stock", 
        "Unit Cost", "Location", "Batch 200 Qty", "Batch 500 Qty", "Status"
      ], data.rawMaterials.map(function(m) {
        return [m.code, m.name, m.category, m.unit, m.currentStock, m.minimumStock, 
                m.unitCost, m.location || "", m.batch200Qty || 0, m.batch500Qty || 0, m.status];
      }));
    }
    
    // 2. Packing Materials Sheet
    if (data.packagingMaterials && data.packagingMaterials.length > 0) {
      writeSheet(ss, "Packing Materials", [
        "Code", "Name", "Category", "Bottle Type", "Unit", "Current Stock", "Min Stock", "Unit Cost"
      ], data.packagingMaterials.map(function(p) {
        return [p.code, p.name, p.category, p.bottleType || "-", p.unit, p.currentStock, p.minimumStock, p.unitCost];
      }));
    }
    
    // 3. Products Sheet
    if (data.products && data.products.length > 0) {
      writeSheet(ss, "Products", [
        "Code", "Name", "Category", "Type", "Pack Sizes", "Status"
      ], data.products.map(function(pr) {
        return [pr.code, pr.name, pr.category, pr.productType, (pr.packSizes || []).join(", "), pr.status];
      }));
    }
    
    // 4. Finished Goods Sheet
    if (data.finishedGoods && data.finishedGoods.length > 0) {
      writeSheet(ss, "Finished Goods", [
        "Product Name", "Code", "Pack Size", "Batch #", "Available Boxes", "Available Units", "Location", "QA Status"
      ], data.finishedGoods.map(function(f) {
        return [f.productName, f.productCode, f.packSize, f.batchNumber, f.availableBoxes || 0, f.availableUnits || 0, f.warehouseLocation, f.qaStatus];
      }));
    }
    
    // 5. Sales Orders Sheet
    if (data.salesOrders && data.salesOrders.length > 0) {
      writeSheet(ss, "Sales Dispatches", [
        "Date", "Invoice #", "Party Name", "Product", "Pack Size", "Batch #", "Boxes", "Total ₹", "Status"
      ], data.salesOrders.map(function(s) {
        return [s.date, s.invoiceNumber, s.partyName, s.productName, s.packSize, s.batchNumber, s.quantityBoxes, s.totalAmount, s.status];
      }));
    }

    // 6. Production Logs Sheet
    if (data.productionLogs && data.productionLogs.length > 0) {
      writeSheet(ss, "Production Logs", [
        "Date", "Batch #", "Product", "Pack Size", "Boxes Produced", "Total Units", "Operator", "Notes"
      ], data.productionLogs.map(function(l) {
        return [l.batchDate, l.batchNumber, l.productName, l.packSize, l.numberOfBoxes, l.totalUnits, l.operatorName || "-", l.notes || ""];
      }));
    }

    // Update Last Synced Note
    var metaSheet = ss.getSheetByName("Backup Info");
    if (!metaSheet) {
      metaSheet = ss.insertSheet("Backup Info");
    }
    metaSheet.getRange(1, 1).setValue("Last ERP Backup Timestamp:");
    metaSheet.getRange(1, 2).setValue(new Date().toString());
    metaSheet.getRange(2, 1).setValue("Backed up by:");
    metaSheet.getRange(2, 2).setValue(data.exportedBy || "Admin");

    return ContentService.createTextOutput(JSON.stringify({ status: "SUCCESS", message: "Backup updated" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "ERROR", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeSheet(ss, sheetName, headers, rows) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  } else {
    sheet.clear();
  }
  
  sheet.appendRow(headers);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight("bold");
  headerRange.setBackground("#e2e8f0");
  
  if (rows && rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}`;

  const copyScriptToClipboard = () => {
    navigator.clipboard.writeText(googleAppsScriptCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  // CSV Parsing
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      parseCSVContent(text);
    };
    reader.readAsText(file);
  };

  const parseCSVContent = (content: string) => {
    setCsvText(content);
    setImportSuccessCount(null);
    setImportError(null);

    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length < 2) {
      setImportError('CSV file must have at least 1 header row and 1 data row.');
      return;
    }

    const headers = lines[0].split(',').map((h) => h.replace(/['"]+/g, '').trim());
    const rows = lines.slice(1).map((l) => l.split(',').map((c) => c.replace(/['"]+/g, '').trim()));

    setParsedHeaders(headers);
    setParsedRows(rows);

    // Auto guess column mapping
    const initialMap: { [key: string]: string } = {};
    headers.forEach((hdr) => {
      const lower = hdr.toLowerCase();
      if (lower.includes('name') || lower.includes('item') || lower.includes('material')) {
        initialMap['name'] = hdr;
      } else if (lower.includes('code') || lower.includes('sku') || lower.includes('id')) {
        initialMap['code'] = hdr;
      } else if (lower.includes('cat') || lower.includes('group')) {
        initialMap['category'] = hdr;
      } else if (lower.includes('stock') || lower.includes('qty') || lower.includes('quantity')) {
        initialMap['currentStock'] = hdr;
      } else if (lower.includes('unit') || lower.includes('uom')) {
        initialMap['unit'] = hdr;
      } else if (lower.includes('cost') || lower.includes('rate') || lower.includes('price')) {
        initialMap['unitCost'] = hdr;
      } else if (lower.includes('min') || lower.includes('reorder')) {
        initialMap['minimumStock'] = hdr;
      } else if (lower.includes('location') || lower.includes('rack') || lower.includes('bin')) {
        initialMap['location'] = hdr;
      } else if (lower.includes('200') || lower.includes('batch200')) {
        initialMap['batch200Qty'] = hdr;
      } else if (lower.includes('500') || lower.includes('batch500')) {
        initialMap['batch500Qty'] = hdr;
      }
    });
    setColumnMapping(initialMap);
  };

  // Perform Import
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) {
      setImportError('No rows to import.');
      return;
    }

    try {
      setImporting(true);
      setImportError(null);
      let count = 0;

      for (const row of parsedRows) {
        const getVal = (erpField: string) => {
          const colName = columnMapping[erpField];
          if (!colName) return '';
          const idx = parsedHeaders.indexOf(colName);
          return idx >= 0 ? row[idx] || '' : '';
        };

        const itemName = getVal('name');
        if (!itemName) continue;

        if (importTarget === 'raw') {
          await saveRawMaterial(
            {
              name: itemName,
              code: getVal('code') || `RM-${Math.floor(100 + Math.random() * 900)}`,
              category: getVal('category') || 'Chemicals',
              physicalForm: 'powder',
              unit: getVal('unit') || 'kg',
              currentStock: Number(getVal('currentStock')) || 0,
              openingStock: Number(getVal('currentStock')) || 0,
              minimumStock: Number(getVal('minimumStock')) || 100,
              unitCost: Number(getVal('unitCost')) || 0,
              location: getVal('location') || 'Warehouse Yard',
              batch200Qty: Number(getVal('batch200Qty')) || 0,
              batch500Qty: Number(getVal('batch500Qty')) || 0,
              status: 'active',
            },
            undefined,
            userProfile?.email || 'admin'
          );
        } else if (importTarget === 'packaging') {
          await savePackagingMaterial(
            {
              name: itemName,
              code: getVal('code') || `PKG-${Math.floor(100 + Math.random() * 900)}`,
              category: 'Bottles',
              type: 'bottle',
              unit: getVal('unit') || 'pieces',
              currentStock: Number(getVal('currentStock')) || 0,
              openingStock: Number(getVal('currentStock')) || 0,
              minimumStock: Number(getVal('minimumStock')) || 500,
              unitCost: Number(getVal('unitCost')) || 0,
              status: 'active',
            },
            undefined,
            userProfile?.email || 'admin'
          );
        } else if (importTarget === 'parties') {
          await saveParty(
            {
              name: itemName,
              code: getVal('code') || `PTY-${Math.floor(100 + Math.random() * 900)}`,
              contactPerson: getVal('contactPerson') || 'Manager',
              phone: getVal('phone') || '+91 98000 00000',
              city: getVal('city') || 'Maharashtra',
              state: 'Maharashtra',
              balanceDue: Number(getVal('balanceDue')) || 0,
              status: 'active',
            },
            undefined,
            userProfile?.email || 'admin'
          );
        }
        count++;
      }

      setImportSuccessCount(count);
      setParsedRows([]);
      setParsedHeaders([]);
      setCsvText('');
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  // Full Database JSON Backup Export
  const handleExportFullJSON = () => {
    const backupSnapshot = {
      exportTimestamp: new Date().toISOString(),
      factoryName: settings.companyName,
      exportedBy: userProfile?.displayName || 'Owner',
      version: '2.0',
      data: {
        rawMaterials,
        packagingMaterials,
        products,
        formulas,
        finishedGoods,
        salesOrders,
        productionLogs,
        tasks,
        attendance,
        parties,
      },
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupSnapshot, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `Factory_ERP_Full_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Data & Cloud Backup</h1>
              <p className="text-xs text-slate-500">
                Google Sheet auto-backup, old software CSV migration, and complete database export.
              </p>
            </div>
          </div>
        </div>

        {/* Global JSON Export */}
        <button
          onClick={handleExportFullJSON}
          className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs transition-colors"
        >
          <Download className="w-4 h-4 text-emerald-400" />
          <span>Export Full Factory Backup (.JSON)</span>
        </button>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-4 pt-3 gap-2">
        <button
          onClick={() => setActiveTab('google_sheet')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'google_sheet'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <CloudUpload className="w-4 h-4" />
          <span>Google Sheet Cloud Backup</span>
        </button>

        <button
          onClick={() => setActiveTab('import_csv')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'import_csv'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>Import Old Software Data (CSV)</span>
        </button>

        <button
          onClick={() => setActiveTab('export_data')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'export_data'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export CSV Reports</span>
        </button>
      </div>

      {/* TAB 1: GOOGLE SHEET CLOUD BACKUP */}
      {activeTab === 'google_sheet' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left 2 Cols: Setup & Trigger */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-5">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Google Sheet Webhook Connection</h2>
                  <p className="text-xs text-slate-500">
                    Connects directly to your Google Spreadsheet via Google Apps Script web-app.
                  </p>
                </div>
                <span className={`px-2 py-1 rounded text-[11px] font-bold border ${
                  gasUrl ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  {gasUrl ? 'Connected' : 'Not Configured'}
                </span>
              </div>

              {backupMessage && (
                <div
                  className={`p-3.5 rounded-lg text-xs font-medium flex items-center gap-2 border ${
                    backupMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {backupMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{backupMessage.text}</span>
                </div>
              )}

              {/* Form Input */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Google Apps Script Web App URL
                  </label>
                  <input
                    type="url"
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    value={gasUrl}
                    onChange={(e) => setGasUrl(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Target spreadsheet receives separate sheets for Raw Materials, Packing, Products, Finished Goods, and Dispatches.
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="relative flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoBackup}
                      onChange={(e) => setAutoBackup(e.target.checked)}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="ml-2 text-xs font-semibold text-slate-700">
                      Enable daily auto-backup reminder on dashboard
                    </span>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    onClick={handleSaveGoogleSheetUrl}
                    disabled={savingSettings}
                    className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-300"
                  >
                    {savingSettings ? 'Saving...' : 'Save Settings'}
                  </button>

                  <button
                    onClick={handleRunBackup}
                    disabled={backingUp || !gasUrl}
                    className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${backingUp ? 'animate-spin' : ''}`} />
                    <span>{backingUp ? 'Syncing to Google Sheet...' : 'Backup to Google Sheet Now'}</span>
                  </button>
                </div>
              </div>

              {settings.lastBackupAt && (
                <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                  Last successful cloud backup: <strong>{new Date(settings.lastBackupAt).toLocaleString()}</strong>
                </div>
              )}
            </div>

            {/* 3-Step Setup Guide */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Easy 3-Step Setup Guide
              </h3>

              <div className="space-y-3 text-xs text-slate-600">
                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    1
                  </span>
                  <div>
                    <strong className="text-slate-900">Create a Google Spreadsheet:</strong> Open{' '}
                    <a href="https://sheets.new" target="_blank" rel="noreferrer" className="text-emerald-700 font-bold underline inline-flex items-center gap-0.5">
                      sheets.new <ExternalLink className="w-3 h-3" />
                    </a>{' '}
                    and title it <em>"Factory ERP Live Cloud Backup"</em>.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    2
                  </span>
                  <div>
                    <strong className="text-slate-900">Open Apps Script:</strong> Click <strong>Extensions</strong> →{' '}
                    <strong>Apps Script</strong>. Copy the code from the right panel and paste it into the editor.
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                    3
                  </span>
                  <div>
                    <strong className="text-slate-900">Deploy as Web App:</strong> Click <strong>Deploy</strong> →{' '}
                    <strong>New deployment</strong>. Choose <strong>Web app</strong>, set <em>"Who has access"</em> to{' '}
                    <strong>"Anyone"</strong>, click Deploy, and paste the generated URL above!
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Copyable Apps Script Code */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3 flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-900">Apps Script Code</h3>
                <span className="text-[10px] text-slate-400">Copy & paste into Google Sheet</span>
              </div>
              <button
                onClick={copyScriptToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 transition-colors"
              >
                {copiedCode ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>

            <pre className="flex-1 bg-slate-900 text-emerald-400 p-3 rounded-lg text-[10px] font-mono overflow-auto max-h-[460px] border border-slate-800 leading-relaxed">
              {googleAppsScriptCode}
            </pre>
          </div>
        </div>
      )}

      {/* TAB 2: IMPORT OLD SOFTWARE DATA (CSV) */}
      {activeTab === 'import_csv' && (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Migrate Old Software Data</h2>
              <p className="text-xs text-slate-500">
                Upload your existing CSV from Excel or Tally, map columns, and load items into ERP without code changes.
              </p>
            </div>

            {/* Target module selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Import Target:</span>
              <select
                value={importTarget}
                onChange={(e) => {
                  setImportTarget(e.target.value as any);
                  setParsedRows([]);
                  setParsedHeaders([]);
                }}
                className="px-3 py-1.5 text-xs font-bold bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="raw">Raw Materials</option>
                <option value="packaging">Packing Materials</option>
                <option value="parties">Customer Parties</option>
              </select>
            </div>
          </div>

          {importSuccessCount !== null && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-3 text-emerald-900 text-xs font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              <span>Successfully imported {importSuccessCount} records into the database!</span>
            </div>
          )}

          {importError && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-3 text-rose-900 text-xs font-bold">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
              <span>{importError}</span>
            </div>
          )}

          {/* Upload Input & Template Downloads */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-6 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl text-center space-y-3 bg-slate-50 transition-colors">
              <Upload className="w-8 h-8 text-slate-400 mx-auto" />
              <div>
                <span className="text-xs font-bold text-slate-800 block">Choose CSV File to Upload</span>
                <span className="text-[11px] text-slate-400">Supports .csv exported from Excel or legacy ERP</span>
              </div>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"
              />
            </div>

            {/* Paste CSV Direct */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Or Paste CSV Raw Text Below:
              </label>
              <textarea
                rows={5}
                placeholder="Item Name,Code,Category,Stock,Unit,Unit Cost&#10;Zinc Sulphate 33%,RM-ZN-33,Chemicals,2000,kg,85&#10;Bentonite Clay,RM-BEN-01,Bentonite,15000,kg,12"
                value={csvText}
                onChange={(e) => parseCSVContent(e.target.value)}
                className="w-full p-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Column Mapping Table */}
          {parsedHeaders.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Map CSV Columns to ERP Fields</h3>
                  <p className="text-[11px] text-slate-500">
                    Verify that your CSV column names match the ERP fields correctly.
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                  {parsedRows.length} rows detected
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                {['name', 'code', 'category', 'currentStock', 'unit', 'unitCost', 'minimumStock', 'location', 'batch200Qty', 'batch500Qty'].map((field) => (
                  <div key={field} className="space-y-1">
                    <span className="text-[11px] font-bold text-slate-700 capitalize">
                      {field.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) =>
                        setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))
                      }
                      className="w-full px-2.5 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-md outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="">-- Ignore --</option>
                      {parsedHeaders.map((hdr) => (
                        <option key={hdr} value={hdr}>
                          {hdr}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Data Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Preview First 5 Mapped Rows:</span>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Item Name</th>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2 px-3 text-right">Stock</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3 text-right">Rate (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {parsedRows.slice(0, 5).map((row, idx) => {
                        const getVal = (f: string) => {
                          const col = columnMapping[f];
                          if (!col) return '-';
                          const i = parsedHeaders.indexOf(col);
                          return i >= 0 ? row[i] || '-' : '-';
                        };
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-semibold text-slate-900">{getVal('name')}</td>
                            <td className="py-2 px-3 font-mono text-slate-600">{getVal('code')}</td>
                            <td className="py-2 px-3 text-slate-600">{getVal('category')}</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{getVal('currentStock')}</td>
                            <td className="py-2 px-3 text-slate-600">{getVal('unit')}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-600">{getVal('unitCost')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Submit Import */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleExecuteImport}
                  disabled={importing}
                  className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-xs transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>{importing ? 'Importing Data into ERP...' : `Import ${parsedRows.length} Items into Database`}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EXPORT CSV REPORTS */}
      {activeTab === 'export_data' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* Card 1: Raw Materials */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Raw Materials Inventory</span>
              <span className="text-xs font-mono font-bold text-slate-500">{rawMaterials.length} Items</span>
            </div>
            <p className="text-xs text-slate-500">
              Complete list with stock, unit cost, batch columns (200/500), and storage locations.
            </p>
            <button
              onClick={() => {
                const headers = ['Code', 'Name', 'Category', 'Unit', 'Stock', 'Min Stock', 'Rate (₹)', 'Location', 'Batch 200', 'Batch 500'];
                const rows = rawMaterials.map((r) => [r.code, r.name, r.category, r.unit, r.currentStock, r.minimumStock, r.unitCost, r.location || '', r.batch200Qty || 0, r.batch500Qty || 0]);
                exportToCSV('Raw_Materials_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Raw Materials CSV</span>
            </button>
          </div>

          {/* Card 2: Packaging */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Packaging Materials</span>
              <span className="text-xs font-mono font-bold text-slate-500">{packagingMaterials.length} Items</span>
            </div>
            <p className="text-xs text-slate-500">
              Bottles (Imida, Mono, Ludo, Gold, Amrut), labels, sleeves, cardboard boxes, and buckets.
            </p>
            <button
              onClick={() => {
                const headers = ['Code', 'Name', 'Category', 'Bottle Type', 'Unit', 'Stock', 'Min Stock', 'Unit Cost'];
                const rows = packagingMaterials.map((p) => [p.code, p.name, p.category, p.bottleType || '-', p.unit, p.currentStock, p.minimumStock, p.unitCost]);
                exportToCSV('Packaging_Materials_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Packaging CSV</span>
            </button>
          </div>

          {/* Card 3: Products */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Products Catalog</span>
              <span className="text-xs font-mono font-bold text-slate-500">{products.length} Products</span>
            </div>
            <p className="text-xs text-slate-500">
              18 agro-fertilizer formulations with pack sizes and cardboard box packaging rules.
            </p>
            <button
              onClick={() => {
                const headers = ['Code', 'Product Name', 'Category', 'Type', 'Pack Sizes', 'Status'];
                const rows = products.map((pr) => [pr.code, pr.name, pr.category, pr.productType, pr.packSizes.join('; '), pr.status]);
                exportToCSV('Agro_Products_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Products CSV</span>
            </button>
          </div>

          {/* Card 4: Finished Goods */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Finished Goods Stock</span>
              <span className="text-xs font-mono font-bold text-slate-500">{finishedGoods.length} Batches</span>
            </div>
            <p className="text-xs text-slate-500">
              Ready boxes & units available in warehouse bays with mfg and expiry dates.
            </p>
            <button
              onClick={() => {
                const headers = ['Product', 'Code', 'Pack Size', 'Batch #', 'Available Boxes', 'Available Units', 'Mfg Date', 'Expiry Date', 'Location'];
                const rows = finishedGoods.map((f) => [f.productName, f.productCode, f.packSize, f.batchNumber, f.availableBoxes, f.availableUnits, f.mfgDate, f.expiryDate, f.warehouseLocation]);
                exportToCSV('Finished_Goods_Warehouse_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Finished Goods CSV</span>
            </button>
          </div>

          {/* Card 5: Outgoing Sales */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Sales Orders & Dispatches</span>
              <span className="text-xs font-mono font-bold text-slate-500">{salesOrders.length} Orders</span>
            </div>
            <p className="text-xs text-slate-500">
              Customer parties, invoice numbers, batch numbers, boxes dispatched, and invoice amount.
            </p>
            <button
              onClick={() => {
                const headers = ['Date', 'Invoice #', 'Party Name', 'Product', 'Pack Size', 'Batch #', 'Quantity Boxes', 'Rate (₹)', 'Total Amount (₹)', 'Dispatched By'];
                const rows = salesOrders.map((s) => [s.date, s.invoiceNumber, s.partyName, s.productName, s.packSize, s.batchNumber, s.quantityBoxes, s.unitPrice, s.totalAmount, s.dispatchedByName]);
                exportToCSV('Sales_Orders_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Sales Orders CSV</span>
            </button>
          </div>

          {/* Card 6: Production Batches */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-slate-900">Production Batch History</span>
              <span className="text-xs font-mono font-bold text-slate-500">{productionLogs.length} Batches</span>
            </div>
            <p className="text-xs text-slate-500">
              Historical batches produced, boxes made, formula versions, and auto-deducted inventory records.
            </p>
            <button
              onClick={() => {
                const headers = ['Date', 'Batch #', 'Product', 'Pack Size', 'Boxes Produced', 'Total Units', 'Formula Version', 'Operator'];
                const rows = productionLogs.map((l) => [l.batchDate, l.batchNumber, l.productName, l.packSize, l.numberOfBoxes, l.totalUnits, l.formulaVersion, l.operatorName || '-']);
                exportToCSV('Production_Batches_Export', headers, rows);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Production Logs CSV</span>
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
