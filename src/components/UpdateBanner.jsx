import { useEffect, useState } from 'react';
import { fetchDeployedAssetId, isStale, loadedAssetId } from '../api/appVersion';

const CHECK_EVERY_MS = 5 * 60 * 1000;

/**
 * Tells the operator when the tab is behind what's deployed.
 *
 * Not a forced reload: a builder can hold unsaved rows, and taking the page
 * out from under someone mid-adjudication would be its own bug. Drafts do
 * survive a reload now, so the cost of saying yes is low — but it stays their
 * call.
 */
export default function UpdateBanner() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // Dev serves no fingerprinted bundle, so there is nothing to compare.
    if (!import.meta.env.PROD) return undefined;
    const loaded = loadedAssetId();
    if (!loaded) return undefined;

    let cancelled = false;
    async function check() {
      try {
        const deployed = await fetchDeployedAssetId();
        if (!cancelled && isStale(loaded, deployed)) setStale(true);
      } catch {
        // Offline, or the origin hiccupped. Silence is right: an unreachable
        // check says nothing about which build is deployed.
      }
    }
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    // A tab left open for hours is exactly the case this exists for, and it
    // wakes up when someone comes back to it.
    window.addEventListener('focus', check);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('focus', check);
    };
  }, []);

  if (!stale) return null;
  return (
    <div className="flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
      <span>
        <span className="font-medium">This page is running an older version.</span> Newer builds change
        what the controls do and what the warnings say — reload before you rely on them.
      </span>
      <button
        onClick={() => window.location.reload()}
        className="ml-auto rounded border border-amber-300 bg-white px-2 py-0.5 font-medium hover:bg-amber-100"
      >
        Reload
      </button>
    </div>
  );
}
