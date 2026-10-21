import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_ANON_KEY;
const BUCKET = 'report-images';

const fresh = () => createClient(URL, KEY, { auth: { persistSession: false } });

async function login(email, password) {
  const c = fresh();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Login failed for ${email}: ${error.message}`);
  return { c, id: data.user.id };
}

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + extra}`);
  ok ? pass++ : fail++;
}
const blocked = (r) => !!r.error || (Array.isArray(r.data) && r.data.length === 0);

const A = await login(process.env.CITIZEN_A_EMAIL, process.env.CITIZEN_A_PASSWORD);
const B = await login(process.env.CITIZEN_B_EMAIL, process.env.CITIZEN_B_PASSWORD);
const ADMIN = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
const anon = fresh();

console.log('\n--- Reports ---');
const ins = await A.c.from('reports').insert({ description: 'perm-test A' }).select().single();
check('Citizen A can create own report', !ins.error && !!ins.data, ins.error?.message);
console.log('       report_code generated:', ins.data?.report_code);
const rid = ins.data?.id;

const bSee = await B.c.from('reports').select('id').eq('id', rid);
check('Citizen B can NOT see A report', !bSee.error && bSee.data.length === 0, JSON.stringify(bSee));

const bUpd = await B.c.from('reports').update({ status: 'resolved' }).eq('id', rid).select();
check('Citizen B can NOT update A report', blocked(bUpd), JSON.stringify(bUpd.data));

const aUpd = await A.c.from('reports').update({ status: 'resolved' }).eq('id', rid).select();
check('Citizen A can NOT change own status', blocked(aUpd), JSON.stringify(aUpd.data));

const fake = await A.c.from('reports').insert({ user_id: B.id, description: 'perm-test fake' }).select();
check('Citizen A can NOT create report for B', !!fake.error, 'insert succeeded!');

const aDel = await A.c.from('reports').delete().eq('id', rid).select();
check('Citizen A can NOT delete report', blocked(aDel), JSON.stringify(aDel.data));

const aRole = await A.c.from('profiles').update({ role: 'admin' }).eq('id', A.id).select();
check('Citizen A can NOT make himself admin', blocked(aRole), JSON.stringify(aRole.data));

const aProfiles = await A.c.from('profiles').select('id');
check('Citizen A sees only own profile', !aProfiles.error && aProfiles.data.length === 1, `saw ${aProfiles.data?.length}`);

const anonRead = await anon.from('reports').select('id');
check('Not-logged-in user can NOT read reports', !!anonRead.error, 'anon could read!');

console.log('\n--- Admin ---');
const adSee = await ADMIN.c.from('reports').select('id').eq('id', rid);
check('Admin can see A report', !adSee.error && adSee.data.length === 1, JSON.stringify(adSee));

const adUpd = await ADMIN.c.from('reports')
  .update({ status: 'assigned', user_id: B.id }).eq('id', rid).select();
check('Admin can change status', !adUpd.error && adUpd.data?.[0]?.status === 'assigned', adUpd.error?.message);
check('Admin can NOT change user_id (guard trigger)', adUpd.data?.[0]?.user_id === A.id, 'user_id changed!');

console.log('\n--- Citizen sees the update + history ---');
const aSee = await A.c.from('reports').select('status').eq('id', rid).single();
check('Citizen A sees new status "assigned"', aSee.data?.status === 'assigned', JSON.stringify(aSee));

const aEv = await A.c.from('report_events').select('old_status,new_status').eq('report_id', rid);
check('History logged automatically (submitted -> assigned)',
  aEv.data?.length === 1 && aEv.data[0].old_status === 'submitted' && aEv.data[0].new_status === 'assigned',
  JSON.stringify(aEv));

const bEv = await B.c.from('report_events').select('id').eq('report_id', rid);
check('Citizen B can NOT see A history', !bEv.error && bEv.data.length === 0, JSON.stringify(bEv));

const evIns = await A.c.from('report_events').insert({ report_id: rid, new_status: 'resolved' });
check('Citizen can NOT write fake history', !!evIns.error, 'insert succeeded!');

console.log('\n--- Storage ---');
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64');
const path = `${A.id}/perm-test-${Date.now()}.png`;
const st = A.c.storage.from(BUCKET);

const up1 = await st.upload(path, png, { contentType: 'image/png' });
check('Citizen A can upload to own folder', !up1.error, up1.error?.message);

const up2 = await st.upload(`${B.id}/perm-test-${Date.now()}.png`, png, { contentType: 'image/png' });
check('Citizen A can NOT upload to B folder', !!up2.error, 'upload succeeded!');

const up3 = await st.upload(`${A.id}/perm-test-${Date.now()}.txt`, Buffer.from('hello'), { contentType: 'text/plain' });
check('Non-image file is rejected', !!up3.error, 'text file accepted!');

const dlA = await st.download(path);
check('Citizen A can read own image', !dlA.error, dlA.error?.message);

const dlB = await B.c.storage.from(BUCKET).download(path);
check('Citizen B can NOT read A image', !!dlB.error, 'B downloaded it!');

const dlAd = await ADMIN.c.storage.from(BUCKET).download(path);
check('Admin can read A image', !dlAd.error, dlAd.error?.message);

console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);