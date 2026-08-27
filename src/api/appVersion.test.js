import { describe, expect, it, vi } from 'vitest';
import { fetchDeployedAssetId, isStale, loadedAssetId, parseAssetId } from './appVersion';

const HTML = `<!doctype html><html><head>
  <script type="module" crossorigin src="/assets/index-DDsq6xfd.js"></script>
  <link rel="stylesheet" href="/assets/index-BqT1.css">
</head><body><div id="root"></div></body></html>`;

describe('appVersion', () => {
  it('reads the fingerprinted bundle as the build id', () => {
    expect(parseAssetId(HTML)).toBe('index-DDsq6xfd.js');
  });

  it('returns null when there is nothing to read', () => {
    expect(parseAssetId('<html></html>')).toBeNull();
    expect(parseAssetId('')).toBeNull();
    expect(parseAssetId(null)).toBeNull();
  });

  it('finds the bundle this tab loaded', () => {
    const doc = new DOMParser().parseFromString(HTML, 'text/html');
    expect(loadedAssetId(doc)).toBe('index-DDsq6xfd.js');
  });

  it('asks the origin without a cache, or it would report our own build forever', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => HTML });
    await expect(fetchDeployedAssetId(fetchImpl)).resolves.toBe('index-DDsq6xfd.js');
    expect(fetchImpl).toHaveBeenCalledWith('/index.html', { cache: 'no-store' });
  });

  it('throws rather than guessing when the origin errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(fetchDeployedAssetId(fetchImpl)).rejects.toThrow(/503/);
  });

  it('calls a tab stale only when both ids are known and differ', () => {
    expect(isStale('index-a.js', 'index-b.js')).toBe(true);
    expect(isStale('index-a.js', 'index-a.js')).toBe(false);
    // Unknown is never stale: nagging someone because a fetch failed teaches
    // them to ignore the one message that matters.
    expect(isStale(null, 'index-b.js')).toBe(false);
    expect(isStale('index-a.js', null)).toBe(false);
    expect(isStale(null, null)).toBe(false);
  });
});
