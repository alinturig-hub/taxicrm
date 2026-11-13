# Offline OpenStreetMap classification

An optional CRM scheduler uses a bundled, public OpenStreetMap extract to classify at most 100 eligible places every 15 minutes, without sending customer locations to an external service. It is disabled unless `OSM_AUTO_ENABLED=true`, and requires the existing scheduler and `CRON_SECRET`. Customer tags are refreshed by the existing customer-intelligence job, not in the classification transaction.

Only non-sensitive, named places with a `NO_MATCH` automatic fallback are eligible. A single OSM object with the same normalized non-generic name must be within 15 metres. The update uses a compare-and-set guard and cannot overwrite manual reviews or concurrent changes. Uncertain records are left untouched, not marked as verified. An advisory transaction lock prevents concurrent instances from processing the same batch.

The included index covers Devon only, not all deployments. It contains named nodes and ways for pubs, bars, restaurants, cafés and fast-food venues; Chinese cuisine is included only when the map explicitly says so. Ways use an approximate bounding-box centre. OSM map completeness and precision vary; a destination does not establish a customer's preferences or consent to marketing.

The bundled index derives from the 2026-11-12 Devon extract at https://download.geofabrik.de/europe/united-kingdom/england/devon-261112.osm.pbf (SHA-256 `b9c3e75886ef16417cd779087879907f2fa2f5672c594843a0660ba48054dc94`). Map data © OpenStreetMap contributors, https://www.openstreetmap.org/copyright, distributed under ODbL. The index excludes OSM relations. It is a snapshot, not a live map: processing stops when the snapshot is more than 45 days old or its date is invalid. Rebuild and deploy an updated index before expiry; no automatic dataset download is implemented.

Refresh the index from a verified Geofabrik extract using the pinned `scripts/osm/requirements.txt`, for example:

```sh
python scripts/osm/build-place-index.py devon.osm.pbf data/osm/devon-venues.json 2026-11-12 https://download.geofabrik.de/europe/united-kingdom/england/devon-261112.osm.pbf
```

The source date must match the downloaded extract, and its checksum should be verified against the publisher. Review the data and deploy the updated file. The cursor automatically restarts on a different extract SHA. Snapshot age, counts and cursor are stored in `CustomerIntelligenceJobRun`; no addresses or customer identities are placed in job metadata.
