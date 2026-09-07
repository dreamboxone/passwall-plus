#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn
#
# What the parser and the configuration generator do, checked against a real
# Xray rather than against my opinion of what Xray accepts.
#
#   RIG_XRAY=/path/to/xray sh test/test-config.sh [list-file]
#
# Without RIG_XRAY the JSON is still checked for shape; with it, every single
# outbound the parser emits is put in front of the binary that will have to
# run it. That is the check that matters: "valid JSON" and "a configuration
# Xray will accept" are not the same thing, and the difference is a router
# that installs cleanly and never connects.

. "$(dirname "$0")/rig.sh"

rig_setup

LIST="${1:-}"
WORK="$RIG/work"
mkdir -p "$WORK"

if [ -z "$LIST" ]; then
	LIST="$WORK/list.txt"
	cat > "$LIST" <<'LINKS'
vless://11111111-2222-3333-4444-555555555555@example.com:443?encryption=none&security=tls&sni=a.example.com&type=ws&path=%2Fws&host=a.example.com&fp=chrome#WS TLS
vless://11111111-2222-3333-4444-555555555555@1.2.3.4:8443?encryption=none&security=reality&sni=www.microsoft.com&fp=chrome&pbk=OO2OqOYyZ2fdqXTWku23mRI0Hz7-1eYEoFsKANj6hn8&sid=abcd1234&flow=xtls-rprx-vision&type=tcp#REALITY
vless://11111111-2222-3333-4444-555555555555@5.6.7.8:443?encryption=none&security=tls&type=grpc&serviceName=svc&sni=g.example.com#GRPC
vless://11111111-2222-3333-4444-555555555555@9.9.9.9:443?encryption=none&security=tls&type=xhttp&path=%2Fx&mode=auto&host=x.example.com#XHTTP
trojan://hunter2@t.example.com:443?sni=t.example.com&type=tcp#TROJAN
ss://YWVzLTI1Ni1nY206aHVudGVyMg==@ss.example.com:8388#SS-SIP002
ss://YWVzLTEyOC1nY206cGFzc3dvcmRAMS4yLjMuNDoxMjM0#SS-LEGACY
hysteria2://hunter2@hy.example.com:443?sni=hy.example.com&insecure=1#HY2
tuic://11111111-2222-3333-4444-555555555555:hunter2@tu.example.com:443?sni=tu.example.com&congestion_control=bbr#TUIC
socks5://dXNlcjpwYXNz@sk.example.com:1080#SOCKS
# a comment, and below it two things that must be refused rather than guessed at
vless://not-a-link
ss://bm9wZQ==
LINKS
	# Two fingerprints: one Xray has ("unsafe" is a real one, however it
	# reads) and one it does not. The real one must survive; the invented one
	# must be dropped, because Xray refuses the whole outbound over it and
	# that would cost a working server for the sake of a cosmetic field.
	echo 'vless://11111111-2222-3333-4444-555555555555@good.example.com:443?encryption=none&security=tls&sni=good.example.com&fp=unsafe#GOODFP' >> "$LIST"
	echo 'vless://11111111-2222-3333-4444-555555555555@bad.example.com:443?encryption=none&security=tls&sni=bad.example.com&fp=madeupvalue#BADFP' >> "$LIST"
fi

echo "== parsing $(grep -c . "$LIST") lines"
LC_ALL=C awk -f "$RIG/lib/ovpn-parse" < "$LIST" > "$WORK/cand.tsv"
N=$(wc -l < "$WORK/cand.tsv" | tr -d ' ')
echo "== $N servers parsed"

[ "$N" -gt 0 ] && ok "the parser found servers" || bad "the parser found nothing"

# Every record must have exactly six columns and a numeric port. A short row
# silently shifts every column after it, which is the kind of fault that
# shows up much later as a server nobody can explain.
COLS=$(awk -F'\t' '{ if (NF != 6) c++ } END { print c + 0 }' "$WORK/cand.tsv")
check "$COLS" "0" "every record has six columns"

PORTS=$(awk -F'\t' '$5 !~ /^[0-9]+$/ || $5 + 0 <= 0 || $5 + 0 > 65535 { c++ } END { print c + 0 }' "$WORK/cand.tsv")
check "$PORTS" "0" "every port is a real port number"

TAGS=$(cut -f1 "$WORK/cand.tsv" | sort -u | wc -l | tr -d ' ')
check "$TAGS" "$N" "every tag is unique"

# The fingerprint Xray will not accept must not reach it...
BADFP=$(grep -c '"fingerprint":"madeupvalue"' "$WORK/cand.tsv" || true)
check "$BADFP" "0" "an unknown TLS fingerprint is dropped, not passed on"

# ...and the one it will accept must not be thrown away with it.
GOODFP=$(grep -c '"fingerprint":"unsafe"' "$WORK/cand.tsv" || true)
check "$GOODFP" "1" "a real fingerprint is kept"

# Removed from Xray in 26.x, and its presence makes the core refuse the whole
# outbound rather than merely relaxing a check.
AI=$(grep -c 'allowInsecure' "$WORK/cand.tsv" || true)
check "$AI" "0" "allowInsecure is never written"

# base64 in awk has to agree with base64 everywhere else.
if command -v base64 >/dev/null 2>&1; then
	IN='the quick brown fox jumps over the lazy dog, 0123456789'
	ENC=$(printf '%s' "$IN" | base64 | tr -d '\n')
	DEC=$(printf '%s' "$ENC" | LC_ALL=C awk -v DECODE=1 -f "$RIG/lib/ovpn-parse")
	check "$DEC" "$IN" "the built-in base64 decoder agrees with base64"
fi

# A subscription handed over as one base64 blob has to come back as links.
BLOB=$(printf 'vless://11111111-2222-3333-4444-555555555555@b64.example.com:443?encryption=none&security=none#B64\n' | base64 | tr -d '\n')
printf '%s' "$BLOB" | LC_ALL=C awk -v DECODE=1 -f "$RIG/lib/ovpn-parse" > "$WORK/dec.txt"
if grep -q 'b64.example.com' "$WORK/dec.txt"; then
	ok "a base64 subscription decodes to links"
else
	bad "a base64 subscription decodes to links"
fi

# ------------------------------------------------- against the real binary

if [ -x "$RIG/core/xray" ]; then
	echo "== checking every outbound against $("$RIG/core/xray" version 2>/dev/null | head -1)"
	rej=0
	tot=0
	while IFS='	' read -r tag label proto host port payload; do
		[ -n "$tag" ] || continue
		case "$proto" in hysteria2|tuic) continue ;; esac
		tot=$((tot + 1))
		printf '{"log":{"loglevel":"none"},"outbounds":[%s]}' \
			"$(printf '%s' "$payload" | sed 's/^{/{"tag":"proxy",/')" > "$WORK/one.json"
		if ! "$RIG/core/xray" run -test -config "$WORK/one.json" >"$WORK/one.err" 2>&1; then
			rej=$((rej + 1))
			echo "     rejected: $proto $host:$port"
			grep -o 'common/errors:.*' "$WORK/one.err" | tail -1 | cut -c1-160
		fi
	done < "$WORK/cand.tsv"
	check "$rej" "0" "all $tot Xray-native outbounds are accepted by the core"

	# And the configuration built around one of them.
	head -1 "$WORK/cand.tsv" | cut -f6 > "$RIG/etc/best.json"

	rig_clear
	sh "$RIG/lib/ovpn-mkconfig" > "$WORK/cfg.json" 2>"$WORK/cfg.err" || bad "mkconfig failed: $(cat "$WORK/cfg.err")"
	if "$RIG/core/xray" run -test -config "$WORK/cfg.json" >"$WORK/t.err" 2>&1; then
		ok "the generated configuration is accepted with the split off"
	else
		bad "the generated configuration is accepted with the split off"
		grep -o 'common/errors:.*\|failed to.*' "$WORK/t.err" | tail -2
	fi

	# The stats plumbing has to be there, because the traffic page reads it
	# and an absent api tag is a page that silently shows zero for ever.
	for want in '"tag": "api"' 'statsOutboundUplink' '"tag": "api-in"'; do
		if grep -q "$want" "$WORK/cfg.json"; then
			ok "config carries $want"
		else
			bad "config carries $want"
		fi
	done

	# With the split on and no geo files, the geo rules must NOT appear -
	# Xray refuses to start when asked for a geoip file that is not there, so
	# writing them anyway turns a missing optional download into no internet.
	#
	# OVPN_GEO_SEARCH is emptied because "missing" has to mean missing. A
	# router that already runs another front-end has that project's geoip.dat
	# and geosite.dat in /usr/share, geo_dir finds them there on purpose - it
	# is twenty-five megabytes not worth downloading twice - and this test
	# would then be measuring that router's files rather than the case it
	# means to describe.
	rig_set route_ir 1
	rig_set geo_dir "$RIG/etc/nowhere"
	OVPN_GEO_SEARCH="" sh "$RIG/lib/ovpn-mkconfig" > "$WORK/cfg_nogeo.json" 2>/dev/null
	if grep -q 'geoip:ir' "$WORK/cfg_nogeo.json"; then
		bad "the split stays out when the geo files are missing"
	else
		ok "the split stays out when the geo files are missing"
	fi
	if "$RIG/core/xray" run -test -config "$WORK/cfg_nogeo.json" >/dev/null 2>&1; then
		ok "and the configuration still starts"
	else
		bad "and the configuration still starts"
	fi

	# With the files actually present, the rules must appear and the core
	# must accept them.
	if [ -s "$OVPN_GEO_DIR/geoip.dat" ] && [ -s "$OVPN_GEO_DIR/geosite.dat" ]; then
		rig_set geo_dir "$OVPN_GEO_DIR"
		sh "$RIG/lib/ovpn-mkconfig" > "$WORK/cfg_geo.json" 2>/dev/null
		if grep -q 'geoip:ir' "$WORK/cfg_geo.json" && grep -q 'geosite:ir' "$WORK/cfg_geo.json"; then
			ok "the split is written when the geo files are present"
		else
			bad "the split is written when the geo files are present"
		fi
		if XRAY_LOCATION_ASSET="$OVPN_GEO_DIR" "$RIG/core/xray" run -test -config "$WORK/cfg_geo.json" >"$WORK/g.err" 2>&1; then
			ok "the core reads geoip:ir and geosite:ir from the downloaded files"
		else
			bad "the core reads geoip:ir and geosite:ir from the downloaded files"
			grep -o 'common/errors:.*\|failed to.*' "$WORK/g.err" | tail -2
		fi
	else
		echo "  skip - no geo files to test the split against (set OVPN_GEO_DIR)"
	fi
	rig_clear

	# A batch is offered to the core as one configuration, so one unusable
	# server refuses the whole batch and takes nine working ones down with it.
	# These two are the shapes that actually turn up: a REALITY key that is
	# not a key, and a cipher Xray dropped. Both must be dropped individually
	# and the good ones must survive.
	{
		printf 'bad1\tbadkey\tvless\t1.2.3.4\t8443\t{"protocol":"vless","settings":{"vnext":[{"address":"1.2.3.4","port":8443,"users":[{"id":"11111111-2222-3333-4444-555555555555","encryption":"none"}]}]},"streamSettings":{"network":"tcp","security":"reality","realitySettings":{"serverName":"a.com","publicKey":"not-a-key","shortId":"ab"}}}\n'
		printf 'bad2\tbadcipher\tshadowsocks\t1.2.3.4\t1234\t{"protocol":"shadowsocks","settings":{"servers":[{"address":"1.2.3.4","port":1234,"method":"rc4-md5","password":"x","uot":true}]},"streamSettings":{"network":"tcp"}}\n'
		head -3 "$WORK/cand.tsv"
	} > "$WORK/batch.tsv"
	before=$(wc -l < "$WORK/batch.tsv" | tr -d ' ')
	: > "$RIG/run/rejected"
	sh "$RIG/lib/ovpn-probe" prune "$WORK/batch.tsv" >/dev/null 2>&1 || true
	after=$(wc -l < "$WORK/batch.tsv" | tr -d ' ')
	check "$after" "$((before - 2))" "a batch survives the two servers the core cannot use"
	if grep -qx bad1 "$RIG/run/rejected" && grep -qx bad2 "$RIG/run/rejected"; then
		ok "and both are written down so they are never offered again"
	else
		bad "and both are written down so they are never offered again"
	fi
	if grep -q '^bad' "$WORK/batch.tsv"; then
		bad "neither bad entry is left in the batch"
	else
		ok "neither bad entry is left in the batch"
	fi
else
	echo "  skip - no core to check against (set RIG_XRAY)"
fi

rig_report
