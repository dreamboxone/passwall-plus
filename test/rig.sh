#!/bin/sh
#
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Zirgozar - https://github.com/dreamboxone/zirgozar
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
RIG="${RIG_ROOT:-${TMPDIR:-/tmp}/zgz-rig}"

rig_setup() {
	rm -rf "$RIG"
	mkdir -p "$RIG/lib" "$RIG/etc" "$RIG/run" "$RIG/bin" "$RIG/core" "$RIG/var/etc"

	for f in "$RIG_SRC"/package/zirgozar/files/zgz-*; do
		cp "$f" "$RIG/lib/$(basename "$f")"
	done
	chmod +x "$RIG"/lib/* 2>/dev/null || true

	: > "$RIG/uci.conf"

	cat > "$RIG/bin/uci" <<'UCI'
#!/bin/sh
# Stand-in for uci. Understands exactly what these scripts ask of it.
#
# The main section is written as "key=value"; any other section - a node
# added by hand, named as a pre-proxy - as "section.key=value". A get of a
# section that has nothing exits 1, as the real one does: that is how the
# scripts tell a node that is there from one that is not.
_get=""; _key=""
for a in "$@"; do
	case "$a" in
		get) _get=1 ;;
		zirgozar.config.*) _key="${a#zirgozar.config.}" ;;
		zirgozar.*.*) _key="${a#zirgozar.}" ;;
	esac
done
if [ -n "$_get" ] && [ -n "$_key" ]; then
	_v="$(awk -v k="$_key" 'index($0, k "=") == 1 { print substr($0, length(k) + 2); exit }' "${ZGZ_TEST_UCI:-/dev/null}" 2>/dev/null)"
	[ -n "$_v" ] || exit 1
	printf '%s\n' "$_v"
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

	ZGZ_LIB="$RIG/lib"
	ZGZ_ETC="$RIG/etc"
	ZGZ_RUN="$RIG/run"
	ZGZ_OWN_DIR="$RIG/core"
	ZGZ_CONFIG_JSON="$RIG/var/etc/zirgozar.json"
	ZGZ_TEST_UCI="$RIG/uci.conf"
	PATH="$RIG/bin:$PATH"
	export ZGZ_LIB ZGZ_ETC ZGZ_RUN ZGZ_OWN_DIR ZGZ_CONFIG_JSON ZGZ_TEST_UCI PATH
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
