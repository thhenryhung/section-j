/**
 * Shared by every functions/api/admin/* route. Files/folders under functions/
 * prefixed with `_` are excluded from Cloudflare Pages' file-based routing, so
 * this is the conventional place for helpers that aren't routes themselves.
 */

import { verifyAdminSession } from '../../src/lib/adminAuth'

const SESSION_COOKIE = 'section-admin-session'

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return null
}

/**
 * Independently re-verifies the signed session cookie on every call — never
 * trust a client-supplied "I'm an admin" flag. This is the exact trust
 * boundary that was missing from the admin panel removed in commit 058a06e.
 */
export async function requireAdminSession(request: Request, sessionSecret: string): Promise<boolean> {
  const token = readCookie(request, SESSION_COOKIE)
  if (!token) return false
  const payload = await verifyAdminSession(token, sessionSecret)
  return payload !== null
}
