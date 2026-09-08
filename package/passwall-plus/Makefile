# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus

include $(TOPDIR)/rules.mk

PKG_NAME:=passwall-plus
PKG_VERSION:=1.0.1
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
touch /etc/crontabs/root
sed -i '\|/usr/libexec/pwplus-|d' /etc/crontabs/root
echo '*/15 * * * * /usr/libexec/pwplus-refresh >/dev/null 2>&1' >> /etc/crontabs/root
echo '*/5 * * * * /usr/libexec/pwplus-stats sample >/dev/null 2>&1' >> /etc/crontabs/root
/etc/init.d/cron reload >/dev/null 2>&1
/etc/init.d/rpcd reload >/dev/null 2>&1
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
