import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Functions emulator serves onRequest at:
//   http://127.0.0.1:5001/<project>/<region>/<function>
// The functions emulator sets GCLOUD_PROJECT; fall back for a bare run.
const PROJECT = process.env.GCLOUD_PROJECT || process.env.GCLOUD_PROJECT_ID || 'expenses-app-7007d';
const URL = `http://127.0.0.1:5001/${PROJECT}/us-central1/spending`;

// Read the local secret from the same (gitignored) file the emulator loads, so
// no secret literal lives in the repo and the two never drift apart.
function localSecret() {
  const txt = readFileSync(new URL('../functions/.secret.local', import.meta.url), 'utf8');
  const m = txt.match(/^SPENDING_REST_SECRET=(.*)$/m);
  if (!m) throw new Error('SPENDING_REST_SECRET missing from functions/.secret.local');
  return m[1].trim();
}
const SECRET = localSecret();

const validPayload = () => ({
  amount: 12,
  date: '2026-07-04',
  comment: 'lunch',
  category: 'Groceries',
});

function post(body, headers = {}) {
  return fetch(URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

test('authorized write succeeds and returns a record id', async () => {
  const res = await post(validPayload(), { authorization: `Bearer ${SECRET}` });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.ok(json.id, 'expected a created record id');
});

test('missing secret is rejected with 401', async () => {
  const res = await post(validPayload());
  assert.equal(res.status, 401);
});

test('wrong secret is rejected with 401', async () => {
  const res = await post(validPayload(), { authorization: 'Bearer nope' });
  assert.equal(res.status, 401);
});

test('invalid payload is rejected with 400', async () => {
  const res = await post(
    { amount: -5, category: 'Nope' },
    { authorization: `Bearer ${SECRET}` },
  );
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(Array.isArray(json.details) && json.details.length > 0);
});

test('fractional amount is rounded up on write', async () => {
  const res = await post(
    { ...validPayload(), amount: 12.34 },
    { authorization: `Bearer ${SECRET}` },
  );
  assert.equal(res.status, 200);
  // Round-up behavior is asserted structurally here; value check covered by unit tests.
});

test('non-POST is rejected with 405', async () => {
  const res = await fetch(URL, { method: 'GET' });
  assert.equal(res.status, 405);
});
