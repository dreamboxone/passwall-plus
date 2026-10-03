# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Zirgozar - https://github.com/dreamboxone/zirgozar

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-zirgozar
PKG_VERSION:=2.0.21
PKG_RELEASE:=1

PKG_MAINTAINER:=routekernel <https://t.me/routekernel1>
PKG_LICENSE:=AGPL-3.0-or-later
PKG_ARCH:=all

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-zirgozar
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Web interface for Zirgozar
  URL:=https://github.com/dreamboxone/zirgozar
  DEPENDS:=+zirgozar +luci-base
  PKGARCH:=all
endef

define Package/luci-app-zirgozar/description
 Connect, servers and subscriptions, traffic, and settings.
endef

define Build/Compile
endef

define Package/luci-app-zirgozar/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/zirgozar
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/subscribe.js \
		$(1)/www/luci-static/resources/view/zirgozar/subscribe.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/geoview.js \
		$(1)/www/luci-static/resources/view/zirgozar/geoview.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/nodes.js \
		$(1)/www/luci-static/resources/view/zirgozar/nodes.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/traffic.js \
		$(1)/www/luci-static/resources/view/zirgozar/traffic.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/acl.js \
		$(1)/www/luci-static/resources/view/zirgozar/acl.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/settings.js \
		$(1)/www/luci-static/resources/view/zirgozar/settings.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/log.js \
		$(1)/www/luci-static/resources/view/zirgozar/log.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/update.js \
		$(1)/www/luci-static/resources/view/zirgozar/update.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/view/zirgozar/other.js \
		$(1)/www/luci-static/resources/view/zirgozar/other.js

	$(INSTALL_DIR) $(1)/www/luci-static/resources/zirgozar
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/i18n.js \
		$(1)/www/luci-static/resources/zirgozar/i18n.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/ui.js \
		$(1)/www/luci-static/resources/zirgozar/ui.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/status.js \
		$(1)/www/luci-static/resources/zirgozar/status.js
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/theme.css \
		$(1)/www/luci-static/resources/zirgozar/theme.css
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/logo-light.png \
		$(1)/www/luci-static/resources/zirgozar/logo-light.png
	$(INSTALL_DIR) $(1)/www/luci-static/resources/zirgozar/fonts
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/fonts/Vazirmatn.woff2 \
		$(1)/www/luci-static/resources/zirgozar/fonts/Vazirmatn.woff2
	$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/fonts/OFL.txt \
		$(1)/www/luci-static/resources/zirgozar/fonts/OFL.txt
	$(if $(wildcard ./root/www/luci-static/resources/zirgozar/logo.png),\
		$(INSTALL_DATA) ./root/www/luci-static/resources/zirgozar/logo.png \
			$(1)/www/luci-static/resources/zirgozar/logo.png)

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-zirgozar.json \
		$(1)/usr/share/luci/menu.d/luci-app-zirgozar.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-zirgozar.json \
		$(1)/usr/share/rpcd/acl.d/luci-app-zirgozar.json
endef

define Package/luci-app-zirgozar/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] && exit 0
rm -f /tmp/luci-indexcache* 2>/dev/null
rm -rf /tmp/luci-modulecache 2>/dev/null
/etc/init.d/rpcd reload >/dev/null 2>&1
/etc/init.d/uhttpd restart >/dev/null 2>&1
exit 0
endef

$(eval $(call BuildPackage,luci-app-zirgozar))
