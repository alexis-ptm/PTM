"""
Rank Ad Library pulls by how long each ad has been running.

Why run-duration: Meta's public Ad Library only shows commercial ads while they
are ACTIVE. So an ad that has been live for months is an ad the advertiser keeps
paying for — that is the only performance signal available from the outside.
Short-running ads are noise; they may be killed next week.

Usage:
  python scripts/adlib_winners.py <dir-of-raw-json> [--min-days 30]
"""

import argparse
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

TEMPLATE = re.compile(r"\{\{.*?\}\}")


def load(dirpath):
    rows = []
    for f in Path(dirpath).glob("raw-*.json"):
        data = json.loads(f.read_text())
        if isinstance(data, dict):          # sweep file: {query: [ads]}
            for ads in data.values():
                rows.extend(ads)
        else:
            rows.extend(data)
    best = {}
    for r in rows:
        aid = str(r.get("ad_archive_id"))
        if aid in ("None", ""):
            continue
        if aid not in best or (r.get("days_running") or 0) > (best[aid].get("days_running") or 0):
            best[aid] = r
    return list(best.values())


def is_real_copy(text):
    if not text:
        return False
    t = TEMPLATE.sub("", text).strip()
    return len(t) > 40


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("dirpath")
    ap.add_argument("--min-days", type=int, default=30)
    args = ap.parse_args()

    ads = load(args.dirpath)
    print(f"{len(ads)} unique ads loaded\n")

    by_page = defaultdict(list)
    for a in ads:
        by_page[a.get("page_name") or "(unknown)"].append(a)

    print("=" * 78)
    print("ADVERTISERS BY VOLUME + LONGEVITY")
    print("=" * 78)
    rank = sorted(by_page.items(),
                  key=lambda kv: max((x.get("days_running") or 0) for x in kv[1]),
                  reverse=True)
    for name, lst in rank[:25]:
        longest = max((x.get("days_running") or 0) for x in lst)
        vids = sum(1 for x in lst if x["format"] == "video")
        print(f"  {longest:>4}d longest | {len(lst):>3} ads | {vids:>3} video | {name[:50]}")

    winners = [a for a in ads
               if (a.get("days_running") or 0) >= args.min_days and is_real_copy(a.get("body_text"))]
    winners.sort(key=lambda a: a["days_running"], reverse=True)

    print()
    print("=" * 78)
    print(f"PROVEN WINNERS — running {args.min_days}+ days with real copy ({len(winners)})")
    print("=" * 78)
    for a in winners[:40]:
        print(f"\n--- {a['days_running']}d | {a['page_name']} | {a['format']} | "
              f"CTA: {a.get('cta_text')} | since {a.get('start_readable')}")
        print(f"    HEADLINE: {a.get('title')}")
        body = TEMPLATE.sub("", a.get("body_text") or "").strip()
        print("    " + body[:600].replace("\n", "\n    "))

    print("\n" + "=" * 78)
    print("PATTERNS ACROSS WINNERS")
    print("=" * 78)
    print("CTA:", Counter(a.get("cta_text") for a in winners).most_common(8))
    print("Format:", Counter(a["format"] for a in winners).most_common())
    hooks = [TEMPLATE.sub("", a.get("body_text") or "").strip().split("\n")[0][:80]
             for a in winners]
    print("\nOPENING LINES (the hooks that keep getting paid for):")
    for h in hooks[:30]:
        print("  •", h)


if __name__ == "__main__":
    main()
