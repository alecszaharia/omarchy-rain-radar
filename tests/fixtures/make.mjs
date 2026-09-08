// Builds Open-Meteo multi-location response fixtures over the real grid, so a
// fixture always has one entry per sampled point in the contract's order.
import { loadQmlJs, plain } from '../qml-js.mjs';

const M = loadQmlJs('Model.js');

export const DATA_TIME = '2026-09-08T06:00';

export function completeResponse(overrides = {}) {
  const points = plain(M.gridPoints());
  return points.map((p, i) => ({
    latitude: p.lat,
    longitude: p.lon,
    elevation: 100,
    current: {
      time: DATA_TIME,
      interval: 900,
      cloud_cover: (i * 7) % 101,
      precipitation: Number(((i % 5) * 0.4).toFixed(1)),
      ...(overrides[i] ?? {})
    }
  }));
}

// The same precipitation amount reported as rain and as snow. The plugin asks
// for a single precipitation total and never for the breakdown, so these must
// produce identical models.
export function rainResponse(mm = 3.0) {
  return completeResponse().map((entry) => ({
    ...entry,
    current: { ...entry.current, precipitation: mm, rain: mm, snowfall: 0 }
  }));
}

export function snowResponse(mm = 3.0) {
  return completeResponse().map((entry) => ({
    ...entry,
    current: { ...entry.current, precipitation: mm, rain: 0, snowfall: mm }
  }));
}
