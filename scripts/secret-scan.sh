#!/usr/bin/env bash
# Fail CI if tracked files look like they contain real secrets.
set -euo pipefail

root="$(git rev-parse --show-toplevel)"
cd "$root"

fail=0

check() {
	local label="$1"
	shift
	if git grep -nE "$@" -- ':!.git' >/tmp/meownow-secret-scan.out 2>/dev/null; then
		echo "secret-scan: ${label}"
		cat /tmp/meownow-secret-scan.out
		fail=1
	fi
}

# Neon role passwords (npg_…).
check "Neon password material (npg_)" 'npg_[A-Za-z0-9]{10,}'

# PEM / OpenSSH private keys.
check "PEM private key" 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY'

# Ed25519 JWK private component. Public keys have `x` only.
check "Ed25519 private JWK (d)" '"d"[[:space:]]*:[[:space:]]*"[A-Za-z0-9_-]{16,}"'

# Known previously committed local private scalar — must never return.
check "retired local capability scalar" 'removed'

if git grep -nE '^(HUB_SECRET|CAPABILITY_TOKEN_PRIVATE_KEY)[[:space:]]*=' -- '*.toml' >/tmp/meownow-secret-scan.out 2>/dev/null; then
	echo "secret-scan: Worker secrets must not be wrangler [vars]"
	cat /tmp/meownow-secret-scan.out
	fail=1
fi

rm -f /tmp/meownow-secret-scan.out

if [[ "$fail" -ne 0 ]]; then
	echo "secret-scan failed. Remove the material; do not commit secrets."
	exit 1
fi

echo "secret-scan: clean"
