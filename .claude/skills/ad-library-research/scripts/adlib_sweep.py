"""
adlib_sweep.py — generic Meta Ad Library sweep for any niche + metro.

Generalised out of sweep_roofing_adlib.py on the third time we needed it. Same
method, no hardcoded vertical: national offer language + the client's metro +
named competitors. One fresh browser session PER QUERY — a shared session gets
throttled to zero ads and that looks exactly like an empty market.

Run-duration is the only performance signal visible from outside a competitor's
account — the public Ad Library shows a commercial ad ONLY while it is active.
Ranking by run-duration is explained in the SKILL.md next to this folder.

    python scripts/adlib_sweep.py <slug> \
        --national "kitchen remodel financing" "whole home remodel" \
        --metro "remodeling Utah" "home remodel Salt Lake City" \
        --competitors "Some Competitor LLC"

Or point it at a JSON config: {"national": [...], "metro": [...], "competitors": [...]}
    python scripts/adlib_sweep.py <slug> --config path.json

Writes ./ad-research/<slug>/raw-<batch>.json (relative to where you run it)
"""
import argparse
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from adlib_playwright import scrape_many  # noqa: E402

BASE = Path.cwd() / "ad-research"


def run(out_dir, name, queries, scrolls):
    if not queries:
        return 0
    print(f"\n=== {name} ({len(queries)} queries) ===", flush=True)
    res = scrape_many(queries, scrolls=scrolls)
    path = out_dir / f"raw-{name}.json"
    path.write_text(json.dumps(res, indent=2))
    total = sum(len(v) for v in res.values())
    print(f"-> {total} ads written to {path}", flush=True)
    # A query returning 0 is usually an over-specific phrase, not an empty
    # market — flag it so nobody reports it as a finding.
    for q, ads in res.items():
        if not ads:
            print(f"   !! 0 ads for {q!r} — check the phrasing before "
                  f"concluding anything", flush=True)
    return total


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("slug", help="project slug, e.g. my-agency")
    ap.add_argument("--national", nargs="*", default=[])
    ap.add_argument("--metro", nargs="*", default=[])
    ap.add_argument("--competitors", nargs="*", default=[])
    ap.add_argument("--config", help="JSON with national/metro/competitors keys")
    ap.add_argument("--scrolls", type=int, default=8)
    args = ap.parse_args()

    cfg = {"national": args.national, "metro": args.metro,
           "competitors": args.competitors}
    if args.config:
        cfg.update(json.loads(Path(args.config).read_text()))

    out_dir = BASE / args.slug
    out_dir.mkdir(parents=True, exist_ok=True)

    total = 0
    total += run(out_dir, "national", cfg["national"], args.scrolls)
    total += run(out_dir, "metro", cfg["metro"], args.scrolls)
    total += run(out_dir, "competitors", cfg["competitors"], max(4, args.scrolls - 3))
    print(f"\nTOTAL {total} ads -> {out_dir}", flush=True)


if __name__ == "__main__":
    main()
