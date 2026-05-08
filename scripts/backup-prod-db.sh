#!/usr/bin/env bash
# =============================================================================
# Snapshot the production SQLite DB from the home NAS.
# =============================================================================
# Run from your laptop. Drops a timestamped copy of prod.db into ~/automotive-backups/.
# Synology Hyper Backup is the primary backup mechanism for /volume1/docker/automotive/;
# this script is for ad-hoc snapshots before risky operations (schema migrations,
# bulk edits) where you want a known-good rollback file.
#
# Usage:
#   ./scripts/backup-prod-db.sh
#
# Requires: ssh access to the `nas-home` alias.
# =============================================================================
set -euo pipefail

LOCAL_DIR="${HOME}/automotive-backups"
REMOTE_DB="/volume1/docker/automotive/data/prod.db"
STAMP="$(date +%Y-%m-%d-%H%M%S)"
LOCAL_FILE="${LOCAL_DIR}/prod-${STAMP}.db"

mkdir -p "${LOCAL_DIR}"

# scp directly from the NAS — DB is uid 1001 owned but the user has read access
# via the share's POSIX ACLs. If this fails with "permission denied", the NAS
# share permissions need an ACL update (read for jamison.hill on /volume1/docker).
scp "nas-home:${REMOTE_DB}" "${LOCAL_FILE}"

echo "Saved ${LOCAL_FILE} ($(du -h "${LOCAL_FILE}" | cut -f1))"
