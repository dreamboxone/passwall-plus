#!/bin/sh
#
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# The firewall ruleset, put in front of a real nft rather than read carefully.
#
#   sh test/test-rules.sh
#
# nftables parses a ruleset and then fails at commit time when a kernel module
# is missing, and `nft --check` catches neither that nor a typo in a chain that
# only appears when a particular setting is switched on. So every combination
# of the settings that change the ruleset is generated and checked, which is
# how the QUIC option came to load fine on its own and break the whole ruleset
# the moment it was combined with anything else.

. "$(dirname "$0")/rig.sh"

rig_setup

if ! command -v nft >/dev/null 2>&1; then
	echo "  skip - no nft on this machine"
	rig_report
	exit 0
fi

WORK="$RIG/work"
mkdir -p "$WORK"

check_ruleset() {
	_what="$1"
	sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft" 2>"$WORK/rules.err"
	if [ ! -s "$WORK/rules.nft" ]; then
		bad "$_what: nothing was generated ($(cat "$WORK/rules.err"))"
		return
	fi
	if nft --check --file "$WORK/rules.nft" >"$WORK/nft.err" 2>&1; then
		ok "$_what"
	else
		bad "$_what: $(head -2 "$WORK/nft.err" | tr '\n' ' ')"
	fi
}

# The device list is normally discovered from the running system; here it is
# pinned so the test says the same thing on every machine.
rig_set lan_zone "br-lan eth1"

echo "== every combination of the settings that change the ruleset"

rig_set ipv6 block;  rig_set block_quic 0; rig_set dns_hijack 1
check_ruleset "ipv6 blocked, no quic block, dns hijacked"

rig_set ipv6 block;  rig_set block_quic 1; rig_set dns_hijack 1
check_ruleset "ipv6 blocked, quic blocked, dns hijacked"

rig_set ipv6 off;    rig_set block_quic 1; rig_set dns_hijack 1
check_ruleset "ipv6 left alone, quic blocked, dns hijacked"

rig_set ipv6 off;    rig_set block_quic 0; rig_set dns_hijack 0
check_ruleset "ipv6 left alone, no quic block, no dns hijack"

rig_set ipv6 off;    rig_set block_quic 0; rig_set dns_hijack 1
check_ruleset "no forward chain at all, dns hijacked"

# A single interface has to work as well as several: `!= { "a" }` and
# `!= { "a", "b" }` are different enough syntactically to get wrong.
rig_set lan_zone "br-lan"
rig_set ipv6 block; rig_set block_quic 1; rig_set dns_hijack 1
check_ruleset "one LAN interface"

echo "== the pieces that have to be present"
rig_set lan_zone "br-lan"
sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft"

for want in 'tproxy ip to 127.0.0.1:1082' 'meta mark set 0x162' \
            'ct direction reply return' 'ip daddr @reserved return' \
            'th dport 53 return'; do
	if grep -q "$want" "$WORK/rules.nft"; then
		ok "ruleset contains: $want"
	else
		bad "ruleset contains: $want"
	fi
done

# Name lookups must be let past the transparent proxy chain and taken by the
# nat chain instead. Both rules in the same chain would mean queries are
# tproxied and redirected at once, and the redirect never happens.
if awk '/chain prerouting/, /^\t}/' "$WORK/rules.nft" | grep -q 'redirect to'; then
	bad "the DNS redirect is in the prerouting chain, where it does not belong"
else
	ok "the DNS redirect is not in the transparent proxy chain"
fi

# The return for port 53 has to come before the tproxy rules, or it never runs.
# The LAN's rules, that is: the router's own traffic arrives on lo already
# sifted - its output chain lets port 53, local and direct addresses past
# before marking anything - and its rule has to come before the LAN-only
# check, so it is first on purpose and left out here.
order=$(awk '/chain prerouting/, /^\t}/' "$WORK/rules.nft" | grep -v 'iifname "lo"' |
	grep -n 'th dport 53 return\|tproxy ip to' | head -2 | cut -d: -f2)
first=$(awk '/chain prerouting/, /^\t}/' "$WORK/rules.nft" | grep -v 'iifname "lo"' |
	grep -n 'th dport 53 return\|tproxy ip to' | head -1)
case "$first" in
	*"dport 53 return"*) ok "port 53 is let past before the tproxy rules" ;;
	*) bad "port 53 is let past before the tproxy rules (got: $first)" ;;
esac

# Refusing QUIC has to happen in prerouting and ahead of the tproxy rules. A
# packet handed to the local socket there never reaches the forward hook, so a
# rule sitting on forward - which is where this one sat - refuses nothing at
# all. It passed every syntax check in this file the whole time it was doing
# nothing, which is what this asserts instead.
rig_set block_quic 1
sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft"
pre=$(awk '/chain prerouting/, /^\t}/' "$WORK/rules.nft" | grep -v 'iifname "lo"')
if printf '%s\n' "$pre" | grep -q 'dport 443'; then
	ok "the QUIC rule is in the prerouting chain"
	q=$(printf '%s\n' "$pre" | grep -n 'dport 443' | head -1 | cut -d: -f1)
	t=$(printf '%s\n' "$pre" | grep -n 'tproxy ip to' | head -1 | cut -d: -f1)
	if [ -n "$q" ] && [ -n "$t" ] && [ "$q" -lt "$t" ]; then
		ok "and ahead of the tproxy rules, which is the only place it works"
	else
		bad "and ahead of the tproxy rules, which is the only place it works"
	fi
else
	bad "the QUIC rule is in the prerouting chain"
fi
if awk '/chain forward/, /^\t}/' "$WORK/rules.nft" | grep -q 'dport 443'; then
	bad "the QUIC rule is not left on the forward hook, where it never runs"
else
	ok "the QUIC rule is not left on the forward hook, where it never runs"
fi
rig_set block_quic 0

# A device that looked a blocked name up while the tunnel was off still has the
# filtering address for it. That address is inside 10.0.0.0/8, so it has to be
# sent to the tunnel before the reserved-address return, or it never is.
sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft"
pre=$(awk '/chain prerouting/, /^	}/' "$WORK/rules.nft")
p=$(printf '%s
' "$pre" | grep -n 'ip daddr 10.10.34.0/24 meta l4proto tcp .*tproxy ip to 127.0.0.1:1084' | head -1 | cut -d: -f1)
r=$(printf '%s
' "$pre" | grep -n 'ip daddr @reserved return' | head -1 | cut -d: -f1)
if [ -n "$p" ] && [ -n "$r" ] && [ "$p" -lt "$r" ]; then
	ok "the filtering addresses go to their own inbound, ahead of the reserved return"
else
	bad "the filtering addresses go to their own inbound, ahead of the reserved return"
fi
rig_set client_proxy 0
sh "$RIG/lib/pwplus-rules" dump > "$WORK/rules.nft"
if grep -q '10.10.34.0/24' "$WORK/rules.nft"; then
	bad "with Client Proxy off the filtering addresses are left alone"
else
	ok "with Client Proxy off the filtering addresses are left alone"
fi
rig_set client_proxy 1

rig_report
