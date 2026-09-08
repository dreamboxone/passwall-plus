# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-passwall-plus
PKG_VERSION:=1.0.9
PKG_RELEASE:=1

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=GPL-3.0-only
PKG_ARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-passwall-plus
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Web interface for Passwall+
  URL:=https://github.com/dreamboxone/passwall-plus
  DEPENDS:=+passwall-plus +luci-base
  PKGARCH:=all
endef

define Package/luci-app-passwall-plus/description
 Connect, servers and subscriptions, traffic, and settings.
endef

define Build/Compile
endef

define Package/luci-app-passwall-plus/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/passwall-plus
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/passwall-plus/overview.js \
		$(1)/www/luci-static/resources/view/passwall-plus/overview.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/passwall-plus/nodes.js \
		$(1)/www/luci-static/resources/view/passwall-plus/nodes.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/passwall-plus/settings.js \
		$(1)/www/luci-static/resources/view/passwall-plus/settings.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/passwall-plus/log.js \
		$(1)/www/luci-static/resources/view/passwall-plus/log.js

	$(INSTALL_DIR) $(1)/www/luci-static/resources/passwall-plus
	$(INSTALL_DATA) ./root/www/luci-static/resources/passwall-plus/i18n.js \
		$(1)/www/luci-static/resources/passwall-plus/i18n.js
	$(if $(wildcard ./root/www/luci-static/resources/passwall-plus/logo.png),\
		$(INSTALL_DATA) ./root/www/luci-static/resources/passwall-plus/logo.png \
			$(1)/www/luci-static/resources/passwall-plus/logo.png)

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-passwall-plus.json \
		$(1)/usr/share/luci/menu.d/luci-app-passwall-plus.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-passwall-plus.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-passwall-plus.json
endef

define Package/luci-app-passwall-plus/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/luci-indexcache* 2>/dev/null
rm -rf /tmp/luci-modulecache 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1
/etc/init.d/uhttpd restart >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,luci-app-passwall-plus))
