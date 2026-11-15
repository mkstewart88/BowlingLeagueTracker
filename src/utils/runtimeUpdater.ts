import { compareSemverVersions } from './githubUpdater';

const RUNTIME_DB_NAME = 'BowlingLeagueHelperRuntime';
const RUNTIME_STORE_NAME = 'runtimeBundles';
const RUNTIME_BUNDLE_KEY = 'latestAppHtml';

export interface CachedRuntimeBundle {
  version: string;
  html: string;
  updatedAt: string;
}

function openRuntimeDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, 1200);
    try {
      const req = indexedDB.open(RUNTIME_DB_NAME, 1);
      req.onupgradeneeded = () => {
        try {
          const db = req.result;
          if (!db.objectStoreNames.contains(RUNTIME_STORE_NAME)) {
            db.createObjectStore(RUNTIME_STORE_NAME);
          }
        } catch {
          // Ignore schema upgrade issues
        }
      };
      req.onsuccess = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(req.result);
        }
      };
      req.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(null);
        }
      };
    } catch {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    }
  });
}

export function injectBootFromCacheFlag(html: string, version: string): string {
  const cleaned = stripBootFromCacheFlag(html);
  const sOpen = String.fromCharCode(60) + 'script';
  const sClose = String.fromCharCode(60, 47) + 'script' + String.fromCharCode(62);
  const flagScript = `${sOpen} id="bowling-runtime-boot-flag">window.__BOWLING_BOOTED_FROM_CACHE__=${JSON.stringify({
    version,
  })};${sClose}`;
  const headMatch = cleaned.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index !== undefined) {
    const insertPos = headMatch.index + headMatch[0].length;
    return cleaned.slice(0, insertPos) + flagScript + cleaned.slice(insertPos);
  }
  return flagScript + cleaned;
}

export function stripBootFromCacheFlag(html: string): string {
  const sOpen = String.fromCharCode(60) + 'script';
  const sClose = String.fromCharCode(60, 47) + 'script' + String.fromCharCode(62);
  return html.replace(
    new RegExp(
      `${sOpen}[^>]*id=["']bowling-runtime-boot-flag["'][^>]*>[\\s\\S]*?${sClose}`,
      'gi'
    ),
    ''
  );
}

export function isValidAppHtmlBundle(html: string): boolean {
  return (
    typeof html === 'string' &&
    html.includes('id="root"') &&
    html.includes('<script') &&
    html.length > 5000
  );
}

export async function saveUpdatedRuntimeBundle(
  version: string,
  html: string
): Promise<boolean> {
  if (!isValidAppHtmlBundle(html)) return false;
  const cleanHtml = stripBootFromCacheFlag(html);
  const record: CachedRuntimeBundle = {
    version,
    html: cleanHtml,
    updatedAt: new Date().toISOString(),
  };

  const db = await openRuntimeDb();
  if (!db) return false;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RUNTIME_STORE_NAME, 'readwrite');
      const store = tx.objectStore(RUNTIME_STORE_NAME);
      const req = store.put(record, RUNTIME_BUNDLE_KEY);
      req.onsuccess = () => resolve(true);
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function loadUpdatedRuntimeBundle(): Promise<CachedRuntimeBundle | null> {
  const db = await openRuntimeDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RUNTIME_STORE_NAME, 'readonly');
      const store = tx.objectStore(RUNTIME_STORE_NAME);
      const req = store.get(RUNTIME_BUNDLE_KEY);
      req.onsuccess = () => {
        const res = req.result as CachedRuntimeBundle | undefined;
        if (res && typeof res.version === 'string' && isValidAppHtmlBundle(res.html)) {
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function clearUpdatedRuntimeBundle(): Promise<void> {
  const db = await openRuntimeDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(RUNTIME_STORE_NAME, 'readwrite');
      const store = tx.objectStore(RUNTIME_STORE_NAME);
      const req = store.delete(RUNTIME_BUNDLE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/**
 * Checks whether a newer compiled single-file HTML release has already been installed
 * into browser IndexedDB and swaps the live style + module runtime into that newer release automatically.
 * Returns `true` if a newer cached version took over booting (so caller should NOT mount old UI).
 */
export async function maybeBootUpdatedRuntime(builtInVersion: string): Promise<boolean> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const win = window as unknown as {
    __BOWLING_BOOTED_FROM_CACHE__?: { version?: string };
  };
  if (win.__BOWLING_BOOTED_FROM_CACHE__) {
    return false;
  }

  try {
    const cached = await loadUpdatedRuntimeBundle();
    if (!cached) return false;

    const cmp = compareSemverVersions(cached.version, builtInVersion);
    if (cmp > 0 && typeof DOMParser !== 'undefined') {
      const parsed = new DOMParser().parseFromString(cached.html, 'text/html');
      const newStyles = Array.from(parsed.head.querySelectorAll('style'));
      const newModuleScripts = Array.from(parsed.querySelectorAll('script[type="module"]'));

      if (newModuleScripts.length > 0) {
        win.__BOWLING_BOOTED_FROM_CACHE__ = { version: cached.version };

        document.head.querySelectorAll('style').forEach((s) => s.remove());
        for (const s of newStyles) {
          const styleEl = document.createElement('style');
          styleEl.textContent = s.textContent || '';
          document.head.appendChild(styleEl);
        }

        const rootEl = document.getElementById('root');
        if (rootEl) rootEl.innerHTML = '';

        for (const modScript of newModuleScripts) {
          const scriptEl = document.createElement('script');
          scriptEl.type = 'module';
          scriptEl.textContent = modScript.textContent || '';
          document.body.appendChild(scriptEl);
        }
        return true;
      }
    }

    // If the file on disk is now >= cached version, discard redundant older cache
    if (cmp <= 0) {
      clearUpdatedRuntimeBundle().catch(() => {});
    }
  } catch {
    // Fall back to mounting the built-in HTML bundle safely
  }
  return false;
}
