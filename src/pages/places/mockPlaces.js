// Seeded sample for the Places monitor (#470 · B1+B2). Mirrors the live
// GET /metrics/places/entity-kind shape so the page is demoable/verifiable
// offline; replaced by live data when the endpoint is reachable.
//
// NOTE: entity_kind is DERIVED from metadata markers, not a persisted
// classifier verdict — the seeded Wikidata catalog never ran brandClassifier.js
// and defaults to 'destination'. Distribution figures mirror prod (2026-07-16).
// The chain_location_candidates rows are illustrative (live prod total is 0) so
// the populated table state is visible in the sample.
export const MOCK_PLACES = {
  places_total: 29607,
  by_entity_kind: [
    { entity_kind: 'destination', count: 29603 },
    { entity_kind: 'chain', count: 3 },
    { entity_kind: 'brand', count: 1 },
  ],
  by_type_kind: [
    { type: 'Museum', entity_kind: 'destination', count: 8649 },
    { type: 'Hotel', entity_kind: 'destination', count: 8555 },
    { type: 'Hotel', entity_kind: 'chain', count: 2 },
    { type: 'TouristAttraction', entity_kind: 'destination', count: 7883 },
    { type: 'Park', entity_kind: 'destination', count: 3086 },
    { type: 'Restaurant', entity_kind: 'destination', count: 1424 },
    { type: 'Restaurant', entity_kind: 'brand', count: 1 },
    { type: 'Restaurant', entity_kind: 'chain', count: 1 },
  ],
  chain_location_candidates: {
    total: 2,
    by_type: [
      { type: 'Hotel', count: 1 },
      { type: 'Restaurant', count: 1 },
    ],
    sample: [
      {
        thing_id: 'hotel_courtyard_marriott_downtown_a1b2',
        title: 'Courtyard by Marriott Downtown',
        type: 'Hotel',
        chain_brand: 'Marriott',
        google_place_id: 'ChIJexample_marriott',
      },
      {
        thing_id: 'restaurant_wendys_123_main_c3d4',
        title: "Wendy's — 123 Main St",
        type: 'Restaurant',
        chain_brand: "Wendy's",
        google_place_id: 'ChIJexample_wendys',
      },
    ],
  },
  derivation: {
    chain: "metadata.is_chain = 'true'",
    brand: "metadata.thing_level = 'brand' (and not a chain)",
    destination: 'any other Place-parented Thing (default)',
    persisted: false,
  },
};
