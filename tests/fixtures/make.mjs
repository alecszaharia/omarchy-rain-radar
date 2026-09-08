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
