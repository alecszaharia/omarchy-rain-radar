# Open-Meteo forecast API — reference notes
Source: https://open-meteo.com/en/docs (fetched 2026-09-04)

Base URL: https://api.open-meteo.com/v1/forecast  (no API key for non-commercial use)
Multi-location: `latitude=a,b,c&longitude=x,y,z` -> response becomes a JSON array of location objects
  (each with latitude, longitude, elevation, current{time, <vars>}, hourly{time[], <vars>[]}). No documented max count.
No bounding-box / grid query: point coordinates only -> a map must be built by sampling a lat/lon grid.
Cloud variables (instant, %): cloud_cover (total), cloud_cover_low, cloud_cover_mid, cloud_cover_high. Available in
  `current=` and `hourly=`.
Time: timezone=GMT default | IANA name | auto; timeformat=iso8601 | unixtime.
Models: models=auto (default) or explicit (e.g. ecmwf_ifs, icon_eu, ...).
Rate limits: not stated on the docs page; Open-Meteo's published free-tier guidance (terms page) is roughly
  10,000 calls/day, 5,000/hour, 600/minute, with multi-location calls weighted per location -> grid density x refresh
  cadence must stay well under this. Treat as an unverified figure to confirm at build time.
Attribution: CC BY 4.0 data; attribute "Weather data by Open-Meteo.com" in the UI/README.
