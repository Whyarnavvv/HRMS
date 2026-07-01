/**
 * seedFiscalYear.js
 *
 * Seeds the fiscal year "April 2026 to March 2027" config into the
 * GlobalSettings.yearlyMaxKpi array.
 *
 * ─── USAGE ───────────────────────────────────────────────────────────────────
 *
 *   DRY-RUN (read-only, zero writes):
 *     node seedFiscalYear.js --dry-run
 *
 *   LIVE APPLY (writes to DB):
 *     node seedFiscalYear.js --apply
 *
 * ─── WHAT IT DOES ────────────────────────────────────────────────────────────
 *   • Reads the current GlobalSettings.yearlyMaxKpi array.
 *   • Shows what is currently in DB.
 *   • In --apply mode, upserts the entry below (matched by label).
 *     If an entry with this label already exists, updates its fields.
 *     If not, appends it.
 *   • Does NOT touch any other settings (geofence, officeLocation, etc.).
 *   • Does NOT delete or modify any existing calendar-year entries.
 *   • Does NOT touch any KpiRecord or User documents.
 *
 * ─── FISCAL YEAR CONFIG BEING SEEDED ─────────────────────────────────────────
 *   Label       : April 2026 to March 2027
 *   Start date  : 2026-04-01 (inclusive)
 *   End date    : 2027-04-01 (exclusive — first day NOT in this FY)
 *   Working days: 310
 *   Max points  : 4,960
 */

'use strict';

require('dotenv').config();
const mongoose = require('mongoose');
const Settings = require('./models/Settings');

const DRY_RUN = !process.argv.includes('--apply');

// ── The fiscal year entry to seed ─────────────────────────────────────────────
const FISCAL_ENTRY = {
  label:       'April 2026 to March 2027',
  startDate:   new Date('2026-04-01T00:00:00.000Z'),
  endDate:     new Date('2027-04-01T00:00:00.000Z'),
  workingDays: 310,
  maxPoints:   4960
};

async function main() {
  if (DRY_RUN) {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MODE: DRY-RUN  — no data will be written');
    console.log('  Re-run with --apply to apply after reviewing this output.');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } else {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  MODE: LIVE APPLY  — will write to GlobalSettings');
    console.log('═══════════════════════════════════════════════════════════════\n');
  }

  console.log('Connecting to MongoDB…');
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
  console.log('Connected.\n');

  let settings = await Settings.findOne({ name: 'GlobalSettings' });

  // ── Show current state ────────────────────────────────────────────────────
  console.log('CURRENT yearlyMaxKpi entries in DB:');
  if (!settings || !settings.yearlyMaxKpi || settings.yearlyMaxKpi.length === 0) {
    console.log('  (none)');
  } else {
    settings.yearlyMaxKpi.forEach((e, i) => {
      if (e.label) {
        console.log(`  [${i}] FISCAL  label="${e.label}"  start=${e.startDate?.toISOString()?.slice(0,10)}  end=${e.endDate?.toISOString()?.slice(0,10)}  workingDays=${e.workingDays ?? 'not set'}  maxPoints=${e.maxPoints}`);
      } else {
        console.log(`  [${i}] LEGACY  year=${e.year}  maxPoints=${e.maxPoints}`);
      }
    });
  }

  // ── Check if entry already exists ────────────────────────────────────────
  const existing = settings?.yearlyMaxKpi?.find(e => e.label === FISCAL_ENTRY.label);

  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('PLANNED CHANGE:');
  if (existing) {
    console.log(`  UPDATE existing entry "${FISCAL_ENTRY.label}"`);
    console.log(`    workingDays : ${existing.workingDays ?? 'not set'} → ${FISCAL_ENTRY.workingDays}`);
    console.log(`    maxPoints   : ${existing.maxPoints} → ${FISCAL_ENTRY.maxPoints}`);
    console.log(`    startDate   : ${existing.startDate?.toISOString()?.slice(0,10)} → ${FISCAL_ENTRY.startDate.toISOString().slice(0,10)}`);
    console.log(`    endDate     : ${existing.endDate?.toISOString()?.slice(0,10)} → ${FISCAL_ENTRY.endDate.toISOString().slice(0,10)}`);
  } else {
    console.log(`  INSERT new entry:`);
    console.log(`    label       : ${FISCAL_ENTRY.label}`);
    console.log(`    startDate   : ${FISCAL_ENTRY.startDate.toISOString().slice(0,10)}`);
    console.log(`    endDate     : ${FISCAL_ENTRY.endDate.toISOString().slice(0,10)}`);
    console.log(`    workingDays : ${FISCAL_ENTRY.workingDays}`);
    console.log(`    maxPoints   : ${FISCAL_ENTRY.maxPoints}`);
  }
  console.log('\n  ⚡ KpiRecord documents affected  : 0  (no KPI data changes)');
  console.log('  ⚡ User documents affected        : 0  (no User data changes)');
  console.log('  ⚡ Settings documents modified    : 1  (GlobalSettings only)');
  console.log('──────────────────────────────────────────────────────────────');

  if (DRY_RUN) {
    console.log('\n  DRY-RUN complete — ZERO changes were made.');
    console.log('  If the above looks correct, run:');
    console.log('    node seedFiscalYear.js --apply');
    await mongoose.disconnect();
    return;
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  if (!settings) {
    settings = await Settings.create({ name: 'GlobalSettings' });
  }

  if (existing) {
    existing.startDate    = FISCAL_ENTRY.startDate;
    existing.endDate      = FISCAL_ENTRY.endDate;
    existing.workingDays  = FISCAL_ENTRY.workingDays;
    existing.maxPoints    = FISCAL_ENTRY.maxPoints;
  } else {
    settings.yearlyMaxKpi.push(FISCAL_ENTRY);
  }

  await settings.save();

  console.log('\n✅  Done. GlobalSettings updated successfully.');
  console.log('    The server does NOT need a restart — next API call will read the new config.');

  // ── Verify what is now in DB ──────────────────────────────────────────────
  const updated = await Settings.findOne({ name: 'GlobalSettings' });
  console.log('\nUPDATED yearlyMaxKpi entries in DB:');
  updated.yearlyMaxKpi.forEach((e, i) => {
    if (e.label) {
      console.log(`  [${i}] FISCAL  label="${e.label}"  start=${e.startDate?.toISOString()?.slice(0,10)}  end=${e.endDate?.toISOString()?.slice(0,10)}  workingDays=${e.workingDays}  maxPoints=${e.maxPoints}`);
    } else {
      console.log(`  [${i}] LEGACY  year=${e.year}  maxPoints=${e.maxPoints}`);
    }
  });

  await mongoose.disconnect();
}

main().catch(err => {
  console.error('Script error:', err);
  process.exit(1);
});
