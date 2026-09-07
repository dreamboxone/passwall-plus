#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn
#
# Shared helpers. Sourced, not executed.
#
# Everything in here is written to be safe to source from a script running
# under `set -e`: nothing at source time may return non-zero.

# The roots. Overridable purely so that this can be run somewhere that is not
# a router: the test suite and the build both exercise the real scripts against
# a throwaway tree, and code that is only ever run in anger is code nobody has
# ever seen work.
OVPN_ETC="${OVPN_ETC:-/etc/ovpn}"
OVPN_RUN="${OVPN_RUN:-/var/run/ovpn}"
OVPN_OWN_DIR="${OVPN_OWN_DIR:-/usr/libexec/ovpn}"
OVPN_LIB="${OVPN_LIB:-/usr/libexec}"

# Where the pieces live. Kept in one place so that no two scripts can
# disagree about a path - which is how a lock came to be taken in one
# directory and looked for in another.
OVPN_CANDIDATES="$OVPN_RUN/candidates.tsv"
OVPN_RANKED="$OVPN_RUN/ranked.tsv"
OVPN_STATUS="$OVPN_RUN/status"
OVPN_MESSAGE="$OVPN_RUN/message"
OVPN_PROGRESS="$OVPN_RUN/progress"
OVPN_BEST="$OVPN_ETC/best.json"
OVPN_BEST_META="$OVPN_ETC/best.meta"
OVPN_NODE_CACHE="$OVPN_ETC/nodes.cache"
OVPN_CONFIG_JSON="${OVPN_CONFIG_JSON:-/var/etc/ovpn.json}"
OVPN_BRIDGE_JSON="${OVPN_BRIDGE_JSON:-/var/etc/ovpn-bridge.json}"
OVPN_VERSION_FILE="$OVPN_ETC/version"

mkdir -p "$OVPN_RUN" "$OVPN_ETC" 2>/dev/null || true

log() {
	logger -t ovpn -p daemon.info "$*" 2>/dev/null || true
	[ -t 2 ] && echo "$*" >&2
	return 0
}

warn() {
	logger -t ovpn -p daemon.warn "$*" 2>/dev/null || true
	[ -t 2 ] && echo "$*" >&2
	return 0
}

# One line the web interface shows verbatim when something needs explaining.
# Anything a user has to act on - no room on the router, a missing kernel
# module, a geo file that was asked for and is not there - belongs here and
# not only in the system log, where nobody will go looking for it.
say_message() {
	echo "$*" > "$OVPN_MESSAGE" 2>/dev/null || true
	return 0
}

clear_message() {
	rm -f "$OVPN_MESSAGE" 2>/dev/null || true
	return 0
}

say_status() {
	echo "$1" > "$OVPN_STATUS" 2>/dev/null || true
	return 0
}

# ---------------------------------------------------------------- settings

# Read one option out of /etc/config/ovpn with a default. uci is on every
# OpenWrt; off a router - the build validating its own output - there is
# none, so fall back to the default rather than failing.
cfg() {
	_v=""
	if command -v uci >/dev/null 2>&1; then
		_v="$(uci -q get "ovpn.config.$1" 2>/dev/null)" || _v=""
	fi
	[ -n "$_v" ] || _v="$2"
	echo "$_v"
	return 0
}

cfg_bool() {
	case "$(cfg "$1" "$2")" in
		1|on|true|yes|enabled) echo 1 ;;
		*) echo 0 ;;
	esac
	return 0
}

ovpn_version() {
	cat "$OVPN_VERSION_FILE" 2>/dev/null || echo unknown
	return 0
}

# ---------------------------------------------------------------- the core

# Which engine to run.
#
# A router that already has a core - the xray-core package, which PassWall2
# and other front-ends pull in - should use it rather than a second copy of
# the same thing sitting in flash. So try what is installed first and fall
# back to the copy this package carries.
#
# The choice is made by asking, not by comparing version numbers: with a
# configuration to hand, each candidate is offered it and the first that
# accepts wins. An older core that cannot read a modern REALITY or xhttp
# stanza is exactly what a version check would wave through, and it would
# then fail at the only moment that matters.
xray_paths() {
	echo "$OVPN_OWN_DIR/xray /usr/bin/xray /usr/local/bin/xray"
	return 0
}

find_xray() {
	_cfg="$1"
	_pref="$(cfg core_xray '')"
	# The configuration is offered to the core exactly as the service will run
	# it, and that includes telling it where geoip.dat and geosite.dat are.
	#
	# Without this the test is not the same question as the run. A core reads
	# geo files from its own asset directory - /usr/share/xray, or wherever it
	# was built to look - and ours are in /etc/ovpn/geo, so a configuration
	# naming geosite:ir was handed to a core that then looked somewhere else,
	# found either nothing or a different project's file with no ir category
	# in it, and refused the lot. Every core refused it for the same reason,
	# find_xray ran out of candidates, and the service gave up with "no xray on
	# this router can run the generated configuration" - on a router where the
	# files were present, correct, and thirty megabytes of them.
	#
	# It only bit with the Iran split switched on, because that is the only
	# thing that puts a geo category in the configuration. With it off the
	# same router connected perfectly, which is what made it look like a
	# problem with the split rather than with where the core was told to look.
	_geo="$(geo_dir)" || _geo=""
	for _x in $_pref $(xray_paths); do
		[ -n "$_x" ] || continue
		[ -x "$_x" ] || continue
		if [ -n "$_cfg" ]; then
			if [ -n "$_geo" ]; then
				XRAY_LOCATION_ASSET="$_geo" "$_x" run -test -config "$_cfg" >/dev/null 2>&1 || continue
			else
				"$_x" run -test -config "$_cfg" >/dev/null 2>&1 || continue
			fi
		else
			"$_x" version >/dev/null 2>&1 || continue
		fi
		echo "$_x"
		return 0
	done
	return 1
}

find_singbox() {
	for _x in "$OVPN_OWN_DIR/sing-box" /usr/bin/sing-box /usr/local/bin/sing-box; do
		[ -x "$_x" ] || continue
		"$_x" version >/dev/null 2>&1 || continue
		echo "$_x"
		return 0
	done
	return 1
}

find_hysteria() {
	for _x in "$OVPN_OWN_DIR/hysteria" /usr/bin/hysteria /usr/local/bin/hysteria; do
		[ -x "$_x" ] || continue
		echo "$_x"
		return 0
	done
	return 1
}

core_version() {
	[ -x "$1" ] || { echo ""; return 1; }
	case "$1" in
		*hysteria*) "$1" version 2>/dev/null | sed -n 's/^Version:[[:space:]]*//p' | head -1 ;;
		*sing-box*) "$1" version 2>/dev/null | sed -n 's/^sing-box version //p' | head -1 ;;
		*)          "$1" version 2>/dev/null | head -1 | awk '{print $2}' ;;
	esac
	return 0
}

# ---------------------------------------------------------------- the arch

# What to download for this router. DISTRIB_ARCH is the exact OpenWrt
# architecture and is what we prefer; uname is the fallback for a system
# whose /etc/openwrt_release is missing or has been rewritten.
openwrt_arch() {
	sed -n "s/^DISTRIB_ARCH='\\([^']*\\)'.*/\\1/p" /etc/openwrt_release 2>/dev/null | head -1
	return 0
}

# Prints three fields: the asset suffix for xray, for sing-box, and for
# hysteria. A dash means that core publishes no build for this machine, and
# the core manager refuses rather than downloading something that cannot run.
arch_assets() {
	_a="$(openwrt_arch)"
	[ -n "$_a" ] || _a="$(uname -m 2>/dev/null)"
	case "$_a" in
		aarch64*|arm64)                      echo "arm64-v8a arm64 arm64" ;;
		arm_cortex-a7*|arm_cortex-a8*|arm_cortex-a9*|arm_cortex-a15*|arm_cortex-a17*|armv7*)
		                                     echo "arm32-v7a armv7 arm" ;;
		arm_cortex-a5*|arm_arm1176*|arm_mpcore*|armv6*)
		                                     echo "arm32-v6 armv6 armv5" ;;
		arm_arm926*|arm_xscale*|armv5*)      echo "arm32-v5 armv5 armv5" ;;
		mipsel*|mipsle)                      echo "mips32le mipsle mipsle" ;;
		mips64el*)                           echo "mips64le mips64le -" ;;
		mips64*)                             echo "mips64 mips64 -" ;;
		mips*)                               echo "mips32 mips -" ;;
		x86_64|amd64)                        echo "64 amd64 amd64" ;;
		i386*|i486*|i686|x86)                echo "32 386 386" ;;
		riscv64*)                            echo "riscv64 riscv64 riscv64" ;;
		*)                                   echo "- - -" ;;
	esac
	return 0
}

# ----------------------------------------------------------------- storage

# Free bytes on the filesystem holding a path. `df -k` is in every busybox;
# `df -B1` and `df --output` are not, so do the arithmetic here.
free_bytes() {
	_p="$1"
	while [ -n "$_p" ] && [ ! -e "$_p" ]; do
		_q="$(dirname "$_p")"
		[ "$_q" = "$_p" ] && break
		_p="$_q"
	done
	[ -n "$_p" ] || _p=/
	df -k "$_p" 2>/dev/null | awk 'NR > 1 && $4 ~ /^[0-9]+$/ { print $4 * 1024; f = 1; exit } END { if (!f) print 0 }'
	return 0
}

# What the server says a download will weigh, without downloading it.
# Redirects are followed: both GitHub raw and the release URLs use them, and
# a HEAD that stops at the redirect reports nothing.
remote_size() {
	curl -fsSLI --connect-timeout 10 --max-time 30 "$1" 2>/dev/null |
		tr -d '\r' |
		awk 'tolower($1) == "content-length:" { n = $2 } END { print n + 0 }'
	return 0
}

human_size() {
	awk -v b="${1:-0}" 'BEGIN {
		if (b >= 1073741824) printf "%.1f GB", b / 1073741824
		else if (b >= 1048576) printf "%.1f MB", b / 1048576
		else if (b >= 1024) printf "%.0f KB", b / 1024
		else printf "%d B", b
	}'
	return 0
}

# Where else the same file lives, when the address it was asked for cannot be
# reached.
#
# Everything this program fetches by default - the server list, the routing
# data - is published on raw.githubusercontent.com, and that host is among the
# first things to disappear on the connection this exists to repair. The
# chicken and egg is real: the list cannot be read until the tunnel is up, and
# the tunnel cannot come up without the list. So a fetch that fails outright is
# tried again through two public mirrors of the same GitHub path before it is
# called a failure. They serve the identical file out of the identical public
# repository, and nothing this program fetches is private.
#
# Only raw.githubusercontent.com addresses have mirrors. A subscription hosted
# anywhere else is fetched exactly as it was written and nowhere else.
mirrors_for() {
	case "$1" in
		https://raw.githubusercontent.com/*)
			_rest="${1#https://raw.githubusercontent.com/}"
			_u="${_rest%%/*}"; _rest="${_rest#*/}"
			_r="${_rest%%/*}"; _rest="${_rest#*/}"
			_b="${_rest%%/*}"; _p="${_rest#*/}"
			# fewer than four parts: there is no file path to rewrite
			[ -n "$_u" ] && [ -n "$_r" ] && [ -n "$_b" ] || return 0
			[ -n "$_p" ] && [ "$_p" != "$_b" ] || return 0
			echo "https://cdn.jsdelivr.net/gh/$_u/$_r@$_b/$_p"
			echo "https://ghproxy.net/https://raw.githubusercontent.com/$_u/$_r/$_b/$_p"
			;;
	esac
	return 0
}

# Refuse a download that will not fit, before a byte of it is written.
#
# A router that fills its overlay does not merely fail to save the file: it
# remounts read-only, and from then on nothing works and nothing explains
# why. So the margin is deliberately generous and the answer is a refusal
# with a number in it rather than a truncated file.
OVPN_SPACE_MARGIN=2097152

space_for() {
	_need="$1"
	_dir="$2"
	_free="$(free_bytes "$_dir")"
	[ "$_need" -gt 0 ] 2>/dev/null || _need=0
	if [ "$_free" -lt $((_need + OVPN_SPACE_MARGIN)) ]; then
		say_message "Not enough room in $_dir: needs $(human_size $((_need + OVPN_SPACE_MARGIN))), $(human_size "$_free") free"
		warn "refusing download: needs $(human_size $((_need + OVPN_SPACE_MARGIN))) in $_dir, $(human_size "$_free") free"
		return 1
	fi
	return 0
}

# download_checked <url> <destination> [expected-bytes]
#
# Downloads beside the destination so that the temporary file and the final
# one share a filesystem - a download into /tmp that is then moved to /etc
# would have checked the space on the wrong disk and filled flash anyway -
# and only replaces the destination once the whole thing has arrived.
download_checked() {
	_url="$1"
	_dest="$2"
	_size="${3:-}"
	_dir="$(dirname "$_dest")"
	mkdir -p "$_dir" || return 1

	[ -n "$_size" ] || _size="$(remote_size "$_url")"
	# A source that will not say how big it is still has to fit something,
	# so assume a generous figure rather than skipping the check.
	[ "$_size" -gt 0 ] 2>/dev/null || _size=$((20 * 1024 * 1024))

	space_for "$_size" "$_dir" || return 1

	# _dl_part and not _tmp. There is no `local` in this shell, so every name
	# a helper assigns is a name it takes away from whoever called it - and
	# this one was called by a function that kept the file it wanted in _tmp.
	# The download then landed correctly, the caller's path was quietly
	# rewritten to the temporary name underneath it, and the file it went on
	# to install was the one that had just been moved away. What that looked
	# like from the outside was a core that downloaded fine and then "would
	# not run on this router - probably built for a different processor",
	# which sent the reader hunting for a build that was already correct.
	_dl_part="$_dest.part"
	rm -f "$_dl_part"
	_dl_ok=0
	for _dl_try in "$_url" $(mirrors_for "$_url"); do
		if curl -fsSL --connect-timeout 15 --max-time 900 --retry 2 -o "$_dl_part" "$_dl_try"; then
			_dl_ok=1
			[ "$_dl_try" = "$_url" ] || log "$_url was unreachable - took it from $_dl_try instead"
			break
		fi
		rm -f "$_dl_part"
	done
	if [ "$_dl_ok" != "1" ]; then
		rm -f "$_dl_part"
		say_message "Download failed: $_url"
		warn "download failed: $_url"
		return 1
	fi
	# Half a file is worse than none: it looks installed and fails later.
	_dl_got="$(wc -c < "$_dl_part" 2>/dev/null || echo 0)"
	if [ "$_dl_got" -lt 1024 ]; then
		rm -f "$_dl_part"
		say_message "Download looks truncated ($(human_size "$_dl_got")): $_url"
		warn "download truncated: $_url"
		return 1
	fi
	mv -f "$_dl_part" "$_dest" || { rm -f "$_dl_part"; return 1; }
	return 0
}

# ------------------------------------------------------------------- geo

# Where geoip.dat and geosite.dat actually are, or nothing.
#
# Both files or neither: Xray does not degrade when one is missing, it refuses
# to start, so a half-finished download must read as "no geo data" and not as
# "geo data". A router that already has them from another front-end is worth
# using rather than downloading twenty-five megabytes a second time.
# Where else a router may already have these files, because another front-end
# put them there. Overridable for the same reason the roots at the top of this
# file are: a test that means to say "this router has no routing data" has to
# be able to mean it, even when the machine it runs on has somebody else's
# copy. `${VAR-default}` rather than `${VAR:-default}`, so that an empty value
# is honoured as an answer instead of read as no answer.
OVPN_GEO_SEARCH="${OVPN_GEO_SEARCH-/usr/share/xray /usr/local/share/xray /usr/share/v2ray}"

geo_dir() {
	_d="$(cfg geo_dir "$OVPN_ETC/geo")"
	for _c in "$_d" $OVPN_GEO_SEARCH; do
		[ -n "$_c" ] || continue
		if [ -s "$_c/geoip.dat" ] && [ -s "$_c/geosite.dat" ]; then
			echo "$_c"
			return 0
		fi
	done
	echo ""
	return 1
}

# --------------------------------------------------------------- flash wear

# Replace a file only when its contents actually changed. Returns 0 when it
# wrote, 1 when there was nothing to write.
#
# The server list is refreshed every quarter of an hour. Writing it to the
# overlay every time is thirty-five thousand writes a year of a file that is
# usually identical to the one already there, onto flash rated for far fewer.
# This one function is the difference between a router that lasts and one
# that does not.
write_if_changed() {
	_src="$1"
	_dst="$2"
	if [ -f "$_dst" ] && cmp -s "$_src" "$_dst" 2>/dev/null; then
		return 1
	fi
	mkdir -p "$(dirname "$_dst")" 2>/dev/null || true
	cp -f "$_src" "$_dst" || return 1
	return 0
}

# -------------------------------------------------------------- the firewall

# Which firewall this router speaks.
#
# OpenWrt has used nftables since 22.03, so nearly every 23.05, 24.10 and
# 25.12 router is nftables, and the change in 25.12 is the package manager,
# not the firewall. But plenty of routers in the field run an older release
# or a vendor build that still carries firewall3, and on one of those an
# nft-only client installs cleanly, starts cleanly, and silently carries no
# traffic at all. So both are implemented and the choice is made here.
firewall_backend() {
	case "$(cfg firewall_backend auto)" in
		nftables|nft) echo nft; return 0 ;;
		iptables|ipt) echo ipt; return 0 ;;
	esac
	# `nft list tables` and not `nft list ruleset`: the status page asks this
	# every few seconds, and rendering the router's entire firewall to answer
	# a yes-or-no question is work nobody needs done.
	if command -v nft >/dev/null 2>&1 && nft list tables >/dev/null 2>&1; then
		echo nft
		return 0
	fi
	if command -v iptables >/dev/null 2>&1; then
		echo ipt
		return 0
	fi
	echo none
	return 0
}

# Can this kernel actually do what the ruleset is about to ask of it?
#
# nft parses a ruleset happily and then fails at commit time when a module is
# missing, and `nft -c` does not catch that either: it checks syntax, not the
# kernel. The only honest test is to load a throwaway table and look. Done
# once per boot and remembered.
nft_probe() {
	_what="$1"
	_cache="$OVPN_RUN/caps.$_what"
	if [ -f "$_cache" ]; then
		[ "$(cat "$_cache" 2>/dev/null)" = "1" ] && return 0
		return 1
	fi

	case "$_what" in
		tproxy) _rule='meta l4proto tcp tproxy ip to 127.0.0.1:65500 accept' ;;
		socket) _rule='meta l4proto tcp socket transparent 1 accept' ;;
		*) return 1 ;;
	esac

	if printf 'table inet ovpn_probe {\n chain c {\n  type filter hook prerouting priority mangle; policy accept;\n  %s\n }\n}\n' "$_rule" | nft -f - >/dev/null 2>&1; then
		nft delete table inet ovpn_probe >/dev/null 2>&1 || true
		echo 1 > "$_cache" 2>/dev/null || true
		return 0
	fi
	nft delete table inet ovpn_probe >/dev/null 2>&1 || true
	echo 0 > "$_cache" 2>/dev/null || true
	return 1
}

ipt_probe() {
	_cache="$OVPN_RUN/caps.ipt_tproxy"
	if [ -f "$_cache" ]; then
		[ "$(cat "$_cache" 2>/dev/null)" = "1" ] && return 0
		return 1
	fi
	if iptables -t mangle -N ovpn_probe >/dev/null 2>&1; then
		if iptables -t mangle -A ovpn_probe -p tcp -j TPROXY \
		     --on-ip 127.0.0.1 --on-port 65500 --tproxy-mark 0x1 >/dev/null 2>&1; then
			iptables -t mangle -F ovpn_probe >/dev/null 2>&1 || true
			iptables -t mangle -X ovpn_probe >/dev/null 2>&1 || true
			echo 1 > "$_cache" 2>/dev/null || true
			return 0
		fi
		iptables -t mangle -F ovpn_probe >/dev/null 2>&1 || true
		iptables -t mangle -X ovpn_probe >/dev/null 2>&1 || true
	fi
	echo 0 > "$_cache" 2>/dev/null || true
	return 1
}

forget_caps() {
	rm -f "$OVPN_RUN"/caps.* 2>/dev/null || true
	return 0
}

# Every device that carries a LAN, as the router itself sees it.
lan_devices() {
	_zone="$(cfg lan_zone '')"
	if [ -n "$_zone" ]; then
		echo "$_zone"
		return 0
	fi
	_devs=""
	if [ -r /lib/functions/network.sh ]; then
		. /lib/functions/network.sh
		for _iface in $(ubus list 'network.interface.*' 2>/dev/null | sed 's/network\.interface\.//'); do
			case "$_iface" in
				wan|wan6|wwan|wan_*|loopback) continue ;;
			esac
			_dev=""
			network_get_device _dev "$_iface" 2>/dev/null || _dev=""
			# not `[ ... ] && devs=...`: that is the last command of the loop
			# body, so an interface with no device would end the loop non-zero
			# and `set -e` would take the function with it, leaving no LAN
			if [ -n "$_dev" ]; then
				case " $_devs " in
					*" $_dev "*) : ;;
					*) _devs="$_devs $_dev" ;;
				esac
			fi
		done
	fi
	[ -n "$_devs" ] || _devs="br-lan"
	echo "$_devs"
	return 0
}

# ----------------------------------------------------------------- locking

# mkdir is atomic, so two callers cannot both believe they hold this.
ovpn_lock() {
	_lock="$OVPN_RUN/lock"
	if mkdir "$_lock" 2>/dev/null; then
		echo $$ > "$_lock/pid" 2>/dev/null || true
		return 0
	fi
	# A directory left behind by something that died would wedge this for
	# good, so only respect a lock something is actually holding.
	_pid="$(cat "$_lock/pid" 2>/dev/null)"
	if [ -n "$_pid" ] && kill -0 "$_pid" 2>/dev/null; then
		return 1
	fi
	rm -rf "$_lock" 2>/dev/null || true
	if mkdir "$_lock" 2>/dev/null; then
		echo $$ > "$_lock/pid" 2>/dev/null || true
		return 0
	fi
	return 1
}

ovpn_unlock() {
	rm -rf "$OVPN_RUN/lock" 2>/dev/null || true
	return 0
}

# -------------------------------------------------------------------- misc

# Is this tunnel's own core running? Matched on the configuration path, so it
# holds for whichever core was chosen and cannot be confused with someone
# else's.
tunnel_running() {
	pgrep -f "run -config $OVPN_CONFIG_JSON" >/dev/null 2>&1
}

# Another transparent proxy on the same router will fight this one for the
# same packets, and the loser is the user's connection.
passwall_running() {
	# Not "is the table there": stopping PassWall2 leaves an empty `inet
	# passwall2` behind, and asking that question put "PassWall is also
	# redirecting traffic on this router" on the front page of a router where
	# it had been switched off - which is a warning about the one thing the
	# reader has already done. Ask whether anything in it is still taking
	# traffic instead.
	for _t in "inet passwall2" "inet passwall"; do
		# shellcheck disable=SC2086
		nft list table $_t 2>/dev/null |
			grep -q -e tproxy -e 'redirect to' -e ' dnat ' && return 0
	done
	# Only worth asking iptables on a router that is actually using it.
	# On an nftables router this is iptables-nft, which is a process spawn and
	# a translation layer to answer a question whose answer is always no.
	if [ "$(firewall_backend)" = "ipt" ]; then
		iptables -t mangle -S PSW2_MANGLE >/dev/null 2>&1 && return 0
	fi
	return 1
}

json_escape() {
	printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g' -e 's/	/ /g'
	return 0
}
