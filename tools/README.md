# tools/

Development-time only. Nothing here runs at plugin runtime, and none of it is
needed to install or use Cloud Radar.

## build-outlines.py

Regenerates `data/Outlines.js` from Natural Earth 50m source data:

```sh
curl -fsSL -o /tmp/ne_countries.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
curl -fsSL -o /tmp/ne_marine.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_geography_marine_polys.geojson
python3 tools/build-outlines.py /tmp/ne_countries.geojson /tmp/ne_marine.geojson data/Outlines.js
```

It clips each region to the Cloud Radar bounds plus a small margin, simplifies
with Douglas-Peucker, and rounds to three decimals. Moldova is simplified at a
finer tolerance because it is the emphasized region.
