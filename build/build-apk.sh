#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# build-apk.sh - build .apk packages for OpenWrt 25.12 and later.
#
#   ./build/build-apk.sh [openwrt-arch] [path-to-apk-binary]
#
# Neither package compiles anything, so the only thing an OpenWrt SDK is
# really needed for is `apk mkpkg`. This performs the same steps
# include/package-pack.mk performs - file list, conffiles and checksums,
# install and removal scripts - and then calls it.

set -e

# Package files must end up root:root with sane modes, and a build tree on a
# filesystem that cannot represent that (a mounted Windows folder, say) would
# quietly produce a broken package. fakeroot virtualises both.
if [ "$(id -u)" != "0" ] && [ -z "$FAKEROOTKEY" ]; then
	FAKEROOT="$(command -v fakeroot || true)"
	if [ -n "$FAKEROOT" ]; then
		exec "$FAKEROOT" -- "$0" "$@"
	fi
	echo "warning: fakeroot not found - file ownership may be wrong" >&2
fi

ARCH="${1:-arm_cortex-a7_neon-vfpv4}"
APK="${2:-$APK_BIN}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/build/packages.inc.sh"

WORK="${PWPLUS_WORK:-${TMPDIR:-/tmp}/ovpn-apk-build}"
DIST="$ROOT/dist"

if [ -z "$APK" ]; then
	APK="$(find "$HOME" -maxdepth 5 -path '*/staging_dir/host/bin/apk' -type f 2>/dev/null | head -1)"
fi
[ -n "$APK" ] && [ -x "$APK" ] || {
	echo "apk tool not found."
	echo "pass it explicitly:  $0 $ARCH /path/to/openwrt-sdk/staging_dir/host/bin/apk"
	exit 1
}

CORE="$ROOT/prebuilt/$ARCH/xray"
[ -f "$CORE" ] || { echo "missing xray: $CORE (run build/build-core.sh)"; exit 1; }

echo ">>> apk tool : $APK"
echo ">>> arch     : $ARCH"
echo ">>> version  : $PKGVER"

rm -rf "$WORK"
mkdir -p "$WORK" "$DIST"

sha256() {
	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$1" | cut -d' ' -f1
	else
		openssl dgst -sha256 -r "$1" | cut -d' ' -f1
	fi
}

# finalize <name> <arch> <depends> <description>
finalize() {
	name="$1"; arch="$2"; deps="$3"; desc="$4"
	idir="$WORK/$name"
	adir="$WORK/admin-$name"
	mkdir -p "$idir/lib/apk/packages" "$adir"

	find "$idir" -type d -exec chmod 0755 {} +
	find "$idir" -type f -exec chmod 0644 {} +
	# derive what must be executable from where it lives, so a helper added
	# later cannot be shipped non-executable by accident
	for d in usr/bin usr/sbin etc/init.d usr/libexec usr/libexec/rpcd usr/libexec/passwall-plus; do
		if [ -d "$idir/$d" ]; then
			find "$idir/$d" -maxdepth 1 -type f -exec chmod 0755 {} +
		fi
	done
	chown -R 0:0 "$idir"

	( cd "$idir" && find . -type f -o -type l ) | sed 's|^\.||' | sort > "$WORK/$name.list"
	mv "$WORK/$name.list" "$idir/lib/apk/packages/$name.list"

	if [ -f "$WORK/$name.conffiles" ]; then
		cp "$WORK/$name.conffiles" "$idir/lib/apk/packages/$name.conffiles"
		: > "$idir/lib/apk/packages/$name.conffiles_static"
		while read -r file; do
			[ -n "$file" ] || continue
			[ -f "$idir$file" ] || continue
			echo "$file $(sha256 "$idir$file")" \
				>> "$idir/lib/apk/packages/$name.conffiles_static"
		done < "$WORK/$name.conffiles"
	fi

	{
		echo "#!/bin/sh"
		echo "[ \"\${IPKG_NO_SCRIPT}\" = \"1\" ] && exit 0"
		echo "[ -s \"\${IPKG_INSTROOT}/lib/functions.sh\" ] || exit 0"
		echo ". \${IPKG_INSTROOT}/lib/functions.sh"
		echo 'export root="${IPKG_INSTROOT}"'
		echo "export pkgname=\"$name\""
		[ -f "$WORK/$name.postinst" ] && sed '/^[[:space:]]*#!/d' "$WORK/$name.postinst"
	} > "$adir/post-install"

	{
		echo "#!/bin/sh"
		echo 'export PKG_UPGRADE=1'
		sed '/^[[:space:]]*#!/d' "$adir/post-install"
	} > "$adir/post-upgrade"

	{
		echo "#!/bin/sh"
		echo "[ -s \"\${IPKG_INSTROOT}/lib/functions.sh\" ] || exit 0"
		echo ". \${IPKG_INSTROOT}/lib/functions.sh"
		echo 'export root="${IPKG_INSTROOT}"'
		echo "export pkgname=\"$name\""
		[ -f "$WORK/$name.prerm" ] && sed '/^[[:space:]]*#!/d' "$WORK/$name.prerm"
	} > "$adir/pre-deinstall"

	chmod 755 "$adir"/post-install "$adir"/post-upgrade "$adir"/pre-deinstall

	out="$DIST/$name-$PKGVER.apk"
	rm -f "$out"

	"$APK" mkpkg \
		--info "name:$name" \
		--info "version:$PKGVER" \
		--info "description:$desc" \
		--info "arch:$arch" \
		--info "license:$LICENSE" \
		--info "origin:$name" \
		--info "url:$URL" \
		--info "maintainer:$MAINTAINER" \
		--info "depends:$deps" \
		--script "post-install:$adir/post-install" \
		--script "post-upgrade:$adir/post-upgrade" \
		--script "pre-deinstall:$adir/pre-deinstall" \
		--files "$idir" \
		--output "$out"

	echo ">>> built $(basename "$out") ($(du -h "$out" | cut -f1))"
}

stage_pwplus "$WORK" "$ROOT" "$CORE"
finalize passwall-plus "$ARCH" "$PWPLUS_DEPS" "$PWPLUS_DESC"

stage_luci "$WORK" "$ROOT"
# OpenWrt spells an architecture independent package "all" in the Makefile and
# "noarch" in the package metadata; package-pack.mk does the same translation
finalize luci-app-passwall-plus noarch "$LUCI_DEPS" "$LUCI_DESC"

echo
echo ">>> packages in $DIST"
ls -l "$DIST"/*.apk
