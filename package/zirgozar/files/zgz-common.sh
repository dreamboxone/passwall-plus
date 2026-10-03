#!/bin/sh
#
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Zirgozar - https://github.com/dreamboxone/zirgozar
#
# Shared helpers. Sourced, not executed.
#
# Everything in here is written to be safe to source from a script running
# under `set -e`: nothing at source time may return non-zero.

# The roots. Overridable purely so that this can be run somewhere that is not
# a router: the test suite and the build both exercise the real scripts against
# a throwaway tree, and code that is only ever run in anger is code nobody has
# ever seen work.
ZGZ_ETC="${ZGZ_ETC:-/etc/zirgozar}"
ZGZ_RUN="${ZGZ_RUN:-/var/run/zirgozar}"
ZGZ_OWN_DIR="${ZGZ_OWN_DIR:-/usr/libexec/zirgozar}"
ZGZ_LIB="${ZGZ_LIB:-/usr/libexec}"

# Where the pieces live. Kept in one place so that no two scripts can
# disagree about a path - which is how a lock came to be taken in one
# directory and looked for in another.
ZGZ_CANDIDATES="$ZGZ_RUN/candidates.tsv"
ZGZ_RANKED="$ZGZ_RUN/ranked.tsv"
ZGZ_STATUS="$ZGZ_RUN/status"
ZGZ_MESSAGE="$ZGZ_RUN/message"
ZGZ_PROGRESS="$ZGZ_RUN/progress"
ZGZ_BEST="$ZGZ_ETC/best.json"
ZGZ_BEST_META="$ZGZ_ETC/best.meta"
ZGZ_NODE_CACHE="$ZGZ_ETC/nodes.cache"
ZGZ_CONFIG_JSON="${ZGZ_CONFIG_JSON:-/var/etc/zirgozar.json}"
ZGZ_BRIDGE_JSON="${ZGZ_BRIDGE_JSON:-/var/etc/zirgozar-bridge.json}"
ZGZ_VERSION_FILE="$ZGZ_ETC/version"

mkdir -p "$ZGZ_RUN" "$ZGZ_ETC" 2>/dev/null || true

# The addresses Iran's resolvers hand out for a blocked name instead of its
# real one. A phone or a laptop that looked a name up while the tunnel was off
# keeps that answer for a while after it is switched on, and the address sits
# inside 10.0.0.0/8, which the firewall treats as this network and leaves
# alone - so the site stays dead until the device forgets it. Connections to
# these go to an inbound of their own instead, which replaces the address with
# the name found in the connection and sends it on like anything else.
ZGZ_POISON_V4="10.10.34.0/24"
poison_port() {
	echo $(( $(cfg tproxy_port 1082) + 2 ))
	return 0
}

# The runtime log the Log page shows, the way PassWall2 keeps one: a file in
# RAM, a date on every line, and a button that empties it. Everything also
# goes to syslog as before - the file is what the page reads, the system log
# is what survives the page being cleared.
ZGZ_LOG="${ZGZ_LOG:-/tmp/log/zirgozar.log}"

log_line() {
	mkdir -p "$(dirname "$ZGZ_LOG")" 2>/dev/null || true
	echo "$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null): $*" >> "$ZGZ_LOG" 2>/dev/null || true
	return 0
}

# A step inside a longer run, indented under the line that started it - the
# shape PassWall2's own log has, so the two read the same way.
log_step() {
	log_line "  - $*"
	logger -t zirgozar -p daemon.info "$*" 2>/dev/null || true
	[ -t 2 ] && echo "$*" >&2
	return 0
}

log() {
	log_line "$*"
	logger -t zirgozar -p daemon.info "$*" 2>/dev/null || true
	[ -t 2 ] && echo "$*" >&2
	return 0
}

warn() {
	log_line "$*"
	logger -t zirgozar -p daemon.warn "$*" 2>/dev/null || true
	[ -t 2 ] && echo "$*" >&2
	return 0
}

# Kept to the last few hundred lines. It lives in RAM, and a router that has
# been up for a month would otherwise be carrying a month of it.
log_trim() {
	[ -f "$ZGZ_LOG" ] || return 0
	_lt_n="$(wc -l < "$ZGZ_LOG" 2>/dev/null || echo 0)"
	if [ "${_lt_n:-0}" -gt 1000 ] 2>/dev/null; then
		tail -n 500 "$ZGZ_LOG" > "$ZGZ_LOG.trim" 2>/dev/null &&
			mv -f "$ZGZ_LOG.trim" "$ZGZ_LOG" 2>/dev/null || true
	fi
	return 0
}

# One line the web interface shows verbatim when something needs explaining.
# Anything a user has to act on - no room on the router, a missing kernel
# module, a geo file that was asked for and is not there - belongs here and
# not only in the system log, where nobody will go looking for it.
say_message() {
	echo "$*" > "$ZGZ_MESSAGE" 2>/dev/null || true
	return 0
}

clear_message() {
	rm -f "$ZGZ_MESSAGE" 2>/dev/null || true
	return 0
}

say_status() {
	echo "$1" > "$ZGZ_STATUS" 2>/dev/null || true
	return 0
}

# ------------------------------------------------------------------ timing

# Run a command with a ceiling on how long it may take.
#
# Not `timeout`, because `timeout` is not on every router. It is a busybox
# applet and a stock OpenWrt 25.12 image does not build it in: `timeout 5 true`
# there exits 127, "not found". Every call in this program was written
# `timeout N cmd || true` or tested with `if timeout N cmd`, so on such a
# router not one of them ran and not one of them said so.
#
# What that cost was the entire program. rpcd was never told the web interface
# existed, so every button on every page did nothing at all. The crontab was
# never reloaded. Pressing Connect ran a restart that never happened and was
# then reported as a failed start. dnsmasq was never restarted, so name
# lookups never moved into the tunnel. Installing the missing dependencies
# never installed anything. All of it silent, on a freshly flashed router,
# with every script behind it working perfectly by hand.
#
# So: use it where it works, and do the same job with a background watchdog
# where it does not.
#
# Where it works - not where it exists. A router can have /usr/bin/timeout as
# a link to a busybox built without the applet: the link is there, `command -v`
# finds it, and every call through it answers "applet not found" with 127.
# That was the same silent failure all over again on a freshly flashed 25.12
# router: the tunnel was never started, never enabled at boot, and dnsmasq
# was never restarted. So it is asked to run something first - once per
# process, the first time a ceiling is needed.
ZGZ_HAVE_TIMEOUT=""

bounded() {
	_bd_secs="$1"
	shift
	if [ -z "$ZGZ_HAVE_TIMEOUT" ]; then
		ZGZ_HAVE_TIMEOUT=0
		if command -v timeout >/dev/null 2>&1 && timeout 5 true >/dev/null 2>&1; then
			ZGZ_HAVE_TIMEOUT=1
		fi
	fi
	if [ "$ZGZ_HAVE_TIMEOUT" = "1" ]; then
		timeout "$_bd_secs" "$@"
		return $?
	fi

	"$@" &
	_bd_pid=$!
	(
		_bd_n=0
		while [ "$_bd_n" -lt "$_bd_secs" ]; do
			kill -0 "$_bd_pid" 2>/dev/null || exit 0
			sleep 1
			_bd_n=$((_bd_n + 1))
		done
		kill -TERM "$_bd_pid" 2>/dev/null || true
	) &
	_bd_watch=$!

	_bd_rc=0
	wait "$_bd_pid" || _bd_rc=$?
	kill "$_bd_watch" 2>/dev/null || true
	wait "$_bd_watch" 2>/dev/null || true
	return "$_bd_rc"
}

# ---------------------------------------------------------------- settings

# Read one option out of /etc/config/zirgozar with a default. uci is on every
# OpenWrt; off a router - the build validating its own output - there is
# none, so fall back to the default rather than failing.
cfg() {
	_v=""
	if command -v uci >/dev/null 2>&1; then
		_v="$(uci -q get "zirgozar.config.$1" 2>/dev/null)" || _v=""
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

zgz_version() {
	cat "$ZGZ_VERSION_FILE" 2>/dev/null || echo unknown
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
	echo "$ZGZ_OWN_DIR/xray /usr/bin/xray /usr/local/bin/xray"
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
	# was built to look - and ours are in /etc/zirgozar/geo, so a configuration
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
	for _x in $_pref $(xray_by_version); do
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

# ------------------------------------------------------ the engine choice
#
# Xray is the engine unless the settings say sing-box. zgz-mkconfig is the one
# place that decides what the tunnel does and it speaks Xray; for sing-box the
# same configuration is run through zgz-sbconfig, which says it again in
# sing-box's words - the same inbounds, outbounds, rules and DNS, not a second
# set of decisions to keep in step with the first.
#
# What is configured is not always what is running: a router with no sing-box
# on it, or a node sing-box cannot speak, falls back to Xray rather than to no
# tunnel at all. What is running is what the service wrote down when it
# started, so everything that talks to the core asks that.
core_engine() {
	case "$(cfg core_engine xray)" in
		singbox|sing-box|singbox-lx) echo singbox ;;
		*) echo xray ;;
	esac
	return 0
}

active_engine() {
	case "$(sed -n 's/^name=//p' "$ZGZ_RUN/core.info" 2>/dev/null | tail -1)" in
		sing-box|sing-box-lx) echo singbox ;;
		xray) echo xray ;;
		*) core_engine ;;
	esac
	return 0
}

# The engine's name as written down for the status page, and as it reads in
# the log.
core_label() {
	if [ "$1" = "singbox" ]; then
		if [ "$(cfg core_engine xray)" = "singbox-lx" ]; then echo sing-box-lx; else echo sing-box; fi
	else
		echo xray
	fi
	return 0
}

core_title() {
	if [ "$1" = "singbox" ]; then core_label singbox; else echo Xray; fi
	return 0
}

# Xray's configuration on stdin, sing-box's on stdout. What could not be
# carried over is said on stderr, one line each, and ends up in the log.
sbconfig() {
	_sb_level="$(cfg loglevel warning)"
	[ "$(cfg_bool log_node 1)" = "1" ] || _sb_level=none
	ucode "$ZGZ_LIB/zgz-sbconfig" \
		geoview="$(geoview_path)" geodir="$(geo_dir 2>/dev/null)" \
		rsdir="$ZGZ_RUN/rs" api="$(cfg api_port 10853)" \
		bridge="$ZGZ_ETC/bridge.json" bridgeport="$(cfg bridge_port 10808)" \
		mark="$ZGZ_OUT_MARK" level="$_sb_level"
}

# The configuration for the engine asked for, on stdout.
#
#   core_config [xray|singbox] [nogeo]
core_config() {
	_cc_engine="$1"; shift
	if [ "$_cc_engine" = "singbox" ]; then
		"$ZGZ_LIB/zgz-mkconfig" "$@" | sbconfig
	else
		"$ZGZ_LIB/zgz-mkconfig" "$@"
	fi
}

# The command line that runs a configuration, and the one that only checks it.
core_run_args() {
	if [ "$1" = "singbox" ]; then echo "run -c $2"; else echo "run -config $2"; fi
}

# Does this core accept this configuration? The question every candidate is
# asked, exactly as the service would run it.
core_accepts() {
	_ca_prog="$1"; _ca_cfg="$2"; _ca_engine="$3"
	if [ "$_ca_engine" = "singbox" ]; then
		"$_ca_prog" check -c "$_ca_cfg" >"$ZGZ_RUN/core-check.err" 2>&1
		return $?
	fi
	_ca_geo="$(geo_dir)" || _ca_geo=""
	if [ -n "$_ca_geo" ]; then
		XRAY_LOCATION_ASSET="$_ca_geo" "$_ca_prog" run -test -config "$_ca_cfg" >/dev/null 2>&1
	else
		"$_ca_prog" run -test -config "$_ca_cfg" >/dev/null 2>&1
	fi
}

# The sing-box to run: the file the settings name, or this program's own copy.
# Never another package's - see core_dir below. Which of the two sing-box
# files it is depends on the setting: the official one, or sing-box-lx.
engine_singbox_path() {
	if [ "$(cfg core_engine xray)" = "singbox-lx" ]; then
		singbox_lx_path
	else
		singbox_path
	fi
	return 0
}

find_engine_singbox() {
	_fs_sb="$(engine_singbox_path)"
	[ -x "$_fs_sb" ] || return 1
	if [ -n "$1" ]; then
		core_accepts "$_fs_sb" "$1" singbox || return 1
	else
		"$_fs_sb" version >/dev/null 2>&1 || return 1
	fi
	echo "$_fs_sb"
	return 0
}

# The helper cores are this program's own, kept in its own folder, and never
# another package's. A sing-box that PassWall2 installed is PassWall2's: it is
# upgraded, downgraded or removed on PassWall2's schedule, and a bridge built
# on it would change underneath this one without anything here knowing. So
# only the copy in core_dir is used - installed from the App Update page -
# and a router that has another program's copy simply shows this one as not
# installed yet.
core_dir() {
	cfg core_dir "$ZGZ_OWN_DIR"
	return 0
}

# PassWall2's App Path for sing-box and hysteria: the file itself when one is
# set - to run from memory, a path under /tmp - and otherwise this program's
# own copy in the cores folder. Either way it is the one file this program
# installs, updates and uses, and nobody else's.
singbox_path() {
	_sp="$(cfg core_singbox '')"
	echo "${_sp:-$(core_dir)/sing-box}"
	return 0
}

# The sing-box build that speaks xhttp - sing-box-lx - installed from App
# Update into a file of its own. It is what carries the tunnel when the
# engine is set to it; the helper above stays the official one.
singbox_lx_path() {
	_lp="$(cfg core_singbox_lx '')"
	echo "${_lp:-$(core_dir)/sing-box-lx}"
	return 0
}

hysteria_path() {
	_hp="$(cfg core_hysteria '')"
	echo "${_hp:-$(core_dir)/hysteria}"
	return 0
}

# Geoview, for the Geo View page - PassWall2's tool for reading the routing
# data: which lists hold a name or an address, and what one list holds.
geoview_path() {
	_gp="$(cfg core_geoview '')"
	echo "${_gp:-$(core_dir)/geoview}"
	return 0
}

find_geoview() {
	_fg="$(geoview_path)"
	[ -x "$_fg" ] && { echo "$_fg"; return 0; }
	return 1
}

find_singbox() {
	_fs="$(singbox_path)"
	[ -x "$_fs" ] && "$_fs" version >/dev/null 2>&1 && { echo "$_fs"; return 0; }
	return 1
}

find_hysteria() {
	_fh="$(hysteria_path)"
	[ -x "$_fh" ] && { echo "$_fh"; return 0; }
	return 1
}

# A file's size in bytes, read from its directory entry rather than by reading
# the file.
file_size() {
	ls -ln "$1" 2>/dev/null | awk '{ print $5 + 0; exit }'
	return 0
}

# The version of a core, asked of the binary once and then remembered for as
# long as the binary is the same file - same size, same time. Asking means
# starting the core, which on a small router is most of a second each time,
# and the App Update page asks every few seconds.
core_version_cached() {
	[ -x "$1" ] || { echo ""; return 1; }
	# Size and time from the directory entry. Not `stat -c`, which busybox is
	# often built without, and never `wc -c`, which reads all thirty-odd
	# megabytes of the core to count them.
	_cvk="$1 $(file_size "$1") $(date -r "$1" +%s 2>/dev/null)"
	_cvf="$ZGZ_RUN/core.versions"
	_cvv="$(awk -v k="$_cvk" 'index($0, k "\t") == 1 { print substr($0, length(k) + 2); exit }' "$_cvf" 2>/dev/null)"
	if [ -z "$_cvv" ]; then
		_cvv="$(core_version "$1")"
		{
			grep -v "^$1 " "$_cvf" 2>/dev/null || true
			printf '%s\t%s\n' "$_cvk" "$_cvv"
		} > "$_cvf.new" 2>/dev/null && mv -f "$_cvf.new" "$_cvf" 2>/dev/null
	fi
	echo "$_cvv"
	return 0
}

# The cores on this router, newest first. Our own copy used to be tried
# first whatever its age, and a router that had a newer one from another
# package went on using ours - which is how large uploads over xhttp, fixed
# in Xray months earlier, kept failing here while the same server worked
# from a laptop and from PassWall2 on the very same router. Versions are
# compared as numbers, part by part; one that will not say comes last.
xray_by_version() {
	for _xv in $(xray_paths); do
		[ -x "$_xv" ] || continue
		# The path first: a version that will not say is an empty field, and
		# an empty field first shifts every other one along - which made the
		# path come out empty, and no core at all be found.
		printf '%s %s\n' "$_xv" "$(core_version_cached "$_xv" | sed 's/^v//')"
	done | awk '{
		n = split($2, p, ".")
		k = ""
		for (i = 1; i <= 4; i++) k = k sprintf("%06d", (i <= n && p[i] ~ /^[0-9]+$/) ? p[i] : 0)
		print k, $1
	}' | sort -r | awk '{ print $2 }'
	return 0
}

# Which Xray a page should talk about, without starting any of them to find
# out: the one the settings insist on, or the newest there is.
xray_installed() {
	for _xi in $(cfg core_xray '') $(xray_by_version); do
		[ -x "$_xi" ] && { echo "$_xi"; return 0; }
	done
	return 1
}

core_version() {
	[ -x "$1" ] || { echo ""; return 1; }
	case "$1" in
		*hysteria*) "$1" version 2>/dev/null | sed -n 's/^Version:[[:space:]]*//p' | head -1 ;;
		*sing-box*) "$1" version 2>/dev/null | sed -n 's/^sing-box version //p' | head -1 ;;
		*geoview*)  "$1" -version 2>/dev/null | awk 'NR == 1 && $1 == "Geoview" { print $2 }' ;;
		# Xray prints "Xray 26.9.9 (...)", a sing-box under any file name prints
		# "sing-box version 1.14.2".
		*)          "$1" version 2>/dev/null | head -1 | awk '$1 == "sing-box" { print $3; next } { print $2 }' ;;
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
ZGZ_SPACE_MARGIN=2097152

space_for() {
	_need="$1"
	_dir="$2"
	_free="$(free_bytes "$_dir")"
	[ "$_need" -gt 0 ] 2>/dev/null || _need=0
	if [ "$_free" -lt $((_need + ZGZ_SPACE_MARGIN)) ]; then
		say_message "Not enough room in $_dir: needs $(human_size $((_need + ZGZ_SPACE_MARGIN))), $(human_size "$_free") free"
		warn "refusing download: needs $(human_size $((_need + ZGZ_SPACE_MARGIN))) in $_dir, $(human_size "$_free") free"
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
ZGZ_GEO_SEARCH="${ZGZ_GEO_SEARCH-/usr/share/xray /usr/local/share/xray /usr/share/v2ray}"

geo_dir() {
	_d="$(cfg geo_dir "$ZGZ_ETC/geo")"
	for _c in "$_d" $ZGZ_GEO_SEARCH; do
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
	_cache="$ZGZ_RUN/caps.$_what"
	if [ -f "$_cache" ]; then
		[ "$(cat "$_cache" 2>/dev/null)" = "1" ] && return 0
		return 1
	fi

	case "$_what" in
		tproxy) _rule='meta l4proto tcp tproxy ip to 127.0.0.1:65500 accept' ;;
		socket) _rule='meta l4proto tcp socket transparent 1 accept' ;;
		*) return 1 ;;
	esac

	if printf 'table inet zgz_probe {\n chain c {\n  type filter hook prerouting priority mangle; policy accept;\n  %s\n }\n}\n' "$_rule" | nft -f - >/dev/null 2>&1; then
		nft delete table inet zgz_probe >/dev/null 2>&1 || true
		echo 1 > "$_cache" 2>/dev/null || true
		return 0
	fi
	nft delete table inet zgz_probe >/dev/null 2>&1 || true
	echo 0 > "$_cache" 2>/dev/null || true
	return 1
}

ipt_probe() {
	_cache="$ZGZ_RUN/caps.ipt_tproxy"
	if [ -f "$_cache" ]; then
		[ "$(cat "$_cache" 2>/dev/null)" = "1" ] && return 0
		return 1
	fi
	if iptables -t mangle -N zgz_probe >/dev/null 2>&1; then
		if iptables -t mangle -A zgz_probe -p tcp -j TPROXY \
		     --on-ip 127.0.0.1 --on-port 65500 --tproxy-mark 0x1 >/dev/null 2>&1; then
			iptables -t mangle -F zgz_probe >/dev/null 2>&1 || true
			iptables -t mangle -X zgz_probe >/dev/null 2>&1 || true
			echo 1 > "$_cache" 2>/dev/null || true
			return 0
		fi
		iptables -t mangle -F zgz_probe >/dev/null 2>&1 || true
		iptables -t mangle -X zgz_probe >/dev/null 2>&1 || true
	fi
	echo 0 > "$_cache" 2>/dev/null || true
	return 1
}

forget_caps() {
	rm -f "$ZGZ_RUN"/caps.* 2>/dev/null || true
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
zgz_lock() {
	_lock="$ZGZ_RUN/lock"
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

zgz_unlock() {
	rm -rf "$ZGZ_RUN/lock" 2>/dev/null || true
	return 0
}

# -------------------------------------------------------------------- misc

# Is this tunnel's own core running? Matched on the configuration path, so it
# holds for whichever core was chosen and cannot be confused with someone
# else's.
tunnel_running() {
	pgrep -f "run -c(onfig)? $ZGZ_CONFIG_JSON" >/dev/null 2>&1
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
	for _t in "inet passwall2" "inet passwall" "inet passwall-plus"; do
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

# -------------------------------------------------------------- direct DNS

# The resolver that answers for everything that goes straight out, as
# "proto address port". PassWall2's rule, and its option names:
# direct_dns_protocol empty is Auto - the upstream dnsmasq was configured
# with, and failing that whatever the ISP handed out - and udp or tcp is the
# one in direct_dns.
#
# It matters more here than in PassWall2, because here dnsmasq's upstream is
# the tunnel itself. A node whose address is a name, resolved the ordinary
# way, asks dnsmasq, which asks the tunnel, which needs that very node to
# answer - and a dead tunnel cannot answer at all, so the moment a node dies
# every node with a name in its address looks dead too. So node names are
# always resolved through this, and this never through the tunnel.
direct_dns() {
	_dd_p="$(cfg direct_dns_protocol '')"
	_dd_v="$(cfg direct_dns '')"
	# Written by versions that had only an Iranian resolver for the split.
	if [ -z "$_dd_p" ] && [ -z "$_dd_v" ]; then
		_dd_v="$(cfg ir_dns '')"
		[ -n "$_dd_v" ] && _dd_p=udp
	fi
	case "$_dd_p" in
		udp|tcp)
			if [ -n "$_dd_v" ]; then
				_dd_a="${_dd_v%%#*}"; _dd_port="53"
				case "$_dd_v" in
					*#*) _dd_port="${_dd_v#*#}" ;;
					*.*.*.*:*) _dd_a="${_dd_v%:*}"; _dd_port="${_dd_v##*:}" ;;
				esac
				case "$_dd_port" in ''|*[!0-9]*) _dd_port=53 ;; esac
				echo "$_dd_p $_dd_a $_dd_port"
				return 0
			fi
			;;
	esac
	# Auto. dnsmasq's own upstream first, as PassWall2 does - but only the
	# plain ones: an entry with a slash in it answers for one domain only.
	for _dd_s in $(uci -q get 'dhcp.@dnsmasq[0].server' 2>/dev/null); do
		case "$_dd_s" in */*|'') continue ;; esac
		_dd_a="${_dd_s%%#*}"; _dd_port="${_dd_s#*#}"
		[ "$_dd_port" = "$_dd_s" ] && _dd_port=53
		case "$_dd_a" in *.*.*.*) : ;; *) continue ;; esac
		case "$_dd_port" in ''|*[!0-9]*) _dd_port=53 ;; esac
		# One of our own listeners is not a way out of the tunnel.
		[ "$_dd_a" = "127.0.0.1" ] && [ "$_dd_port" = "$(cfg dns_port 1053)" ] && continue
		echo "udp $_dd_a $_dd_port"
		return 0
	done
	for _dd_f in /tmp/resolv.conf.d/resolv.conf.auto /tmp/resolv.conf.auto; do
		[ -s "$_dd_f" ] || continue
		_dd_a="$(awk '$1 == "nameserver" && $2 ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ &&
		              $2 != "127.0.0.1" && $2 != "0.0.0.0" { print $2; exit }' "$_dd_f" 2>/dev/null)"
		if [ -n "$_dd_a" ]; then
			echo "udp $_dd_a 53"
			return 0
		fi
	done
	# Nothing handed out at all - a static WAN with no resolver. Something has
	# to answer for the node names, or a node with a name cannot be reached.
	echo "udp 1.1.1.1 53"
	return 0
}

# One name, resolved through the direct resolver rather than the router's own
# - see above for why. Prints the first IPv4 address, or nothing.
resolve_direct() {
	case "$1" in
		*:*|'') return 1 ;;
		*[!0-9.]*) : ;;
		*) echo "$1"; return 0 ;;
	esac
	set -- "$1" ${ZGZ_DDNS:-$(direct_dns)}
	[ -n "${3:-}" ] || return 1
	# busybox nslookup takes the server as its second argument; the answer
	# section is everything after the server's own "Address" line.
	bounded 4 nslookup "$1" "$3" 2>/dev/null | awk '
		/^Name:/ { named = 1; next }
		named && /^Address/ {
			for (i = 2; i <= NF; i++)
				if ($i ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) { print $i; exit }
		}'
	return 0
}

# --------------------------------------------------------- the Xray tab

# What every proxied outbound is given from the Xray settings: fragment and
# noise, which Xray 26 carries as finalmask on the outbound's own stream, and
# mux. Each prints the JSON for its piece, or nothing when it is off.
#
# Fragment is written twice over, length and lengths, delay and delays. The
# core this package carries reads the first pair and ignores the second;
# Xray 26.9 reads the second and falls back to the first. Written both ways,
# it means the same thing to either core rather than being refused by one.
fragment_json() {
	[ "$(cfg_bool fragment 0)" = "1" ] || return 0
	_fr_p="$(cfg fragment_packets tlshello)"
	_fr_l="$(cfg fragment_lengths '3-5,6-8,10-20' | tr -d ' ')"
	_fr_d="$(cfg fragment_delays '10-20' | tr -d ' ')"
	_fr_m="$(cfg fragment_maxSplit '3-6' | tr -d ' ')"
	printf '{"type":"fragment","settings":{"packets":"%s","length":"%s","lengths":[%s],"delay":"%s","delays":[%s]%s}}' \
		"$(json_escape "$_fr_p")" \
		"$(json_escape "${_fr_l%%,*}")" \
		"$(printf '%s' "$_fr_l" | awk -F, '{ for (i = 1; i <= NF; i++) if ($i != "") printf "%s\"%s\"", (n++ ? "," : ""), $i }')" \
		"$(json_escape "${_fr_d%%,*}")" \
		"$(printf '%s' "$_fr_d" | awk -F, '{ for (i = 1; i <= NF; i++) if ($i != "") printf "%s\"%s\"", (n++ ? "," : ""), $i }')" \
		"$([ -n "$_fr_m" ] && printf ',"maxSplit":"%s"' "$(json_escape "$_fr_m")")"
	return 0
}

# PassWall2's noise table: `config xray_noise_packets` sections, each with a
# type, a packet (or, for rand, a length) and a delay.
noise_json() {
	[ "$(cfg_bool noise 0)" = "1" ] || return 0
	command -v uci >/dev/null 2>&1 || return 0
	_nz="$(uci -q show zirgozar 2>/dev/null | awk -F'[.=]' '
		NF == 3 && $3 == "xray_noise_packets" { order[++n] = $2; next }
		NF >= 4 {
			v = $0; sub(/^[^=]*=/, "", v); gsub(/^'\''|'\''$/, "", v)
			val[$2 "." $3] = v
		}
		END {
			for (i = 1; i <= n; i++) {
				s = order[i]
				if ((s ".enabled") in val && val[s ".enabled"] != "1") continue
				t = val[s ".type"]; p = val[s ".packet"]; d = val[s ".delay"]
				if (p == "") continue
				gsub(/\\/, "\\\\", p); gsub(/"/, "\\\"", p)
				item = (t == "rand" || t == "") ? "\"rand\":\"" p "\"" \
				     : (t == "array" && p ~ /^\[.*\]$/) ? "\"type\":\"array\",\"packet\":" p \
				     : "\"type\":\"" t "\",\"packet\":\"" p "\""
				if (d != "") item = item ",\"delay\":\"" d "\""
				out = out (out != "" ? "," : "") "{" item "}"
			}
			if (out != "") printf "%s", out
		}')"
	[ -n "$_nz" ] || return 0
	printf '{"type":"noise","settings":{"reset":0,"noise":[%s]}}' "$_nz"
	return 0
}

mux_json() {
	[ "$(cfg_bool mux 0)" = "1" ] || return 0
	_mx_c="$(cfg mux_concurrency 8)"; _mx_x="$(cfg xudp_concurrency 16)"
	case "$_mx_c" in ''|*[!0-9-]*) _mx_c=8 ;; esac
	case "$_mx_x" in ''|*[!0-9-]*) _mx_x=16 ;; esac
	printf '{"enabled":true,"concurrency":%s,"xudpConcurrency":%s,"xudpProxyUDP443":"%s"}' \
		"$_mx_c" "$_mx_x" "$(cfg xudp_proxy_udp443 reject)"
	return 0
}

# The section named as the pre-proxy for every node, when it is switched on.
# PassWall2 calls this the pre-proxy of a shunt node; here the tunnel is that
# shunt - Iran one way, everything else the other - so it is set once, here,
# and every node the tunnel may choose dials out through it.
global_preproxy() {
	[ "$(cfg_bool preproxy_enabled 0)" = "1" ] || return 1
	_gp="$(cfg preproxy_node '')"
	[ -n "$_gp" ] || return 1
	uci -q get "zirgozar.$_gp.link" >/dev/null 2>&1 || return 1
	echo "$_gp"
	return 0
}

# decorate [dialer-tag] [skip-host|port]
#
# Reads records - or bare outbounds - on stdin and writes them back with the
# Xray tab applied, and with the outbound dialling through the dialer tag
# when one is given and it has none of its own. A record whose own host and
# port are skip-host|port is left without the dialer: a node is not its own
# pre-proxy.
decorate() {
	FRAG="$(fragment_json)" NOISE="$(noise_json)" MUX="$(mux_json)" \
	DIALER="${1:-}" SKIPHP="${2:-}" DOMSTRAT="${DOMSTRAT:-}" SOMARK="$ZGZ_OUT_MARK" \
		LC_ALL=C awk -v DECORATE=1 -f "$ZGZ_LIB/zgz-parse"
}

# The mark every connection the core itself opens carries. The firewall lets
# anything with it straight past, which is what stops the router's own
# traffic, once Localhost Proxy sends it into the tunnel, from sending the
# tunnel's own connections into the tunnel as well. 255 is the value the
# rules already honour as "leave this alone".
ZGZ_OUT_MARK=255

# The outbound of one hand-added node, tagged chain-<section>, for the
# outbounds that name it as their dialer. Only the first link of the section
# is used, and it is never itself given a dialer: a chain is one hop deep, so
# two sections naming each other cannot become a loop.
chain_outbound() {
	_co_link="$(uci -q get "zirgozar.$1.link" 2>/dev/null)" || _co_link=""
	if [ -n "$_co_link" ]; then
		_co="$(printf '%s\n' "$_co_link" | LC_ALL=C awk -v LIMIT=1 -f "$ZGZ_LIB/zgz-parse" 2>/dev/null | head -1)"
	else
		# Not a hand-added node: a subscription's own node that its landing
		# chain goes through, kept beside the list by zgz-nodes under the
		# name the landing node dials.
		_co="$(LC_ALL=C awk -F'\t' -v id="$1" '
			$1 == id { sub(/^[^\t]*\t/, ""); printf "x\tx\tx\tx\t0\t%s\n", $0; exit }' \
			"$ZGZ_RUN/chains.tsv" 2>/dev/null)"
	fi
	[ -n "$_co" ] || return 1
	case "$(printf '%s' "$_co" | cut -f3)" in
		# A pre-proxy Xray cannot speak cannot be dialled through by Xray.
		hysteria2|hysteria|tuic|openvpn|amneziawg) return 1 ;;
	esac
	printf '%s\n' "$_co" | cut -f6- | DOMSTRAT="${DOMSTRAT:-}" decorate |
		sed -e "s/^{/{\"tag\":\"chain-$1\",/"
	return 0
}

# Every chain-<section> the given outbounds dial through, as outbounds of
# their own, one per line, each once.
chain_outbounds() {
	printf '%s\n' "$1" | grep -o '"dialerProxy":"chain-[A-Za-z0-9_]*"' | sort -u |
		sed 's/.*"chain-\([A-Za-z0-9_]*\)"/\1/' | while read -r _cs; do
			[ -n "$_cs" ] || continue
			chain_outbound "$_cs" || warn "the pre-proxy '$_cs' could not be read - it has been deleted, or Xray cannot speak it"
		done
	return 0
}

# Only the dialer, none of the Xray tab: for building a record, which is
# decorated in full later, where it is used.
set_dialer() {
	FRAG="" NOISE="" MUX="" DIALER="$1" SKIPHP="" DOMSTRAT="" \
		LC_ALL=C awk -v DECORATE=1 -f "$ZGZ_LIB/zgz-parse"
}

# A record that reaches the network through another node. The router can
# only knock on the first hop, and a handshake to a server it never talks to
# directly measures nothing.
first_hop_is_chained() {
	case "$1" in
		*'"dialerProxy":"chain-'*) return 0 ;;
	esac
	return 1
}

# How a node's own server name is resolved: through the core's DNS - which
# sends it to the direct resolver - rather than through the router's.
node_domain_strategy() {
	if [ "$(cfg ipv6 block)" = "off" ]; then echo UseIP; else echo UseIPv4; fi
	return 0
}

# The links one hand-added section holds, one per line. A section may hold
# several pasted at once; it is split only where a new link begins, because
# names have spaces in them. A name typed on the page goes after the # of a
# link that has none of its own.
section_links() {
	_sl_link="$(uci -q get "zirgozar.$1.link" 2>/dev/null)" || return 1
	[ -n "$_sl_link" ] || return 1
	_sl_name="$(uci -q get "zirgozar.$1.name" 2>/dev/null)" || _sl_name=""
	# A whole WireGuard .conf is one document, not a list of links: cutting it
	# into lines and hanging the name on each of them would turn every key in
	# it into something else. The name goes in as the comment the parser
	# reads a name from.
	if printf '%s\n' "$_sl_link" | grep -qi '^[[:space:]]*\[\(interface\|peer\)\]'; then
		[ -z "$_sl_name" ] || printf '# %s\n' "$_sl_name"
		printf '%s\n' "$_sl_link"
		return 0
	fi
	# An OpenVPN profile is a document too. The user name, the password and the
	# pass phrase of its key are settings of the node and not part of the file,
	# so they are put in front of it as comments the parser reads.
	if printf '%s\n' "$_sl_link" | grep -qiE '^[[:space:]]*(client[[:space:]]*$|remote[[:space:]]+[^[:space:]]+|<ca>)'; then
		for _k in user pass keypass; do
			_v="$(uci -q get "zirgozar.$1.ovpn_$_k" 2>/dev/null)" || _v=""
			[ -z "$_v" ] || printf '#!zgz-%s=%s\n' "$_k" "$_v"
		done
		[ -z "$_sl_name" ] || printf '# %s\n' "$_sl_name"
		printf '%s\n' "$_sl_link"
		return 0
	fi
	printf '%s\n' "$_sl_link" | NAME="$_sl_name" LC_ALL=C awk '
		{
			gsub(/[ \t]+[a-zA-Z][a-zA-Z0-9+.-]*:\/\//, "\n&")
			n = split($0, lines, "\n")
			for (i = 1; i <= n; i++) {
				l = lines[i]
				gsub(/^[ \t]+|[ \t]+$/, "", l)
				if (l == "") continue
				if (ENVIRON["NAME"] != "" && index(l, "#") == 0)
					l = l "#" ENVIRON["NAME"]
				print l
			}
		}'
	return 0
}

# The records a hand-added node puts into the running, with its own chain
# applied - PassWall2's chain_proxy, option for option:
#
#   chain_proxy 1, preproxy_node P   this node, dialling out through P
#   chain_proxy 2, to_node L         the landing node: traffic goes through
#                                    this node first and on to L, which is
#                                    where it finally leaves from
#
# Either way the record keeps this node's own address, because that is the
# hop the router actually reaches. A chain naming the node itself, a node
# that is gone, or one Xray cannot speak is ignored rather than guessed at.
node_records() {
	_nd_recs="$(section_links "$1" | LC_ALL=C awk -v LIMIT="${2:-300}" -f "$ZGZ_LIB/zgz-parse" 2>/dev/null)"
	[ -n "$_nd_recs" ] || return 1
	_nd_mode="$(uci -q get "zirgozar.$1.chain_proxy" 2>/dev/null)" || _nd_mode=""
	case "$_nd_mode" in
		1)
			_nd_pre="$(uci -q get "zirgozar.$1.preproxy_node" 2>/dev/null)" || _nd_pre=""
			if [ -n "$_nd_pre" ] && [ "$_nd_pre" != "$1" ] &&
			   uci -q get "zirgozar.$_nd_pre.link" >/dev/null 2>&1; then
				printf '%s\n' "$_nd_recs" | set_dialer "chain-$_nd_pre"
				return 0
			fi
			;;
		2)
			_nd_to="$(uci -q get "zirgozar.$1.to_node" 2>/dev/null)" || _nd_to=""
			if [ -n "$_nd_to" ] && [ "$_nd_to" != "$1" ]; then
				_nd_land="$(section_links "$_nd_to" | LC_ALL=C awk -v LIMIT=1 -f "$ZGZ_LIB/zgz-parse" 2>/dev/null | head -1)"
				_nd_first="$(printf '%s\n' "$_nd_recs" | head -1)"
				case "$(printf '%s' "$_nd_first" | cut -f3)" in
					hysteria2|hysteria|tuic|openvpn|amneziawg) _nd_land="" ;;
				esac
				case "$(printf '%s' "$_nd_land" | cut -f3)" in
					hysteria2|hysteria|tuic|openvpn|amneziawg|'') _nd_land="" ;;
				esac
				if [ -n "$_nd_land" ]; then
					printf '%s\t%s → %s\t%s\t%s\t%s\t%s\n' \
						"$(printf '%s' "$_nd_first" | cut -f1)" \
						"$(printf '%s' "$_nd_first" | cut -f2)" \
						"$(printf '%s' "$_nd_land" | cut -f2)" \
						"$(printf '%s' "$_nd_land" | cut -f3)" \
						"$(printf '%s' "$_nd_first" | cut -f4)" \
						"$(printf '%s' "$_nd_first" | cut -f5)" \
						"$(printf '%s' "$_nd_land" | cut -f6- | set_dialer "chain-$1")"
					return 0
				fi
			fi
			;;
	esac
	printf '%s\n' "$_nd_recs"
	return 0
}
