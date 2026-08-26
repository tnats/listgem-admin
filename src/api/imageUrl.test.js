import { describe, expect, it } from 'vitest';
import { imageUrl } from './imageUrl';

describe('imageUrl', () => {
  it('proxies a source that blocks hotlinks', () => {
    // Yelp answers 403 to a hotlinked image, so a Place pitch — a chef's city
    // guide is an ordinary one — would otherwise show a row of nothing.
    const url = imageUrl('https://s3-media0.fl.yelpcdn.com/bphoto/abc/o.jpg');
    expect(url).toContain('/images/proxy?url=');
    expect(url).toContain(encodeURIComponent('https://s3-media0.fl.yelpcdn.com/bphoto/abc/o.jpg'));
  });

  it('leaves everything else alone', () => {
    // Proxying TMDB through our own API would put a CDN's traffic on our
    // egress for no reason.
    const tmdb = 'https://image.tmdb.org/t/p/w200/poster.jpg';
    expect(imageUrl(tmdb)).toBe(tmdb);
  });

  it('returns null for nothing to show', () => {
    expect(imageUrl(null)).toBeNull();
    expect(imageUrl('')).toBeNull();
    expect(imageUrl(undefined)).toBeNull();
    expect(imageUrl(42)).toBeNull();
  });
});
