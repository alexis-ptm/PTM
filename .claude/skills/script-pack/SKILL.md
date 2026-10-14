---
name: script-pack
description: Build a word-for-word video ad script pack (10 to 16 scripts) as a formatted Word document, from research, business facts and what is working. Also formats call or setter scripts. Use when the user asks for ad scripts, a script pack, or call scripts.
---

# Script Pack

Needs: the **competitor-positioning** output, the business facts, and what's working. Without them you get generic scripts. See `templates/intake.md` for the fill-in questionnaire.

## Rules

- **Minimum 10 scripts, ask for 12 to 16.** Five run out in three weeks; one winning ad becomes a single point of failure.
- Each script has a **distinct one-line angle** (pain, differentiator, proof, education, trust, qualifier, transparency, process, geography, authority, plus 2 to 3 warm-only). If the angle can't be said in one line, cut the script.
- **Every spoken line word for word, in quotes.** "Introduce yourself" is a wish, not a script. Direction (italic grey) and dialogue never mix.
- The qualifying price range appears in every cold script. It is the filter.
- Name each script for its idea; the name becomes the ad name. Convention: `Angle_Format_Hook_Version`.
- Every script ends with "Why this one works" citing the evidence.
- Include a "what we never do" list.

## Document anatomy (do not reorder)

Cover, the brief (what the research found, what we did about it), at-a-glance table, standards, then per script: heading, red angle line, meta table, setup and direction, **beats table**, labelled sections (on-screen text, headline, primary text, why it works), then back matter.

Beats table: left column is the marker (`0-3s` for video; `OPEN`, `PROBE`, `QUALIFY`, `BOOK` for calls; `Q1` for interviews), right column is direction plus the quoted line.

## Build it

```bash
pip install python-docx
cp templates/example_pack.py my_pack.py   # edit the SCRIPTS list only
python my_pack.py
```

Keep content as a pure data list at the top and never hand-roll layout; import `scripts/script_doc.py`. For call scripts, change `beats_label` to "Call flow" and the markers to stages; nothing else changes.

## Delivery

Upload the `.docx` to Google Drive (Drive > New > File upload, right-click > Open with Google Docs) and share the link. A local file is not a deliverable.

## Before it goes out

- [ ] 10+ scripts, each a different idea, not the same idea reworded
- [ ] Offer matches what the business actually sells, word for word
- [ ] Price range in every cold script
- [ ] Every guarantee confirmed by the owner in writing, including scope
- [ ] After launch: diff the live ad copy against the script (production often drops the price line)
