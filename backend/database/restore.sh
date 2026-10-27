#!/bin/sh
# Destination must be a separate, empty database. Credentials stay in environment.
set -eu
test "$#" -eq 1 || { echo 'Bruk: restore.sh <backupfil>' >&2; exit 2; }
: "${MBG_ADMIN_DSN:?MBG_ADMIN_DSN må peke på en tom måldatabase}"
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec "$task_root/.venv/bin/python" "$task_root/backend/database/maintenance.py" restore "$1"
