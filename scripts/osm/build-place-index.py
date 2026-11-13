#!/usr/bin/env python3
"""Build a small, reusable OSM venue index from an operator-supplied extract.

Usage: python build-place-index.py INPUT.osm.pbf OUTPUT.json SNAPSHOT_DATE SOURCE_URL
Requires pyosmium. Processes public map data only and never queries customer data.
"""
import hashlib
import json
import math
import os
import sys
import tempfile
from datetime import date, datetime, timezone
from pathlib import Path

try:
    import osmium
except ImportError:
    raise SystemExit('Install the pinned osmium dependency before running this importer.')

AMENITIES = {'pub', 'bar', 'restaurant', 'cafe', 'fast_food'}

class Venues(osmium.SimpleHandler):
    def __init__(self):
        super().__init__()
        self.rows = []

    def add(self, obj, kind, latitude, longitude):
        name = obj.tags.get('name', '').strip()
        amenity = obj.tags.get('amenity', '')
        if amenity not in AMENITIES or not name or len(name) > 120 or any(ord(c) < 32 for c in name):
            return
        if not math.isfinite(latitude) or not math.isfinite(longitude) or abs(latitude) > 90 or abs(longitude) > 180:
            return
        cuisine = obj.tags.get('cuisine', '')
        category = 'catering.restaurant.chinese' if amenity == 'restaurant' and 'chinese' in [v.strip().lower() for v in cuisine.split(';')] else 'catering.' + amenity
        self.rows.append({'name': name, 'category': category, 'latitude': latitude, 'longitude': longitude, 'osmType': kind, 'osmId': obj.id})

    def node(self, obj):
        if obj.location.valid():
            self.add(obj, 'node', obj.location.lat, obj.location.lon)

    def way(self, obj):
        if obj.tags.get('amenity', '') not in AMENITIES or not obj.tags.get('name', ''):
            return
        points = [(n.location.lat, n.location.lon) for n in obj.nodes if n.location.valid()]
        if len(points) < 3 or len(points) != len(obj.nodes):
            return
        if points[0] == points[-1]:
            points.pop()
        if len(points) < 3:
            return
        # Bounding-box centre is approximate; callers must not treat it as an entrance.
        self.add(obj, 'way', (min(p[0] for p in points) + max(p[0] for p in points)) / 2, (min(p[1] for p in points) + max(p[1] for p in points)) / 2)


def build(source: Path, target: Path, snapshot_date: str, source_url: str):
    parsed_date = date.fromisoformat(snapshot_date)
    if parsed_date > datetime.now(timezone.utc).date() or not source_url.startswith('https://download.geofabrik.de/'):
        raise ValueError('A non-future snapshot date and Geofabrik extract URL are required')
    if source.resolve() == target.resolve() or not source.is_file():
        raise ValueError('Input must exist and differ from output')
    digest = hashlib.sha256()
    with source.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    handler = Venues()
    handler.apply_file(str(source), locations=True)
    if not handler.rows:
        raise ValueError("No supported named venues found; existing output was not replaced")
    result = {'version': 1, 'source': 'OpenStreetMap', 'sourceSha256': digest.hexdigest(), 'createdAt': datetime.now(timezone.utc).isoformat(), 'sourceSnapshotDate': snapshot_date, 'sourceExtractUrl': source_url, 'attribution': '© OpenStreetMap contributors', 'licenceUrl': 'https://www.openstreetmap.org/copyright', 'venues': handler.rows}
    target.parent.mkdir(parents=True, exist_ok=True)
    name = None
    try:
        with tempfile.NamedTemporaryFile('w', encoding='utf-8', dir=target.parent, prefix='.osm-index-', delete=False) as stream:
            name = stream.name
            json.dump(result, stream, ensure_ascii=False, separators=(',', ':'))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, target)
    finally:
        if name and os.path.exists(name):
            os.unlink(name)
    return len(handler.rows)

if __name__ == '__main__':
    if len(sys.argv) != 5:
        raise SystemExit('Usage: build-place-index.py INPUT.osm.pbf OUTPUT.json SNAPSHOT_DATE SOURCE_URL')
    print('Indexed venues:', build(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], sys.argv[4]))
