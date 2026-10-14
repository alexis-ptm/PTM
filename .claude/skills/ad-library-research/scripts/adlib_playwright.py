"""
Ad Library scraper — local Chromium, no Apify, no Node.

Meta's Ad Library API (/ads_archive) only returns political + issue ads in the US,
so commercial contractor ads are invisible to it. The public web UI has them all,
but it's a JS app behind a bot challenge. So we drive a real browser and intercept
the page's OWN GraphQL responses, which carry the full ad records.

Usage:
  python scripts/adlib_playwright.py "Allied Outdoor Solutions" --out raw.json
  python scripts/adlib_playwright.py "patio cover" --state TX --scrolls 12
"""

import argparse
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36")


def build_url(query, active_only=True):
    return (
        "https://www.facebook.com/ads/library/"
        f"?active_status={'active' if active_only else 'all'}"
        "&ad_type=all&country=US"
        f"&q={quote(query)}"
        "&search_type=keyword_unordered&media_type=all"
    )


def deep_find_ads(node, sink):
    """Walk arbitrary JSON and collect every dict that looks like an ad record."""
    if isinstance(node, dict):
        if "ad_archive_id" in node:
            sink.append(node)
        for v in node.values():
            deep_find_ads(v, sink)
    elif isinstance(node, list):
        for v in node:
            deep_find_ads(v, sink)


def parse_multi_json(text):
    """Meta streams several JSON objects back to back. Yield each one."""
    dec = json.JSONDecoder()
    idx = 0
    n = len(text)
    while idx < n:
        while idx < n and text[idx] in " \r\n\t":
            idx += 1
        if idx >= n:
            return
        try:
            obj, end = dec.raw_decode(text, idx)
        except ValueError:
            return
        yield obj
        idx = end


def scrape(query, scrolls=10, active_only=True, headful=False):
    collected = []

    def on_response(resp):
        url = resp.url
        if "/api/graphql" not in url and "/ads/library/async" not in url:
            return
        try:
            body = resp.text()
        except Exception:
            return
        if "ad_archive_id" not in body:
            return
        for obj in parse_multi_json(body):
            deep_find_ads(obj, collected)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=not headful,
            args=["--disable-blink-features=AutomationControlled"],
        )
        ctx = browser.new_context(user_agent=UA, locale="en-US",
                                  viewport={"width": 1440, "height": 900})
        ctx.add_init_script(
            "Object.defineProperty(navigator,'webdriver',{get:()=>undefined})"
        )
        page = ctx.new_page()
        page.on("response", on_response)

        page.goto(build_url(query, active_only), timeout=90000,
                  wait_until="domcontentloaded")

        # Solve the /__rd_verify_ bot challenge if it's served.
        for _ in range(3):
            if "__rd_verify_" in page.content():
                page.wait_for_timeout(3000)
                page.reload(timeout=90000, wait_until="domcontentloaded")
            else:
                break

        page.wait_for_timeout(6000)
        for i in range(scrolls):
            page.mouse.wheel(0, 6000)
            page.wait_for_timeout(2200)
            if i % 4 == 3:
                page.wait_for_timeout(2500)

        browser.close()

    # De-dupe on ad_archive_id, keeping the richest copy of each record.
    best = {}
    for ad in collected:
        aid = str(ad.get("ad_archive_id"))
        if aid not in best or len(json.dumps(ad)) > len(json.dumps(best[aid])):
            best[aid] = ad
    return list(best.values())


# A query that genuinely has no advertisers and a query Meta throttled look
# identical from here, and a zero is usually the whole finding ("nobody in this
# market says X"). So: one fresh browser per query, a pause between, one retry
# on any zero, and a control query before we let a run report all-zeros.
CONTROL_QUERY = "concrete Knoxville"


def scrape_many(queries, scrolls=8, active_only=True, pause=10):
    """Run several searches, each in its OWN browser session.

    A shared session gets throttled to zero ads on every query (HSD Masonry,
    2026-08-08: 0/12 queries, then 885 ads on the same queries one-at-a-time).
    Slower, reliable.
    """
    results = {}

    for n, q in enumerate(queries):
        if n:
            time.sleep(pause)
        try:
            ads = scrape(q, scrolls=scrolls, active_only=active_only)
        except Exception as e:
            print(f"  !! {q}: {e}", flush=True)
            ads = []

        # One retry on a zero, after a longer cool-off — a throttled session
        # usually recovers, an empty market never does.
        if not ads:
            print(f"  {q}: 0 ads — cooling off {pause * 3}s and retrying once",
                  flush=True)
            time.sleep(pause * 3)
            try:
                ads = scrape(q, scrolls=scrolls, active_only=active_only)
            except Exception as e:
                print(f"  !! {q} (retry): {e}", flush=True)
                ads = []

        results[q] = [flatten(a, q) for a in ads]
        print(f"  {q}: {len(results[q])} ads", flush=True)

    if queries and not any(results.values()):
        print(f"\n  !! every query returned 0 — running control query "
              f"{CONTROL_QUERY!r} to tell 'empty market' from 'throttled'",
              flush=True)
        time.sleep(pause)
        try:
            control = scrape(CONTROL_QUERY, scrolls=3, active_only=active_only)
        except Exception as e:
            control = []
            print(f"  !! control failed: {e}", flush=True)
        if control:
            print(f"  CONTROL OK ({len(control)} ads) — the zeros are real, "
                  f"but widen the phrasing before calling the category empty.",
                  flush=True)
        else:
            raise RuntimeError(
                "Ad Library scrape returned 0 ads on every query AND on the "
                f"control query {CONTROL_QUERY!r}. The scraper is throttled or "
                "broken — do NOT report these zeros as findings. Wait and rerun."
            )

    return results


def days_running(start_ts, end_ts=None, is_active=True):
    if not start_ts:
        return None
    start = datetime.fromtimestamp(int(start_ts), tz=timezone.utc)
    if is_active or not end_ts:
        end = datetime.now(tz=timezone.utc)
    else:
        end = datetime.fromtimestamp(int(end_ts), tz=timezone.utc)
    return max(0, (end - start).days)


def flatten(ad, query=""):
    snap = ad.get("snapshot") or {}
    body = snap.get("body") or {}
    text = body.get("text") if isinstance(body, dict) else None
    cards = snap.get("cards") or []
    if not text and cards:
        text = (cards[0] or {}).get("body")
    videos = snap.get("videos") or []
    images = snap.get("images") or []
    fmt = "video" if videos else ("image" if images else "other")
    start = ad.get("start_date") or ad.get("startDate")
    end = ad.get("end_date") or ad.get("endDate")
    active = str(ad.get("is_active", True)).lower() in ("true", "1")
    return {
        "query": query,
        "ad_archive_id": ad.get("ad_archive_id"),
        "page_name": ad.get("page_name") or snap.get("page_name"),
        "page_id": ad.get("page_id"),
        "is_active": active,
        "start_date": start,
        "start_readable": (datetime.fromtimestamp(int(start), tz=timezone.utc)
                           .strftime("%Y-%m-%d") if start else None),
        "days_running": days_running(start, end, active),
        "format": fmt,
        "video_count": len(videos),
        "image_count": len(images),
        "cta_text": snap.get("cta_text"),
        "cta_type": snap.get("cta_type"),
        "title": snap.get("title") or (cards[0].get("title") if cards else None),
        "link_url": snap.get("link_url"),
        "caption": snap.get("caption"),
        "body_text": (text or "").strip(),
        "publisher_platform": ad.get("publisher_platform"),
        "collation_count": ad.get("collation_count"),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("query")
    ap.add_argument("--scrolls", type=int, default=10)
    ap.add_argument("--all-time", action="store_true",
                    help="include inactive ads (default: active only)")
    ap.add_argument("--headful", action="store_true")
    ap.add_argument("--out", default=None)
    args = ap.parse_args()

    ads = scrape(args.query, scrolls=args.scrolls,
                 active_only=not args.all_time, headful=args.headful)
    rows = [flatten(a, args.query) for a in ads]
    rows.sort(key=lambda r: r["days_running"] or -1, reverse=True)

    out = args.out or f"adlib_{re.sub(r'[^a-z0-9]+', '-', args.query.lower())}.json"
    Path(out).write_text(json.dumps(rows, indent=2))
    print(f"{len(rows)} ads -> {out}")
    for r in rows[:10]:
        print(f"  {r['days_running']:>4}d  {r['page_name'][:34]:<34} "
              f"{r['format']:<5} {(r['body_text'] or '')[:70]!r}")


if __name__ == "__main__":
    main()
