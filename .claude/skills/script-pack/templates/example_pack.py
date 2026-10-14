"""
example_pack.py — worked example. Copy this file, swap the SCRIPTS data, run it.

    python example_pack.py
    -> ./Example Agency - Video Ad Scripts.docx

Content (SCRIPTS) and rendering stay separate, so the next pack is a data swap.
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "scripts"))

from script_doc import (callout, cover, h1, new_doc, page_break, para,  # noqa: E402
                        render_script, save, table, bullets)

DEST = Path.cwd() / "Example Agency - Video Ad Scripts.docx"

SCRIPTS = [
    dict(
        n=1,
        title="The Guess",
        subtitle="PRIMARY HOOK: puts the money at risk first, the offer last.",
        meta=[("Ad name", "Guess_Video_BudgetInYourHead_v1"),
              ("Length", "40 seconds"),
              ("CTA", "Tap the button below")],
        setup="Owner to camera, vertical 9:16, phone at eye level, no music "
              "build. Talk to one person, not an audience.",
        beats_label="Script",
        beats=[
            ("0–3s", "Cold open. No greeting, no logo.",
             "“Most agency owners spend four thousand dollars a month on ads "
             "nobody ever showed them how to read.”"),
            ("3–15s", "Hold on camera.",
             "“I'm [NAME], I run [AGENCY] in [CITY]. [One sentence proving "
             "you've seen this exact mistake.]”"),
            ("15–40s", "Cut to proof, then back to camera.",
             "“[Your promise, with a number.] Tap the button and [next step].”"),
        ],
        sections=[
            ("On-screen text", ["Hook line in first 3 seconds, with the number"], "bullets"),
            ("Headline", "[Headline with the price or promise]", "hero"),
            ("Why this one works", "[Cite the competitor ad or evidence it is built on.]", "muted"),
        ],
    ),
]


def main():
    doc = new_doc()
    cover(doc, kicker="Example Agency", title="Video Ad Script Pack",
          subtitle="10+ scripts, word for word",
          meta_rows=[("Prepared for", "[Name]"), ("Prepared by", "[You]"),
                     ("Grounded in", "Competitor research dated [date]")])
    h1(doc, "The brief")
    para(doc, "Why these scripts look the way they do: what the research found "
              "and what we did about it.")
    h1(doc, "At a glance")
    table(doc, ["#", "Name", "Angle"],
          [[str(s["n"]), s["title"], s["subtitle"]] for s in SCRIPTS],
          widths=[0.4, 2.0, 4.1])
    h1(doc, "Standards")
    bullets(doc, ["Vertical 9:16, captions burned in",
                  "Hook in the first 3 seconds: a problem or a number, never a greeting",
                  "Say the city out loud; use a real dollar figure"])
    page_break(doc)
    for s in SCRIPTS:
        render_script(doc, s)
    save(doc, DEST)
    print("wrote", DEST)


if __name__ == "__main__":
    main()
