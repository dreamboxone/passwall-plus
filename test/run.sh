#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
#
# Everything, in the order of how much it needs to run.
#
#   sh test/run.sh
#   RIG_XRAY=/path/to/xray sh test/run.sh
#
# test-package and test-stats need nothing at all. test-rules needs an nft on
# the machine and skips itself without one. test-config checks what it can
# without a core and a great deal more with one, which is why the release
# build sets RIG_XRAY.

cd "$(dirname "$0")/.."

rc=0
for t in test/test-package.sh test/test-stats.sh test/test-rules.sh test/test-config.sh test/test-probe.sh; do
	echo
	echo "######## $t"
	sh "$t" || rc=1
done

echo
if [ "$rc" = "0" ]; then
	echo "######## all suites passed"
else
	echo "######## something failed"
fi
exit "$rc"
