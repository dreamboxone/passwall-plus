# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-ovpn
PKG_VERSION:=1.0.0
PKG_RELEASE:=1

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=GPL-3.0-only
PKG_ARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-ovpn
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Web interface for ovpn
  URL:=https://github.com/dreamboxone/ovpn
  DEPENDS:=+ovpn +luci-base
  PKGARCH:=all
endef

define Package/luci-app-ovpn/description
 Connect, servers and subscriptions, traffic, and settings.
endef

define Build/Compile
endef

define Package/luci-app-ovpn/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/ovpn
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/ovpn/overview.js \
		$(1)/www/luci-static/resources/view/ovpn/overview.js

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-ovpn.json \
		$(1)/usr/share/luci/menu.d/luci-app-ovpn.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-ovpn.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-ovpn.json
endef

define Package/luci-app-ovpn/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/luci-indexcache* 2>/dev/null
rm -rf /tmp/luci-modulecache 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1
/etc/init.d/uhttpd restart >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,luci-app-ovpn))
