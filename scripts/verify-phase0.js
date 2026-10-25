// Verification script for Phase 0 database migration
const fs = require('fs');
const path = require('path');

const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20261021223000_phase0_database_fixes.sql');
const testSqlPath = path.join(__dirname, '..', 'supabase', 'tests', 'phase0_rls_security_test.sql');

console.log('--- Phase 0 Integrity Verification ---');

if (!fs.existsSync(migrationPath)) {
  console.error('FAIL: Migration file not found at', migrationPath);
  process.exit(1);
}
console.log('PASS: Migration file exists:', path.basename(migrationPath));

const sql = fs.readFileSync(migrationPath, 'utf8');

// Verify critical security sections
const checks = [
  { name: 'full_name column on profiles', pattern: /alter table public\.profiles add column if not exists full_name/i },
  { name: 'authority role added to check constraint', pattern: /check \(role in \('citizen','authority','admin'\)\)/i },
  { name: 'guard_profile_insert trigger', pattern: /create trigger profiles_guard_insert/i },
  { name: 'guard_profile_update trigger', pattern: /create trigger profiles_guard_update/i },
  { name: 'guard_report_insert trigger', pattern: /create trigger reports_guard_insert/i },
  { name: 'guard_report_update trigger', pattern: /create trigger reports_guard_update/i },
  { name: 'departments table definition', pattern: /create table if not exists public\.departments/i },
  { name: 'categories table definition', pattern: /create table if not exists public\.categories/i },
  { name: 'notifications table definition', pattern: /create table if not exists public\.notifications/i },
  { name: 'automatic report_events trigger', pattern: /create trigger reports_status_history_trigger/i },
  { name: 'updated_at trigger', pattern: /create trigger set_reports_updated_at/i },
  { name: 'location geography column and gist index', pattern: /create index if not exists reports_location_gist/i },
];

let allPassed = true;
for (const check of checks) {
  if (check.pattern.test(sql)) {
    console.log(`PASS: ${check.name}`);
  } else {
    console.error(`FAIL: Missing ${check.name}`);
    allPassed = false;
  }
}

if (!fs.existsSync(testSqlPath)) {
  console.error('FAIL: SQL test file not found at', testSqlPath);
  allPassed = false;
} else {
  console.log('PASS: SQL test suite file exists:', path.basename(testSqlPath));
}

if (!allPassed) {
  process.exit(1);
}

console.log('All Phase 0 static database migration checks PASSED.');
