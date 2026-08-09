#!/bin/sh
# ============================================================
# Art Vibe — signs backup
# Snapshots /var/lib/av2-signs/signs.db, which since 2026-08-09 is the ONLY
# copy of the wall. The Telegram channel used to double as the off-site record;
# that mirror is gone, so if this does not run there is no backup at all.
#
# Uses sqlite3's `.backup`, not `cp`: the database runs in WAL mode and is
# written live, so copying the file alone can capture a torn page and leave the
# -wal behind. `.backup` takes a consistent snapshot of a live database.
#
# Install (see cron.d/av2-signs-backup beside this file):
#     install -m 755 backup-signs.sh /usr/local/bin/av2-signs-backup
#     install -m 644 cron.d/av2-signs-backup /etc/cron.d/av2-signs-backup
# ============================================================
set -eu

DB=${AV2_SIGNS_DB:-/var/lib/av2-signs/signs.db}
DIR=${AV2_SIGNS_BACKUP_DIR:-/var/backups/av2-signs}
KEEP=${AV2_SIGNS_KEEP:-240}   # 240 snapshots at one per 2h ≈ 20 days

[ -r "$DB" ] || { echo "av2-signs-backup: cannot read $DB" >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "av2-signs-backup: sqlite3 missing" >&2; exit 1; }

mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TMP=$(mktemp "$DIR/.snap-XXXXXX")
trap 'rm -f "$TMP"' EXIT

# A failed .backup must never overwrite a good snapshot, so it lands on a temp
# file first and is only promoted once sqlite3 reports success AND the result
# actually opens.
sqlite3 "$DB" ".backup '$TMP'"
COUNT=$(sqlite3 "$TMP" 'SELECT COUNT(*) FROM signs;')

# The wall only changes when somebody signs, so most runs would write a
# byte-identical file. Keep the snapshot only when something actually moved.
LATEST="$DIR/latest.db"
if [ -f "$LATEST" ] && cmp -s "$TMP" "$LATEST"; then
  exit 0
fi

cp "$TMP" "$DIR/signs-$STAMP.db"
cp "$TMP" "$LATEST"

# Prune oldest snapshots past the retention count.
ls -1t "$DIR"/signs-*.db 2>/dev/null | tail -n "+$((KEEP + 1))" | while read -r old; do
  rm -f "$old"
done

echo "av2-signs-backup: saved signs-$STAMP.db ($COUNT signs, $(wc -c < "$TMP") bytes)"
