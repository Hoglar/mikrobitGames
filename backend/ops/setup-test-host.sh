#!/bin/bash
# Explicit one-time local setup. Does not start services, change firewall or tests.
set -euo pipefail
if [[ $EUID != 0 || $# -lt 1 || $# -gt 2 ]]; then
    echo 'Bruk: sudo bash backend/ops/setup-test-host.sh <Linux-brukernavn> [--download-model]' >&2
    exit 2
fi
task_user=$1
[[ $# == 1 || $2 == --download-model ]] || exit 2
task_repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
[[ $task_user =~ ^[a-z_][a-z0-9_-]*$ ]] || exit 2
id "$task_user" >/dev/null
[[ $(id -u "$task_user") != 0 ]] || exit 2
[[ -x $task_repo/.venv/bin/python && -x /usr/local/bin/ollama ]] || { echo 'Kjør backend/check setup og installer Ollama først.' >&2; exit 2; }
for task_tool in cc setfacl; do command -v "$task_tool" >/dev/null; done
[[ -x /usr/lib/postgresql/17/bin/initdb ]] || { echo 'PostgreSQL 17 serververktøy mangler.' >&2; exit 2; }

for task_role in api ai model; do
    if ! id "mbg-test-$task_role" >/dev/null 2>&1; then
        useradd --system --user-group --create-home --home-dir "/var/lib/mbg-test-$task_role" --shell /usr/sbin/nologin "mbg-test-$task_role"
    fi
done
getent group mbg-test-launch >/dev/null || groupadd --system mbg-test-launch
usermod -a -G mbg-test-launch "$task_user"
install -d -m 0755 /usr/local/libexec
task_binary=$(mktemp)
trap 'rm -f -- "$task_binary"' EXIT
cc -O2 -Wall -Wextra -Werror -DMBG_REPO="\"$task_repo\"" -DMBG_CALLER="\"$task_user\"" "$task_repo/backend/ops/test-launch.c" -o "$task_binary"
install -o root -g mbg-test-launch -m 4750 "$task_binary" /usr/local/libexec/mbg-test-launch
setfacl -m "u:$task_user:r-x" /usr/local/libexec/mbg-test-launch
chmod u+s /usr/local/libexec/mbg-test-launch

# Traverse parent directories without exposing unrelated files in the home directory.
task_parent=$(dirname -- "$task_repo")
while [[ $task_parent != / ]]; do
    for task_role in api ai model; do setfacl -m "u:mbg-test-$task_role:--x" "$task_parent"; done
    task_parent=$(dirname -- "$task_parent")
done
# Only code/libraries are readable. No access to .git, reports or local config.
for task_path in "$task_repo" "$task_repo/backend" "$task_repo/backend/api" "$task_repo/backend/ai-service"; do
    for task_role in api ai model; do setfacl -m "u:mbg-test-$task_role:r-x" "$task_path"; done
done
for task_role in api ai; do
    setfacl -R -P -m "u:mbg-test-$task_role:r-X" "$task_repo/.venv" "$task_repo/backend/api/src" "$task_repo/backend/ai-service/src"
    find "$task_repo/.venv" "$task_repo/backend/api/src" "$task_repo/backend/ai-service/src" -type d -exec setfacl -m "d:u:mbg-test-$task_role:r-x" {} +
done

# Reuse the existing local model; never move or change its original owner.
task_model_source=/usr/share/ollama/.ollama/models
task_model_dest=/var/lib/mikrobit-games-test/models
install -d -o root -g mbg-test-model -m 0750 /var/lib/mikrobit-games-test
install -d -o mbg-test-model -g mbg-test-model -m 0750 "$task_model_dest"
setfacl -m "u:$task_user:r-x" /var/lib/mikrobit-games-test "$task_model_dest"
setfacl -m "d:u:$task_user:r-x" "$task_model_dest"
task_model=qwen3:4b-instruct-2507-q4_K_M
task_manifest="$task_model_source/manifests/registry.ollama.ai/library/qwen3/4b-instruct-2507-q4_K_M"
if [[ -f $task_manifest ]]; then
    # Copy only this manifest and its content-addressed blobs, not unrelated models.
    /usr/bin/python3 "$task_repo/backend/ops/copy-model.py" "$task_model_source" "$task_model_dest"
    chown -R mbg-test-model:mbg-test-model "$task_model_dest"
    chmod -R u=rwX,g=rX,o= "$task_model_dest"
    setfacl -R -m "u:$task_user:r-X" /var/lib/mikrobit-games-test
else
    echo "MERK: $task_model finnes ikke i $task_model_source. Ekte AI-måling er blokkert til modellen er lastet ned."
fi
# No secrets in this machine-local, ignored file. Preserve unrelated local settings.
/usr/bin/python3 - "$task_repo" "$task_model_dest" <<'PY'
import json,os,sys
from pathlib import Path
repo,model=Path(sys.argv[1]),sys.argv[2]
path=repo/'backend/check.local.json'
config=json.loads(path.read_text()) if path.exists() else {}
config.update(postgres_bin='/usr/lib/postgresql/17/bin', model_directory=model,
              model='qwen3:4b-instruct-2507-q4_K_M', isolated_launcher='/usr/local/libexec/mbg-test-launch',
              api_command=['/usr/local/libexec/mbg-test-launch','api','{port}'],
              ai_command=['/usr/local/libexec/mbg-test-launch','ai','{port}'],
              ollama_command=['/usr/local/libexec/mbg-test-launch','ollama'])
path.write_text(json.dumps(config,indent=2)+'\n')
owner=repo.stat()
os.chown(path,owner.st_uid,owner.st_gid)
path.chmod(0o600)
PY
if [[ ${2:-} == --download-model ]]; then
    /usr/bin/python3 "$task_repo/backend/ops/prepare-model.py"
fi
echo 'Testoppsett installert. Den navngitte brukeren har tilgang uten ny innlogging.'
echo 'Kjør deretter ./backend/check selv når implementasjonen er committet. Ingen testfase er startet.'
