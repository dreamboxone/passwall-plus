#!/bin/sh
#
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# The Traffic Rules and Access Control pages, as the firewall and the core
# receive them.
#
#   sh test/test-acl.sh
#
# The shape is checked everywhere. With an nft on the machine the rulesets are
# also put in front of it, for the reason test-rules.sh gives: a chain that only
# appears when one particular rule exists is exactly the chain nobody loads by
# hand before it ships.

. "$(dirname "$0")/rig.sh"

rig_setup

WORK="$RIG/work"
mkdir -p "$WORK"
rig_set lan_zone "br-lan"

TAB="$(printf '\t')"

# id iface macs ips ipsets mode port tcp_no udp_no tcp_redir udp_redir
acl() {
	printf '%s\n' "$*" | tr ' ' "$TAB" >> "$PWPLUS_RUN/acl.tsv"
}

dump() {
	sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft" 2>"$WORK/rules.err"
	if command -v nft >/dev/null 2>&1; then
		if nft --check --file "$WORK/rules.nft" >"$WORK/nft.err" 2>&1; then
			ok "$1: nft accepts it"
		else
			bad "$1: nft accepts it: $(head -2 "$WORK/nft.err" | tr '\n' ' ')"
		fi
	fi
}

has() {
	if grep -qF -- "$2" "$WORK/rules.nft"; then ok "$1"; else bad "$1 (no [$2])"; fi
}

hasnt() {
	if grep -qF -- "$2" "$WORK/rules.nft"; then bad "$1 (found [$2])"; else ok "$1"; fi
}

chain() {
	awk -v c="chain $1 {" 'index($0, c) { on = 1 } on { print } on && /^\t}/ { exit }' "$WORK/rules.nft"
}

echo "== nothing set: nothing extra"
: > "$PWPLUS_RUN/acl.tsv"
dump "no rules"
hasnt "no direct set" "set direct"
hasnt "no access control chain" "chain acl_"

echo "== direct addresses"
rig_set direct_ip "1.2.3.4 5.6.0.0/16 not-an-address"
dump "direct addresses"
has "a set of them" "elements = { 1.2.3.4, 5.6.0.0/16 }"
has "skipped before the tunnel" "ip daddr @direct return"
hasnt "and nonsense left out" "not-an-address"
d=$(chain prerouting | grep -n '@direct return' | cut -d: -f1)
t=$(chain prerouting | grep -n 'tproxy ip to' | head -1 | cut -d: -f1)
if [ -n "$d" ] && [ -n "$t" ] && [ "$d" -lt "$t" ]; then
	ok "ahead of the tproxy rules"
else
	bad "ahead of the tproxy rules"
fi
rig_set direct_ip ""

echo "== access control"
rig_set ipv6 block
rig_set block_quic 1
: > "$PWPLUS_RUN/acl.tsv"
acl "cfg01 - 00:11:22:33:44:55 192.168.1.50-192.168.1.60,192.168.1.7 - 0 0 - - 1:65535 1:65535"
acl "cfg02 br-lan - 192.168.1.0/24 - 2 0 - 1:65535 80:443,8443 1:65535"
acl "cfg03 - - 192.168.1.9 - 1 1183 - - 1:65535 1:65535"
acl "cfg04 br-lan - - - 2 0 - - 1:65535 1:65535"
acl "cfg05 - - - lanlist 2 0 - - 1:65535 1:65535"
dump "four kinds of rule"

has "no proxy: MAC jump" "ether saddr { 00:11:22:33:44:55 } jump acl_1"
has "no proxy: addresses and ranges in one match" "ip saddr { 192.168.1.50-192.168.1.60, 192.168.1.7 } jump acl_1"
if chain acl_1 | grep -q tproxy; then bad "no proxy: never tproxied"; else ok "no proxy: never tproxied"; fi
if chain forward | grep -qF 'ether saddr { 00:11:22:33:44:55 } return'; then
	ok "no proxy: IPv6 left alone for that device"
else
	bad "no proxy: IPv6 left alone for that device"
fi

has "interface restricts the match" 'iifname "br-lan" ip saddr { 192.168.1.0/24 } jump acl_2'
if chain acl_2 | grep -qF 'udp dport { 1-65535 } accept'; then
	ok "global node: no-redirect UDP ports let past"
else
	bad "global node: no-redirect UDP ports let past"
fi
if chain acl_2 | grep -qF 'tcp dport != { 80-443, 8443 } accept'; then
	ok "global node: only the listed TCP ports redirected"
else
	bad "global node: only the listed TCP ports redirected"
fi
if chain acl_2 | grep -qF 'tproxy ip to 127.0.0.1:1082'; then
	ok "global node: the tunnel's own port"
else
	bad "global node: the tunnel's own port"
fi
if chain acl_2 | grep -qF 'dport 443 counter drop'; then
	ok "global node: QUIC refused as for everyone"
else
	bad "global node: QUIC refused as for everyone"
fi

if chain acl_3 | grep -qF 'tproxy ip to 127.0.0.1:1183'; then
	ok "own node: its own port"
else
	bad "own node: its own port"
fi
has "interface-only rule matches the interface" 'iifname "br-lan" jump acl_4'
hasnt "ipset-only rule left out under nftables" "jump acl_5"

# Rules are decided in order: the first match is the rule that applies, so
# every jump has to come after the reserved returns and before the catch-all.
j=$(chain prerouting | grep -n 'jump acl_1' | head -1 | cut -d: -f1)
r=$(chain prerouting | grep -n '@reserved return' | head -1 | cut -d: -f1)
t=$(chain prerouting | grep -n 'tproxy ip to' | head -1 | cut -d: -f1)
if [ -n "$j" ] && [ -n "$r" ] && [ -n "$t" ] && [ "$r" -lt "$j" ] && [ "$j" -lt "$t" ]; then
	ok "the jumps sit between the reserved returns and the catch-all"
else
	bad "the jumps sit between the reserved returns and the catch-all"
fi

echo "== the core"
: > "$PWPLUS_RUN/acl.tsv"
echo '{"protocol":"freedom","settings":{}}' > "$PWPLUS_ETC/best.json"
rig_set direct_domain "example.com full:a.example.org .b.example.net"
if sh "$RIG/lib/pwplus-mkconfig" > "$WORK/config.json" 2>"$WORK/mk.err"; then
	ok "the configuration is written"
else
	bad "the configuration is written: $(cat "$WORK/mk.err")"
fi
if command -v python >/dev/null 2>&1 &&
   python -c "import json,sys; json.load(open(sys.argv[1]))" "$WORK/config.json" 2>/dev/null; then
	ok "and it is JSON"
elif command -v node >/dev/null 2>&1 &&
   node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$WORK/config.json" 2>/dev/null; then
	ok "and it is JSON"
else
	bad "and it is JSON"
fi
if grep -qF '"domain":["domain:example.com","full:a.example.org","domain:b.example.net"],"outboundTag":"direct"' "$WORK/config.json"; then
	ok "direct domains go to the direct outbound"
else
	bad "direct domains go to the direct outbound"
fi
rig_set direct_domain ""

rig_report
