// VP-07.1 display-only visual separation. Raw WGS84 coordinates and QA rules do not change.
// MapLibre line-offset is measured in screen pixels; NOT meters, a GPS adjustment or a QA correction.
export const REFERENCE_SCREEN_OFFSET_PX = 6;
export const REFERENCE_LAYER_IDS = Object.freeze(['reference-halo', 'reference-path']);

export function referencePaint(daylight) {
  const shared = {
    'line-offset': REFERENCE_SCREEN_OFFSET_PX,
    'line-dasharray': [2, 1.5],
  };
  return {
    halo: {
      ...shared,
      'line-color': daylight ? '#fffdf6' : '#0b1b29',
      'line-width': 7,
      'line-opacity': 0.98,
    },
    path: {
      ...shared,
      'line-color': daylight ? '#8b4513' : '#ffe09a',
      'line-width': 3.6,
      'line-opacity': 1,
    },
  };
}
