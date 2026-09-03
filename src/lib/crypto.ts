/**
 * The privacy boundary.
 *
 * `scripts/encrypt-data.ts` (Node) and `src/gate/` (browser) both import this
 * module, so the two sides cannot drift apart. Both run on the standard WebCrypto
 * API — available as `globalThis.crypto` in Node 22 and in every target browser —
 * so there is exactly one implementation, not a matched pair.
 *
 * Payload framing, in order:
 *
 *   magic   8 bytes   "SECJ0001"  — lets us fail loudly on a stale/garbage file
 *   salt   16 bytes   per-payload PBKDF2 salt
 *   iv     12 bytes   per-payload AES-GCM nonce
 *   body   n bytes    AES-256-GCM ciphertext, 128-bit tag appended by WebCrypto
 *
 * Every payload gets a fresh salt and IV. Reusing an IV under one key is the
 * classic way to destroy GCM, and a per-payload salt means the two blobs
 * (roster and photos) do not share a derived key.
 */

export const MAGIC = new Uint8Array([0x53, 0x45, 0x43, 0x4a, 0x30, 0x30, 0x30, 0x31]) // "SECJ0001"
export const SALT_BYTES = 16
export const IV_BYTES = 12

/**
 * PBKDF2 is not the strongest KDF available, but it is the only one WebCrypto
 * gives us natively, and pulling in a wasm Argon2 would mean shipping it to
 * every visitor before they can unlock. 600k iterations matches OWASP's current
 * PBKDF2-SHA256 guidance and costs roughly half a second on a phone — paid once
 * per unlock, then cached.
 */
export const PBKDF2_ITERATIONS = 600_000

export class DecryptError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DecryptError'
  }
}

async function importPassphrase(passphrase: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase.normalize('NFKC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
}

export async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await importPassphrase(passphrase)
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt raw bytes into the framed payload described at the top of this file. */
export async function encryptPayload(
  plaintext: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key = await deriveKey(passphrase, salt)

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, plaintext as BufferSource),
  )

  const out = new Uint8Array(MAGIC.length + SALT_BYTES + IV_BYTES + ciphertext.length)
  out.set(MAGIC, 0)
  out.set(salt, MAGIC.length)
  out.set(iv, MAGIC.length + SALT_BYTES)
  out.set(ciphertext, MAGIC.length + SALT_BYTES + IV_BYTES)
  return out
}

/** Split a framed payload without doing any crypto, so callers can reuse a key. */
export function unframe(payload: Uint8Array): {
  salt: Uint8Array
  iv: Uint8Array
  ciphertext: Uint8Array
} {
  const headerLength = MAGIC.length + SALT_BYTES + IV_BYTES
  if (payload.length <= headerLength) {
    throw new DecryptError('Encrypted payload is truncated.')
  }
  for (let i = 0; i < MAGIC.length; i++) {
    if (payload[i] !== MAGIC[i]) {
      throw new DecryptError('Not a Section J payload — the data files look stale or corrupt.')
    }
  }
  return {
    salt: payload.subarray(MAGIC.length, MAGIC.length + SALT_BYTES),
    iv: payload.subarray(MAGIC.length + SALT_BYTES, headerLength),
    ciphertext: payload.subarray(headerLength),
  }
}

/**
 * Decrypt a framed payload.
 *
 * A wrong passphrase surfaces as a GCM tag mismatch, which WebCrypto reports as
 * a bare `OperationError`. We translate it here so the unlock screen can say
 * something a human understands.
 */
export async function decryptPayload(
  payload: Uint8Array,
  passphrase: string,
): Promise<Uint8Array> {
  const { salt, iv, ciphertext } = unframe(payload)
  const key = await deriveKey(passphrase, salt)
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      ciphertext as BufferSource,
    )
    return new Uint8Array(plaintext)
  } catch {
    throw new DecryptError('That passphrase is not right.')
  }
}

export async function decryptJSON<T>(payload: Uint8Array, passphrase: string): Promise<T> {
  const bytes = await decryptPayload(payload, passphrase)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}
