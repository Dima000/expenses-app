/**
 * Pure path helpers for demo mode. Demo-ness lives in the URL *path* (not a
 * query param) so it survives `setSearchParams` — React Router's setter
 * replaces the whole query string, which would silently drop a `?demo=1` on
 * every Reports period switch.
 *
 * These are plain string functions on purpose: they hold the parts most likely
 * to be subtly wrong (path matching, base prefixing) and are unit-testable in
 * the `node` vitest environment, which has no DOM.
 */

/** Base path the app is mounted at a second time, backed by `DemoDataSource`. */
export const DEMO_BASE = '/demo';

/** The normal, Firestore-backed base. */
export const ROOT_BASE = '/';

/**
 * True for `/demo` and anything under `/demo/`. The exact-match arm is what
 * keeps lookalikes such as `/democracy` out — a bare `startsWith('/demo')`
 * would match them.
 */
export function isDemoPath(pathname: string): boolean {
  return pathname === DEMO_BASE || pathname.startsWith(`${DEMO_BASE}/`);
}

/**
 * Prefix an app-relative path (`/reports?unit=month`) with the active base, so
 * navigating inside the demo stays inside the demo. The `path === '/'` arm
 * yields `/demo` rather than `/demo/`, keeping the demo dashboard URL clean.
 */
export function withBase(base: string, path: string): string {
  if (base === ROOT_BASE) return path;
  return path === ROOT_BASE ? base : `${base}${path}`;
}
