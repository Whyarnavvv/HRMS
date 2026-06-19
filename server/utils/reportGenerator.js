/**
 * reportGenerator.js
 * Shared utility that produces Asset / Credential reports in three formats:
 *   - Excel  (.xlsx)  via ExcelJS
 *   - CSV    (.csv)   via plain string
 *   - PDF    (.pdf)   via PDFKit
 *
 * Every generator function receives a plain-object data payload and returns
 * a Buffer so the controller can pipe it directly to the response.
 */

const ExcelJS  = require('exceljs');
const PDFDoc   = require('pdfkit');

// ─── Shared theme ─────────────────────────────────────────────────────────────
const BRAND = {
  blue:       '2563EB',
  slate:      '1E293B',
  lightSlate: '64748B',
  emerald:    '059669',
  amber:      'D97706',
  red:        'DC2626',
  white:      'FFFFFF',
  headerBg:   '0F172A',
  rowAlt:     'F8FAFC',
};

// ─── Excel helpers ────────────────────────────────────────────────────────────

const excelHeader = (ws, columns) => {
  ws.columns = columns.map(c => ({ header: c.header, key: c.key, width: c.width || 18 }));
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell(cell => {
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND.headerBg } };
    cell.font   = { name: 'Calibri', bold: true, color: { argb: 'FF' + BRAND.white }, size: 11 };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border = {
      bottom: { style: 'medium', color: { argb: 'FF' + BRAND.blue } }
    };
  });
};

const excelRow = (ws, idx, values, isAlt) => {
  const row = ws.addRow(values);
  row.height = 20;
  if (isAlt) {
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + BRAND.rowAlt.replace('#', '') } };
    });
  }
  row.eachCell(cell => {
    cell.font      = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    cell.alignment = { vertical: 'middle', wrapText: false };
  });
  return row;
};

const excelMeta = async (wb, title, filters) => {
  wb.creator   = 'Study Palace Hub HRMS';
  wb.created   = new Date();
  wb.modified  = new Date();
  wb.title     = title;
  wb.subject   = 'HRMS Report';
  wb.keywords  = 'HRMS report assets credentials';
  wb.description = `Generated on ${new Date().toLocaleString('en-IN')}. Filters: ${JSON.stringify(filters)}`;
};

// ─── CSV helper ───────────────────────────────────────────────────────────────

const csvEscape = (v) => {
  if (v == null) return '';
  const s = String(v).replace(/"/g, '""');
  return /[,"\n\r]/.test(s) ? `"${s}"` : s;
};

const buildCsv = (columns, rows) => {
  const header = columns.map(c => csvEscape(c.header)).join(',');
  const body   = rows.map(r =>
    columns.map(c => csvEscape(r[c.key])).join(',')
  ).join('\n');
  return Buffer.from(header + '\n' + body, 'utf-8');
};

// ─── PDF helpers ──────────────────────────────────────────────────────────────

const buildPdf = (title, subtitle, columns, rows) =>
  new Promise(resolve => {
    const doc  = new PDFDoc({ margin: 36, size: 'A4', layout: 'landscape' });
    const bufs = [];
    doc.on('data', b => bufs.push(b));
    doc.on('end',  () => resolve(Buffer.concat(bufs)));

    const PAGE_W = doc.page.width  - 72;  // usable width
    const PAGE_H = doc.page.height - 72;
    let y = 36;

    // ── Brand header ──
    doc.rect(36, y, PAGE_W, 44).fill('#0F172A');
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#FFFFFF')
       .text('Study Palace Hub HRMS', 50, y + 8, { continued: true });
    doc.fontSize(9).font('Helvetica').fillColor('#94A3B8')
       .text(`  ·  ${title}`, { continued: false });
    doc.fontSize(8).fillColor('#64748B')
       .text(subtitle, 50, y + 30, { width: PAGE_W - 20 });
    y += 54;

    // ── Generated stamp ──
    doc.fontSize(7.5).fillColor('#94A3B8')
       .text(`Generated: ${new Date().toLocaleString('en-IN')}   ·   Records: ${rows.length}`,
             36, y, { width: PAGE_W, align: 'right' });
    y += 14;

    // ── Column layout ──
    const totalWeight = columns.reduce((s, c) => s + (c.pdfWidth || 1), 0);
    const colWidths   = columns.map(c => Math.floor(PAGE_W * ((c.pdfWidth || 1) / totalWeight)));

    // Clamp last column to fill exactly
    const sumUsed = colWidths.slice(0, -1).reduce((a, b) => a + b, 0);
    colWidths[colWidths.length - 1] = PAGE_W - sumUsed;

    const ROW_H   = 18;
    const HEADER_H = 22;

    const drawTableHeader = (startY) => {
      // Background
      doc.rect(36, startY, PAGE_W, HEADER_H).fill('#2563EB');
      let x = 36;
      columns.forEach((col, i) => {
        doc.fontSize(8).font('Helvetica-Bold').fillColor('#FFFFFF')
           .text(col.header, x + 4, startY + 6, { width: colWidths[i] - 8, ellipsis: true });
        x += colWidths[i];
      });
      return startY + HEADER_H;
    };

    const drawRow = (row, startY, isAlt) => {
      if (isAlt) doc.rect(36, startY, PAGE_W, ROW_H).fill('#F8FAFC');
      doc.rect(36, startY, PAGE_W, ROW_H).stroke('#E2E8F0');
      let x = 36;
      columns.forEach((col, i) => {
        const val = row[col.key] != null ? String(row[col.key]) : '';
        doc.fontSize(7.5).font('Helvetica').fillColor('#334155')
           .text(val, x + 4, startY + 5, { width: colWidths[i] - 8, ellipsis: true, lineBreak: false });
        x += colWidths[i];
      });
      return startY + ROW_H;
    };

    y = drawTableHeader(y);

    rows.forEach((row, idx) => {
      // New page if needed
      if (y + ROW_H > doc.page.height - 36) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 36 });
        y = 36;
        y = drawTableHeader(y);
      }
      y = drawRow(row, y, idx % 2 === 1);
    });

    // Footer on last page
    doc.fontSize(7).fillColor('#94A3B8')
       .text('This is a system-generated report. Study Palace Hub HRMS — Confidential.',
             36, doc.page.height - 36, { width: PAGE_W, align: 'center' });

    doc.end();
  });

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 1 — Asset Inventory Report
// ═══════════════════════════════════════════════════════════════════════════════

const ASSET_INVENTORY_COLS = [
  { key: 'assetNumber',    header: 'Asset No.',      width: 14, pdfWidth: 1.2 },
  { key: 'assetName',      header: 'Asset Name',     width: 22, pdfWidth: 2   },
  { key: 'category',       header: 'Category',       width: 14, pdfWidth: 1.2 },
  { key: 'brand',          header: 'Brand',          width: 14, pdfWidth: 1   },
  { key: 'modelName',      header: 'Model',          width: 16, pdfWidth: 1.2 },
  { key: 'imeiNumber',     header: 'IMEI Number',    width: 18, pdfWidth: 1.4 },
  { key: 'totalQty',       header: 'Total Qty',      width: 10, pdfWidth: 0.8 },
  { key: 'assignedQty',    header: 'Assigned',       width: 10, pdfWidth: 0.8 },
  { key: 'availableQty',   header: 'Available',      width: 10, pdfWidth: 0.8 },
  { key: 'status',         header: 'Status',         width: 14, pdfWidth: 1   },
  { key: 'purchasePrice',  header: 'Purchase Price', width: 14, pdfWidth: 1   },
  { key: 'purchaseDate',   header: 'Purchase Date',  width: 14, pdfWidth: 1   },
  { key: 'warrantyExpiry', header: 'Warranty Expiry',width: 14, pdfWidth: 1   },
  { key: 'vendorName',     header: 'Vendor',         width: 18, pdfWidth: 1.2 },
  { key: 'addedBy',        header: 'Added By',       width: 18, pdfWidth: 1.2 },
  { key: 'createdAt',      header: 'Date Added',     width: 14, pdfWidth: 1   },
];

const mapAssetInventory = (assets) => assets.map(a => ({
  assetNumber:    a.assetNumber   || '',
  assetName:      a.assetName     || '',
  category:       a.category      || '',
  brand:          a.brand         || '',
  modelName:      a.modelName     || '',
  imeiNumber:     a.imeiNumber    || '',
  totalQty:       a.totalQuantity    ?? 0,
  assignedQty:    a.assignedQuantity ?? 0,
  availableQty:   a.availableQuantity ?? 0,
  status:         a.status        || '',
  purchasePrice:  a.purchasePrice != null ? `₹${a.purchasePrice.toLocaleString('en-IN')}` : '',
  purchaseDate:   a.purchaseDate  ? new Date(a.purchaseDate).toLocaleDateString('en-IN') : '',
  warrantyExpiry: a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString('en-IN') : '',
  vendorName:     a.vendorName    || '',
  addedBy:        a.createdBy?.name || '',
  createdAt:      new Date(a.createdAt).toLocaleDateString('en-IN'),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 2 — Employee Asset Report
// ═══════════════════════════════════════════════════════════════════════════════

const EMPLOYEE_ASSET_COLS = [
  { key: 'employeeName',    header: 'Employee',        width: 20, pdfWidth: 1.8 },
  { key: 'employeeId',      header: 'Employee ID',     width: 14, pdfWidth: 1   },
  { key: 'department',      header: 'Department',      width: 14, pdfWidth: 1   },
  { key: 'assetName',       header: 'Asset Name',      width: 22, pdfWidth: 2   },
  { key: 'assetNumber',     header: 'Asset No.',       width: 14, pdfWidth: 1.2 },
  { key: 'category',        header: 'Category',        width: 14, pdfWidth: 1   },
  { key: 'modelName',       header: 'Model',           width: 14, pdfWidth: 1   },
  { key: 'quantity',        header: 'Qty',             width: 8,  pdfWidth: 0.6 },
  { key: 'assignedDate',    header: 'Assigned Date',   width: 14, pdfWidth: 1   },
  { key: 'expectedReturn',  header: 'Expected Return', width: 14, pdfWidth: 1   },
  { key: 'assignmentStatus',header: 'Status',          width: 12, pdfWidth: 0.9 },
  { key: 'returnCondition', header: 'Return Condition',width: 14, pdfWidth: 1   },
  { key: 'returnedDate',    header: 'Returned Date',   width: 14, pdfWidth: 1   },
  { key: 'assignedBy',      header: 'Assigned By',     width: 16, pdfWidth: 1.2 },
];

const mapEmployeeAsset = (assignments) => assignments.map(a => ({
  employeeName:     a.employee?.name        || '',
  employeeId:       a.employee?.employeeId  || '',
  department:       a.employee?.department  || '',
  assetName:        a.asset?.assetName      || '',
  assetNumber:      a.asset?.assetNumber    || '',
  category:         a.asset?.category       || '',
  modelName:        a.asset?.modelName      || '',
  quantity:         a.quantity              ?? 0,
  assignedDate:     a.assignedDate   ? new Date(a.assignedDate).toLocaleDateString('en-IN')   : '',
  expectedReturn:   a.expectedReturnDate ? new Date(a.expectedReturnDate).toLocaleDateString('en-IN') : '',
  assignmentStatus: a.status               || '',
  returnCondition:  a.returnCondition       || '',
  returnedDate:     a.returnedDate   ? new Date(a.returnedDate).toLocaleDateString('en-IN')   : '',
  assignedBy:       a.assignedBy?.name      || '',
}));

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 3 — Damaged Asset Report
// ═══════════════════════════════════════════════════════════════════════════════

const DAMAGED_ASSET_COLS = [
  { key: 'assetName',    header: 'Asset Name',    width: 22, pdfWidth: 2   },
  { key: 'assetNumber',  header: 'Asset No.',     width: 14, pdfWidth: 1.2 },
  { key: 'category',     header: 'Category',      width: 14, pdfWidth: 1   },
  { key: 'employeeName', header: 'Returned By',   width: 20, pdfWidth: 1.5 },
  { key: 'employeeId',   header: 'Employee ID',   width: 14, pdfWidth: 1   },
  { key: 'department',   header: 'Department',    width: 14, pdfWidth: 1   },
  { key: 'quantity',     header: 'Qty',           width: 8,  pdfWidth: 0.6 },
  { key: 'returnedDate', header: 'Returned Date', width: 14, pdfWidth: 1   },
  { key: 'returnRemarks',header: 'Remarks',       width: 30, pdfWidth: 2.5 },
  { key: 'processedBy',  header: 'Processed By',  width: 18, pdfWidth: 1.2 },
];

const mapDamagedAsset = (assignments) => assignments.map(a => ({
  assetName:     a.asset?.assetName      || '',
  assetNumber:   a.asset?.assetNumber    || '',
  category:      a.asset?.category       || '',
  employeeName:  a.employee?.name        || '',
  employeeId:    a.employee?.employeeId  || '',
  department:    a.employee?.department  || '',
  quantity:      a.quantity              ?? 0,
  returnedDate:  a.returnedDate  ? new Date(a.returnedDate).toLocaleDateString('en-IN') : '',
  returnRemarks: a.returnRemarks          || '',
  processedBy:   a.returnedBy?.name       || '',
}));

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 4 — Lost Asset Report
// ═══════════════════════════════════════════════════════════════════════════════

// Same columns as Damaged
const LOST_ASSET_COLS = DAMAGED_ASSET_COLS;
const mapLostAsset    = mapDamagedAsset; // identical mapping

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT 5 — Credential Audit Report
// ═══════════════════════════════════════════════════════════════════════════════

const CREDENTIAL_AUDIT_COLS = [
  { key: 'targetEmployee', header: 'Employee',        width: 20, pdfWidth: 1.8 },
  { key: 'employeeId',     header: 'Employee ID',     width: 14, pdfWidth: 1   },
  { key: 'department',     header: 'Department',      width: 14, pdfWidth: 1   },
  { key: 'action',         header: 'Event',           width: 14, pdfWidth: 1   },
  { key: 'affectedFields', header: 'Affected Fields', width: 30, pdfWidth: 2.5 },
  { key: 'actorName',      header: 'Performed By',    width: 20, pdfWidth: 1.5 },
  { key: 'actorRole',      header: 'Role',            width: 14, pdfWidth: 1   },
  { key: 'ipAddress',      header: 'IP Address',      width: 16, pdfWidth: 1.2 },
  { key: 'timestamp',      header: 'Timestamp',       width: 20, pdfWidth: 1.5 },
];

const FIELD_LABELS = {
  email1: 'Email 1', email1Password: 'Email 1 Password',
  email2: 'Email 2', email2Password: 'Email 2 Password',
  crmUserId: 'CRM User ID', crmPassword: 'CRM Password',
  laptopUsername: 'Laptop Username', laptopPassword: 'Laptop Password',
  desktopUsername: 'Desktop Username', desktopPassword: 'Desktop Password',
  phonePassword: 'Phone PIN', simNumber: 'SIM Number',
};

const mapCredentialAudit = (logs) => logs.map(l => ({
  targetEmployee: l.targetEmployee?.name        || '',
  employeeId:     l.targetEmployee?.employeeId  || '',
  department:     l.targetEmployee?.department  || '',
  action:         l.action                      || '',
  affectedFields: (l.affectedFields || []).map(f => FIELD_LABELS[f] || f).join(', '),
  actorName:      l.actorUserId?.name           || '',
  actorRole:      l.actorRole                   || '',
  ipAddress:      l.ipAddress                   || '',
  timestamp:      new Date(l.createdAt).toLocaleString('en-IN'),
}));

// ─── Excel workbook builder ───────────────────────────────────────────────────

const buildExcel = async (title, sheetName, columns, rows) => {
  const wb = new ExcelJS.Workbook();
  await excelMeta(wb, title, {});
  const ws = wb.addWorksheet(sheetName, {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1 }
  });

  excelHeader(ws, columns);
  rows.forEach((r, i) => excelRow(ws, i, columns.map(c => r[c.key]), i % 2 === 1));

  // Auto-filter
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to:   { row: 1, column: columns.length }
  };

  // Freeze header row
  ws.views = [{ state: 'frozen', ySplit: 1 }];

  return wb.xlsx.writeBuffer();
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateReport(type, format, data)
 *   type   — 'assetInventory' | 'employeeAsset' | 'damaged' | 'lost' | 'credentialAudit'
 *   format — 'excel' | 'csv' | 'pdf'
 *   data   — raw mongoose documents
 *
 * Returns: { buffer, contentType, filename }
 */
const generateReport = async (type, format, data) => {
  const configs = {
    assetInventory: {
      title:     'Asset Inventory Report',
      sheetName: 'Asset Inventory',
      subtitle:  'Complete inventory of all company assets',
      columns:   ASSET_INVENTORY_COLS,
      mapper:    mapAssetInventory,
      fileBase:  'Asset_Inventory_Report',
    },
    employeeAsset: {
      title:     'Employee Asset Report',
      sheetName: 'Employee Assets',
      subtitle:  'All asset assignments per employee',
      columns:   EMPLOYEE_ASSET_COLS,
      mapper:    mapEmployeeAsset,
      fileBase:  'Employee_Asset_Report',
    },
    damaged: {
      title:     'Damaged Asset Report',
      sheetName: 'Damaged Assets',
      subtitle:  'Assets returned with Damaged condition',
      columns:   DAMAGED_ASSET_COLS,
      mapper:    mapDamagedAsset,
      fileBase:  'Damaged_Asset_Report',
    },
    lost: {
      title:     'Lost Asset Report',
      sheetName: 'Lost Assets',
      subtitle:  'Assets reported as Lost',
      columns:   LOST_ASSET_COLS,
      mapper:    mapLostAsset,
      fileBase:  'Lost_Asset_Report',
    },
    credentialAudit: {
      title:     'Credential Audit Report',
      sheetName: 'Credential Audit',
      subtitle:  'Audit log of all credential access events',
      columns:   CREDENTIAL_AUDIT_COLS,
      mapper:    mapCredentialAudit,
      fileBase:  'Credential_Audit_Report',
    },
  };

  const cfg  = configs[type];
  if (!cfg) throw new Error(`Unknown report type: ${type}`);

  const rows = cfg.mapper(data);
  const date = new Date().toISOString().split('T')[0];

  if (format === 'excel') {
    const buffer = await buildExcel(cfg.title, cfg.sheetName, cfg.columns, rows);
    return {
      buffer,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      filename: `${cfg.fileBase}_${date}.xlsx`,
    };
  }

  if (format === 'csv') {
    const buffer = buildCsv(cfg.columns, rows);
    return {
      buffer,
      contentType: 'text/csv; charset=utf-8',
      filename: `${cfg.fileBase}_${date}.csv`,
    };
  }

  if (format === 'pdf') {
    const buffer = await buildPdf(cfg.title, `${cfg.subtitle}  ·  Generated ${new Date().toLocaleString('en-IN')}`, cfg.columns, rows);
    return {
      buffer,
      contentType: 'application/pdf',
      filename: `${cfg.fileBase}_${date}.pdf`,
    };
  }

  throw new Error(`Unknown format: ${format}. Use excel | csv | pdf`);
};

module.exports = { generateReport };
