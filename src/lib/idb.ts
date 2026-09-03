/**
 * A three-function IndexedDB wrapper.
 *
 * Used only to cache the *decrypted* roster and photo bundle, so that reloading
 * the site does not mean re-running a 600k-iteration key derivation and
 * re-decrypting three megabytes of images every time.
 *
 * Because this stores plaintext personal data on disk, the gate only writes here
 * when the visitor has explicitly chosen "remember on this device" — the same
 * choice that already persists their passphrase. Otherwise everything stays in
 * memory and dies with the tab.
 */

const DB_NAME = 'section-j'
const STORE = 'cache'
const DB_VERSION = 1

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function idbGet<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open()
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      request.onsuccess = () => resolve(request.result as T | undefined)
      request.onerror = () => reject(request.error)
    })
  } catch {
    // Private browsing and locked-down browsers can refuse IndexedDB outright.
    // A cache miss is always survivable, so never let this break the app.
    return undefined
  }
}

export async function idbSet(key: string, value: unknown): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* caching is best-effort */
  }
}

export async function idbClear(): Promise<void> {
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    /* nothing to clear */
  }
}
