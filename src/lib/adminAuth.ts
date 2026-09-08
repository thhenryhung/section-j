/**
 * Admin passphrase hashing and session-cookie signing, shared between
 * `scripts/hash-admin-passphrase.ts` (Node, run once to produce
 * ADMIN_PASSPHRASE_HASH) and `functions/api/admin/*.ts` (Cloudflare Workers
 * runtime, checking a login attempt against that hash). Both environments
 * expose the same WebCrypto `crypto.subtle` API, so this is one
 * implementation, not a matched pair — the same reasoning as `src/lib/crypto.ts`.
 *
 * This is deliberately a *separate* module and a *separate* secret from
 * `src/lib/crypto.ts`'s SECTION_PASSPHRASE flow: the admin passphrase guards
 * write access, not the roster's confidentiality, and must never be
 * derivable from or interchangeable with the section passphrase.
 */

// The Workers runtime rejects PBKDF2 above 100k iterations ("iteration counts
// above 100000 are not supported") even though Node and browsers allow far
// more — unlike src/lib/crypto.ts, this hash is verified inside a Function,
// so it's capped at what that runtime actually accepts.
const HASH_ITERATIONS = 100_000
const SALT_BYTES = 16
const HASH_BYTES = 32

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveBits(passphrase: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  )
  return new Uint8Array(bits)
}

/** Produces the `salt:iterations:hash` string stored as ADMIN_PASSPHRASE_HASH. */
export async function hashAdminPassphrase(passphrase: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const hash = await deriveBits(passphrase, salt, HASH_ITERATIONS)
  return `${toBase64(salt)}:${HASH_ITERATIONS}:${toBase64(hash)}`
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

/** Verifies a login attempt against a stored `salt:iterations:hash` string. */
export async function verifyAdminPassphrase(passphrase: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const [saltB64, iterationsStr, hashB64] = parts
  const iterations = Number(iterationsStr)
  if (!Number.isFinite(iterations) || iterations <= 0) return false
  const salt = fromBase64(saltB64)
  const expected = fromBase64(hashB64)
  const actual = await deriveBits(passphrase, salt, iterations)
  return timingSafeEqual(actual, expected)
}

export type AdminSessionPayload = { issuedAt: number; exp: number }

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  )
}

/** Signs `{issuedAt, exp}` into a compact `payload.signature` token for the session cookie. */
export async function signAdminSession(payload: AdminSessionPayload, secret: string): Promise<string> {
  const payloadB64 = toBase64(new TextEncoder().encode(JSON.stringify(payload)))
  const key = await hmacKey(secret)
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64))
  return `${payloadB64}.${toBase64(new Uint8Array(signature))}`
}

/** Verifies a session token, returning the payload if the signature is valid and it hasn't expired. */
export async function verifyAdminSession(token: string, secret: string): Promise<AdminSessionPayload | null> {
  const dot = token.indexOf('.')
  if (dot < 0) return null
  const payloadB64 = token.slice(0, dot)
  const signatureB64 = token.slice(dot + 1)
  const key = await hmacKey(secret)
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    fromBase64(signatureB64) as BufferSource,
    new TextEncoder().encode(payloadB64),
  )
  if (!valid) return null
  try {
    const payload = JSON.parse(new TextDecoder().decode(fromBase64(payloadB64))) as AdminSessionPayload
    if (typeof payload.exp !== 'number' || Date.now() >= payload.exp) return null
    return payload
  } catch {
    return null
  }
}
