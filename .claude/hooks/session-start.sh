#!/bin/bash
# Installs dependencies at the start of each Claude Code cloud session.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Next.js app (Markup)
npm install --no-audit --no-fund

# ad-library-research skill. Playwright is pinned to the release that matches
# the Chromium build pre-installed in cloud sessions (/opt/pw-browsers), since
# browser downloads are blocked there.
python3 -m pip install --quiet --root-user-action=ignore \
  "playwright==1.56.0" python-docx
