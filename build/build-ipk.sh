#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# build-ipk.sh - build .ipk packages for OpenWrt 24.10 and 23.05.
#
#   ./build/build-ipk.sh [openwrt-arch]
#
# An .ipk is a gzipped tar holding three members: debian-binary, data.tar.gz
# and control.tar.gz. Nothing here needs an SDK - tar and gzip are the whole
# toolchain - which is what makes shipping both formats from one build cheap.

set -e

if [ "$(id -u)" != "0" ] && [ -z "$FAKEROOTKEY" ]; then
	FAKEROOT="$(command -v fakeroot || true)"
	if [ -n "$FAKEROOT" ]; then
		exec "$FAKEROOT" -- "$0" "$@"
	fi
	echo "warning: fakeroot not found - file ownership may be wrong" >&2
fi

ARCH="${1:-arm_cortex-a7_neon-vfpv4}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/build/packages.inc.sh"

WORK="${PWPLUS_WORK:-${TMPDIR:-/tmp}/ovpn-ipk-build}"
DIST="$ROOT/dist"

CORE="$ROOT/prebuilt/$ARCH/xray"
[ -f "$CORE" ] || { echo "missing xray: $CORE (run build/build-core.sh)"; exit 1; }

echo ">>> arch    : $ARCH"
echo ">>> version : $PKGVER"

rm -rf "$WORK"
mkdir -p "$WORK" "$DIST"

# finalize <name> <arch> <depends> <description>
finalize() {
	name="$1"; arch="$2"; deps="$3"; desc="$4"
	idir="$WORK/$name"
	cdir="$WORK/control-$name"
	mkdir -p "$cdir"

	find "$idir" -type d -exec chmod 0755 {} +
	find "$idir" -type f -exec chmod 0644 {} +
	for d in usr/bin usr/sbin etc/init.d usr/libexec usr/libexec/rpcd usr/libexec/passwall-plus; do
		if [ -d "$idir/$d" ]; then
			find "$idir/$d" -maxdepth 1 -type f -exec chmod 0755 {} +
		fi
	done
	chown -R 0:0 "$idir"

	size=$(du -sb "$idir" 2>/dev/null | cut -f1 || echo 0)

	{
		echo "Package: $name"
		echo "Version: $PKGVER"
		echo "Depends: $deps" | sed 's/ /, /g; s/Depends:, /Depends: /'
		echo "Source: $URL"
		echo "SourceName: $name"
		echo "License: $LICENSE"
		echo "Section: net"
		echo "URL: $URL"
		echo "Maintainer: $MAINTAINER"
		echo "Architecture: $arch"
		echo "Installed-Size: $size"
		echo "Description: $desc"
	} > "$cdir/control"

	{
		echo "#!/bin/sh"
		echo "[ \"\${IPKG_NO_SCRIPT}\" = \"1\" ] && exit 0"
		echo "[ -s \"\${IPKG_INSTROOT}/lib/functions.sh\" ] || exit 0"
		echo ". \${IPKG_INSTROOT}/lib/functions.sh"
		echo 'export root="${IPKG_INSTROOT}"'
		echo "export pkgname=\"$name\""
		[ -f "$WORK/$name.postinst" ] && sed '/^[[:space:]]*#!/d' "$WORK/$name.postinst"
	} > "$cdir/postinst"

	{
		echo "#!/bin/sh"
		echo "[ -s \"\${IPKG_INSTROOT}/lib/functions.sh\" ] || exit 0"
		echo ". \${IPKG_INSTROOT}/lib/functions.sh"
		echo 'export root="${IPKG_INSTROOT}"'
		echo "export pkgname=\"$name\""
		[ -f "$WORK/$name.prerm" ] && sed '/^[[:space:]]*#!/d' "$WORK/$name.prerm"
	} > "$cdir/prerm"

	[ -f "$WORK/$name.conffiles" ] && cp "$WORK/$name.conffiles" "$cdir/conffiles"

	chmod 0755 "$cdir/postinst" "$cdir/prerm"
	chown -R 0:0 "$cdir"

	asm="$WORK/asm-$name"
	rm -rf "$asm"; mkdir -p "$asm"
	echo "2.0" > "$asm/debian-binary"
	tar -C "$idir" -czf "$asm/data.tar.gz" --owner=0 --group=0 .
	tar -C "$cdir" -czf "$asm/control.tar.gz" --owner=0 --group=0 .

	out="$DIST/${name}_${PKGVER}_${arch}.ipk"
	rm -f "$out"
	tar -C "$asm" -czf "$out" --owner=0 --group=0 \
		./debian-binary ./data.tar.gz ./control.tar.gz

	echo ">>> built $(basename "$out") ($(du -h "$out" | cut -f1))"
}

stage_pwplus "$WORK" "$ROOT" "$CORE"
finalize passwall-plus "$ARCH" "$PWPLUS_DEPS" "$PWPLUS_DESC"

stage_luci "$WORK" "$ROOT"
# opkg spells an architecture independent package "all"
finalize luci-app-passwall-plus all "$LUCI_DEPS" "$LUCI_DESC"

echo
echo ">>> packages in $DIST"
ls -l "$DIST"/*.ipk
