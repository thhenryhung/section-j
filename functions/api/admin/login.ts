/**
 * POST /api/admin/login — the only place the admin passphrase is ever checked.
 *
 * Rate-limited by client IP before the passphrase comparison even runs, so a
 * brute-force attempt burns through the lockout window before it burns
 * through guesses. Success sets an HttpOnly session cookie; the raw
 * passphrase and the derived hash never leave this function.
 */

import { signAdminSession, verifyAdminPassphrase } from '../../../src/lib/adminAuth'

interface Env {
  EVENTS_KV: KVNamespace
  ADMIN_PASSPHRASE_HASH: string
  ADMIN_SESSION_SECRET: string
}

const SESSION_COOKIE = 'section-admin-session'
const SESSION_TTL_MS = 2 * 60 * 60 * 1000 // 2 hours

const RATE_LIMIT_WINDOW_SECONDS = 5 * 60
const RATE_LIMIT_MAX_ATTEMPTS = 8

function rateLimitKey(ip: string): string {
  return `admin-login-attempts:${ip}`
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'

  const attemptsRaw = await env.EVENTS_KV.get(rateLimitKey(ip))
  const attempts = attemptsRaw ? Number(attemptsRaw) : 0
  if (attempts >= RATE_LIMIT_MAX_ATTEMPTS) {
    return new Response(JSON.stringify({ error: 'Too many attempts. Try again later.' }), {
      status: 429,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let passphrase: string
  try {
    const body = (await request.json()) as { passphrase?: unknown }
    if (typeof body.passphrase !== 'string' || !body.passphrase) throw new Error('missing passphrase')
    passphrase = body.passphrase
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const ok = env.ADMIN_PASSPHRASE_HASH
    ? await verifyAdminPassphrase(passphrase, env.ADMIN_PASSPHRASE_HASH)
    : false

  if (!ok) {
    await env.EVENTS_KV.put(rateLimitKey(ip), String(attempts + 1), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS,
    })
    // Generic failure message — don't distinguish "wrong passphrase" from "locked out"
    // beyond the 429 above, to avoid giving an attacker a signal either way.
    return new Response(JSON.stringify({ error: 'That passphrase is not right.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  await env.EVENTS_KV.delete(rateLimitKey(ip))

  const issuedAt = Date.now()
  const token = await signAdminSession(
    { issuedAt, exp: issuedAt + SESSION_TTL_MS },
    env.ADMIN_SESSION_SECRET,
  )

  const cookie = [
    `${SESSION_COOKIE}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ].join('; ')

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookie },
  })
}
