import { beforeEach } from 'vitest';

/**
 * The builder now persists an in-progress build to sessionStorage, so state
 * leaks between tests unless it's cleared: a draft saved by one case restores
 * into the next, and the failure looks like a component bug rather than test
 * contamination.
 */
beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
