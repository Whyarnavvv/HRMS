const PDFDocument = require('pdfkit');
const Company = require('../models/Company');

const numberToWords = (num) => {
  if (num === 0) return 'Zero Only';
  const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];

  const safeNum = Math.floor(Math.abs(num));
  // Pad to 11 digits to handle up to ₹99,99,99,999 (well above any salary)
  const padded = ('00000000000' + safeNum).slice(-11);
  const n = padded.match(/^(\d{2})(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return safeNum.toString() + ' Only';

  let str = '';
  // n[1] = hundred crores, n[2] = crores, n[3] = lakhs, n[4] = thousands, n[5] = hundreds, n[6] = last two
  if (Number(n[1]) !== 0) str += (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + ' Hundred Crore ';
  if (Number(n[2]) !== 0) str += (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + ' Crore ';
  if (Number(n[3]) !== 0) str += (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + ' Lakh ';
  if (Number(n[4]) !== 0) str += (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + ' Thousand ';
  if (Number(n[5]) !== 0) str += (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + ' Hundred ';
  if (Number(n[6]) !== 0) str += (a[Number(n[6])] || b[n[6][0]] + ' ' + a[n[6][1]]);
  return (str.trim() + ' Only').replace(/\s+/g, ' ').trim();
};

const renderCompanyHeader = (doc, companyData) => {
  const companyName = companyData.name || 'Study Palace Hub';
  const parts = companyName.split(' ');
  if (parts.length >= 2) {
    doc.fontSize(36).font('Helvetica-Bold').fillColor('#15803d').text(parts[0], 180, 50, { continued: true });
    if (parts.length > 2) {
      for (let i = 1; i < parts.length - 1; i++) {
        doc.fillColor('#3b82f6').text(` ${parts[i]}`, { continued: true });
      }
      doc.fillColor('#333333').text(` ${parts[parts.length - 1]}`);
    } else {
      doc.fillColor('#3b82f6').text(` ${parts[1]}`);
    }
  } else {
    doc.fontSize(36).font('Helvetica-Bold').fillColor('#15803d').text(companyName, 180, 50);
  }
  doc.moveTo(180, 90).lineTo(480, 90).lineWidth(3).strokeColor('#15803d').stroke();
  doc.moveTo(180, 95).lineTo(480, 95).lineWidth(1.5).strokeColor('#3b82f6').stroke();
  doc.fontSize(16).fillColor('#dc2626').text('DOCTORS MAKING DOCTORS', 180, 105, { align: 'center', width: 300 });
};

const getCompanyData = async (userCompany) => {
  try {
    if (userCompany) {
      const company = await Company.findById(userCompany);
      if (company) return company;
    }
    return await Company.findOne({ isActive: true }).sort({ createdAt: 1 });
  } catch (error) {
    return null;
  }
};

const generateSalarySlipPDF = async (payroll) => {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));

    const p = payroll;
    const u = p.user || {};
    const bank = u.bankDetails || {};

    const company = await getCompanyData(u.company);
    const defaultCompany = {
      name: 'Study Palace Hub',
      address: { street: 'KLJ TOWER, NETAJI SUBHASH PLACE', city: 'DELHI', state: '', postalCode: '110034', country: 'India' },
      email: '', phone: '', gstNumber: '', logo: null
    };
    const companyData = company || defaultCompany;

    doc.rect(20, 20, 555, 800).lineWidth(1.5).strokeColor('#333333').stroke();

    const fs = require('fs');
    const path = require('path');

    if (companyData.logo) {
      const logoPath = path.join(__dirname, '../uploads', companyData.logo);
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 80, 30, { width: 400, align: 'center' });
      } else {
        renderCompanyHeader(doc, companyData);
      }
    } else {
      renderCompanyHeader(doc, companyData);
    }

    const fullAddress = companyData.address ?
      `${companyData.address.street || ''} ${companyData.address.city || ''} ${companyData.address.state || ''} ${companyData.address.postalCode || ''}`.trim() :
      'KLJ TOWER, NETAJI SUBHASH PLACE, DELHI - 110034';

    doc.fontSize(8).fillColor('#2563eb').text(fullAddress, 0, 145, { align: 'center' });

    if (companyData.gstNumber) {
      doc.fontSize(8).fillColor('#2563eb').text(`GST: ${companyData.gstNumber}`, 0, 155, { align: 'center' });
    }

    const monthStr = new Date(2000, p.month - 1).toLocaleString('default', { month: 'long' });
    const monthY = companyData.gstNumber ? 175 : 165;
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#7e22ce').text(`Pay Slip for the Month of ${monthStr}`, 0, monthY, { align: 'center' });

    const detailsY = companyData.gstNumber ? 210 : 200;
    const col1X = 40, val1X = 150, col2X = 320, val2X = 420, dy = 16;

    const printDetailRow = (yPos, lbl1, val1, lbl2, val2) => {
      doc.font('Helvetica-Bold').fillColor('#7e22ce').text(lbl1, col1X, yPos);
      doc.font('Helvetica').fillColor('#333333').text(val1, val1X, yPos);
      if (lbl2) {
        doc.font('Helvetica-Bold').fillColor('#7e22ce').text(lbl2, col2X, yPos);
        doc.font('Helvetica').fillColor('#333333').text(val2, val2X, yPos);
      }
    };

    printDetailRow(detailsY,       'Employee Code', u.employeeId || 'N/A', 'DOB', u.birthDate ? new Date(u.birthDate).toLocaleDateString() : 'N/A');
    printDetailRow(detailsY+dy*1,  'Name',          u.name || 'N/A',       'DOJ', u.joiningDate ? new Date(u.joiningDate).toLocaleDateString() : 'N/A');
    printDetailRow(detailsY+dy*2,  'Bank Name',     bank.bankName || 'N/A','PAN No', u.panCard || 'N/A');
    printDetailRow(detailsY+dy*3,  'Bank Acc No',   bank.accountNumber ? `:${bank.accountNumber}` : 'N/A', 'Bank Pay Mode', 'NEFT');
    printDetailRow(detailsY+dy*4,  'Location',      'Netaji Subhash Place','Month', monthStr);
    printDetailRow(detailsY+dy*5,  'Department',    u.department || 'N/A', 'LOP Days', p.absentDays || 0);
    printDetailRow(detailsY+dy*6,  'WORKDAYS',      p.presentDays + (p.paidLeaves || 0), 'Days in Month', p.workingDays);

    const tableY = 325;
    const c1 = 40, c2 = 200, c3 = 300, c4 = 460;
    const wE = 160, wR = 100, wD = 160, wA = 95;

    doc.lineWidth(1).strokeColor('#333333');
    const drawGridLines = (topY, bottomY) => {
      doc.moveTo(c1, topY).lineTo(c1, bottomY).stroke();
      doc.moveTo(c2, topY).lineTo(c2, bottomY).stroke();
      doc.moveTo(c3, topY).lineTo(c3, bottomY).stroke();
      doc.moveTo(c4, topY).lineTo(c4, bottomY).stroke();
      doc.moveTo(c1 + wE + wR + wD + wA, topY).lineTo(c1 + wE + wR + wD + wA, bottomY).stroke();
    };

    const drawTableRow = (yPos, eLbl, eAmt, dLbl, dAmt, isBold = false) => {
      if (isBold) doc.font('Helvetica-Bold'); else doc.font('Helvetica');
      doc.fillColor('#333333');
      if (eLbl) doc.text(eLbl, c1 + 5, yPos + 4);
      if (eAmt !== '') doc.text(eAmt, c2, yPos + 4, { width: wR - 5, align: 'right' });
      if (dLbl) doc.text(dLbl, c3 + 5, yPos + 4);
      if (dAmt !== '') doc.text(dAmt, c4, yPos + 4, { width: wA - 5, align: 'right' });
      doc.moveTo(c1, yPos + 18).lineTo(555, yPos + 18).stroke();
    };

    doc.moveTo(c1, tableY).lineTo(555, tableY).stroke();
    drawTableRow(tableY, 'Earnings', 'Rs', 'Deductions', 'Amount', true);

    let curY = tableY + 18;

    const earningsRows = [
      { label: 'Basic', amount: p.grossBaseSalary || p.baseSalary || 0 },
      ...(p.totalAllowances ? [{ label: 'Allowances', amount: p.totalAllowances }] : []),
      ...(p.monthlyBonus ? [{ label: 'Monthly Bonus', amount: p.monthlyBonus }] : []),
      ...(p.performanceBonus ? [{ label: 'Performance Bonus', amount: p.performanceBonus }] : [])
    ];
    if (p.adjustments) p.adjustments.filter(a => a.type === 'Addition').forEach(a => earningsRows.push({ label: a.reason, amount: a.amount }));

    const deductionsRows = [
      ...(p.absentDeduction ? [{ label: 'Leave Deduction', amount: parseFloat(p.absentDeduction.toFixed(2)) }] : []),
      ...(p.halfDayDeduction ? [{ label: 'Half-Day Deduction', amount: parseFloat(p.halfDayDeduction.toFixed(2)) }] : [])
    ];
    if (p.adjustments) p.adjustments.filter(a => a.type === 'Deduction').forEach(a => deductionsRows.push({ label: a.reason, amount: a.amount }));

    const maxRows = Math.max(earningsRows.length, deductionsRows.length, 6);
    let totalE = 0, totalD = 0;

    for (let i = 0; i < maxRows; i++) {
      let eLbl = '', eAmt = '', dLbl = '', dAmt = '';
      if (i < earningsRows.length) { eLbl = earningsRows[i].label; eAmt = Math.round(earningsRows[i].amount); totalE += Number(earningsRows[i].amount); }
      if (i < deductionsRows.length) { dLbl = deductionsRows[i].label; dAmt = deductionsRows[i].amount; totalD += Number(deductionsRows[i].amount); }
      drawTableRow(curY, eLbl, eAmt.toString(), dLbl, dAmt.toString());
      curY += 18;
    }

    drawTableRow(curY, 'Total Earning', Math.round(totalE).toString(), 'Total Deduction', totalD.toString(), true);
    curY += 18;
    drawTableRow(curY, '', '', '', '');
    curY += 18;

    const netPay = Math.round(p.netSalary);
    const perDay = (p.dailyRate || (totalE / (p.workingDays || 1))).toFixed(7);

    drawGridLines(tableY, curY + 18 * 3);

    doc.font('Helvetica-Bold').fillColor('#7e22ce').text('Per Day:', c1 + 5, curY + 4);
    doc.font('Helvetica-Bold').fillColor('#333333').text(perDay, c4, curY + 4, { width: wA - 5, align: 'right' });
    doc.moveTo(c1, curY + 18).lineTo(555, curY + 18).strokeColor('#333333').stroke();
    curY += 18;

    doc.font('Helvetica-Bold').fillColor('#7e22ce').text('Net Pay (Bank):', c1 + 5, curY + 4);
    doc.font('Helvetica-Bold').fillColor('#333333').text(netPay.toString(), c4, curY + 4, { width: wA - 5, align: 'right' });
    doc.moveTo(c1, curY + 18).lineTo(555, curY + 18).strokeColor('#333333').stroke();
    curY += 18;

    doc.font('Helvetica-Bold').fillColor('#7e22ce').text('In Words:', c1 + 5, curY + 4);
    doc.font('Helvetica-Bold').fillColor('#333333').text(numberToWords(netPay), c3 + 5, curY + 4, { width: wD + wA - 5, align: 'center' });
    doc.moveTo(c1, curY + 18).lineTo(555, curY + 18).strokeColor('#333333').stroke();
    curY += 18;

    curY += 40;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#dc2626').text(`Dear Employee we thank you for being part of ${companyData.name} Family`, 0, curY, { align: 'center' });

    curY += 50;
    doc.save()
      .rotate(-30, { origin: [450, curY + 30] })
      .circle(450, curY + 30, 40).lineWidth(1).strokeColor('#7c3aed').stroke()
      .circle(450, curY + 30, 35).stroke();

    const sealText = companyData.name ? `${companyData.name.toUpperCase()} PVT LTD` : 'STUDY PALACE HUB PVT LTD';
    doc.fontSize(8).fillColor('#7c3aed').text(sealText, 390, curY + 10, { width: 120, align: 'center' });
    doc.text('HR DEPARTMENT', 390, curY + 30, { width: 120, align: 'center' });
    doc.restore();

    doc.fontSize(8).fillColor('#333333').text('Authorised Signatory', 400, curY + 60);
    doc.text(companyData.address?.city || 'New Delhi', 420, curY + 70);

    doc.end();
  });
};

module.exports = { generateSalarySlipPDF };
