#!/bin/bash
# Debian 13 / Parrot 7. Install prerequisites; do not expose a web endpoint.
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Kjør med sudo.' >&2; exit 2; }
. /etc/os-release
[[ ${VERSION_ID:-} == 13 || ${ID:-} == parrot && ${VERSION_ID:-} == 7.* ]] || {
    echo 'Dette oppsettet er skrevet for Debian 13 / Parrot 7.' >&2; exit 2;
}
if systemctl is-active --quiet caddy.service; then
    echo 'Eksisterende Caddy kjører. Oppsettet overtar ikke denne tjenesten.' >&2; exit 2
fi
if ! command -v tailscale >/dev/null; then
    install -d -m 0755 /usr/share/keyrings
    task_key=$(mktemp)
    task_list=$(mktemp)
    trap 'rm -f -- "$task_key" "$task_list"' EXIT
    curl --fail --silent --show-error --location https://pkgs.tailscale.com/stable/debian/trixie.noarmor.gpg -o "$task_key"
    curl --fail --silent --show-error --location https://pkgs.tailscale.com/stable/debian/trixie.tailscale-keyring.list -o "$task_list"
    install -m 0644 "$task_key" /usr/share/keyrings/tailscale-archive-keyring.gpg
    install -m 0644 "$task_list" /etc/apt/sources.list.d/tailscale.list
fi
# Prevent the distro package's default website from starting during installation.
# We use our own mbg-web.service on loopback, not caddy.service.
if [[ -e /etc/systemd/system/caddy.service && ! -L /etc/systemd/system/caddy.service ]]; then
    echo 'Egendefinert Caddy-unit finnes; krever manuell gjennomgang.' >&2; exit 2
fi
systemctl mask caddy.service
apt-get update
apt-get install -y caddy tailscale python3-venv postgresql-17 curl ca-certificates
systemctl enable --now tailscaled
printf '%s\n' 'Avhengigheter klare. Caddys standardtjeneste er maskert; ingen nettside er åpnet.'
printf '%s\n' 'Kjør nå: sudo tailscale up --accept-dns=false --accept-routes=false'
printf '%s\n' 'Åpne innloggingslenken selv. Ikke del passord eller innloggingsnøkler.'
