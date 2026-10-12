---
name: ad-library-research
description: Scrape the Meta Ad Library for competitor ads in any niche or city, free, with no API key, and rank them by how long they have been running to find the proven winners. Use when the user asks to pull competitor ads, research a market's ads, find winning ads, or sweep the Ad Library for a keyword, advertiser or metro.
---

# Ad Library Research

Pull every live ad for a competitor or keyword, then rank by run-duration. No Apify, no API key, no login.

## One-time setup

```bash
pip install playwright && playwright install chromium
```

## 1. Pull ads

Single advertiser or keyword:

```bash
python scripts/adlib_playwright.py "<competitor or keyword>" --scrolls 8 --out ad-research/<project>/raw-<name>.json
```

A whole market in one go (national offer words + your metro + named competitors):

```bash
python scripts/adlib_sweep.py <project> \
  --national "kitchen remodel financing" \
  --metro "remodeling Utah" "home remodel Salt Lake City" \
  --competitors "Some Competitor LLC"
```

Files land in `./ad-research/<project>/raw-*.json` (relative to where you run it).

**Always query both:**
1. Every competitor the person named, verbatim.
2. Keyword sweeps for service + city + state. A named list is never the whole market: half of it often runs no ads, and the most useful advertiser usually isn't on it.

## 2. Rank by run-duration

```bash
python scripts/adlib_winners.py ad-research/<project> --min-days 60
```

Meta shows a commercial ad only while it is active and publishes no spend. So an ad still live after 250 days is the only outside proof that it works. Rule of thumb: **500+ days = profitable.**

## Read the results carefully

- **Filter noise first.** Keyword sweeps pull in whoever bought the same words (dropshippers, realtors, unrelated trades). Keep relevant page names and body copy, then dedupe identical copy keeping the longest-running one.
- **`{{product.brand}}` in the body = catalog ad.** No human copy, useless for scripting. Drop it.
- **A query returning 0 ads is not an empty market.** It is usually an over-specific phrase or a throttled session. Rephrase before reporting "nobody advertises this."
- Place names fake a metro: "garland" matches the town and the Christmas decoration. Check page names.

## Do not chase the official API

The Ad Library API (`/ads_archive`) only returns political, issue and special-category ads in the US. Commercial ads are invisible to it, and an approved key returns an empty set. This scraper drives a real browser and reads the page's own data instead.

## Output

Hand the ranked list to the **competitor-positioning** module to turn it into a decision. Do not write scripts straight from this list.
