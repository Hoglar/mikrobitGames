#!/bin/sh
set -eu
test "$#" -eq 1 || { echo 'Bruk: backup.sh <ny-backupfil>' >&2; exit 2; }
: "${MBG_ADMIN_DSN:?MBG_ADMIN_DSN mangler}"
umask 077
test ! -e "$1" || { echo 'Målfilen finnes allerede.' >&2; exit 2; }
task_root=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
exec "$task_root/.venv/bin/python" "$task_root/backend/database/maintenance.py" backup "$1"
