#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# build-core.sh - fetch the Xray core for an OpenWrt target.
#
#   ./build/build-core.sh              # default: armv7 / ipq40xx
#   ./build/build-core.sh aarch64
#   ./build/build-core.sh x86_64
#
# Only the executable is kept. The release archive also carries geoip.dat and
# geosite.dat, about twelve megabytes of routing data for deciding which
# traffic to send where - and this build sends everything through the tunnel,
# so they would be twelve megabytes of a router's flash spent on a question
# nobody asks.

set -e

TARGET="${1:-armv7}"
XRAY_VERSION="${XRAY_VERSION:-v26.3.27}"
BASE="https://github.com/XTLS/Xray-core/releases/download/$XRAY_VERSION"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$TARGET" in
	armv7|arm_cortex-a7_neon-vfpv4|ipq40xx|arm)
		ASSET=Xray-linux-arm32-v7a.zip;  OUTDIR=arm_cortex-a7_neon-vfpv4 ;;
	aarch64|arm64|filogic|mediatek)
		ASSET=Xray-linux-arm64-v8a.zip;  OUTDIR=aarch64_cortex-a53 ;;
	mipsel|mipsle|ramips|mt7621)
		ASSET=Xray-linux-mips32le.zip;   OUTDIR=mipsel_24kc ;;
	x86_64|amd64)
		ASSET=Xray-linux-64.zip;         OUTDIR=x86_64 ;;
	i386|x86)
		ASSET=Xray-linux-32.zip;         OUTDIR=i386_pentium4 ;;
	*)
		echo "unknown target '$TARGET'"
		echo "supported: armv7 aarch64 mipsel x86_64 i386"
		exit 1 ;;
esac

command -v curl >/dev/null 2>&1 || { echo "curl not found in PATH"; exit 1; }
command -v unzip >/dev/null 2>&1 || { echo "unzip not found in PATH"; exit 1; }

WORK="${PWPLUS_WORK:-$ROOT/.build}/$OUTDIR"
OUT="$ROOT/prebuilt/$OUTDIR/xray"

echo ">>> target      : $TARGET"
echo ">>> xray release: $XRAY_VERSION"
echo ">>> asset       : $ASSET"
echo ">>> openwrt arch: $OUTDIR"

rm -rf "$WORK"
mkdir -p "$WORK" "$(dirname "$OUT")"

echo ">>> downloading"
curl -fsSL --retry 3 -o "$WORK/xray.zip" "$BASE/$ASSET"

echo ">>> extracting the executable only"
unzip -o -q "$WORK/xray.zip" xray -d "$WORK"
[ -f "$WORK/xray" ] || { echo "no 'xray' entry inside $ASSET"; exit 1; }

install -m 0755 "$WORK/xray" "$OUT"
printf '%s\n' "$XRAY_VERSION" > "$ROOT/prebuilt/$OUTDIR/xray-version.txt"

echo ">>> done: $OUT"
ls -l "$OUT"
command -v file >/dev/null 2>&1 && file "$OUT" || true
