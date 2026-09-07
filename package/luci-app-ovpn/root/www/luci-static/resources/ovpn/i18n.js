/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of ovpn - https://github.com/dreamboxone/ovpn
 *
 * The Persian interface.
 *
 * LuCI translates through .lmo catalogues built by po2lmo, which is part of
 * the OpenWrt build system - and this package is built by three shell scripts
 * that do not have it. So the translation lives here instead: a dictionary and
 * a lookup, and each view shadows the global _() with this one for its own
 * strings only. Nothing else on the page is affected, and a string that is not
 * in the dictionary comes back exactly as it was written, in English.
 *
 * Keys are the English source strings, so adding a string to a view without
 * translating it is not an error - it is simply not translated yet.
 */

'use strict';
'require baseclass';

var LANG = 'en';

var FA = {
	/* ---------------------------------------------------------- status */
	'Connect': 'اتصال',
	'Disconnect': 'قطع',
	'Choose again': 'انتخاب دوباره',
	'Connected': 'متصل',
	'Disconnected': 'قطع',
	'Ready to connect': 'آمادهٔ اتصال',
	'Connecting…': 'در حال اتصال…',
	'Starting…': 'در حال شروع…',
	'Finding a server…': 'در حال یافتن سرور…',
	'Could not connect': 'اتصال برقرار نشد',
	'Server': 'سرور',
	'Protocol': 'پروتکل',
	'Response time': 'زمان پاسخ',
	'Routing': 'مسیریابی',
	'Iranian traffic goes direct': 'ترافیک ایران مستقیم می‌رود',
	'Iran split is on, but the routing data is missing': 'تفکیک ایران روشن است، ولی دادهٔ مسیریابی نیست',
	'Everything goes through the tunnel': 'همه‌چیز از تونل می‌رود',
	'PassWall is also redirecting traffic — turn one of them off.': 'PassWall هم دارد ترافیک را منحرف می‌کند — یکی از این دو را خاموش کنید.',
	'Checking which of %d servers answer at all — %d so far': 'بررسی اینکه از %d سرور کدام‌ها اصلاً جواب می‌دهند — تا اینجا %d',
	'Measuring the %d that answered, best first — %d done': 'اندازه‌گیری %d سروری که جواب دادند، بهترین اول — %d انجام شد',
	'%d of %d servers answered, but none completed a request': '%d سرور از %d جواب دادند، ولی هیچ‌کدام یک درخواست را کامل نکرد',
	'No server on the list answered at all': 'هیچ سروری در لیست جواب نداد',

	/* --------------------------------------------------------- traffic */
	'Traffic through the tunnel': 'ترافیک عبوری از تونل',
	'Today': 'امروز',
	'Last 7 days': 'هفت روز اخیر',
	'This month': 'این ماه',
	'Last 14 days': 'چهارده روز اخیر',
	'total': 'مجموع',
	'down': 'دانلود',
	'up': 'آپلود',
	'Nothing recorded yet.': 'هنوز چیزی ثبت نشده.',
	'Sent straight out this month (not tunnelled): ': 'مستقیم فرستاده‌شده در این ماه (بدون تونل): ',

	/* --------------------------------------------------------- servers */
	'Servers': 'سرورها',
	'Which servers to use': 'از کدام سرورها استفاده شود',
	'Servers to use': 'سرورهای مورد استفاده',
	'Mine and the subscriptions': 'مالِ من و اشتراک‌ها',
	'Only the ones I added by hand': 'فقط آن‌هایی که دستی اضافه کرده‌ام',
	'Only the subscriptions': 'فقط اشتراک‌ها',
	'Subscriptions': 'اشتراک‌ها',
	'Servers added by hand': 'سرورهای دستی',
	'Name': 'نام',
	'Address': 'آدرس',
	'Share link': 'لینک اشتراک‌گذاری',
	'On': 'فعال',
	'Read the subscriptions now': 'همین حالا اشتراک‌ها را بخوان',
	'Check every server': 'همهٔ سرورها را بررسی کن',
	'Last time the sources were read': 'آخرین باری که منابع خوانده شدند',
	'Measured': 'اندازه‌گیری‌شده',
	'Reachable in': 'زمان دسترسی',
	'Use this one': 'همین را استفاده کن',
	'in use': 'در حال استفاده',
	'%d servers': '%d سرور',
	'just now': 'همین الان',
	'%d min ago': '%d دقیقه پیش',
	'%d h ago': '%d ساعت پیش',
	'%d days ago': '%d روز پیش',
	'Nothing read yet. Press Read the subscriptions, or Connect on the main page.': 'هنوز چیزی خوانده نشده. «همین حالا اشتراک‌ها را بخوان» را بزنید، یا در صفحهٔ اصلی Connect.',
	'That does not look like a share link': 'این شبیه یک لینک اشتراک‌گذاری نیست',
	'Must start with http:// or https://': 'باید با http:// یا https:// شروع شود',

	/* -------------------------------------------------------- settings */
	'Settings': 'تنظیمات',
	'Language': 'زبان',
	'English': 'English',
	'Persian': 'فارسی',
	'Send Iranian traffic direct': 'ترافیک ایران مستقیم برود',
	'Address data': 'دادهٔ آدرس‌ها',
	'Name data': 'دادهٔ نام‌ها',
	'Iranian resolver': 'resolver ایرانی',
	'Block advertising': 'مسدود کردن تبلیغات',
	'Block BitTorrent': 'مسدود کردن بیت‌تورنت',
	'Network': 'شبکه',
	'Name lookups': 'حل نام‌ها',
	'Through dnsmasq (recommended)': 'از راه dnsmasq (پیشنهادی)',
	'Straight into the tunnel': 'مستقیم داخل تونل',
	'Leave alone': 'دست نزن',
	'Catch hardcoded resolvers': 'گرفتن resolverهای ثابت',
	'IPv6': 'IPv6',
	'Refuse it while connected (recommended)': 'تا وقتی وصل است رد شود (پیشنهادی)',
	'Leave it alone': 'دست نزن',
	'Refuse QUIC': 'رد کردن QUIC',
	'Firewall': 'فایروال',
	'Choose automatically': 'انتخاب خودکار',
	'Interfaces to tunnel': 'اینترفیس‌هایی که تونل شوند',
	'Reconnect after a reboot': 'اتصال دوباره بعد از ریستارت',
	'Choosing a server': 'انتخاب سرور',
	'First pass': 'پاس اول',
	'TCP handshake (recommended)': 'دست‌دادن TCP (پیشنهادی)',
	'Ping': 'پینگ',
	'Ping, then handshake': 'پینگ، بعد دست‌دادن',
	'Good enough (ms)': 'به‌قدر کافی خوب (میلی‌ثانیه)',
	'Measured at a time': 'هم‌زمان اندازه‌گیری‌شونده',
	'Batches at most': 'حداکثر تعداد دسته',
	'Checked at once': 'هم‌زمان بررسی‌شونده',
	'Traffic counting': 'شمارش ترافیک',
	'Save to flash every (s)': 'ذخیره روی فلش هر (ثانیه)',
	'Does this router have what it needs?': 'آیا این روتر آنچه لازم دارد را دارد؟',
	'Transparent proxy': 'پروکسی شفاف',
	'Policy routing': 'مسیریابی سیاستی',
	'HTTPS': 'HTTPS',
	'Firewall in use': 'فایروال در حال استفاده',
	'Packages': 'پکیج‌ها',
	'none found': 'چیزی پیدا نشد',
	'Install them': 'نصبشان کن',
	'%d missing': '%d مورد کم است',
	'everything needed is installed': 'هرچه لازم بود نصب است',
	'the kernel can redirect traffic': 'کرنل می‌تواند ترافیک را منحرف کند',
	'the kernel module for this is missing — nothing will be tunnelled': 'ماژول کرنلِ این کار نیست — هیچ چیزی تونل نمی‌شود',
	'the full ip command is installed': 'دستور کامل ip نصب است',
	'busybox ip cannot add the route this needs — install ip-full': 'ip بیزی‌باکس این مسیر را نمی‌تواند اضافه کند — ip-full را نصب کنید',
	'the router can fetch over HTTPS': 'روتر می‌تواند روی HTTPS چیزی بگیرد',
	'certificates are missing or the connection is blocked — nothing can be downloaded': 'گواهی‌ها نیستند یا اتصال مسدود است — هیچ چیزی دانلود نمی‌شود',
	'Routing data': 'دادهٔ مسیریابی',
	'Addresses (geoip.dat)': 'آدرس‌ها (geoip.dat)',
	'Names (geosite.dat)': 'نام‌ها (geosite.dat)',
	'not downloaded': 'دانلود نشده',
	'Download': 'دانلود',
	'Update': 'به‌روزرسانی',
	'Remove both': 'حذف هر دو',
	'Free space': 'فضای خالی',
	'Cores': 'هسته‌ها',
	'Install': 'نصب',
	'Remove': 'حذف',
	'installed': 'نصب‌شده',
	'not installed': 'نصب نشده',
	'no build for this router': 'برای این روتر بیلدی ندارد',
	'latest is %s': 'آخرین نسخه %s است',
	'Update to %s': 'به‌روزرسانی به %s',
	'Check for new versions': 'بررسی نسخه‌های جدید',
	'(installed by another package — left alone)': '(توسط پکیج دیگری نصب شده — دست‌نخورده مانده)',
	'Traffic history': 'تاریخچهٔ ترافیک',
	'Forget all recorded traffic': 'همهٔ ترافیک ثبت‌شده را فراموش کن',
	'yes': 'بله',
	'no': 'خیر'
};

function tr(s) {
	if (LANG !== 'fa') return s;
	var v = FA[s];
	return (v === undefined) ? s : v;
}

return baseclass.extend({
	/* Called by each view once it knows what the setting says. Anything other
	   than "fa" is English, including a value nobody has set yet. */
	setLang: function(l) { LANG = (l === 'fa') ? 'fa' : 'en'; },
	get: function() { return LANG; },
	tr: tr
});
