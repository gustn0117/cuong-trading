#!/usr/bin/env node
// Checks that only allowlisted admins can write Cuong's data and images,
// while visitors can still read everything the site shows.
//
// Usage:
//   SUPABASE_SERVICE_ROLE_KEY=... [ADMIN_EMAIL=... ADMIN_PASSWORD=...] node supabase/verify-security.mjs
//
// Prints one line per check (PASS / FAIL / SKIP) and exits 1 if any check fails.
// Probe rows (site_texts keys zz_probe_*), probe files (zz-probe/) and the throwaway
// non-admin account are always removed at the end with the service key.
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const siteScript = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const API = siteScript.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const ANON = siteScript.match(/SUPABASE_ANON\s*=\s*'([^']+)'/)[1];
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
if (!SERVICE) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required');
    process.exit(2);
}

const SCHEMA = 'cuong_trading';
const BUCKET = 'cuong-trading';
const ZERO_ID = '00000000-0000-0000-0000-000000000000';
const TAG = randomBytes(4).toString('hex');
const statuses = [];

function report(status, name, detail = '') {
    statuses.push(status);
    console.log(`${status} ${name}${detail ? ' — ' + detail : ''}`);
}
const check = (name, ok, detail) => report(ok ? 'PASS' : 'FAIL', name, detail);
const isDenied = (status) => status === 401 || status === 403;

async function call(base, method, path, token, { body, headers = {} } = {}) {
    const res = await fetch(`${API}/${base}/${path}`, {
        method,
        headers: {
            apikey: token === SERVICE ? SERVICE : ANON,
            Authorization: `Bearer ${token}`,
            ...(body !== undefined && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}),
            ...headers,
        },
        body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    return { status: res.status, json };
}

const rest = (method, path, token, { body, prefer } = {}) => call('rest/v1', method, path, token, {
    body,
    headers: { 'Accept-Profile': SCHEMA, 'Content-Profile': SCHEMA, ...(prefer ? { Prefer: prefer } : {}) },
});

const upload = (path, token) => call('storage/v1', 'POST', `object/${BUCKET}/${path}`, token, {
    body: 'security probe',
    headers: { 'Content-Type': 'text/plain', 'x-upsert': 'false' },
});

async function probeFiles() {
    const r = await call('storage/v1', 'POST', `object/list/${BUCKET}`, SERVICE, { body: { prefix: 'zz-probe', limit: 1000, offset: 0 } });
    return Array.isArray(r.json) ? r.json.map((o) => `zz-probe/${o.name}`) : [];
}

async function signIn(email, password) {
    const r = await call('auth/v1', 'POST', 'token?grant_type=password', ANON, { body: { email, password } });
    if (r.status !== 200) throw new Error(`sign-in failed for ${email}: ${r.status} ${JSON.stringify(r.json)}`);
    return r.json.access_token;
}

async function probeRowValue(key) {
    const r = await rest('GET', `site_texts?select=value_en&key=eq.${key}`, SERVICE);
    return Array.isArray(r.json) && r.json.length ? r.json[0].value_en : null;
}

// Same request the admin page's saveAllTexts()/saveSetting() send (upsert on key).
const upsertText = (token, key, value) => rest('POST', 'site_texts?on_conflict=key', token, {
    body: { key, value_en: value },
    prefer: 'resolution=merge-duplicates,return=representation',
});

// An existing file (like a review image) must survive delete and overwrite attempts.
async function tamperBlocked(label, token) {
    const victim = `zz-probe/victim-${label}-${TAG}.txt`;
    await upload(victim, SERVICE);
    const del = await call('storage/v1', 'DELETE', `object/${BUCKET}`, token, { body: { prefixes: [victim] } });
    const over = await call('storage/v1', 'POST', `object/${BUCKET}/${victim}`, token, {
        body: 'tampered',
        headers: { 'Content-Type': 'text/plain', 'x-upsert': 'true' },
    });
    const res = await fetch(`${API}/storage/v1/object/${BUCKET}/${victim}`, { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    const content = await res.text();
    check(`${label} delete/overwrite of existing file blocked`, res.status === 200 && content === 'security probe',
        `delete ${del.status} ${JSON.stringify(del.json)}, overwrite ${over.status}, file now ${res.status === 200 ? JSON.stringify(content) : 'missing'}`);
}

let probeUserId = null;
try {
    // Visitors must still read every row (the page itself filters by active).
    for (const table of ['events', 'exchanges', 'reviews', 'site_texts']) {
        const asVisitor = await rest('GET', `${table}?select=*`, ANON);
        const asServer = await rest('GET', `${table}?select=*`, SERVICE);
        const seen = Array.isArray(asVisitor.json) ? asVisitor.json.length : -1;
        const total = Array.isArray(asServer.json) ? asServer.json.length : -2;
        check(`anon read ${table}`, asVisitor.status === 200 && seen === total, `${asVisitor.status}, ${seen} of ${total} rows`);
    }

    // The public key alone must not write anything.
    let r = await rest('POST', 'site_texts', ANON, { body: { key: `zz_probe_anon_${TAG}`, value_en: 'x' } });
    check('anon insert blocked', isDenied(r.status), String(r.status));
    r = await rest('PATCH', `events?id=eq.${ZERO_ID}`, ANON, { body: { display_order: 0 } });
    check('anon update blocked', isDenied(r.status), String(r.status));
    r = await rest('DELETE', `events?id=eq.${ZERO_ID}`, ANON);
    check('anon delete blocked', isDenied(r.status), String(r.status));
    r = await upload(`zz-probe/anon-${TAG}.txt`, ANON);
    let stored = (await probeFiles()).includes(`zz-probe/anon-${TAG}.txt`);
    check('anon upload blocked', r.status >= 400 && !stored, `${r.status}${stored ? ', file was stored' : ''}`);
    await tamperBlocked('anon', ANON);

    // A signed-up account that is not on the allowlist must be refused too.
    const probeRow = `zz_probe_row_${TAG}`;
    await rest('POST', 'site_texts', SERVICE, { body: { key: probeRow, value_en: 'original' } });
    const probeEmail = `zz-probe-${TAG}@example.com`;
    const probePassword = randomBytes(18).toString('base64url');
    const created = await call('auth/v1', 'POST', 'admin/users', SERVICE, { body: { email: probeEmail, password: probePassword, email_confirm: true } });
    if (created.status !== 200) throw new Error(`could not create probe user: ${created.status} ${JSON.stringify(created.json)}`);
    probeUserId = created.json.id;
    const userToken = await signIn(probeEmail, probePassword);

    r = await rest('POST', 'rpc/is_admin', userToken, { body: {} });
    check('non-admin is_admin=false', r.status === 200 && r.json === false, `${r.status} ${JSON.stringify(r.json)}`);
    r = await rest('POST', 'site_texts', userToken, { body: { key: `zz_probe_user_${TAG}`, value_en: 'x' } });
    check('non-admin insert blocked', isDenied(r.status), String(r.status));
    r = await rest('PATCH', `site_texts?key=eq.${probeRow}`, userToken, { body: { value_en: 'changed' }, prefer: 'return=representation' });
    let value = await probeRowValue(probeRow);
    check('non-admin update blocked', (isDenied(r.status) || (r.status === 200 && r.json.length === 0)) && value === 'original', `${r.status}, value now ${JSON.stringify(value)}`);
    r = await upsertText(userToken, probeRow, 'changed-by-upsert');
    value = await probeRowValue(probeRow);
    check('non-admin upsert blocked', value === 'original', `${r.status}, value now ${JSON.stringify(value)}`);
    r = await rest('DELETE', `site_texts?key=eq.${probeRow}`, userToken, { prefer: 'return=representation' });
    value = await probeRowValue(probeRow);
    check('non-admin delete blocked', (isDenied(r.status) || (r.status === 200 && r.json.length === 0)) && value !== null, `${r.status}, row ${value === null ? 'deleted' : 'kept'}`);
    r = await upload(`zz-probe/user-${TAG}.txt`, userToken);
    stored = (await probeFiles()).includes(`zz-probe/user-${TAG}.txt`);
    check('non-admin upload blocked', r.status >= 400 && !stored, `${r.status}${stored ? ', file was stored' : ''}`);
    await tamperBlocked('non-admin', userToken);

    // Allowlisted admins can still do everything the admin page does.
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
        const adminToken = await signIn(ADMIN_EMAIL, ADMIN_PASSWORD);
        const adminRow = `zz_probe_admin_${TAG}`;
        r = await rest('POST', 'rpc/is_admin', adminToken, { body: {} });
        check('admin is_admin=true', r.status === 200 && r.json === true, `${r.status} ${JSON.stringify(r.json)}`);
        r = await rest('POST', 'site_texts', adminToken, { body: { key: adminRow, value_en: 'a' }, prefer: 'return=representation' });
        check('admin insert', r.status === 201 && r.json.length === 1, String(r.status));
        r = await rest('PATCH', `site_texts?key=eq.${adminRow}`, adminToken, { body: { value_en: 'b' }, prefer: 'return=representation' });
        check('admin update', r.status === 200 && r.json.length === 1 && r.json[0].value_en === 'b', String(r.status));
        r = await rest('DELETE', `site_texts?key=eq.${adminRow}`, adminToken, { prefer: 'return=representation' });
        check('admin delete', r.status === 200 && r.json.length === 1 && (await probeRowValue(adminRow)) === null, String(r.status));
        const upsertRow = `zz_probe_upsert_${TAG}`;
        r = await upsertText(adminToken, upsertRow, 'first');
        const inserted = (await probeRowValue(upsertRow)) === 'first';
        const second = await upsertText(adminToken, upsertRow, 'second');
        check('admin upsert (new key, then existing key)', inserted && second.status < 300 && (await probeRowValue(upsertRow)) === 'second',
            `${r.status} then ${second.status}`);
        const adminFile = `zz-probe/admin-${TAG}.txt`;
        r = await upload(adminFile, adminToken);
        check('admin upload', r.status === 200 && (await probeFiles()).includes(adminFile), String(r.status));
        r = await call('storage/v1', 'DELETE', `object/${BUCKET}`, adminToken, { body: { prefixes: [adminFile] } });
        check('admin remove', r.status === 200 && !(await probeFiles()).includes(adminFile), String(r.status));
    } else {
        report('SKIP', 'admin checks', 'ADMIN_EMAIL / ADMIN_PASSWORD not set');
    }

    // Review images must still load for visitors.
    r = await rest('GET', 'reviews?select=image_url&limit=1', ANON);
    const image = Array.isArray(r.json) && r.json[0] ? await fetch(r.json[0].image_url) : null;
    check('public image', image?.status === 200, image ? String(image.status) : 'no review rows');
} catch (e) {
    report('FAIL', 'run aborted', e.message);
} finally {
    await rest('DELETE', 'site_texts?key=like.zz_probe_*', SERVICE);
    let leftover = await probeFiles();
    if (leftover.length) await call('storage/v1', 'DELETE', `object/${BUCKET}`, SERVICE, { body: { prefixes: leftover } });
    let userGone = true;
    if (probeUserId) userGone = (await call('auth/v1', 'DELETE', `admin/users/${probeUserId}`, SERVICE)).status === 200;
    const rows = await rest('GET', 'site_texts?select=key&key=like.zz_probe_*', SERVICE);
    leftover = await probeFiles();
    check('cleanup', rows.json?.length === 0 && leftover.length === 0 && userGone,
        `${rows.json?.length} probe rows, ${leftover.length} probe files, probe user ${userGone ? 'deleted' : 'NOT deleted'}`);
}

process.exit(statuses.includes('FAIL') ? 1 : 0);
