# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn

include $(TOPDIR)/rules.mk

PKG_NAME:=ovpn
PKG_VERSION:=1.0.0
PKG_RELEASE:=2

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=GPL-3.0-only

include $(INCLUDE_DIR)/package.mk

# Kept in step with build/packages.inc.sh, which is what the release builds
# use. A helper that reaches one of them and not the other is a helper that
# is missing on exactly half of the installations.
OVPN_SCRIPTS:=ovpn-nodes ovpn-probe ovpn-connect ovpn-refresh ovpn-parse ovpn-mkconfig ovpn-rules ovpn-dns ovpn-stats ovpn-geo ovpn-cores ovpn-deps ovpn-bridge

define Package/ovpn
  SECTION:=net
  CATEGORY:=Network
  TITLE:=Transparent proxy client built on Xray
  URL:=https://github.com/dreamboxone/ovpn
  DEPENDS:=+jshn +libubox +curl +ca-bundle +nftables +kmod-nft-tproxy +kmod-nft-socket +ip-full +unzip
endef

define Package/ovpn/description
 Sends every LAN device through a tunnel. Reads its server list every quarter
 of an hour, sifts a hundred servers with one handshake each and measures only
 the ones that answered, ten at a time, until it finds one fast enough.
 Optional Iran routing split, per-day traffic accounting, and both nftables
 and iptables.
endef

define Package/ovpn/conffiles
/etc/config/ovpn
endef

define Build/Compile
endef

define Package/ovpn/install
	$(INSTALL_DIR) $(1)/usr/libexec/ovpn
	$(INSTALL_BIN) ./files/../../../prebuilt/$(ARCH_PACKAGES)/xray $(1)/usr/libexec/ovpn/xray

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_DATA) ./files/ovpn.config $(1)/etc/config/ovpn

	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./files/ovpn.init $(1)/etc/init.d/ovpn

	$(INSTALL_DIR) $(1)/usr/libexec
	$(INSTALL_DATA) ./files/ovpn-common.sh $(1)/usr/libexec/ovpn-common.sh
	$(foreach s,$(OVPN_SCRIPTS),$(INSTALL_BIN) ./files/$(s) $(1)/usr/libexec/$(s);)

	$(INSTALL_DIR) $(1)/usr/libexec/rpcd
	$(INSTALL_BIN) ./files/luci.ovpn $(1)/usr/libexec/rpcd/luci.ovpn

	$(INSTALL_DIR) $(1)/etc/ovpn/geo
	echo "$(PKG_VERSION)-r$(PKG_RELEASE)" > $(1)/etc/ovpn/version

endef

define Package/ovpn/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
mkdir -p /etc/ovpn /etc/ovpn/geo /var/run/ovpn
touch /etc/crontabs/root
sed -i '\|/usr/libexec/ovpn-|d' /etc/crontabs/root
echo '*/15 * * * * /usr/libexec/ovpn-refresh >/dev/null 2>&1' >> /etc/crontabs/root
echo '*/5 * * * * /usr/libexec/ovpn-stats sample >/dev/null 2>&1' >> /etc/crontabs/root
/etc/init.d/cron reload >/dev/null 2>&1
/etc/init.d/rpcd reload >/dev/null 2>&1
exit 0
endef

define Package/ovpn/prerm
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
/etc/init.d/ovpn stop >/dev/null 2>&1
/etc/init.d/ovpn disable >/dev/null 2>&1
sed -i '\|/usr/libexec/ovpn-|d' /etc/crontabs/root 2>/dev/null
/etc/init.d/cron reload >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,ovpn))
