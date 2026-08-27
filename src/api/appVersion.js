/**
 * Whether the tab is running the build that's currently deployed.
 *
 * An operator kept a builder tab open across three deploys and worked against
 * a field whose label had since been corrected — the one that used to say a
 * note was internal when it was copied onto the target's list. They followed
 * the label, and the note reached a stranger's list. The guards are most of
 * this tool's value, and a stale tab silently has the old ones.
 *
 * Vite fingerprints the entry bundle, so the filename in index.html IS the
 * build id. No build-time config, nothing to keep in sync.
 */

/** The hashed entry bundle named by a copy of index.html. */
export function parseAssetId(html) {
  const m = String(html || '').match(/\/assets\/(index-[A-Za-z0-9_-]+\.js)/);
  return m ? m[1] : null;
}

/** The one this tab actually loaded. */
export function loadedAssetId(doc = document) {
  for (const el of doc.querySelectorAll('script[src]')) {
    const id = parseAssetId(el.getAttribute('src'));
    if (id) return id;
  }
  return null;
}

/**
 * Ask the origin what it's serving now. `no-store` matters: a cached copy of
 * index.html would report the build we already have, forever.
 */
export async function fetchDeployedAssetId(fetchImpl = fetch) {
  const res = await fetchImpl('/index.html', { cache: 'no-store' });
  if (!res.ok) throw new Error(`index.html ${res.status}`);
  return parseAssetId(await res.text());
}

/**
 * True only when both ids are known and differ. Unknown is never "stale":
 * nagging someone to reload because a fetch failed would train them to ignore
 * the one message that matters.
 */
export function isStale(loaded, deployed) {
  return !!loaded && !!deployed && loaded !== deployed;
}
