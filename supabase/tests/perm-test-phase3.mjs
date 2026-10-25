import { createClient } from '@supabase/supabase-js';

const need = (k) => {
  const v = process.env[k];
  if (!v) { console.error(`Missing env var ${k}`); process.exit(2); }
  return v;
};
const URL = need('SUPABASE_URL');
const KEY = need('SUPABASE_ANON_KEY');
const BUCKET = 'report-images';
const GHOST = '00000000-0000-0000-0000-000000000000'; // no such row: a "successful" write touches nothing

const fresh = () => createClient(URL, KEY, { auth: { persistSession: false } });
async function login(email, password) {
  const c = fresh();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

let pass = 0, fail = 0;
const check = (name, ok, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`);
  ok ? pass++ : fail++;
};
const denied = (r) => !!r.error && /permission denied|row-level security/i.test(r.error.message);
const noAccess = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0);

const A = await login(need('CITIZEN_A_EMAIL'), need('CITIZEN_A_PASSWORD'));
const B = await login(need('CITIZEN_B_EMAIL'), need('CITIZEN_B_PASSWORD'));
const AD = await login(need('ADMIN_EMAIL'), need('ADMIN_PASSWORD'));
const anon = fresh();
const created = [];

console.log('\n--- Reads: RLS limits what each user sees ---');
const aRep = await A.c.from('reports').select('id,user_id');
check('Citizen A reads only own reports', !aRep.error && aRep.data.every((r) => r.user_id === A.id), aRep.error?.message);
const aIds = (aRep.data ?? []).map((r) => r.id);

const aEv = await A.c.from('report_events').select('report_id');
check('Citizen A sees history of own reports only', !aEv.error && aEv.data.every((e) => aIds.includes(e.report_id)), aEv.error?.message);

const aNo = await A.c.from('notifications').select('user_id');
check('Citizen A sees only own notifications', !aNo.error && aNo.data.every((n) => n.user_id === A.id), aNo.error?.message);

const aAi = await A.c.from('ai_requests').select('user_id');
check('Citizen A sees only own ai_requests', !aAi.error && aAi.data.every((x) => x.user_id === A.id), aAi.error?.message);

const aProf = await A.c.from('profiles').select('id');
check('Citizen A sees only own profile', !aProf.error && aProf.data.length === 1 && aProf.data[0].id === A.id, aProf.error?.message);

const adRep = await AD.c.from('reports').select('id');
check('Admin reads at least as many reports as A', !adRep.error && adRep.data.length >= (aRep.data?.length ?? 0), adRep.error?.message);

console.log('\n--- Not logged in ---');
for (const t of ['reports', 'profiles', 'notifications', 'ai_requests', 'report_events']) {
  const r = await anon.from(t).select('*').limit(1);
  check(`anon cannot read ${t}`, noAccess(r), JSON.stringify(r.data));
}
const dep = await anon.from('departments').select('id').limit(1);
check('anon can read departments (intended)', !dep.error, dep.error?.message);

console.log('\n--- Direct writes must be DENIED (writes go through the API) ---');
for (const [label, c] of [['Citizen A', A.c], ['anon', anon]]) {
  const r = await c.from('reports').insert({ description: 'perm-test direct insert (should be denied)' }).select('id');
  if (r.data?.length) created.push(...r.data.map((x) => x.id));
  check(`${label} cannot insert a report directly`, denied(r), r.error?.message ?? 'INSERT SUCCEEDED');
}
for (const [label, c] of [['Citizen A', A.c], ['Admin', AD.c]]) {
  const u = await c.from('reports').update({ status: 'submitted' }).eq('id', GHOST).select('id');
  check(`${label} cannot update reports directly`, denied(u), u.error?.message ?? 'no error = privilege exists');
  const d = await c.from('reports').delete().eq('id', GHOST).select('id');
  check(`${label} cannot delete reports`, denied(d), d.error?.message ?? 'no error = privilege exists');
  const e = await c.from('report_events').insert({ report_id: GHOST, new_status: 'resolved' });
  check(`${label} cannot insert report_events`, denied(e), e.error?.message ?? 'INSERT SUCCEEDED');
}
const n = await A.c.from('notifications').insert({ user_id: A.id, type: 'x', title: 'x', body: 'x' });
check('Citizen A cannot create notifications', denied(n), n.error?.message ?? 'INSERT SUCCEEDED');
const role = await A.c.from('profiles').update({ role: 'citizen' }).eq('id', A.id).select('id');
check('Citizen A cannot touch own role column', denied(role), role.error?.message ?? 'no error = column privilege exists');
const dept = await A.c.from('profiles').update({ department_id: null }).eq('id', A.id).select('id');
check('Citizen A cannot touch own department_id', denied(dept), dept.error?.message ?? 'no error = column privilege exists');

console.log('\n--- Functions ---');
const f1 = await anon.rpc('is_admin');
check('anon cannot call is_admin()', !!f1.error, 'anon could call it');
const f2 = await A.c.rpc('is_admin');
check('Citizen A can call is_admin() and gets false', !f2.error && f2.data === false, f2.error?.message);
const f3 = await A.c.rpc('guard_report_update');
check('Citizen A cannot call guard_report_update()', !!f3.error, 'call was accepted');

console.log('\n--- Storage ---');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const st = A.c.storage.from(BUCKET);
const up1 = await st.upload(`${B.id}/perm-test-${Date.now()}.png`, png, { contentType: 'image/png' });
check('Citizen A cannot upload into B folder', !!up1.error, 'upload succeeded');
const up2 = await st.upload(`${A.id}/perm-test-${Date.now()}.txt`, Buffer.from('x'), { contentType: 'text/plain' });
check('Non-image file is rejected', !!up2.error, 'text file accepted');
const up3 = await anon.storage.from(BUCKET).upload(`${A.id}/perm-test-${Date.now()}.png`, png, { contentType: 'image/png' });
check('anon cannot upload', !!up3.error, 'upload succeeded');
const ls = await st.list(B.id);
check('Citizen A cannot list B folder', !ls.error && ls.data.length === 0, ls.error?.message ?? 'saw files');

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
if (created.length) {
  console.log('\nTest rows were created by mistake. Clean them in the SQL Editor:');
  console.log("delete from public.reports where description like 'perm-test%';");
}
process.exit(fail ? 1 : 0);