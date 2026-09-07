#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn
#
# The checks that catch a thing being written down in two places and only
# changed in one.
#
#   sh test/test-package.sh
#
# None of this needs a router, a core or a network. All of it has bitten this
# project before: a helper added to one packaging path and not the other, a
# menu entry naming a view that was never shipped, an rpcd method the web
# interface is not allowed to call.

. "$(dirname "$0")/rig.sh"

ROOT="$RIG_SRC"
PASS=0
FAIL=0

echo "== every shell script parses"
for f in "$ROOT"/package/ovpn/files/ovpn-* "$ROOT"/package/ovpn/files/ovpn.init \
         "$ROOT"/package/ovpn/files/luci.ovpn "$ROOT"/build/*.sh "$ROOT"/test/*.sh; do
	case "$f" in *ovpn-parse) continue ;; esac
	if sh -n "$f" 2>/dev/null; then
		ok "$(basename "$f")"
	else
		bad "$(basename "$f") does not parse"
	fi
done

echo "== the awk parser compiles"
if echo '' | awk -f "$ROOT/package/ovpn/files/ovpn-parse" >/dev/null 2>&1; then
	ok "ovpn-parse"
else
	bad "ovpn-parse does not compile"
fi

echo "== the two packaging paths ship the same helpers"
MK=$(sed -n 's/^OVPN_SCRIPTS:=//p' "$ROOT/package/ovpn/Makefile" | tr ' ' '\n' | grep . | sort)
INC=$(sed -n 's/^OVPN_SCRIPTS="//p' "$ROOT/build/packages.inc.sh" | tr -d '"' | tr ' ' '\n' | grep . | sort)
if [ "$MK" = "$INC" ]; then
	ok "package/ovpn/Makefile and build/packages.inc.sh agree"
else
	bad "package/ovpn/Makefile and build/packages.inc.sh disagree"
	printf '%s\n' "$MK" > "$RIG/mk.list"
	printf '%s\n' "$INC" > "$RIG/inc.list"
	diff "$RIG/mk.list" "$RIG/inc.list" || true
fi

echo "== every helper named actually exists"
for s in $MK; do
	if [ -f "$ROOT/package/ovpn/files/$s" ]; then
		ok "$s"
	else
		bad "$s is named by the packaging but is not in the tree"
	fi
done

echo "== every helper in the tree is packaged"
MK_LINE=" $(printf '%s ' $MK)"
for f in "$ROOT"/package/ovpn/files/ovpn-*; do
	b=$(basename "$f")
	case "$b" in ovpn-common.sh) continue ;; esac
	case "$MK_LINE" in
		*" $b "*) ok "$b is packaged" ;;
		*) bad "$b is in the tree but no packaging installs it" ;;
	esac
done

echo "== the web interface can call what the backend implements"
ACL=$(tr -d ' \t\n' < "$ROOT/package/luci-app-ovpn/root/usr/share/rpcd/acl.d/luci-app-ovpn.json" |
	sed 's/"luci\.ovpn":\[/\n/g' | sed -n '2,$p' | sed 's/\].*//' |
	grep -o '"[a-z_]*"' | tr -d '"' | sort -u | tr '\n' ' ')
IMPL=$(sed -n '/^	call)/,/esac/p' "$ROOT/package/ovpn/files/luci.ovpn" |
	sed -n 's/^\t\t\t\([a-z_]*\)).*/\1/p' | sort -u | tr '\n' ' ')
if [ "$ACL" = "$IMPL" ]; then
	ok "the ACL lists exactly the methods rpcd implements ($IMPL)"
else
	bad "ACL [$ACL] does not match implemented [$IMPL]"
fi

echo "== every method the views call is in the ACL"
for m in $(grep -ho "method: *'[a-z_]*'" "$ROOT"/package/luci-app-ovpn/root/www/luci-static/resources/view/ovpn/*.js |
           sed "s/.*'\\([a-z_]*\\)'.*/\\1/" | sort -u); do
	case " $ACL " in
		*" $m "*) ok "$m" ;;
		*) bad "the web interface calls $m, which the ACL does not allow" ;;
	esac
done

echo "== the menu names views that are shipped"
MENU="$ROOT/package/luci-app-ovpn/root/usr/share/luci/menu.d/luci-app-ovpn.json"
for v in $(grep -o '"path": *"[^"]*"' "$MENU" | cut -d'"' -f4); do
	if [ -s "$ROOT/package/luci-app-ovpn/root/www/luci-static/resources/view/$v.js" ]; then
		ok "$v.js"
	else
		bad "the menu points at $v.js, which is not in the tree"
	fi
done

echo "== every view file is reachable from the menu"
for f in "$ROOT"/package/luci-app-ovpn/root/www/luci-static/resources/view/ovpn/*.js; do
	b="ovpn/$(basename "$f" .js)"
	if grep -q "\"$b\"" "$MENU"; then
		ok "$b"
	else
		bad "$b is shipped but nothing in the menu leads to it"
	fi
done

echo "== the versions agree"
V_INC=$(sed -n 's/^VERSION=//p' "$ROOT/build/packages.inc.sh")
R_INC=$(sed -n 's/^RELEASE=//p' "$ROOT/build/packages.inc.sh")
for mk in package/ovpn/Makefile package/luci-app-ovpn/Makefile; do
	V=$(sed -n 's/^PKG_VERSION:=//p' "$ROOT/$mk")
	R=$(sed -n 's/^PKG_RELEASE:=//p' "$ROOT/$mk")
	if [ "$V" = "$V_INC" ] && [ "$R" = "$R_INC" ]; then
		ok "$mk is $V-r$R"
	else
		bad "$mk is $V-r$R but packages.inc.sh says $V_INC-r$R_INC"
	fi
done

echo "== settings the scripts read all have a default in the shipped config"
CONF="$ROOT/package/ovpn/files/ovpn.config"
for k in $(grep -ho 'cfg\(_bool\)\? [a-z_0-9]*' "$ROOT"/package/ovpn/files/* |
           awk '{print $2}' | sort -u); do
	case "$k" in enabled) continue ;; esac
	# a commented default counts: it documents the setting and its value
	if grep -q "option $k " "$CONF" || grep -q "#[[:space:]]*option $k " "$CONF"; then
		:
	else
		bad "the scripts read '$k' but /etc/config/ovpn ships no default for it"
	fi
done
ok "checked every setting the scripts read"

echo "== no function ends in a bare && test"
# Such a function returns non-zero and, called unguarded from a script under
# set -e, takes the whole script down. It is the single most common way this
# codebase has broken.
FOUND=$(awk '
	/^[a-z_0-9]+\(\) \{/ { fn = $1; last = "" }
	/^\}/ { if (fn != "" && last ~ /^\[.*\][ \t]*&&/) print FILENAME ": " fn; fn = "" }
	{ if ($0 !~ /^[[:space:]]*(#|$)/) { last = $0; sub(/^[[:space:]]+/, "", last) } }
' "$ROOT"/package/ovpn/files/* 2>/dev/null)
if [ -z "$FOUND" ]; then
	ok "none"
else
	bad "these would kill a caller running under set -e: $FOUND"
fi

# The web interface has two packaging paths too, and only one of them was
# being checked. The OpenWrt Makefile installed overview.js and neither of the
# other two views: a package built that way was one page and two blank ones,
# and nothing said so, because the shell builders - which the releases use -
# ship all three.
echo "== every file the web interface needs is in both packaging paths"
LUCI_FILES="www/luci-static/resources/view/ovpn/overview.js
www/luci-static/resources/view/ovpn/nodes.js
www/luci-static/resources/view/ovpn/settings.js
www/luci-static/resources/ovpn/i18n.js
usr/share/luci/menu.d/luci-app-ovpn.json
usr/share/rpcd/acl.d/luci-app-ovpn.json"
MISSING=""
for f in $LUCI_FILES; do
	[ -f "$ROOT/package/luci-app-ovpn/root/$f" ] || MISSING="$MISSING $f(not in the tree)"
	grep -q "$(basename "$f")" "$ROOT/package/luci-app-ovpn/Makefile" || MISSING="$MISSING $f(Makefile)"
	# Without the extension: the shell builder installs the three views from a
	# loop over their names, so the file name never appears in it whole.
	grep -q "$(basename "$f" .js)" "$ROOT/build/packages.inc.sh" || MISSING="$MISSING $f(packages.inc.sh)"
done
if [ -z "$MISSING" ]; then
	ok "all of them, in both"
else
	bad "missing:$MISSING"
fi

# A shared helper must not take a variable name away from whoever called it.
#
# There is no `local` in this shell, so every name a function assigns is
# global. download_checked kept its partial file in _tmp; install_hysteria
# kept the file it wanted in _tmp; and after the download the caller's path
# pointed at the temporary name that had just been moved away. The core
# downloaded perfectly and the program then reported that it "will not run on
# this router - probably built for a different processor", about a build that
# was correct. Driven for real here, over file://, because the collision only
# shows when the helper actually runs.
echo "== a helper does not overwrite its caller's variables"
if command -v curl >/dev/null 2>&1; then
	mkdir -p "$RIG/work"
	PAYLOAD="$RIG/work/payload.bin"
	dd if=/dev/urandom of="$PAYLOAD" bs=1024 count=8 2>/dev/null
	cat > "$RIG/work/caller.sh" <<CALLER
. "$RIG/lib/ovpn-common.sh"
_tmp="$RIG/work/dest.bin"
_url="file://$PAYLOAD"
download_checked "\$_url" "\$_tmp" 8192 >/dev/null 2>&1 || exit 3
printf '%s|%s\n' "\$_tmp" "\$_url"
CALLER
	GOT="$(OVPN_RUN="$RIG/run" OVPN_ETC="$RIG/etc" sh "$RIG/work/caller.sh" 2>/dev/null)"
	check "$GOT" "$RIG/work/dest.bin|file://$PAYLOAD" \
		"download_checked leaves the caller's _tmp and _url alone"
	if [ -s "$RIG/work/dest.bin" ]; then
		ok "and the file it was asked for is where it was asked to put it"
	else
		bad "and the file it was asked for is where it was asked to put it"
	fi
else
	echo "  skip - no curl on this machine"
fi

rig_report
