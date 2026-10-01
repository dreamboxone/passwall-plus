# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Zirgozar - https://github.com/dreamboxone/zirgozar

include $(TOPDIR)/rules.mk

PKG_NAME:=zirgozar
PKG_VERSION:=2.0.5
PKG_RELEASE:=1

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=AGPL-3.0-or-later

include $(INCLUDE_DIR)/package.mk

# Kept in step with build/packages.inc.sh, which is what the release builds
# use. A helper that reaches one of them and not the other is a helper that
# is missing on exactly half of the installations.
ZGZ_SCRIPTS:=zgz-nodes zgz-probe zgz-connect zgz-refresh zgz-parse zgz-mkconfig zgz-rules zgz-dns zgz-stats zgz-test zgz-geo zgz-cores zgz-deps zgz-bridge zgz-router

define Package/zirgozar
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Transparent proxy client built on Xray
  URL:=https://github.com/dreamboxone/zirgozar
  DEPENDS:=+jshn +libubox +curl +ca-bundle +nftables +kmod-nft-tproxy +kmod-nft-socket +ip-full +unzip
endef

define Package/zirgozar/description
 Sends every LAN device through a tunnel. Reads its server list every quarter
 of an hour, sifts a hundred servers with one handshake each and measures only
 the ones that answered, ten at a time, until it finds one fast enough.
 Optional Iran routing split, per-day traffic accounting, and both nftables
 and iptables.
endef

define Package/zirgozar/conffiles
/etc/config/zirgozar
endef

define Build/Compile
endef

define Package/zirgozar/install
	$(INSTALL_DIR) $(1)/usr/libexec/zirgozar
	$(INSTALL_BIN) ./files/../../../prebuilt/$(ARCH_PACKAGES)/xray $(1)/usr/libexec/zirgozar/xray

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/zirgozar.config $(1)/etc/config/zirgozar

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/zirgozar.init $(1)/etc/init.d/zirgozar

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_DATA) ./files/zgz-common.sh $(1)/usr/libexec/zgz-common.sh
	$(foreach s,$(ZGZ_SCRIPTS),$(INSTALL_BIN) ./files/$(s) $(1)/usr/libexec/$(s);)

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/luci.zirgozar $(1)/usr/libexec/rpcd/luci.zirgozar

	$(INSTALL_DIR) $(1)/etc/zirgozar/geo
	echo "$(PKG_VERSION)-r$(PKG_RELEASE)" > $(1)/etc/zirgozar/version

endef

define Package/zirgozar/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
mkdir -p /etc/zirgozar /etc/zirgozar/geo /var/run/zirgozar
# A message left by the version being replaced. /var/run survives an
# upgrade, so a notice written by older code - "hysteria installed." -
# went on sitting on the front page after the release that stopped
# saying it. Nothing here is worth carrying across an install.
rm -f /var/run/zirgozar/message
# The version file is not a setting, but it lives in /etc, and a package
# manager keeps a changed file there and puts the new one beside it.
for v in /etc/zirgozar/version.apk-new /etc/zirgozar/version-opkg; do
	[ -f "$$v" ] && mv -f "$$v" /etc/zirgozar/version
done
# Coming from Passwall+, this program's earlier name: its settings and its
# data come across once, and the old service is stopped and taken out of the
# boot sequence, so the two never hold the network at the same time. The old
# package itself is left for the reader to remove - a package cannot remove
# another while the package manager is busy installing it.
if [ -f /etc/config/passwall-plus ] && [ ! -f /etc/zirgozar/.from-passwall-plus ]; then
	/etc/init.d/passwall-plus stop >/dev/null 2>&1 || true
	/etc/init.d/passwall-plus disable >/dev/null 2>&1 || true
	sed -e 's/^config passwall-plus /config zirgozar /' 	    -e 's#/etc/passwall-plus#/etc/zirgozar#g' 	    -e 's#/usr/libexec/passwall-plus#/usr/libexec/zirgozar#g' 	    /etc/config/passwall-plus > /etc/config/zirgozar
	# The node lists, the measurements, the traffic history and the routing
	# data. Moved, not copied: the routing data alone is twenty-five
	# megabytes, and a router's flash may not hold it twice.
	for f in /etc/passwall-plus/* /etc/passwall-plus/.[!.]*; do
		[ -e "$$f" ] || continue
		n="$${f##*/}"
		case "$$n" in version|xray-version|version.apk-new|version-opkg) continue ;; esac
		rm -rf "/etc/zirgozar/$$n"
		mv "$$f" /etc/zirgozar/
	done
	# Cores this program downloaded, rather than the one its package ships.
	for c in sing-box hysteria geoview; do
		if [ -x "/usr/libexec/passwall-plus/$$c" ] && [ ! -e "/usr/libexec/zirgozar/$$c" ]; then
			mkdir -p /usr/libexec/zirgozar
			mv "/usr/libexec/passwall-plus/$$c" /usr/libexec/zirgozar/
		fi
	done
	touch /etc/zirgozar/.from-passwall-plus
fi
# The rebind exceptions that ship on the Traffic Rules page. A configuration
# kept from an older version has no such list; it gets one once, and a list
# the reader has since trimmed is never filled back in.
if [ -z "$$(uci -q get zirgozar.config.rebind_seeded)" ]; then
	for d in banksepah.ir cbi.ir ebanksepah.ir esata.ir gov.ir medu.ir qmb.ir tamin.ir meedc.net ntp.faraborddi.com; do
		uci -q add_list zirgozar.config.rebind_domain="$$d"
	done
	uci -q set zirgozar.config.rebind_seeded='1'
	uci -q commit zirgozar
fi
/usr/libexec/zgz-router rebind >/dev/null 2>&1 || true
touch /etc/crontabs/root
if [ -n "$$(uci -q get zirgozar.config.ir_dns)" ] && [ -z "$$(uci -q get zirgozar.config.direct_dns)" ]; then
	uci -q set zirgozar.config.direct_dns_protocol='udp'
	uci -q set zirgozar.config.direct_dns="$$(uci -q get zirgozar.config.ir_dns)"
fi
uci -q delete zirgozar.config.ir_dns
uci -q delete zirgozar.config.autostart
uci -q commit zirgozar
sed -i '\|/usr/libexec/zgz-|d' /etc/crontabs/root
echo '*/15 * * * * /usr/libexec/zgz-refresh >/dev/null 2>&1' >> /etc/crontabs/root
echo '*/5 * * * * /usr/libexec/zgz-stats sample >/dev/null 2>&1' >> /etc/crontabs/root
/etc/init.d/cron reload >/dev/null 2>&1
# rpcd has to be told there is a new object, and telling it once is not
# reliable. On a fresh install this reload has been seen to return success
# and leave the object unregistered - and an unregistered object is a web
# interface on which every single button does nothing whatever, while every
# script behind it works perfectly from the shell. It is the worst kind of
# failure this package can have, because nothing anywhere says a word.
# So ask afterwards, and restart if the answer is no.
/etc/init.d/rpcd reload >/dev/null 2>&1
if ! ubus list 2>/dev/null | grep -q '^luci.zirgozar$$'; then
	/etc/init.d/rpcd restart >/dev/null 2>&1
fi
# Always in the boot sequence; the main switch decides whether it runs.
/etc/init.d/zirgozar enable >/dev/null 2>&1
exit 0
endef

define Package/zirgozar/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/zirgozar stop >/dev/null 2>&1
/etc/init.d/zirgozar disable >/dev/null 2>&1
sed -i '\|/usr/libexec/zgz-|d' /etc/crontabs/root 2>/dev/null
/etc/init.d/cron reload >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,zirgozar))
