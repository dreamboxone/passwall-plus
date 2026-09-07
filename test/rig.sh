#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# rig.sh - stand the router's scripts up somewhere that is not a router.
#
# Sourced by the tests. It lays the real scripts out in a throwaway tree,
# points every root at it, and puts a stand-in `uci` on the path so that
# settings can be varied without a router to vary them on.
#
# The point is that the tests exercise the shipped scripts themselves. A test
# that reimplements what it is testing proves only that two things agree.

RIG_SRC="$(cd "$(dirname "$0")/.." && pwd)"
RIG="${RIG_ROOT:-${TMPDIR:-/tmp}/pwplus-rig}"

rig_setup() {
	rm -rf "$RIG"
	mkdir -p "$RIG/lib" "$RIG/etc" "$RIG/run" "$RIG/bin" "$RIG/core" "$RIG/var/etc"

	for f in "$RIG_SRC"/package/passwall-plus/files/pwplus-*; do
		cp "$f" "$RIG/lib/$(basename "$f")"
	done
	chmod +x "$RIG"/lib/* 2>/dev/null || true

	: > "$RIG/uci.conf"

	cat > "$RIG/bin/uci" <<'UCI'
#!/bin/sh
# Stand-in for uci. Understands exactly what these scripts ask of it.
_get=""; _key=""
for a in "$@"; do
	case "$a" in
		get) _get=1 ;;
		passwall-plus.config.*) _key="${a#passwall-plus.config.}" ;;
	esac
done
if [ -n "$_get" ] && [ -n "$_key" ]; then
	sed -n "s/^$_key=//p" "${PWPLUS_TEST_UCI:-/dev/null}" 2>/dev/null | head -1
fi
exit 0
UCI
	chmod +x "$RIG/bin/uci"

	# A core the scripts can find and run. On a machine where the real binary
	# has a different name or extension, this is what bridges the gap.
	if [ -n "$RIG_XRAY" ] && [ -x "$RIG_XRAY" ]; then
		printf '#!/bin/sh\nexec "%s" "$@"\n' "$RIG_XRAY" > "$RIG/core/xray"
		chmod +x "$RIG/core/xray"
	fi

	PWPLUS_LIB="$RIG/lib"
	PWPLUS_ETC="$RIG/etc"
	PWPLUS_RUN="$RIG/run"
	PWPLUS_OWN_DIR="$RIG/core"
	PWPLUS_CONFIG_JSON="$RIG/var/etc/passwall-plus.json"
	PWPLUS_TEST_UCI="$RIG/uci.conf"
	PATH="$RIG/bin:$PATH"
	export PWPLUS_LIB PWPLUS_ETC PWPLUS_RUN PWPLUS_OWN_DIR PWPLUS_CONFIG_JSON PWPLUS_TEST_UCI PATH
}

# rig_set key value
rig_set() {
	sed -i "/^$1=/d" "$RIG/uci.conf" 2>/dev/null || true
	printf '%s=%s\n' "$1" "$2" >> "$RIG/uci.conf"
}

rig_clear() { : > "$RIG/uci.conf"; }

PASS=0
FAIL=0

ok()   { PASS=$((PASS + 1)); echo "  ok   - $1"; }
bad()  { FAIL=$((FAIL + 1)); echo "  FAIL - $1"; }
check() { if [ "$1" = "$2" ]; then ok "$3"; else bad "$3 (expected [$2], got [$1])"; fi; }

rig_report() {
	echo
	echo "$PASS passed, $FAIL failed"
	[ "$FAIL" -eq 0 ]
}
