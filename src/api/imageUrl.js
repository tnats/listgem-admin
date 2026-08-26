/**
 * Cover art, routed through the API's proxy where the source hotlink-blocks.
 *
 * Mirrors the web app's `getImageUrl` (listgem-website `src/lib/image-proxy.ts`).
 * Yelp serves 403 to a hotlinked image, so a Place list — a chef's city guide
 * is an ordinary pitch, not a hypothetical — would show a row of nothing.
 *
 * Kept as a list rather than a proxy-everything rule: proxying TMDB posters
 * through our own API would put a CDN's traffic on our egress for no reason.
 */
const HOTLINK_BLOCKED = ['yelpcdn.com'];

const API_URL = import.meta.env.DEV ? '' : import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function imageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  return HOTLINK_BLOCKED.some(host => url.includes(host))
    ? `${API_URL}/images/proxy?url=${encodeURIComponent(url)}`
    : url;
}
