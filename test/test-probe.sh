#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# The whole of choosing a server, run for real.
#
#   RIG_XRAY=/path/to/xray sh test/test-probe.sh
#
# The candidates here are not real servers. Most of them are `freedom`
# outbounds - the core's own direct connection - and one is a blackhole. So
# every part of the machinery runs exactly as it does in anger (a batch
# configuration, a core holding ten SOCKS ports, ten timed requests through
# them, the early exit, the writing down of the winner) without any of it
# depending on whether some stranger's free server happens to be up this
# morning. A test that fails because a free server died is a test nobody
# believes, and a test nobody believes is worse than no test.
#
# The blackhole is there to prove the other half: a candidate that answers
# nothing must be passed over rather than chosen or crashed on.

. "$(dirname "$0")/rig.sh"

rig_setup

if [ ! -x "$RIG/core/xray" ]; then
	echo "  skip - no core to run (set RIG_XRAY)"
	rig_report
	exit 0
fi

WORK="$RIG/work"
mkdir -p "$WORK"

# Can the core reach anything at all from here? On a machine where it cannot -
# a firewall that blocks the unsigned binary, a network with no way out - every
# measurement below would fail for a reason that has nothing to do with this
# code, and reporting that as a failure would be a lie.
cat > "$WORK/reach.json" <<EOF
{"log":{"loglevel":"none"},
 "inbounds":[{"tag":"i","listen":"127.0.0.1","port":24999,"protocol":"socks","settings":{"udp":false}}],
 "outbounds":[{"tag":"d","protocol":"freedom"}]}
EOF
"$RIG/core/xray" run -config "$WORK/reach.json" >/dev/null 2>&1 &
RP=$!
sleep 2
if ! curl -s -o /dev/null -x socks5h://127.0.0.1:24999 --connect-timeout 8 --max-time 8 \
	"http://www.gstatic.com/generate_204" 2>/dev/null; then
	kill "$RP" 2>/dev/null || true
	echo "  skip - the core cannot reach the test address from this machine"
	rig_report
	exit 0
fi
kill "$RP" 2>/dev/null || true
wait "$RP" 2>/dev/null || true

# Fifteen candidates: fourteen that work and one that answers nothing. The
# host and port are real and reachable so that the first pass, which does a
# genuine handshake, has something to handshake with.
{
	printf 'dead\tblackhole\tvless\twww.gstatic.com\t80\t{"protocol":"blackhole"}\n'
	i=0
	while [ "$i" -lt 14 ]; do
		printf 'f%s\tdirect %s\tvless\twww.gstatic.com\t80\t{"protocol":"freedom"}\n' "$i" "$i"
		i=$((i + 1))
	done
} > "$RIG/run/candidates.tsv"

rig_set batch_size 10
rig_set max_batches 5
rig_set good_ms 5000
rig_set sift_parallel 15

echo "== the first pass"
sh "$RIG/lib/pwplus-probe" sift >/dev/null 2>&1 || true
ALIVE=$(wc -l < "$RIG/run/alive.tsv" 2>/dev/null | tr -d ' ')
check "$ALIVE" "15" "every candidate answered a handshake"

echo "== the whole thing"
if sh "$RIG/lib/pwplus-probe" select >"$WORK/sel.log" 2>&1; then
	ok "a server was chosen"
else
	bad "a server was chosen ($(tail -2 "$WORK/sel.log" | tr '\n' ' '))"
fi

if [ -s "$RIG/etc/best.json" ]; then
	ok "the choice was written down"
else
	bad "the choice was written down"
fi

CHOSEN=$(sed -n 's/^tag=//p' "$RIG/etc/best.meta" 2>/dev/null)
case "$CHOSEN" in
	dead) bad "the server that answers nothing was not chosen" ;;
	f*)   ok "the server that answers nothing was not chosen (picked $CHOSEN)" ;;
	*)    bad "nothing sensible was chosen (got '$CHOSEN')" ;;
esac

# Fifteen reachable candidates and a batch of ten: one batch should be enough,
# because something in it is certain to come back under five seconds. If this
# says fifteen, the early exit is not working and every connection is paying
# for the whole list.
TESTED=$(sed -n 's/^tested=//p' "$RIG/run/progress" 2>/dev/null)
check "$TESTED" "10" "it stopped after the first batch instead of measuring all fifteen"

# The blackhole never answers, so it must not appear among the measured.
if grep -q '	dead	' "$RIG/run/ranked.tsv" 2>/dev/null; then
	bad "the blackhole is in the measured list"
else
	ok "only servers that completed a request are in the measured list"
fi

RANKED=$(wc -l < "$RIG/run/ranked.tsv" 2>/dev/null | tr -d ' ')
if [ "${RANKED:-0}" -ge 2 ]; then
	ok "there is a ranked list to fall back on ($RANKED servers)"
else
	bad "there is a ranked list to fall back on (got $RANKED)"
fi

echo "== healing takes the next one down rather than measuring again"
BEFORE="$CHOSEN"
if sh "$RIG/lib/pwplus-probe" next >/dev/null 2>&1; then
	AFTER=$(sed -n 's/^tag=//p' "$RIG/etc/best.meta")
	if [ "$AFTER" != "$BEFORE" ]; then
		ok "moved from $BEFORE to $AFTER"
	else
		bad "the choice did not move"
	fi
else
	bad "there was no next server to move to"
fi

echo "== a candidate no core can use is dropped, not fatal"
{
	printf 'bad\tnonsense\tvless\twww.gstatic.com\t80\t{"protocol":"vless","settings":{"vnext":[{"address":"x","port":1,"users":[{"id":"not-a-uuid","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"publicKey":"nope"}}}\n'
	printf 'f0\tdirect 0\tvless\twww.gstatic.com\t80\t{"protocol":"freedom"}\n'
	printf 'f1\tdirect 1\tvless\twww.gstatic.com\t80\t{"protocol":"freedom"}\n'
} > "$RIG/run/candidates.tsv"
: > "$RIG/run/rejected"

if sh "$RIG/lib/pwplus-probe" select >"$WORK/sel2.log" 2>&1; then
	ok "the batch still produced a choice"
else
	bad "the batch still produced a choice ($(tail -2 "$WORK/sel2.log" | tr '\n' ' '))"
fi
if grep -qx bad "$RIG/run/rejected" 2>/dev/null; then
	ok "the unusable candidate was written down and will not be offered again"
else
	bad "the unusable candidate was written down"
fi

rig_report
