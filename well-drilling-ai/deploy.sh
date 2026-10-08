#!/usr/bin/env bash
#
# deploy.sh — put the AI assistant live on the existing Vercel project.
#
# Run this from inside your site repo (demo-website-well-drilling), or pass the
# path to it. It links to the EXISTING Vercel project by name, adds the three
# API keys as Production environment variables, and deploys to production.
#
#   ./deploy.sh                          # project: demo-website-well-drilling
#   VERCEL_PROJECT=my-project ./deploy.sh
#   ./deploy.sh /path/to/repo            # repo somewhere else
#
# Requires: git, node, npm. Everything else is fetched by npx.
# The script never prints your keys.

set -euo pipefail

REPO="${1:-$PWD}"
PROJECT="${VERCEL_PROJECT:-demo-website-well-drilling}"
PATCH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/chatbot.patch"
SITE_URL="${SITE_URL:-https://aquiferreachllc.vercel.app}"

say()  { printf "\n\033[1;34m▸ %s\033[0m\n" "$1"; }
warn() { printf "\033[1;33m! %s\033[0m\n" "$1"; }
die()  { printf "\033[1;31m✗ %s\033[0m\n" "$1" >&2; exit 1; }

cd "$REPO"
[ -f package.json ] || die "No package.json in $REPO — point the script at the site repo."

say "Repository: $REPO"

# ── 1. the code ──────────────────────────────────────────────────────────────
if [ -f src/lib/ai/providers.ts ] && [ -f src/components/chat-widget.tsx ]; then
  echo "  ✓ assistant files already present"
elif [ -f "$PATCH" ]; then
  say "Applying chatbot.patch"
  git apply --check "$PATCH" || die "Patch does not apply cleanly. Commit or stash your changes first, then re-run."
  git apply "$PATCH"
  echo "  ✓ patch applied"
else
  die "Assistant files are missing and chatbot.patch was not found next to this script."
fi

# ── 2. keys ──────────────────────────────────────────────────────────────────
ENV_FILE="$REPO/.env.local"
if [ -f "$ENV_FILE" ]; then
  # Read without echoing anything.
  set -a; . "$ENV_FILE"; set +a
  echo "  ✓ loaded .env.local"
fi

MISSING=""
for name in GROQ_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY; do
  value="${!name:-}"
  if [ -n "$value" ]; then
    echo "  ✓ $name is set (${#value} chars)"
  else
    MISSING="$MISSING $name"
  fi
done
[ -z "${MISSING// /}" ] || warn "Not set:$MISSING — the site will answer from the offline knowledge base until keys exist."

# ── 3. build check (catches any local breakage before it reaches Vercel) ─────
say "Installing and building locally"
npm install --no-audit --no-fund --silent
npm run build >/dev/null || die "Local build failed — fix the error above before deploying."
echo "  ✓ build clean"

# ── 4. Vercel CLI + auth ─────────────────────────────────────────────────────
say "Checking Vercel access"
if ! npx --yes vercel@latest whoami >/dev/null 2>&1; then
  warn "Not logged in."
  echo "  Run this first, then re-run the script:"
  echo "      npx vercel@latest login"
  exit 1
fi
WHOAMI="$(npx --yes vercel@latest whoami 2>/dev/null | tail -1)"
echo "  ✓ logged in as $WHOAMI"

# ── 5. link to the existing project (by name, as requested) ──────────────────
say "Linking to project: $PROJECT"
npx --yes vercel@latest link --yes --project "$PROJECT" >/dev/null 2>&1 \
  || die "Could not link to '$PROJECT'. Check the exact project name (vercel.com → your project → Settings → General) and pass it with VERCEL_PROJECT=NAME."
echo "  ✓ linked"

# ── 6. environment variables (Production) ────────────────────────────────────
say "Setting Production environment variables"
for name in GROQ_API_KEY GEMINI_API_KEY OPENROUTER_API_KEY OPENROUTER_MODEL GEMINI_MODEL AI_PROVIDER_CHAIN; do
  value="${!name:-}"
  [ -n "$value" ] || continue
  printf '%s' "$value" | npx --yes vercel@latest env add "$name" production --force --yes >/dev/null 2>&1 \
    && echo "  ✓ $name" \
    || warn "$name could not be set by the CLI — add it by hand in Settings → Environment Variables"
done

# ── 7. deploy ────────────────────────────────────────────────────────────────
say "Deploying to production"
npx --yes vercel@latest --prod --yes

# ── 8. verify ────────────────────────────────────────────────────────────────
say "Verifying"
sleep 5
echo "  Assistant status:"
curl -s -m 20 "$SITE_URL/api/health" || true
echo
echo "  A reply from \"live\" providers means the keys are working."
echo "  \"offline knowledge base\" means no key reached the deployment."
echo
printf "\033[1;32mDone.\033[0m Open %s and click the chat button in the bottom-right corner.\n" "$SITE_URL"
