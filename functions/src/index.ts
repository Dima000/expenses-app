import { initializeApp } from 'firebase-admin/app';
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret, defineString } from 'firebase-functions/params';
import { SpendingValidationError } from '@expenses/shared';
import { recordSpending } from './recordSpending.js';

initializeApp();

/**
 * The long-lived shared secret for the machine (REST) auth boundary
 * (design.md D7). Provisioned in Secret Manager; rotate per README.
 */
const SPENDING_REST_SECRET = defineSecret('SPENDING_REST_SECRET');

/**
 * The single owner's Firebase Auth UID. The REST caller has no browser
 * identity, so the server stamps every REST-written record with this UID.
 */
const OWNER_UID = defineString('OWNER_UID');

/**
 * Constant-time-ish comparison to avoid leaking the secret length/prefix via
 * early-exit timing. Both strings are short and server-side; this is belt-and-braces.
 */
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Pull the presented secret from `Authorization: Bearer` or `x-api-key`. */
function presentedSecret(req: { get(name: string): string | undefined }): string {
  const auth = req.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return (req.get('x-api-key') ?? '').trim();
}

/**
 * `POST /spending` — authenticated REST write adapter (design.md D2/D7).
 * Verifies the shared secret, then writes via the shared `recordSpending()`.
 *   401 — missing/incorrect secret (no record written)
 *   400 — invalid payload
 *   405 — non-POST
 *   200 — `{ id }` of the created record
 */
export const spending = onRequest(
  // Kept PRIVATE for now (owner's choice): Cloud Run blocks unauthenticated
  // callers at the network layer, so the REST path is not usable yet. To turn
  // it on later, change `invoker` to 'public' and redeploy — the shared-secret
  // check below is then the auth gate (design.md D7 — machine boundary).
  { secrets: [SPENDING_REST_SECRET], cors: false, invoker: 'private' },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'method not allowed' });
      return;
    }

    const expected = SPENDING_REST_SECRET.value();
    const presented = presentedSecret(req);
    if (!expected || !presented || !secretsMatch(presented, expected)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    try {
      const id = await recordSpending(req.body, {
        ownerUid: OWNER_UID.value(),
        source: 'rest',
      });
      res.status(200).json({ id });
    } catch (err) {
      if (err instanceof SpendingValidationError) {
        res.status(400).json({ error: 'invalid payload', details: err.errors });
        return;
      }
      console.error('recordSpending failed', err);
      res.status(500).json({ error: 'internal error' });
    }
  },
);
