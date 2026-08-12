// Registry taxonomy facts shared across admin surfaces.

/**
 * Types the taxonomy retired but that still exist in the registry — and, notably,
 * are still returned by `GET /types` with `supported: true` and counts of 1–2.
 *
 * The Pipeline page's Taxonomy Health panel (#456) tracks sightings of these as
 * drift, so no admin picker may offer them: creating new rows under a retired
 * type manufactures the exact signal that panel exists to detect.
 */
export const RETIRED_THING_TYPES = ['Cafe', 'Gym', 'Bar', 'Store'];
