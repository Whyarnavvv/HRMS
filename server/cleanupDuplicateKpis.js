/**
 * cleanupDuplicateKpis.js
 *
 * Removes duplicate auto-KPI records — keeping the FIRST (earliest createdAt)
 * entry for each (employeeId, kpiType, date) group and deleting the rest.
 * Also corrects totalKpi / totalAdded on the User document for every affected
 * employee.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   DRY-RUN (safe, no writes — review output first):
 *     node cleanupDuplicateKpis.js --dry-run
 *
 *   LIVE RUN (writes — only after you have reviewed dry-run output):
 *     node cleanupDuplicateKpis.js --apply
 *
 * ─── SAFETY NOTES ────────────────────────────────────────────────────────────
 *   • Dry-run mode performs ZERO writes and ZERO deletes.
 *   • Live run wraps each employee's cleanup in a per-employee try/catch so
 *     a single failure does not abort the rest.
 *   • Take a MongoDB Atlas backup (or export the kpirecords + users collections)
 *     BEFORE running --apply.
 *   • This script does NOT touch salary, bank, KYC, or any other collection.
 *   • Only auto-KPI records (autoKpi: true) are considered.
 *     Manual KPI entries are never touched.
 *
 * ─── WHAT "KEEPING THE FIRST" MEANS ─────────────────────────────────────────
 *   Within each (employeeId, kpiType, YYYY-MM-DD IST) group we keep the record
 *   with the smallest createdAt.  All others are deleted.
 *   The User.totalKpi and User.totalAdded are decremented by the sum of the
 *   deleted records' points.
 */

'use strict';

// Override system DNS — fixes querySrv ECONNREFUSED on some Windows machines
const dns = require('dns');
dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

require('dotenv').config();
const mongoose = require('mongoose');
const KpiRecord = require('./models/KpiRecord');
const User      = require('./models/User');

const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MODE: DRY-RUN  — no data will be changed');
  console.log('  Re-run with --apply to apply the changes after reviewing this output.');
  console.log('═══════════════════════════════════════════════════════════════\n');
} else {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  MODE: LIVE APPLY  — this will delete records and update User totals');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

// IST date string helper
const toISTDateStr = (utcDate) =>
  new Date(utcDate).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

async function main() {
  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected.\n');

  // ── Load all auto-KPI records ─────────────────────────────────────────────
  const records = await KpiRecord.find({ autoKpi: true })
    .select('_id employeeId kpiType date points reason createdAt')
    .sort({ createdAt: 1 })   // ascending: first record per group = the keeper
    .lean();

  console.log(`Total auto-KPI records: ${records.length}`);

  // ── Group by (employeeId, kpiType, IST-date) ──────────────────────────────
  const groups = {};
  for (const r of records) {
    const key = `${r.employeeId}||${r.kpiType}||${toISTDateStr(r.date)}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
  if (duplicateGroups.length === 0) {
    console.log('✅  No duplicates found. Nothing to clean up.');
    await mongoose.disconnect();
    return;
  }

  // ── Resolve employee names ────────────────────────────────────────────────
  const empIds = [...new Set(duplicateGroups.map(g => g[0].employeeId.toString()))];
  const users  = await User.find({ _id: { $in: empIds } }).select('name employeeId totalKpi totalAdded').lean();
  const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

  // ── Collect what to delete, grouped by employee for the User $inc ─────────
  // impactMap: { empIdStr → { extraPoints, recordsToDelete: [_id, …] } }
  const impactMap = {};

  console.log('\n' + '─'.repeat(100));
  console.log('RECORDS THAT WOULD BE DELETED (keeping earliest createdAt per group)');
  console.log('─'.repeat(100));

  let totalDeleteCount = 0;
  let totalExtraPoints = 0;

  for (const group of duplicateGroups.sort((a, b) =>
    toISTDateStr(a[0].date).localeCompare(toISTDateStr(b[0].date))
  )) {
    const keeper  = group[0];  // earliest → keep
    const extras  = group.slice(1);
    const empStr  = keeper.employeeId.toString();
    const u       = userMap[empStr];
    const empNo   = u?.employeeId || '?';
    const name    = u?.name || '(unknown)';

    if (!impactMap[empStr]) impactMap[empStr] = { extraPoints: 0, recordsToDelete: [] };

    for (const e of extras) {
      impactMap[empStr].extraPoints      += e.points;
      impactMap[empStr].recordsToDelete.push(e._id);
      totalDeleteCount++;
      totalExtraPoints += e.points;

      console.log(
        `  DELETE _id=${e._id}` +
        `  emp=${empNo}/${name}` +
        `  type=${e.kpiType}` +
        `  date(IST)=${toISTDateStr(e.date)}` +
        `  pts=${e.points}` +
        `  created=${new Date(e.createdAt).toISOString()}`
      );
      console.log(`         reason: ${(e.reason || '').substring(0, 90)}`);
    }
    console.log(
      `  KEEP   _id=${keeper._id}` +
      `  created=${new Date(keeper.createdAt).toISOString()}\n`
    );
  }

  console.log('─'.repeat(100));
  console.log('\nSUMMARY OF CHANGES:');
  console.log(`  KpiRecord documents to delete : ${totalDeleteCount}`);
  console.log(`  Total excess points to reverse: ${totalExtraPoints.toFixed(2)}`);
  console.log(`  Employees affected            : ${Object.keys(impactMap).length}`);
  console.log('\nPer-employee User field changes (totalKpi / totalAdded):');
  for (const [empStr, impact] of Object.entries(impactMap)) {
    const u    = userMap[empStr];
    const name = u?.name || '(unknown)';
    const empNo = u?.employeeId || '?';
    const curTotal = u?.totalKpi  ?? 'N/A';
    const curAdded = u?.totalAdded ?? 'N/A';
    const newTotal = typeof curTotal === 'number' ? (curTotal - impact.extraPoints).toFixed(2) : 'N/A';
    const newAdded = typeof curAdded === 'number' ? (curAdded - impact.extraPoints).toFixed(2) : 'N/A';
    console.log(
      `  emp ${empNo} ${name.padEnd(22)}` +
      `  totalKpi : ${String(curTotal).padStart(8)} → ${String(newTotal).padStart(8)}` +
      `  totalAdded: ${String(curAdded).padStart(8)} → ${String(newAdded).padStart(8)}` +
      `  (removing ${impact.extraPoints.toFixed(2)} pts across ${impact.recordsToDelete.length} record(s))`
    );
  }

  if (DRY_RUN) {
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  DRY-RUN complete — ZERO changes were made.');
    console.log('  Review the output above, then run:');
    console.log('    node cleanupDuplicateKpis.js --apply');
    console.log('  (After taking a MongoDB backup first!)');
    console.log('═══════════════════════════════════════════════════════════════');
    await mongoose.disconnect();
    return;
  }

  // ════════════════════════════════════════════════════════════════════════════
  // LIVE APPLY — only reached when --apply flag is passed
  // ════════════════════════════════════════════════════════════════════════════
  console.log('\n⚡  Applying changes now…');

  let deleteSuccessCount = 0;
  let deleteFailCount    = 0;
  let userUpdateCount    = 0;

  for (const [empStr, impact] of Object.entries(impactMap)) {
    try {
      // Delete the extra records
      const delResult = await KpiRecord.deleteMany({
        _id: { $in: impact.recordsToDelete }
      });
      deleteSuccessCount += delResult.deletedCount;

      // Adjust User totals — only if points > 0 to avoid no-op updates
      if (impact.extraPoints > 0) {
        await User.findByIdAndUpdate(empStr, {
          $inc: {
            totalKpi:   -impact.extraPoints,
            totalAdded: -impact.extraPoints
          }
        });
        userUpdateCount++;
      }

      const u = userMap[empStr];
      console.log(`  ✅  emp ${u?.employeeId || empStr} (${u?.name || '?'}) — deleted ${delResult.deletedCount} record(s), reversed ${impact.extraPoints.toFixed(2)} pts`);
    } catch (err) {
      deleteFailCount++;
      console.error(`  ❌  emp ${empStr} — ERROR: ${err.message}`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  KpiRecord documents deleted: ${deleteSuccessCount}`);
  console.log(`  User documents updated     : ${userUpdateCount}`);
  if (deleteFailCount > 0) {
    console.log(`  ⚠️  Failures                : ${deleteFailCount}  (see errors above)`);
  }
  console.log('  Done.');
  console.log('═══════════════════════════════════════════════════════════════');

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
