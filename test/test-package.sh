#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
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
for f in "$ROOT"/package/passwall-plus/files/pwplus-* "$ROOT"/package/passwall-plus/files/passwall-plus.init \
         "$ROOT"/package/passwall-plus/files/luci.passwall-plus "$ROOT"/build/*.sh "$ROOT"/test/*.sh; do
	case "$f" in *pwplus-parse) continue ;; esac
	if sh -n "$f" 2>/dev/null; then
		ok "$(basename "$f")"
	else
		bad "$(basename "$f") does not parse"
	fi
done

echo "== the awk parser compiles"
if echo '' | awk -f "$ROOT/package/passwall-plus/files/pwplus-parse" >/dev/null 2>&1; then
	ok "pwplus-parse"
else
	bad "pwplus-parse does not compile"
fi

echo "== the two packaging paths ship the same helpers"
MK=$(sed -n 's/^PWPLUS_SCRIPTS:=//p' "$ROOT/package/passwall-plus/Makefile" | tr ' ' '\n' | grep . | sort)
INC=$(sed -n 's/^PWPLUS_SCRIPTS="//p' "$ROOT/build/packages.inc.sh" | tr -d '"' | tr ' ' '\n' | grep . | sort)
if [ "$MK" = "$INC" ]; then
	ok "package/passwall-plus/Makefile and build/packages.inc.sh agree"
else
	bad "package/passwall-plus/Makefile and build/packages.inc.sh disagree"
	printf '%s\n' "$MK" > "$RIG/mk.list"
	printf '%s\n' "$INC" > "$RIG/inc.list"
	diff "$RIG/mk.list" "$RIG/inc.list" || true
fi

echo "== every helper named actually exists"
for s in $MK; do
	if [ -f "$ROOT/package/passwall-plus/files/$s" ]; then
		ok "$s"
	else
		bad "$s is named by the packaging but is not in the tree"
	fi
done

echo "== every helper in the tree is packaged"
MK_LINE=" $(printf '%s ' $MK)"
for f in "$ROOT"/package/passwall-plus/files/pwplus-*; do
	b=$(basename "$f")
	case "$b" in pwplus-common.sh) continue ;; esac
	case "$MK_LINE" in
		*" $b "*) ok "$b is packaged" ;;
		*) bad "$b is in the tree but no packaging installs it" ;;
	esac
done

echo "== the web interface can call what the backend implements"
ACL=$(tr -d ' \t\n' < "$ROOT/package/luci-app-passwall-plus/root/usr/share/rpcd/acl.d/luci-app-passwall-plus.json" |
	sed 's/"luci\.passwall-plus":\[/\n/g' | sed -n '2,$p' | sed 's/\].*//' |
	grep -o '"[a-z_]*"' | tr -d '"' | sort -u | tr '\n' ' ')
IMPL=$(sed -n '/^	call)/,/esac/p' "$ROOT/package/passwall-plus/files/luci.passwall-plus" |
	sed -n 's/^\t\t\t\([a-z_]*\)).*/\1/p' | sort -u | tr '\n' ' ')
if [ "$ACL" = "$IMPL" ]; then
	ok "the ACL lists exactly the methods rpcd implements ($IMPL)"
else
	bad "ACL [$ACL] does not match implemented [$IMPL]"
fi

echo "== every method the views call is in the ACL"
for m in $(grep -ho "method: *'[a-z_]*'" "$ROOT"/package/luci-app-passwall-plus/root/www/luci-static/resources/view/passwall-plus/*.js |
           sed "s/.*'\\([a-z_]*\\)'.*/\\1/" | sort -u); do
	case " $ACL " in
		*" $m "*) ok "$m" ;;
		*) bad "the web interface calls $m, which the ACL does not allow" ;;
	esac
done

echo "== the menu names views that are shipped"
MENU="$ROOT/package/luci-app-passwall-plus/root/usr/share/luci/menu.d/luci-app-passwall-plus.json"
for v in $(grep -o '"path": *"[^"]*"' "$MENU" | cut -d'"' -f4); do
	if [ -s "$ROOT/package/luci-app-passwall-plus/root/www/luci-static/resources/view/$v.js" ]; then
		ok "$v.js"
	else
		bad "the menu points at $v.js, which is not in the tree"
	fi
done

echo "== every view file is reachable from the menu"
for f in "$ROOT"/package/luci-app-passwall-plus/root/www/luci-static/resources/view/passwall-plus/*.js; do
	b="passwall-plus/$(basename "$f" .js)"
	if grep -q "\"$b\"" "$MENU"; then
		ok "$b"
	else
		bad "$b is shipped but nothing in the menu leads to it"
	fi
done

echo "== the versions agree"
V_INC=$(sed -n 's/^VERSION=//p' "$ROOT/build/packages.inc.sh")
R_INC=$(sed -n 's/^RELEASE=//p' "$ROOT/build/packages.inc.sh")
for mk in package/passwall-plus/Makefile package/luci-app-passwall-plus/Makefile; do
	V=$(sed -n 's/^PKG_VERSION:=//p' "$ROOT/$mk")
	R=$(sed -n 's/^PKG_RELEASE:=//p' "$ROOT/$mk")
	if [ "$V" = "$V_INC" ] && [ "$R" = "$R_INC" ]; then
		ok "$mk is $V-r$R"
	else
		bad "$mk is $V-r$R but packages.inc.sh says $V_INC-r$R_INC"
	fi
done

echo "== settings the scripts read all have a default in the shipped config"
CONF="$ROOT/package/passwall-plus/files/passwall-plus.config"
for k in $(grep -ho 'cfg\(_bool\)\? [a-z_0-9]*' "$ROOT"/package/passwall-plus/files/* |
           awk '{print $2}' | sort -u); do
	case "$k" in enabled) continue ;; esac
	# a commented default counts: it documents the setting and its value
	if grep -q "option $k " "$CONF" || grep -q "#[[:space:]]*option $k " "$CONF"; then
		:
	else
		bad "the scripts read '$k' but /etc/config/passwall-plus ships no default for it"
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
' "$ROOT"/package/passwall-plus/files/* 2>/dev/null)
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
LUCI_FILES="www/luci-static/resources/view/passwall-plus/overview.js
www/luci-static/resources/view/passwall-plus/nodes.js
www/luci-static/resources/view/passwall-plus/settings.js
www/luci-static/resources/passwall-plus/i18n.js
usr/share/luci/menu.d/luci-app-passwall-plus.json
usr/share/rpcd/acl.d/luci-app-passwall-plus.json"
MISSING=""
for f in $LUCI_FILES; do
	[ -f "$ROOT/package/luci-app-passwall-plus/root/$f" ] || MISSING="$MISSING $f(not in the tree)"
	grep -q "$(basename "$f")" "$ROOT/package/luci-app-passwall-plus/Makefile" || MISSING="$MISSING $f(Makefile)"
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
# was correct. Driven for real here, because the collision only shows when the
# helper actually runs.
echo "== a helper does not overwrite its caller's variables"
mkdir -p "$RIG/work"
PAYLOAD="$RIG/work/payload.bin"
dd if=/dev/urandom of="$PAYLOAD" bs=1024 count=8 2>/dev/null

write_caller() {
	# The helper out of the tree, not out of the rig: this suite is the one
	# that needs nothing, and it never calls rig_setup - so $RIG/lib exists
	# only on a machine where some other suite has already run. That is why
	# this passed on a development router and failed on a clean runner.
	cat > "$RIG/work/caller.sh" <<CALLER
. "$ROOT/package/passwall-plus/files/pwplus-common.sh"
_tmp="$RIG/work/dest.bin"
_url="$1"
download_checked "\$_url" "\$_tmp" 8192 >/dev/null 2>&1
printf '%s|%s\n' "\$_tmp" "\$_url"
CALLER
}

run_caller() {
	PWPLUS_RUN="$RIG/run" PWPLUS_ETC="$RIG/etc" \
		sh "$RIG/work/caller.sh" 2>"$RIG/work/caller.err"
	echo "$?" > "$RIG/work/caller.rc"
}

# When this goes wrong it goes wrong silently - the caller dies and hands back
# nothing, and "expected X, got []" says which of a dozen things happened only
# if you already know. So say what the shell said.
caller_why() {
	printf '     exit %s' "$(cat "$RIG/work/caller.rc" 2>/dev/null)"
	if [ -s "$RIG/work/caller.err" ]; then
		printf ', stderr: %s' "$(head -3 "$RIG/work/caller.err" | tr '\n' ' ')"
	fi
	printf '\n'
	printf '     sh is %s\n' "$(readlink -f /bin/sh 2>/dev/null || echo /bin/sh)"
}

# The collision happens where the helper assigns, which is before it transfers
# anything - so the transfer is not allowed to decide whether this check means
# something. A download that cannot possibly work exercises it just as well,
# and does it on every machine: whether curl here will fetch a file:// URL at
# all is not this project's business, and a check that depends on it fails
# somewhere eventually for a reason that has nothing to do with what it checks.
NOWHERE="file://$RIG/work/there-is-no-such-file"
write_caller "$NOWHERE"
GOT="$(run_caller)"
if [ "$GOT" = "$RIG/work/dest.bin|$NOWHERE" ]; then
	ok "a download that fails leaves the caller's _tmp and _url alone"
else
	bad "a download that fails leaves the caller's _tmp and _url alone (got [$GOT])"
	caller_why
fi

# And where curl will fetch one, that the file lands where it was asked to.
if command -v curl >/dev/null 2>&1 && curl -fsS "file://$PAYLOAD" -o /dev/null 2>/dev/null; then
	rm -f "$RIG/work/dest.bin"
	write_caller "file://$PAYLOAD"
	check "$(run_caller)" "$RIG/work/dest.bin|file://$PAYLOAD" \
		"a download that works leaves them alone too"
	if [ -s "$RIG/work/dest.bin" ]; then
		ok "and the file is where it was asked to put it"
	else
		bad "and the file is where it was asked to put it"
	fi
else
	echo "  skip - curl here will not fetch a file:// URL"
fi

# Every string the web interface shows has a Persian translation.
#
# The dictionary is keyed on the English source string, so a string added to a
# view and not to the dictionary is not an error at runtime - it simply comes
# back in English, on a page the reader has set to Persian, next to Persian.
# Which is the same thing as an untranslated interface and nothing says so.
echo "== every string in the views is in the Persian dictionary"
I18N="$ROOT/package/luci-app-passwall-plus/root/www/luci-static/resources/passwall-plus/i18n.js"
sed -n "s/^	'\(.*\)':.*/\1/p" "$I18N" | sort -u > "$RIG/keys.txt"
grep -ho "_('[^']*')" "$ROOT"/package/luci-app-passwall-plus/root/www/luci-static/resources/view/passwall-plus/*.js |
	sed "s/^_('//; s/')$//" | sort -u > "$RIG/used.txt"
UNTRANSLATED="$(comm -23 "$RIG/used.txt" "$RIG/keys.txt")"
if [ -z "$UNTRANSLATED" ]; then
	ok "all $(wc -l < "$RIG/used.txt" | tr -d ' ') of them"
else
	bad "not translated:"
	printf '%s\n' "$UNTRANSLATED" | sed 's/^/       /'
fi

# A translation that loses a %d or a %s does not read oddly - .format() puts
# the number nowhere and the sentence is missing the only part of it that was
# not already known.
echo "== the translations keep their placeholders"
BADFMT=""
while IFS= read -r k; do
	[ -n "$k" ] || continue
	v="$(sed -n "s/^	'$(printf '%s' "$k" | sed 's/[]\/$*.^[]/\\&/g')': *'\(.*\)',*$/\1/p" "$I18N" | head -1)"
	[ -n "$v" ] || continue
	kn="$(printf '%s' "$k" | grep -o '%[ds]' | sort | tr -d '\n')"
	vn="$(printf '%s' "$v" | grep -o '%[ds]' | sort | tr -d '\n')"
	[ "$kn" = "$vn" ] || BADFMT="$BADFMT $k"
done < "$RIG/used.txt"
if [ -z "$BADFMT" ]; then
	ok "none lost or invented"
else
	bad "placeholders differ in:$BADFMT"
fi

# The one file in this package that is not code, and the one that arrived at
# two megabytes. A router's flash is the scarce thing here and the page draws
# this 46 pixels tall, so a picture bigger than the whole web interface is a
# mistake worth catching before it is released rather than after.
echo "== the artwork is a size a router can afford"
LOGO="$ROOT/package/luci-app-passwall-plus/root/www/luci-static/resources/passwall-plus/logo.png"
if [ -f "$LOGO" ]; then
	BYTES=$(wc -c < "$LOGO" | tr -d ' ')
	if [ "$BYTES" -le 65536 ]; then
		ok "logo.png is $BYTES bytes"
	else
		bad "logo.png is $BYTES bytes - it goes into the flash of every router this is installed on"
	fi
	MISS=""
	grep -q 'logo.png' "$ROOT/package/luci-app-passwall-plus/Makefile" || MISS="$MISS Makefile"
	grep -q 'logo.png' "$ROOT/build/packages.inc.sh" || MISS="$MISS packages.inc.sh"
	if [ -z "$MISS" ]; then
		ok "and both packaging paths install it"
	else
		bad "logo.png is in the tree but not installed by:$MISS"
	fi
else
	echo "  skip - no logo.png in the tree"
fi

# The question nothing used to ask.
#
# "The core is running and the rules are in place" was taken for a working
# tunnel, and a node that completes a TCP handshake and then carries nothing
# satisfies both of those for ever - so the network stayed pointed into a dead
# tunnel, the whole house lost the internet, and the page said everything was
# fine. The healer asks pwplus-test whether a request actually gets through
# now, and the first thing that has to be true of that question is that it
# answers safely when there is nothing chosen at all.
echo "== asking whether the tunnel carries traffic is safe with nothing chosen"
mkdir -p "$RIG/hc/etc" "$RIG/hc/run"
OUT="$(PWPLUS_ETC="$RIG/hc/etc" PWPLUS_RUN="$RIG/hc/run" \
       PWPLUS_LIB="$ROOT/package/passwall-plus/files" \
       sh "$ROOT/package/passwall-plus/files/pwplus-test" current 2>/dev/null)"
RC=$?
if [ "$RC" != "0" ]; then
	ok "it fails rather than claiming a tunnel that does not exist works"
else
	bad "it reported success with no node chosen"
fi
check "$OUT" "0" "and says nothing got through"

# The script that runs after the package is unpacked, which nothing ever
# checked. It is written into the package as text by a builder, so a syntax
# error in it would not show up until an install on somebody's router - and an
# install whose postinst dies half way leaves rpcd never told about the web
# interface, which is a page where every button does nothing and nothing says
# why. That happened.
echo "== the postinst the builder writes is valid shell"
sed -n '/passwall-plus.postinst" <<EOF/,/^EOF$/p' "$ROOT/build/packages.inc.sh" |
	sed '1d;$d' > "$RIG/postinst.sh"
if [ -s "$RIG/postinst.sh" ] && sh -n "$RIG/postinst.sh" 2>/dev/null; then
	ok "it parses"
else
	bad "the generated postinst does not parse"
fi
if grep -q 'luci.passwall-plus' "$RIG/postinst.sh"; then
	ok "and it checks rpcd really registered the object rather than assuming"
else
	bad "the postinst reloads rpcd without checking it took"
fi

# Nothing may call `timeout` directly.
#
# It is not on every router. A stock OpenWrt 25.12 image has no timeout at all
# - not even as a busybox applet - and there `timeout 15 cmd || true` exits 127
# and runs nothing, silently, because the `|| true` swallows it. Every such
# call in this program was one that mattered: rpcd never learned the web
# interface existed, the crontab was never reloaded, Connect ran a restart that
# never happened, dnsmasq was never told to send lookups down the tunnel, and
# installing the missing dependencies installed nothing. A whole program that
# did nothing on a freshly flashed router, and said nothing about it.
#
# `bounded` in the helper does the same job with a watchdog when timeout is
# missing. The packaging scripts, which cannot source the helper, carry their
# own two-line version.
echo "== nothing calls timeout, which a stock OpenWrt does not have"
BARE=$(grep -rnE '(^|[[:space:]])timeout[[:space:]]+[0-9]' \
	"$ROOT/package" "$ROOT/build" 2>/dev/null |
	grep -v 'command -v timeout' || true)
if [ -z "$BARE" ]; then
	ok "none"
else
	bad "these do nothing at all on a router without timeout:"
	printf '%s\n' "$BARE" | sed 's/^/       /'
fi

# And the fallback has to actually bound something, or it is a worse lie than
# the one it replaces.
echo "== bounded returns what the command returned, and cuts a hang short"
cat > "$RIG/bt.sh" <<BT
PWPLUS_RUN="$RIG/bt/run"; PWPLUS_ETC="$RIG/bt/etc"
. "$ROOT/package/passwall-plus/files/pwplus-common.sh"
PWPLUS_HAVE_TIMEOUT=0
bounded 5 true; echo "true=\$?"
bounded 5 sh -c 'exit 7'; echo "seven=\$?"
_t0=\$(date +%s)
bounded 2 sleep 20 >/dev/null 2>&1; echo "hang=\$?"
echo "took=\$(( \$(date +%s) - _t0 ))"
BT
mkdir -p "$RIG/bt/run" "$RIG/bt/etc"
BT_OUT="$(sh "$RIG/bt.sh" 2>/dev/null)"
check "$(printf '%s\n' "$BT_OUT" | sed -n 's/^true=//p')" "0" "a command that works reports success"
check "$(printf '%s\n' "$BT_OUT" | sed -n 's/^seven=//p')" "7" "and one that fails reports its own status"
BT_TOOK="$(printf '%s\n' "$BT_OUT" | sed -n 's/^took=//p')"
if [ -n "$BT_TOOK" ] && [ "$BT_TOOK" -le 6 ]; then
	ok "a twenty-second hang is cut short after two ($BT_TOOK s)"
else
	bad "the watchdog did not cut the hang short (took ${BT_TOOK:-?} s)"
fi

rig_report
