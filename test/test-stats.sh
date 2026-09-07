#!/bin/sh
#
# SPDX-License-Identifier: GPL-3.0-only
# Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
# Part of ovpn - https://github.com/dreamboxone/ovpn
#
# The traffic accounting, checked against arithmetic that can be done by hand.
#
#   sh test/test-stats.sh
#
# Nothing here needs a core or a network: the history is written directly and
# the totals are read back. What is being checked is the part that is easy to
# get wrong and impossible to notice - whether "this week" and "this month"
# mean what they say when the week crosses the end of a month.

. "$(dirname "$0")/rig.sh"

rig_setup

STATS="$RIG/lib/ovpn-stats"
DB="$RIG/etc/usage.db"

# A port nothing is listening on, so that "there is no core to ask" means it.
# The rig's core is the real binary when one is available, and on a machine
# that is also running the real thing it would otherwise reach the live
# tunnel's statistics interface on the default port and read a real router's
# traffic into a test - which is how the check below came to pass for years
# while the counter parser was reading every value as zero.
rig_set api_port 45999

# A fixed date so the answer does not depend on the day this is run. The day
# numbering is done in awk from the date string, so any date will do as long
# as the test and the code agree on it - and they only agree if the code is
# right.
day_before() {
	# <days-ago> -> YYYY-MM-DD, using the same civil-date arithmetic the code
	# uses, so that a bug in it would have to be present in two places written
	# at different times to go unnoticed.
	awk -v base="$1" -v back="$2" 'BEGIN {
		y = substr(base, 1, 4) + 0; m = substr(base, 6, 2) + 0; d = substr(base, 9, 2) + 0
		if (m <= 2) y -= 1
		era = int((y >= 0 ? y : y - 399) / 400)
		yoe = y - era * 400
		doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
		doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
		z = era * 146097 + doe - 719468 - back

		z += 719468
		era = int((z >= 0 ? z : z - 146096) / 146097)
		doe = z - era * 146097
		yoe = int((doe - int(doe / 1460) + int(doe / 36524) - int(doe / 146096)) / 365)
		y = yoe + era * 400
		doy = doe - (365 * yoe + int(yoe / 4) - int(yoe / 100))
		mp = int((5 * doy + 2) / 153)
		d = doy - int((153 * mp + 2) / 5) + 1
		m = mp + (mp < 10 ? 3 : -9)
		if (m <= 2) y += 1
		printf "%04d-%02d-%02d", y, m, d
	}'
}

TODAY="$(date +%Y-%m-%d)"
MONTH="$(date +%Y-%m)"

# One megabyte down and a hundred kilobytes up, every day for forty days.
: > "$DB"
i=40
while [ "$i" -ge 1 ]; do
	d="$(day_before "$TODAY" "$i")"
	printf '%s\t102400\t1048576\t1024\t2048\n' "$d" >> "$DB"
	i=$((i - 1))
done

# ...and something in memory for today that has not reached the file yet.
printf 'day=%s\nday_proxy_up=5000\nday_proxy_down=6000\nday_direct_up=70\nday_direct_down=80\nlast_flush=0\n' \
	"$TODAY" > "$RIG/run/stats.state"

J="$(sh "$STATS" json)"

check "$(printf '%s' "$J" | sed -n 's/.*"today":{"up":\([0-9]*\).*/\1/p')" "5000" \
	"today counts what is still only in memory"

# The last seven days are today plus the six before it. Six stored days at
# 102400 up, plus today's 5000 held in memory.
check "$(printf '%s' "$J" | sed -n 's/.*"week":{"up":\([0-9]*\).*/\1/p')" \
	"$((6 * 102400 + 5000))" \
	"the last seven days cross the end of a month correctly"

# This calendar month: however many stored days fall in it, plus today.
DAYS_IN_MONTH=$(cut -f1 "$DB" | grep -c "^$MONTH" || echo 0)
check "$(printf '%s' "$J" | sed -n 's/.*"month":{"up":\([0-9]*\).*/\1/p')" \
	"$((DAYS_IN_MONTH * 102400 + 5000))" \
	"this month counts exactly the days in this calendar month"

SERIES=$(printf '%s' "$J" | grep -o '{"d":"' | wc -l | tr -d ' ')
check "$SERIES" "30" "the daily series is the last thirty days"

# A day the router was switched off must not appear, and must not shift the
# others along.
if printf '%s' "$J" | grep -q "\"d\":\"$TODAY\""; then
	ok "today is in the series"
else
	bad "today is in the series"
fi

# The counters reset whenever the core restarts, so a reading lower than the
# one before it means everything now reported is new. Getting this wrong
# either loses a session or, worse, counts a huge negative.
echo "== counter resets"
rm -f "$RIG/run/stats.state" "$DB"
printf 'day=%s\nlast_proxy_up=1000000\nlast_proxy_down=2000000\nlast_direct_up=0\nlast_direct_down=0\nday_proxy_up=1000000\nday_proxy_down=2000000\nday_direct_up=0\nday_direct_down=0\nlast_flush=%s\n' \
	"$TODAY" "$(date +%s)" > "$RIG/run/stats.state"

# There is no core to ask, so sample must fail cleanly rather than writing
# nonsense over a good running total.
sh "$STATS" sample >/dev/null 2>&1 || true
check "$(sed -n 's/^day_proxy_up=//p' "$RIG/run/stats.state")" "1000000" \
	"a sample with no core to ask leaves the running total alone"

# Reading the core's answer, in both shapes it has been known to take. Xray
# wrote "value": "12345" and now writes "value": 12345, and a parser that knew
# only the first read every counter as zero - which is a legitimate number for
# a tunnel that has just started, so nothing anywhere said anything was wrong
# while the traffic page showed 0 B for ever.
#
# This replaces the rig's core with one that answers a fixture, so it is last:
# nothing after it can ask a real core anything.
echo "== reading the counters out of the core's answer"

RIG_ANSWER="$RIG/work/answer.json"
export RIG_ANSWER
mkdir -p "$RIG/work"

cat > "$RIG/core/xray" <<'FAKE'
#!/bin/sh
case "$1" in
	version) echo "Xray 26.0.0 (fixture)" ;;
	api)     cat "$RIG_ANSWER" ;;
esac
exit 0
FAKE
chmod +x "$RIG/core/xray"

for shape in quoted bare; do
	if [ "$shape" = "quoted" ]; then up='"4000"'; down='"5000"'; else up=4000; down=5000; fi
	cat > "$RIG_ANSWER" <<JSON
{ "stat": [
    { "name": "outbound>>>block>>>traffic>>>uplink" },
    { "name": "outbound>>>proxy>>>traffic>>>uplink", "value": $up },
    { "name": "outbound>>>proxy>>>traffic>>>downlink", "value": $down }
] }
JSON
	rm -f "$RIG/run/stats.state" "$DB"
	sh "$STATS" sample >/dev/null 2>&1 || true
	check "$(sed -n 's/^day_proxy_up=//p' "$RIG/run/stats.state")" "4000" \
		"a $shape counter value is read"
	check "$(sed -n 's/^day_proxy_down=//p' "$RIG/run/stats.state")" "5000" \
		"and so is the one beside it"
done

# A counter the core left out entirely means nothing has gone that way yet,
# and must not pick up the number from the record after it.
cat > "$RIG_ANSWER" <<'JSON'
{ "stat": [
    { "name": "outbound>>>direct>>>traffic>>>uplink" },
    { "name": "outbound>>>proxy>>>traffic>>>uplink", "value": 7000 }
] }
JSON
rm -f "$RIG/run/stats.state" "$DB"
sh "$STATS" sample >/dev/null 2>&1 || true
check "$(sed -n 's/^day_direct_up=//p' "$RIG/run/stats.state")" "0" \
	"an omitted counter is nothing, not the value of the next one"

rig_report
