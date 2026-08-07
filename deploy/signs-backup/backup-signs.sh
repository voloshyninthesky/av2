#!/bin/sh
# ============================================================
# Art Vibe — signs backup
# Snapshots the pinned "head" message (the live stage: every sign, its colour
# and its slot) out of the Telegram channel. The head is the one thing with no
# second copy — the channel's ✍️ feed posts record what was said, but not the
# layout — so a wiped or hand-mangled pin is unrecoverable without this.
#
# Credentials come from /etc/av2-signs-backup.env so they never live in the
# repo:
#     BOT_TOKEN=123456:AA...
#     CHAT_ID=-1001234567890
#
# Install (see cron.d/av2-signs-backup beside this file):
#     install -m 755 backup-signs.sh /usr/local/bin/av2-signs-backup
#     install -m 600 /dev/stdin /etc/av2-signs-backup.env   # then paste the two lines
#     install -m 644 cron.d/av2-signs-backup /etc/cron.d/av2-signs-backup
# ============================================================
set -eu

ENV_FILE=${AV2_SIGNS_ENV:-/etc/av2-signs-backup.env}
DIR=${AV2_SIGNS_BACKUP_DIR:-/var/backups/av2-signs}
KEEP=${AV2_SIGNS_KEEP:-240}   # 240 snapshots at one per 2h ≈ 20 days

[ -r "$ENV_FILE" ] || { echo "av2-signs-backup: cannot read $ENV_FILE" >&2; exit 1; }
# shellcheck disable=SC1090
. "$ENV_FILE"
: "${BOT_TOKEN:?av2-signs-backup: BOT_TOKEN missing}"
: "${CHAT_ID:?av2-signs-backup: CHAT_ID missing}"

mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp)
trap 'rm -f "$TMP"' EXIT

# Pull the pinned message and unwrap it. Anything unexpected — API error, no
# pin, empty text — fails loudly and writes nothing, so a bad response can
# never overwrite a good backup with an error page.
curl -fsS --max-time 30 \
  "https://api.telegram.org/bot${BOT_TOKEN}/getChat?chat_id=${CHAT_ID}" \
  | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    d = json.loads(raw)
except ValueError:
    sys.exit("av2-signs-backup: telegram returned no JSON (%r)" % raw[:120])
if not d.get("ok"):
    sys.exit("av2-signs-backup: api error: %s" % d.get("description"))
text = (d.get("result") or {}).get("pinned_message", {}).get("text") or ""
if not text.startswith("AV2 "):
    sys.exit("no signs head pinned (got %r)" % text[:40])
sys.stdout.write(text)
' > "$TMP"

# The head only changes when somebody signs, so most runs would write a
# byte-identical file. Keep the snapshot only when something actually moved.
LATEST="$DIR/latest.txt"
if [ -f "$LATEST" ] && cmp -s "$TMP" "$LATEST"; then
  exit 0
fi

cp "$TMP" "$DIR/signs-$STAMP.txt"
cp "$TMP" "$LATEST"

# Prune oldest snapshots past the retention count.
ls -1t "$DIR"/signs-*.txt 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

echo "av2-signs-backup: saved signs-$STAMP.txt ($(wc -c < "$TMP") bytes, $(( $(wc -l < "$TMP") - 1 )) signs)"
