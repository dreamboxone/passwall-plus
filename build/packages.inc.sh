#!/bin/sh
#
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Zirgozar - https://github.com/dreamboxone/zirgozar
#
# packages.inc.sh - what goes into a package, shared by the .apk and .ipk
# builders so the two formats can never drift apart.

VERSION=2.0.4
RELEASE=1
PKGVER="$VERSION-r$RELEASE"
LICENSE="AGPL-3.0-or-later"
URL="https://github.com/dreamboxone/zirgozar"
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
ZGZ_DEPS="jshn libubox curl ca-bundle nftables kmod-nft-tproxy kmod-nft-socket ip-full unzip"
LUCI_DEPS="zirgozar luci-base"

ZGZ_DESC="Transparent proxy client for OpenWrt built on Xray, for Iran. Reads its server list every quarter of an hour, sifts a hundred servers with one handshake each and then measures only the ones that answered, ten at a time, until it finds one fast enough. Optional Iran routing split, per-day traffic accounting, and both nftables and iptables."
LUCI_DESC="Web interface for Zirgozar: connect, servers and subscriptions, traffic, and settings."

# Every quarter of an hour for the list, every five minutes for the counters.
#
# They are separate because they cost different things. Reading the list is
# one small request that only reaches flash on the days it changed. Reading
# the counters is a local call, and doing it often is what makes the traffic
# figures useful - but it is added up in RAM and only written to storage once
# an hour, so five-minute resolution costs no extra flash wear at all.
CRON_LIST='*/15 * * * * /usr/libexec/zgz-refresh >/dev/null 2>&1'
CRON_STATS='*/5 * * * * /usr/libexec/zgz-stats sample >/dev/null 2>&1'

ZGZ_SCRIPTS="zgz-nodes zgz-probe zgz-connect zgz-refresh zgz-parse zgz-mkconfig zgz-rules zgz-dns zgz-stats zgz-test zgz-geo zgz-cores zgz-deps zgz-bridge zgz-router"

# stage_zgz <staging-root> <source-root> <xray-binary>
stage_zgz() {
	work="$1"; root="$2"; core="$3"
	f="$root/package/zirgozar/files"
	i="$work/zirgozar"

	# Our own copy of the core lives under /usr/libexec/zirgozar. /usr/bin/xray
	# belongs to OpenWrt's xray-core package, which PassWall2 and others pull
	# in, and claiming that path makes this package refuse to install on any
	# router that already has one.
	install -d "$i/usr/libexec/zirgozar" "$i/etc/config" "$i/etc/init.d" \
	           "$i/usr/libexec/rpcd" "$i/etc/zirgozar" "$i/etc/zirgozar/geo"
	install -m 0755 "$core"            "$i/usr/libexec/zirgozar/xray"
	install -m 0644 "$f/zirgozar.config"   "$i/etc/config/zirgozar"
	install -m 0755 "$f/zirgozar.init"     "$i/etc/init.d/zirgozar"
	install -m 0644 "$f/zgz-common.sh" "$i/usr/libexec/zgz-common.sh"
	install -m 0755 "$f/luci.zirgozar"     "$i/usr/libexec/rpcd/luci.zirgozar"

	for s in $ZGZ_SCRIPTS; do
		install -m 0755 "$f/$s" "$i/usr/libexec/$s"
	done

	# One place the version is written down, read back by the web interface.
	# Two places would eventually disagree, and the one people look at would
	# be the wrong one.
	printf '%s\n' "$PKGVER" > "$i/etc/zirgozar/version"
	chmod 0644 "$i/etc/zirgozar/version"

	ver="$(dirname "$core")/xray-version.txt"
	[ -s "$ver" ] && install -m 0644 "$ver" "$i/etc/zirgozar/xray-version"

	echo "/etc/config/zirgozar" > "$work/zirgozar.conffiles"

	cat > "$work/zirgozar.postinst" <<EOF
# 'timeout' is not on every OpenWrt image - a stock 25.12 does not have it,
# and some have the name without the applet behind it, so it is tried
# rather than looked for. 'timeout N cmd || true' on a router where it does
# not run is not a bounded command, it is no command at all - which is how
# this package came to install itself without telling rpcd it was there.
bounded() {
	if timeout 5 true >/dev/null 2>&1; then timeout "\$@"; else shift; "\$@"; fi
}
mkdir -p /etc/zirgozar /etc/zirgozar/geo /var/run/zirgozar
# The version file is not a setting, but it lives in /etc, and a package
# manager keeps a changed file there and puts the new one beside it.
for v in /etc/zirgozar/version.apk-new /etc/zirgozar/version-opkg; do
	[ -f "\$v" ] && mv -f "\$v" /etc/zirgozar/version
done
# Coming from Passwall+, this program's earlier name: its settings and its
# data come across once, and the old service is stopped and taken out of the
# boot sequence, so the two never hold the network at the same time. The old
# package itself is left for the reader to remove - a package cannot remove
# another while the package manager is busy installing it.
if [ -f /etc/config/passwall-plus ] && [ ! -f /etc/zirgozar/.from-passwall-plus ]; then
	bounded 30 /etc/init.d/passwall-plus stop >/dev/null 2>&1 || true
	bounded 15 /etc/init.d/passwall-plus disable >/dev/null 2>&1 || true
	sed -e 's/^config passwall-plus /config zirgozar /' \
	    -e 's#/etc/passwall-plus#/etc/zirgozar#g' \
	    -e 's#/usr/libexec/passwall-plus#/usr/libexec/zirgozar#g' \
	    /etc/config/passwall-plus > /etc/config/zirgozar
	# The node lists, the measurements, the traffic history and the routing
	# data. Moved, not copied: the routing data alone is twenty-five
	# megabytes, and a router's flash may not hold it twice.
	for f in /etc/passwall-plus/* /etc/passwall-plus/.[!.]*; do
		[ -e "\$f" ] || continue
		n="\${f##*/}"
		case "\$n" in version|xray-version|version.apk-new|version-opkg) continue ;; esac
		rm -rf "/etc/zirgozar/\$n"
		mv "\$f" /etc/zirgozar/
	done
	# Cores this program downloaded, rather than the one its package ships.
	for c in sing-box hysteria geoview; do
		if [ -x "/usr/libexec/passwall-plus/\$c" ] && [ ! -e "/usr/libexec/zirgozar/\$c" ]; then
			mkdir -p /usr/libexec/zirgozar
			mv "/usr/libexec/passwall-plus/\$c" /usr/libexec/zirgozar/
		fi
	done
	touch /etc/zirgozar/.from-passwall-plus
fi
# A message left by the version being replaced. /var/run survives an
# upgrade, so a notice written by older code - "hysteria installed." -
# went on sitting on the front page after the release that stopped
# saying it. Nothing here is worth carrying across an install.
rm -f /var/run/zirgozar/message
# The rebind exceptions that ship on the Traffic Rules page. A configuration
# kept from an older version has no such list; it gets one once, and a list
# the reader has since trimmed is never filled back in.
if [ -z "\$(uci -q get zirgozar.config.rebind_seeded)" ]; then
	for d in banksepah.ir cbi.ir ebanksepah.ir esata.ir gov.ir medu.ir qmb.ir tamin.ir meedc.net ntp.faraborddi.com; do
		uci -q add_list zirgozar.config.rebind_domain="\$d"
	done
	uci -q set zirgozar.config.rebind_seeded='1'
	uci -q commit zirgozar
fi
/usr/libexec/zgz-router rebind >/dev/null 2>&1 || true
# The DNS tab replaced the one Iranian resolver of earlier versions with
# PassWall2's Direct DNS. A resolver chosen before is carried across as the
# Direct DNS, so nothing the reader set is lost on the way.
if [ -n "\$(uci -q get zirgozar.config.ir_dns)" ] && [ -z "\$(uci -q get zirgozar.config.direct_dns)" ]; then
	uci -q set zirgozar.config.direct_dns_protocol='udp'
	uci -q set zirgozar.config.direct_dns="\$(uci -q get zirgozar.config.ir_dns)"
fi
uci -q delete zirgozar.config.ir_dns
# The main switch now decides what happens after a reboot, as it does in
# PassWall2, so the separate setting for it is gone.
uci -q delete zirgozar.config.autostart
uci -q commit zirgozar
# one set of crontab entries, however often this package is reinstalled
touch /etc/crontabs/root
sed -i '\|/usr/libexec/zgz-|d' /etc/crontabs/root
sed -i '\|/usr/libexec/pwplus-|d' /etc/crontabs/root
echo '$CRON_LIST' >> /etc/crontabs/root
echo '$CRON_STATS' >> /etc/crontabs/root
# Every one of these takes a procd lock, and a lock held by something that
# died leaves the call waiting for good - which would strand the install half
# done and make the package impossible to remove afterwards. Bound them: none
# of this is worth failing an installation over.
bounded 15 /etc/init.d/cron reload >/dev/null 2>&1 || true
# rpcd has to be told there is a new object, and telling it once is not
# reliable. On a fresh install this reload has been seen to return success
# and leave the object unregistered - and an unregistered object is a web
# interface on which every single button does nothing whatever, while every
# script behind it works perfectly from the shell. It is the worst kind of
# failure this package can have, because nothing anywhere says a word.
# So ask afterwards, and restart if the answer is no.
bounded 15 /etc/init.d/rpcd reload >/dev/null 2>&1 || true
if ! ubus list 2>/dev/null | grep -q '^luci.zirgozar\$'; then
	bounded 20 /etc/init.d/rpcd restart >/dev/null 2>&1 || true
fi
# Always in the boot sequence; the main switch decides whether it runs.
bounded 15 /etc/init.d/zirgozar enable >/dev/null 2>&1 || true
exit 0
EOF

	cat > "$work/zirgozar.prerm" <<'EOF'
# 'timeout' is not on every OpenWrt image - a stock 25.12 does not have it,
# and some have the name without the applet behind it, so it is tried
# rather than looked for. 'timeout N cmd || true' on a router where it does
# not run is not a bounded command, it is no command at all - which is how
# this package came to install itself without telling rpcd it was there.
bounded() {
	if timeout 5 true >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi
}
bounded 20 /etc/init.d/zirgozar stop >/dev/null 2>&1 || true
bounded 15 /etc/init.d/zirgozar disable >/dev/null 2>&1 || true
sed -i '\|/usr/libexec/zgz-|d' /etc/crontabs/root 2>/dev/null
bounded 15 /etc/init.d/cron reload >/dev/null 2>&1 || true
exit 0
EOF
}

# stage_luci <staging-root> <source-root>
stage_luci() {
	work="$1"; root="$2"
	l="$root/package/luci-app-zirgozar/root"
	i="$work/luci-app-zirgozar"

	install -d "$i/www/luci-static/resources/view/zirgozar" \
	           "$i/www/luci-static/resources/zirgozar" \
	           "$i/usr/share/luci/menu.d" "$i/usr/share/rpcd/acl.d"
	for v in settings nodes subscribe other update traffic geoview acl log; do
		install -m 0644 "$l/www/luci-static/resources/view/zirgozar/$v.js" \
			"$i/www/luci-static/resources/view/zirgozar/$v.js"
	done
	# The Persian strings. Every view requires it, so a package without it is
	# three blank pages - it ships beside them, not as an extra.
	install -m 0644 "$l/www/luci-static/resources/zirgozar/i18n.js" \
		"$i/www/luci-static/resources/zirgozar/i18n.js"
	# The frame every page is drawn in, its stylesheet, and the Persian
	# typeface it uses. Required by every view, like the strings above.
	install -m 0644 "$l/www/luci-static/resources/zirgozar/ui.js" \
		"$i/www/luci-static/resources/zirgozar/ui.js"
	install -m 0644 "$l/www/luci-static/resources/zirgozar/status.js" \
		"$i/www/luci-static/resources/zirgozar/status.js"
	install -m 0644 "$l/www/luci-static/resources/zirgozar/theme.css" \
		"$i/www/luci-static/resources/zirgozar/theme.css"
	# The logo drawn light, for the dark banner every page opens with.
	install -m 0644 "$l/www/luci-static/resources/zirgozar/logo-light.png" \
		"$i/www/luci-static/resources/zirgozar/logo-light.png"
	install -d "$i/www/luci-static/resources/zirgozar/fonts"
	install -m 0644 "$l/www/luci-static/resources/zirgozar/fonts/Vazirmatn.woff2" \
		"$i/www/luci-static/resources/zirgozar/fonts/Vazirmatn.woff2"
	install -m 0644 "$l/www/luci-static/resources/zirgozar/fonts/OFL.txt" \
		"$i/www/luci-static/resources/zirgozar/fonts/OFL.txt"
	# The artwork on the status page. Optional on purpose - it is the one file
	# in this package that is not code, the page falls back to the name
	# without it, and a build should not fail for want of a picture.
	if [ -f "$l/www/luci-static/resources/zirgozar/logo.png" ]; then
		install -m 0644 "$l/www/luci-static/resources/zirgozar/logo.png" \
			"$i/www/luci-static/resources/zirgozar/logo.png"
	fi
	install -m 0644 "$l/usr/share/luci/menu.d/luci-app-zirgozar.json" \
		"$i/usr/share/luci/menu.d/luci-app-zirgozar.json"
	install -m 0644 "$l/usr/share/rpcd/acl.d/luci-app-zirgozar.json" \
		"$i/usr/share/rpcd/acl.d/luci-app-zirgozar.json"

	cat > "$work/luci-app-zirgozar.postinst" <<'EOF'
rm -f /tmp/luci-indexcache* 2>/dev/null
rm -rf /tmp/luci-modulecache 2>/dev/null
# 'timeout' is not on every OpenWrt image - a stock 25.12 does not have it,
# and some have the name without the applet behind it, so it is tried
# rather than looked for. 'timeout N cmd || true' on a router where it does
# not run is not a bounded command, it is no command at all - which is how
# this package came to install itself without telling rpcd it was there.
bounded() {
	if timeout 5 true >/dev/null 2>&1; then timeout "$@"; else shift; "$@"; fi
}
bounded 15 /etc/init.d/rpcd reload >/dev/null 2>&1 || true
bounded 15 /etc/init.d/uhttpd restart >/dev/null 2>&1 || true
exit 0
EOF
}
