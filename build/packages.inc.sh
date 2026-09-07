#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn
#
# packages.inc.sh - what goes into a package, shared by the .apk and .ipk
# builders so the two formats can never drift apart.

VERSION=1.0.0
RELEASE=2
PKGVER="$VERSION-r$RELEASE"
LICENSE="GPL-3.0-only"
URL="https://github.com/dreamboxone/ovpn"
MAINTAINER="routekernel <https://t.me/routekernel1>"

# ca-bundle is not decoration. Every address this program fetches from is
# HTTPS, and on a router without certificates curl refuses all of them with an
# error most people read as "the site is blocked".
#
# ip-full likewise: busybox provides a cut-down `ip` under the same name that
# cannot add the local route transparent proxying needs, and the failure looks
# like a tunnel that loads every rule perfectly and carries nothing.
#
# kmod-nft-socket is optional to the ruleset but wanted: without it every
# packet of every connection goes through the transparent-proxy lookup again
# instead of being handed straight to the socket that already owns it.
#
# Deliberately absent: xray-core. A router that has one already - because
# PassWall2 pulled it in - needs nothing, and this finds it. Depending on it
# would drag a second copy onto routers that do not need one, and refusing to
# install alongside it would be worse still.
OVPN_DEPS="jshn libubox curl ca-bundle nftables kmod-nft-tproxy kmod-nft-socket ip-full unzip"
LUCI_DEPS="ovpn luci-base"

OVPN_DESC="Transparent proxy client for OpenWrt built on Xray, for Iran. Reads its server list every quarter of an hour, sifts a hundred servers with one handshake each and then measures only the ones that answered, ten at a time, until it finds one fast enough. Optional Iran routing split, per-day traffic accounting, and both nftables and iptables."
LUCI_DESC="Web interface for ovpn: connect, servers and subscriptions, traffic, and settings."

# Every quarter of an hour for the list, every five minutes for the counters.
#
# They are separate because they cost different things. Reading the list is
# one small request that only reaches flash on the days it changed. Reading
# the counters is a local call, and doing it often is what makes the traffic
# figures useful - but it is added up in RAM and only written to storage once
# an hour, so five-minute resolution costs no extra flash wear at all.
CRON_LIST='*/15 * * * * /usr/libexec/ovpn-refresh >/dev/null 2>&1'
CRON_STATS='*/5 * * * * /usr/libexec/ovpn-stats sample >/dev/null 2>&1'

OVPN_SCRIPTS="ovpn-nodes ovpn-probe ovpn-connect ovpn-refresh ovpn-parse ovpn-mkconfig ovpn-rules ovpn-dns ovpn-stats ovpn-geo ovpn-cores ovpn-deps ovpn-bridge"

# stage_ovpn <staging-root> <source-root> <xray-binary>
stage_ovpn() {
	work="$1"; root="$2"; core="$3"
	f="$root/package/ovpn/files"
	i="$work/ovpn"

	# Our own copy of the core lives under /usr/libexec/ovpn. /usr/bin/xray
	# belongs to OpenWrt's xray-core package, which PassWall2 and others pull
	# in, and claiming that path makes this package refuse to install on any
	# router that already has one.
	install -d "$i/usr/libexec/ovpn" "$i/etc/config" "$i/etc/init.d" \
	           "$i/usr/libexec/rpcd" "$i/etc/ovpn" "$i/etc/ovpn/geo"
	install -m 0755 "$core"            "$i/usr/libexec/ovpn/xray"
	install -m 0644 "$f/ovpn.config"   "$i/etc/config/ovpn"
	install -m 0755 "$f/ovpn.init"     "$i/etc/init.d/ovpn"
	install -m 0644 "$f/ovpn-common.sh" "$i/usr/libexec/ovpn-common.sh"
	install -m 0755 "$f/luci.ovpn"     "$i/usr/libexec/rpcd/luci.ovpn"

	for s in $OVPN_SCRIPTS; do
		install -m 0755 "$f/$s" "$i/usr/libexec/$s"
	done

	# One place the version is written down, read back by the web interface.
	# Two places would eventually disagree, and the one people look at would
	# be the wrong one.
	printf '%s\n' "$PKGVER" > "$i/etc/ovpn/version"
	chmod 0644 "$i/etc/ovpn/version"

	ver="$(dirname "$core")/xray-version.txt"
	[ -s "$ver" ] && install -m 0644 "$ver" "$i/etc/ovpn/xray-version"

	echo "/etc/config/ovpn" > "$work/ovpn.conffiles"

	cat > "$work/ovpn.postinst" <<EOF
mkdir -p /etc/ovpn /etc/ovpn/geo /var/run/ovpn
# one set of crontab entries, however often this package is reinstalled
touch /etc/crontabs/root
sed -i '\|/usr/libexec/ovpn-|d' /etc/crontabs/root
echo '$CRON_LIST' >> /etc/crontabs/root
echo '$CRON_STATS' >> /etc/crontabs/root
# Every one of these takes a procd lock, and a lock held by something that
# died leaves the call waiting for good - which would strand the install half
# done and make the package impossible to remove afterwards. Bound them: none
# of this is worth failing an installation over.
timeout 15 /etc/init.d/cron reload >/dev/null 2>&1 || true
timeout 15 /etc/init.d/rpcd reload >/dev/null 2>&1 || true
exit 0
EOF

	cat > "$work/ovpn.prerm" <<'EOF'
timeout 20 /etc/init.d/ovpn stop >/dev/null 2>&1 || true
timeout 15 /etc/init.d/ovpn disable >/dev/null 2>&1 || true
sed -i '\|/usr/libexec/ovpn-|d' /etc/crontabs/root 2>/dev/null
timeout 15 /etc/init.d/cron reload >/dev/null 2>&1 || true
exit 0
EOF
}

# stage_luci <staging-root> <source-root>
stage_luci() {
	work="$1"; root="$2"
	l="$root/package/luci-app-ovpn/root"
	i="$work/luci-app-ovpn"

	install -d "$i/www/luci-static/resources/view/ovpn" \
	           "$i/usr/share/luci/menu.d" "$i/usr/share/rpcd/acl.d"
	for v in overview nodes settings; do
		install -m 0644 "$l/www/luci-static/resources/view/ovpn/$v.js" \
			"$i/www/luci-static/resources/view/ovpn/$v.js"
	done
	install -m 0644 "$l/usr/share/luci/menu.d/luci-app-ovpn.json" \
		"$i/usr/share/luci/menu.d/luci-app-ovpn.json"
	install -m 0644 "$l/usr/share/rpcd/acl.d/luci-app-ovpn.json" \
		"$i/usr/share/rpcd/acl.d/luci-app-ovpn.json"

	cat > "$work/luci-app-ovpn.postinst" <<'EOF'
rm -f /tmp/luci-indexcache* 2>/dev/null
rm -rf /tmp/luci-modulecache 2>/dev/null
timeout 15 /etc/init.d/rpcd reload >/dev/null 2>&1 || true
timeout 15 /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
exit 0
EOF
}
