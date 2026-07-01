/**
 * findDuplicateKpis.js  —  READ-ONLY diagnostic script
 *
 * Finds every employee who has more than one auto-KPI record of the same
 * kpiType on the same calendar date (in IST).
 *
 * HOW TO RUN (safe, no writes):
 *   node findDuplicateKpis.js
 *
 * OUTPUT: A table of { employeeId, name, kpiType, dateIST, count } for every
 * group where count > 1, plus a total-impact summary.
 *
 * This script is READ-ONLY. It makes zero writes to the database.
 */

'use strict';

// Override system DNS — fixes querySrv ECONNREFUSED on some Windows machines
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const KpiRecord = require('./models/KpiRecord');
const User      = require('./models/User');

// ─── IST date helper ─────────────────────────────────────────────────────────
// Converts a UTC Date stored in MongoDB to a YYYY-MM-DD string in IST.
const toISTDateStr = (utcDate) => {
  return new Date(utcDate)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }); // en-CA gives YYYY-MM-DD
};

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
  });
  console.log('Connected.\n');

  // ── Pull all auto-KPI records ────────────────────────────────────────────
  console.log('Loading all auto-KPI records (this may take a moment)…');
  const records = await KpiRecord.find({ autoKpi: true })
    .select('employeeId kpiType date points reason createdAt')
    .lean();

  console.log(`Total auto-KPI records found: ${records.length}\n`);

  // ── Group by (employeeId, kpiType, IST-date) ─────────────────────────────
  const groups = {};
  for (const r of records) {
    const dateStr = toISTDateStr(r.date);
    const key     = `${r.employeeId}||${r.kpiType}||${dateStr}`;
    if (!groups[key]) {
      groups[key] = { employeeId: r.employeeId, kpiType: r.kpiType, dateIST: dateStr, entries: [] };
    }
    groups[key].entries.push(r);
  }

  // ── Filter to duplicates only ─────────────────────────────────────────────
  const duplicates = Object.values(groups).filter(g => g.entries.length > 1);

  if (duplicates.length === 0) {
    console.log('✅  No duplicate auto-KPI entries found across any employee.');
    await mongoose.disconnect();
    return;
  }

  // ── Resolve employee names ────────────────────────────────────────────────
  const affectedEmpIds = [...new Set(duplicates.map(d => d.employeeId.toString()))];
  const users = await User.find({ _id: { $in: affectedEmpIds } })
    .select('name employeeId')
    .lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  // ── Print results ─────────────────────────────────────────────────────────
  console.log('='.repeat(90));
  console.log('DUPLICATE AUTO-KPI REPORT');
  console.log('='.repeat(90));
  console.log(
    'mongoId'.padEnd(26) +
    'empNo'.padEnd(8)   +
    'Name'.padEnd(22)   +
    'kpiType'.padEnd(16)+
    'Date(IST)'.padEnd(14)+
    'Count'.padEnd(7)   +
    'Points(each)'
  );
  console.log('-'.repeat(90));

  let totalExtraRecords = 0;
  let totalExtraPoints  = 0;

  for (const d of duplicates.sort((a, b) => a.dateIST.localeCompare(b.dateIST))) {
    const u         = userMap[d.employeeId.toString()];
    const name      = u?.name      || '(unknown)';
    const empNo     = u?.employeeId || '?';
    const count     = d.entries.length;
    const ptsList   = d.entries.map(e => e.points).join(', ');
    const extra     = count - 1;                              // records beyond the 1st
    const extraPts  = d.entries.slice(1).reduce((s, e) => s + e.points, 0);

    totalExtraRecords += extra;
    totalExtraPoints  += extraPts;

    console.log(
      d.employeeId.toString().padEnd(26) +
      String(empNo).padEnd(8)            +
      name.substring(0, 20).padEnd(22)   +
      d.kpiType.padEnd(16)               +
      d.dateIST.padEnd(14)               +
      String(count).padEnd(7)            +
      ptsList
    );

    // Show individual record details for easy manual review
    for (const e of d.entries) {
      console.log(
        '   └─ _id:' + e._id.toString() +
        '  pts:' + e.points +
        '  created:' + new Date(e.createdAt).toISOString() +
        '\n      reason: ' + (e.reason || '').substring(0, 80)
      );
    }
  }

  console.log('='.repeat(90));
  console.log(`Affected employees      : ${affectedEmpIds.length}`);
  console.log(`Duplicate groups found  : ${duplicates.length}`);
  console.log(`Extra records to remove : ${totalExtraRecords}`);
  console.log(`Extra KPI points awarded: ${totalExtraPoints.toFixed(2)}`);
  console.log('='.repeat(90));
  console.log('\n⚠️  This was a READ-ONLY scan. No data was changed.');
  console.log('    Run cleanupDuplicateKpis.js --dry-run to preview the cleanup.');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
