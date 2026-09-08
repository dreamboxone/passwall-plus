# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus

include $(TOPDIR)/rules.mk

PKG_NAME:=passwall-plus
PKG_VERSION:=1.0.6
PKG_RELEASE:=1

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=GPL-3.0-only

include $(INCLUDE_DIR)/package.mk

# Kept in step with build/packages.inc.sh, which is what the release builds
# use. A helper that reaches one of them and not the other is a helper that
# is missing on exactly half of the installations.
PWPLUS_SCRIPTS:=pwplus-nodes pwplus-probe pwplus-connect pwplus-refresh pwplus-parse pwplus-mkconfig pwplus-rules pwplus-dns pwplus-stats pwplus-test pwplus-geo pwplus-cores pwplus-deps pwplus-bridge

define Package/passwall-plus
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Transparent proxy client built on Xray
  URL:=https://github.com/dreamboxone/passwall-plus
  DEPENDS:=+jshn +libubox +curl +ca-bundle +nftables +kmod-nft-tproxy +kmod-nft-socket +ip-full +unzip
endef

define Package/passwall-plus/description
 Sends every LAN device through a tunnel. Reads its server list every quarter
 of an hour, sifts a hundred servers with one handshake each and measures only
 the ones that answered, ten at a time, until it finds one fast enough.
 Optional Iran routing split, per-day traffic accounting, and both nftables
 and iptables.
endef

define Package/passwall-plus/conffiles
/etc/config/passwall-plus
endef

define Build/Compile
endef

define Package/passwall-plus/install
	$(INSTALL_DIR) $(1)/usr/libexec/passwall-plus
	$(INSTALL_BIN) ./files/../../../prebuilt/$(ARCH_PACKAGES)/xray $(1)/usr/libexec/passwall-plus/xray

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/passwall-plus.config $(1)/etc/config/passwall-plus

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/passwall-plus.init $(1)/etc/init.d/passwall-plus

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_DATA) ./files/pwplus-common.sh $(1)/usr/libexec/pwplus-common.sh
	$(foreach s,$(PWPLUS_SCRIPTS),$(INSTALL_BIN) ./files/$(s) $(1)/usr/libexec/$(s);)

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/luci.passwall-plus $(1)/usr/libexec/rpcd/luci.passwall-plus

	$(INSTALL_DIR) $(1)/etc/passwall-plus/geo
	echo "$(PKG_VERSION)-r$(PKG_RELEASE)" > $(1)/etc/passwall-plus/version

endef

define Package/passwall-plus/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
mkdir -p /etc/passwall-plus /etc/passwall-plus/geo /var/run/passwall-plus
# A message left by the version being replaced. /var/run survives an
# upgrade, so a notice written by older code - "hysteria installed." -
# went on sitting on the front page after the release that stopped
# saying it. Nothing here is worth carrying across an install.
rm -f /var/run/passwall-plus/message
touch /etc/crontabs/root
sed -i '\|/usr/libexec/pwplus-|d' /etc/crontabs/root
echo '*/15 * * * * /usr/libexec/pwplus-refresh >/dev/null 2>&1' >> /etc/crontabs/root
echo '*/5 * * * * /usr/libexec/pwplus-stats sample >/dev/null 2>&1' >> /etc/crontabs/root
/etc/init.d/cron reload >/dev/null 2>&1
# rpcd has to be told there is a new object, and telling it once is not
# reliable. On a fresh install this reload has been seen to return success
# and leave the object unregistered - and an unregistered object is a web
# interface on which every single button does nothing whatever, while every
# script behind it works perfectly from the shell. It is the worst kind of
# failure this package can have, because nothing anywhere says a word.
# So ask afterwards, and restart if the answer is no.
/etc/init.d/rpcd reload >/dev/null 2>&1
if ! ubus list 2>/dev/null | grep -q '^luci.passwall-plus$$'; then
	/etc/init.d/rpcd restart >/dev/null 2>&1
fi
exit 0
endef

define Package/passwall-plus/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/passwall-plus stop >/dev/null 2>&1
/etc/init.d/passwall-plus disable >/dev/null 2>&1
sed -i '\|/usr/libexec/pwplus-|d' /etc/crontabs/root 2>/dev/null
/etc/init.d/cron reload >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,passwall-plus))
