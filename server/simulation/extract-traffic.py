# Turns an adsb.lol globe_history archive into the simulator's traffic file: every aircraft position,
# every 5 s, for three hours, within reach of six city tiles.
# Run: cat v2026.11.05-planes-readsb-prod-0.tar.* | python extract-traffic.py sim-traffic.jsonl.gz [2026-11-05T14:00]
import gzip
import json
import math
import sys
import tarfile
from datetime import datetime, timezone

TILES = {
    'tel-aviv': (33, 35), 'berlin': (53, 13), 'london': (51, -1),
    'paris': (49, 3), 'new-york': (41, -73), 'dubai': (25, 55),
}
RADIUS_NM = 100
STEP_S = 5
WINDOW_S = 3 * 3600
MAX_GAP_S = 60

start = int(datetime.fromisoformat(sys.argv[2] if len(sys.argv) > 2 else '2026-11-05T14:00')
            .replace(tzinfo=timezone.utc).timestamp())
end = start + WINDOW_S


def distance_nm(a, b):
    east = math.radians(b[1] - a[1]) * math.cos(math.radians((a[0] + b[0]) / 2))
    north = math.radians(b[0] - a[0])
    return math.hypot(east, north) * 3440.065


def tiles_for(lat, lon):
    return [name for name, centre in TILES.items()
            if abs(lat - centre[0]) < 2 and abs(lon - centre[1]) < 3 and distance_nm(centre, (lat, lon)) <= RADIUS_NM]


def blend(a, b, f):
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return a + f * (b - a)
    return a if a is not None else b


kept = 0
with gzip.open(sys.argv[1], 'wt') as out, tarfile.open(fileobj=sys.stdin.buffer, mode='r|') as archive:
    for member in archive:
        if not member.isfile() or 'trace_full' not in member.name:
            continue
        raw = archive.extractfile(member).read()
        try:
            trace = json.loads(gzip.decompress(raw) if raw[:2] == b'\x1f\x8b' else raw)
        except (ValueError, OSError, EOFError):
            continue
        base = trace.get('timestamp', 0)
        points, flight = [], None
        for p in trace.get('trace', []):
            if len(p) > 8 and isinstance(p[8], dict) and p[8].get('flight'):
                flight = p[8]['flight'].strip()
            t = base + p[0]
            if p[1] is not None and start - MAX_GAP_S <= t <= end + MAX_GAP_S:
                points.append((t, p[1], p[2], p[3], p[4], p[5], p[7] if len(p) > 7 else None, flight))
        if not any(tiles_for(lat, lon) for _, lat, lon, *_ in points):
            continue
        kept += 1
        for before, after in zip(points, points[1:]):
            t0, lat0, lon0, alt0, gs0, track0, rate0, flight0 = before
            t1, lat1, lon1, alt1, gs1, track1, rate1, flight1 = after
            if not 0 < t1 - t0 <= MAX_GAP_S:
                continue
            t = max(math.ceil(t0 / STEP_S) * STEP_S, start)
            while t < t1 and t < end:
                f = (t - t0) / (t1 - t0)
                lat, lon = blend(lat0, lat1, f), blend(lon0, lon1, f)
                for tile in tiles_for(lat, lon):
                    out.write(json.dumps([
                        t, tile, trace.get('icao'), flight0 or flight1 or '', trace.get('t'),
                        blend(alt0, alt1, f), blend(gs0, gs1, 0), blend(track0, track1, 0),
                        blend(rate0, rate1, 0), round(lat, 5), round(lon, 5),
                    ]) + '\n')
                t += STEP_S

print('aircraft kept:', kept)
