/**
 * deleteAllKpisBefore.js
 *
 * Deletes ALL KpiRecord documents with date <= 2026-06-30 (end of day IST),
 * then resets totalKpi / totalAdded / totalDeducted to 0 on every User
 * document that had records in that range.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   DRY-RUN (read-only, zero writes):
 *     node deleteAllKpisBefore.js --dry-run
 *
 *   LIVE APPLY (writes — only after reviewing dry-run output):
 *     node deleteAllKpisBefore.js --apply
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   • Deletes ALL KpiRecord documents where date <= 2026-06-30T23:59:59 IST
 *     (both auto and manual, all employees).
 *   • Resets totalKpi, totalAdded, totalDeducted to 0 on every affected User.
 *   • Does NOT touch Attendance, Payroll, User profile, or any other collection.
 *
 * ─── SAFETY ──────────────────────────────────────────────────────────────────
 *   • Take a MongoDB Atlas backup BEFORE running --apply.
 *   • This operation is NOT reversible without a backup.
 */

'use strict';

// Override system DNS — fixes querySrv ECONNREFUSED on Windows
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const KpiRecord = require('./models/KpiRecord');
const User      = require('./models/User');

const DRY_RUN = !process.argv.includes('--apply');

// ── Cut-off: everything UP TO AND INCLUDING June 30 2026 (end of day IST) ────
// IST is UTC+5:30, so end of June 30 IST = June 30 18:30 UTC = July 1 00:00 IST
// Using July 1 2026 00:00:00 UTC as the exclusive upper bound covers this exactly.
const CUTOFF_EXCLUSIVE = new Date('2026-07-01T00:00:00.000Z');

if (DRY_RUN) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MODE: DRY-RUN  — no data will be changed');
  console.log('  Re-run with --apply to apply after reviewing this output.');
  console.log('═══════════════════════════════════════════════════════════════\n');
} else {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MODE: LIVE APPLY  — will DELETE KpiRecords and reset User totals');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected.\n');

  // ── Count what will be deleted ────────────────────────────────────────────
  const totalToDelete = await KpiRecord.countDocuments({
    date: { $lt: CUTOFF_EXCLUSIVE }
  });

  const autoToDelete = await KpiRecord.countDocuments({
    date: { $lt: CUTOFF_EXCLUSIVE },
    autoKpi: true
  });

  const manualToDelete = totalToDelete - autoToDelete;

  // ── Find affected employees ───────────────────────────────────────────────
  const affected = await KpiRecord.aggregate([
    { $match: { date: { $lt: CUTOFF_EXCLUSIVE } } },
    {
      $group: {
        _id:         '$employeeId',
        totalPts:    { $sum: '$points' },
        recordCount: { $sum: 1 }
      }
    },
    { $sort: { totalPts: -1 } }
  ]);

  const empIds = affected.map(a => a._id);
  const users  = await User.find({ _id: { $in: empIds } })
    .select('name employeeId totalKpi totalAdded totalDeducted')
    .lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  // ── Print summary ─────────────────────────────────────────────────────────
  console.log('══════════════════════════════════════════════════════════════════════');
  console.log(`  KpiRecord documents to DELETE : ${totalToDelete}`);
  console.log(`    → Auto-KPI records          : ${autoToDelete}`);
  console.log(`    → Manual KPI records        : ${manualToDelete}`);
  console.log(`  Employees affected            : ${affected.length}`);
  console.log(`  Cut-off (exclusive)           : ${CUTOFF_EXCLUSIVE.toISOString()} (= end of 30 Jun 2026 IST)`);
  console.log('══════════════════════════════════════════════════════════════════════\n');

  console.log('Per-employee impact:');
  console.log('─'.repeat(90));
  console.log(
    'empNo'.padEnd(14) +
    'Name'.padEnd(24) +
    'Records'.padEnd(10) +
    'Pts in range'.padEnd(16) +
    'totalKpi → 0'.padEnd(18) +
    'totalAdded → 0'
  );
  console.log('─'.repeat(90));

  for (const a of affected) {
    const u       = userMap[a._id.toString()];
    const name    = (u?.name    || '(unknown)').substring(0, 22);
    const empNo   = (u?.employeeId || '?').toString().substring(0, 12);
    const curKpi  = u?.totalKpi   ?? '?';
    const curAdded = u?.totalAdded ?? '?';
    console.log(
      empNo.padEnd(14) +
      name.padEnd(24) +
      String(a.recordCount).padEnd(10) +
      String(a.totalPts.toFixed(2)).padEnd(16) +
      `${curKpi} → 0`.padEnd(18) +
      `${curAdded} → 0`
    );
  }

  console.log('─'.repeat(90));

  // ── Remaining records after deletion (sanity check) ───────────────────────
  const remaining = await KpiRecord.countDocuments({
    date: { $gte: CUTOFF_EXCLUSIVE }
  });
  console.log(`\n  KpiRecords that will REMAIN (date >= 2026-07-01): ${remaining}`);

  if (DRY_RUN) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  DRY-RUN complete — ZERO changes were made.');
    console.log('  If this looks correct, take an Atlas backup then run:');
    console.log('    node deleteAllKpisBefore.js --apply');
    console.log('═══════════════════════════════════════════════════════════════');
    await mongoose.disconnect();
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LIVE APPLY
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n⚡  Applying now…\n');

  // 1. Delete all KpiRecords in range
  const delResult = await KpiRecord.deleteMany({
    date: { $lt: CUTOFF_EXCLUSIVE }
  });
  console.log(`  ✅  KpiRecord documents deleted: ${delResult.deletedCount}`);

  // 2. Reset User totals to 0 for all affected employees
  const resetResult = await User.updateMany(
    { _id: { $in: empIds } },
    { $set: { totalKpi: 0, totalAdded: 0, totalDeducted: 0 } }
  );
  console.log(`  ✅  User documents reset       : ${resetResult.modifiedCount}`);

  // 3. Verify nothing remains before cutoff
  const leftover = await KpiRecord.countDocuments({
    date: { $lt: CUTOFF_EXCLUSIVE }
  });
  if (leftover === 0) {
    console.log('  ✅  Verified: 0 KpiRecords remain before 2026-07-01');
  } else {
    console.log(`  ⚠️  WARNING: ${leftover} KpiRecords still exist before cutoff — check manually`);
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  Done. You can now import the real April–June KPI data.');
  console.log('═══════════════════════════════════════════════════════════════');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
