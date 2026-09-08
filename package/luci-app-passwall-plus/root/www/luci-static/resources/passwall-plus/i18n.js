/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
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
 *
 * Two things this file has to get right beyond the words.
 *
 * The direction. A Persian sentence in a left-to-right box is not merely
 * right-aligned wrongly: the parts of it move. "این قسمت برای تنظیمات QUIC
 * می‌باشد" came out as "می‌باشد QUIC این قسمت برای تنظیمات", because the
 * browser lays out a right-to-left run inside a left-to-right paragraph by
 * putting the whole run where the paragraph wants it and only then reversing
 * the letters inside. The Latin word in the middle splits the sentence into
 * two runs, and the two runs then appear in the wrong order. Nothing about
 * the text is wrong; the box it is in is. page() below is that box, and it
 * has to wrap everything a view returns, not only the parts that look
 * obviously textual.
 *
 * And the technical words. handshake, ping, node, tunnel, QUIC: these are not
 * translated, they are written in Persian letters - هندشیک, پینگ, نود, تونل.
 * A reader looking for the thing they read about in a Telegram channel needs
 * to recognise the word, and a Persian coinage for it is a word they have
 * never seen and will not search for.
 */

'use strict';
'require baseclass';

var LANG = 'en';

var FA = {
	/* -------------------------------------------------------- how long ago */
	'just now': 'همین الان',
	'%d min ago': '%d دقیقه پیش',
	'%d h ago': '%d ساعت پیش',
	'%d days ago': '%d روز پیش',

	/* ----------------------------------------------------- the three tests */
	'Ping': 'پینگ',
	'TCPing': 'TCPing',
	'URL Test': 'تست URL',
	'Test': 'تست',
	'ICMP round trip to the address. Says nothing about the server behind it, which may not answer pings at all.':
		'رفت‌وبرگشت ICMP تا آن آدرس. دربارهٔ سروری که پشتش است چیزی نمی‌گوید، و آن سرور ممکن است اصلاً به پینگ جواب ندهد.',
	'A handshake to the port the tunnel will use.':
		'یک هندشیک به همان پورتی که تونل استفاده می‌کند.',
	'One whole request carried by this node. The only one that proves it works.':
		'یک درخواست کامل که از همین نود عبور می‌کند. تنها تستی که ثابت می‌کند نود کار می‌کند.',

	/* ----------------------------------------------------------- the nodes */
	'Node': 'نود',
	'Nodes': 'نودها',
	'%d nodes': '%d نود',
	'Protocol': 'پروتکل',
	'in use': 'در حال استفاده',
	'Use': 'استفاده',
	'This is the node the tunnel is using at the moment. Press Disconnect, or Choose again, before deleting it.':
		'این همان نودی است که تونل الان از آن استفاده می‌کند. قبل از حذفش «قطع» یا «انتخاب دوباره» را بزنید.',
	'Connecting through %s…': 'در حال اتصال از راه %s…',
	'Nothing read yet. Press Read the subscriptions, or Connect on the main page.':
		'هنوز چیزی خوانده نشده. «همین حالا اشتراک‌ها را بخوان» را بزنید، یا در صفحهٔ اصلی «اتصال».',
	'Where nodes come from, and which ones to add by hand. Changes take effect the next time the list is read.':
		'نودها از کجا می‌آیند، و کدام‌ها را دستی اضافه می‌کنید. تغییرات از دفعهٔ بعدی که لیست خوانده شود اعمال می‌شوند.',
	'Which nodes to use': 'از کدام نودها استفاده شود',
	'Nodes to use': 'نودهای مورد استفاده',
	'This decides who may be measured, not who wins: whichever node answers fastest is the one used, wherever it came from. A node added by hand joins the list rather than replacing it. To insist on one node, press “Use” beside it below.':
		'این تعیین می‌کند چه کسی اندازه‌گیری شود، نه چه کسی برنده شود: هر نودی که سریع‌تر جواب بدهد همان استفاده می‌شود، از هر جا که آمده باشد. نودی که دستی اضافه می‌کنید به لیست اضافه می‌شود و جای آن را نمی‌گیرد. اگر روی یک نود خاص اصرار دارید، پایین همین صفحه کنارش «استفاده» را بزنید.',
	'Mine and the subscriptions': 'مالِ من و اشتراک‌ها',
	'Only Manually Added': 'فقط نودهای دستی',
	'Only the subscriptions': 'فقط اشتراک‌ها',
	'Subscriptions': 'اشتراک‌ها',
	'Fetched every fifteen minutes. Xray, sing-box, Hysteria, Clash and WireGuard files are accepted, as are a plain list of links and a single base64 block.':
		'هر پانزده دقیقه یک بار خوانده می‌شود. فایل‌های Xray، sing-box، Hysteria، Clash و وایرگارد پذیرفته می‌شوند، و همین‌طور لیست ساده‌ای از لینک‌ها یا یک بلوک base64.',
	'Name': 'نام',
	'Address': 'آدرس',
	'Must start with http:// or https://': 'باید با ‎http://‎ یا ‎https://‎ شروع شود',
	'On': 'فعال',
	'Nodes added manually': 'نودهای دستی',
	'One share link per entry — vless, vmess, trojan, shadowsocks, socks, hysteria2, tuic or wireguard. A whole WireGuard .conf file can be pasted in as it stands. These are tried before the subscription list. The three test columns each measure something different; press one to run it.':
		'برای هر ردیف یک لینک — vless، vmess، trojan، shadowsocks، socks، hysteria2، tuic یا wireguard. یک فایل ‎.conf وایرگارد را هم می‌توانید همان‌طور که هست اینجا بچسبانید. این‌ها پیش از لیست اشتراک‌ها امتحان می‌شوند. سه ستون تست هر کدام چیز متفاوتی را می‌سنجند؛ روی هرکدام بزنید تا اجرا شود.',
	'Share link': 'لینک اشتراک‌گذاری',
	'A share link, several of them one per line, or a whole WireGuard .conf file. Choose a file and its contents are put in the box for you.':
		'یک لینک، یا چند لینک هر کدام در یک خط، یا کل یک فایل ‎.conf وایرگارد. فایل را انتخاب کنید تا محتوایش خودش داخل کادر بیاید.',
	'Browse…': 'انتخاب فایل…',
	'a .conf file, or a list of links': 'یک فایل ‎.conf، یا لیستی از لینک‌ها',
	'a .json or .conf file': 'یک فایل ‎.json یا ‎.conf',
	'Or a file': 'یا یک فایل',
	'Instead of an address: a configuration file — Xray, sing-box, Clash, a WireGuard .conf, or a plain list of links. Leave the address empty when you use this.':
		'به‌جای آدرس: یک فایل کانفیگ — Xray، sing-box، Clash، یک فایل ‎.conf وایرگارد، یا فقط لیستی از لینک‌ها. وقتی از این استفاده می‌کنید آدرس را خالی بگذارید.',
	'That file could not be read.': 'آن فایل خوانده نشد.',
	'That does not look like a share link': 'این شبیه یک لینک اشتراک‌گذاری نیست',
	'Last time the sources were read': 'آخرین باری که منابع خوانده شدند',
	'Reading the subscriptions. This page will fill in shortly.':
		'در حال خواندن اشتراک‌ها. این صفحه تا لحظاتی دیگر پر می‌شود.',
	'Read the subscriptions now': 'همین حالا اشتراک‌ها را بخوان',
	'Knocking on every node once. The TCPing column will fill in as answers come back.':
		'یک بار به در هر نود می‌زند. ستون TCPing هر چه جواب برسد پر می‌شود.',
	'Check every node': 'همهٔ نودها را بررسی کن',
	'“TCPing” is the handshake every node is checked with first, so it is filled in for all of them. “URL Test” is a complete request through the node, which is only run on the ones that answered and only until a fast enough one is found — so most of that column is empty by design. Both are the same measurements the buttons above take, done for the whole list at once.':
		'«TCPing» همان هندشیکی است که همهٔ نودها اول با آن بررسی می‌شوند، پس برای همه پر می‌شود. «URL Test» یک درخواست کامل از داخل نود است، که فقط روی آن‌هایی اجرا می‌شود که جواب داده‌اند و فقط تا وقتی یکی به‌قدر کافی سریع پیدا شود — پس خالی بودن بیشترِ آن ستون عمدی است. هر دو همان اندازه‌گیری‌هایی هستند که دکمه‌های بالا انجام می‌دهند، این بار برای کل لیست.',

	/* --------------------------------------------------------- the traffic */
	'Traffic through the tunnel': 'ترافیک عبوری از تونل',
	'Today': 'امروز',
	'Last 7 days': 'هفت روز اخیر',
	'This month': 'این ماه',
	'Last 14 days': 'چهارده روز اخیر',
	'total': 'مجموع',
	'down': 'دانلود',
	'up': 'آپلود',
	'Nothing recorded yet.': 'هنوز چیزی ثبت نشده.',
	'Sent straight out this month (not tunnelled): ':
		'مستقیم فرستاده‌شده در این ماه (بدون تونل): ',

	/* ---------------------------------------------------------- the status */
	'Connect': 'اتصال',
	'Disconnect': 'قطع',
	'Choose again': 'انتخاب دوباره',
	'Connected': 'متصل',
	'Disconnected': 'قطع',
	'Ready to connect': 'آمادهٔ اتصال',
	'Connecting…': 'در حال اتصال…',
	'Disconnecting…': 'در حال قطع…',
	'Starting…': 'در حال شروع…',
	'Finding a node…': 'در حال یافتن نود…',
	'Could not connect': 'اتصال برقرار نشد',
	'Latency': 'تأخیر',
	'Routing': 'مسیریابی',
	'Dismiss': 'بستن',
	'Iran is Direct': 'ایران مستقیم',
	'Iran split is on, but the routing data is missing':
		'تفکیک ایران روشن است، ولی دادهٔ مسیریابی نیست',
	'Everything goes through the tunnel': 'همه‌چیز از تونل می‌رود',
	'PassWall2 is also redirecting traffic — turn one of them off.':
		'PassWall2 هم دارد ترافیک را منحرف می‌کند — یکی از این دو را خاموش کنید.',
	'Checking which of %d nodes answer at all — %d so far':
		'بررسی اینکه از %d نود کدام‌ها اصلاً جواب می‌دهند — تا اینجا %d',
	'Measuring the %d that answered, best first — %d done':
		'اندازه‌گیری %d نودی که جواب دادند، بهترین اول — %d انجام شد',
	'%d of %d nodes answered, but none completed a request':
		'%d نود از %d جواب دادند، ولی هیچ‌کدام یک درخواست را کامل نکرد',
	'No node on the list answered at all': 'هیچ نودی در لیست جواب نداد',

	/* ------------------------------------------------------------- the log */
	'Log': 'لاگ',
	'The last few hundred lines this program wrote to the system log, newest at the bottom. It refreshes every five seconds. Nothing here is stored by this package — it is the router’s own log, and it is emptied when the router restarts.':
		'چند صد خط آخری که این برنامه در لاگ سیستم نوشته، تازه‌ترین در پایین. هر پنج ثانیه تازه می‌شود. هیچ‌کدام از این‌ها را خود پکیج ذخیره نمی‌کند — لاگ خودِ روتر است و با ریستارت روتر پاک می‌شود.',
	/* The lines themselves are never translated: they are the router's own
	   log, written in English with paths and numbers in them, and a Persian
	   rendering of half of them would be a worse thing to read than either. */
	'Nothing has been logged yet.': 'هنوز چیزی در لاگ نوشته نشده.',
	'Refresh': 'تازه‌سازی',
	'Following': 'دنبال کردن',
	'Not following': 'دنبال نکردن',

	/* -------------------------------------------------------- the settings */
	'Settings': 'تنظیمات',
	'Language': 'زبان',
	'English': 'English',
	'Persian': 'فارسی',

	'Routing data': 'دادهٔ مسیریابی',
	'Send Iranian traffic direct': 'ترافیک ایران مستقیم برود',
	'Iranian sites and addresses skip the tunnel. Needs the routing data below — until that is downloaded this does nothing, because a core asked for a geo file it has not got refuses to start rather than carrying on without it.':
		'سایت‌ها و آدرس‌های ایرانی از تونل رد نمی‌شوند. به دادهٔ مسیریابیِ پایین نیاز دارد — تا وقتی آن دانلود نشده این گزینه هیچ کاری نمی‌کند، چون هسته‌ای که از آن فایل geo خواسته شده و ندارد اصلاً بالا نمی‌آید و بی‌خیالش هم نمی‌شود.',
	'Geoip source': 'منبع Geoip',
	'geoip.dat file address': 'آدرس فایل ‎geoip.dat',
	'Geosite source': 'منبع Geosite',
	'geosite.dat file address': 'آدرس فایل ‎geosite.dat',
	'Iranian DNS': 'DNS ایرانی',
	'Used for Iranian domains in split mode to keep CDN traffic local. Leave empty to keep split routing active without exposing DNS lookups to Iranian servers.':
		'در حالت تفکیک برای دامنه‌های ایرانی استفاده می‌شود تا ترافیک CDN داخل کشور بماند. خالی بگذارید تا تفکیک کار کند بدون اینکه سرورهای ایرانی ببینند چه دامنه‌هایی جست‌وجو می‌شود.',
	'Block advertising': 'مسدود کردن تبلیغات',
	'Also needs the routing data.': 'این هم به دادهٔ مسیریابی نیاز دارد.',
	'Block BitTorrent': 'مسدود کردن بیت‌تورنت',
	'BitTorrent through a free node is how a free node stops existing.':
		'بیت‌تورنت روی یک نود رایگان همان کاری است که نود رایگان را از بین می‌برد.',

	'Network': 'شبکه',
	'Name lookups': 'حل نام‌ها',
	'“Through dnsmasq” keeps local machine names and DHCP names working and moves only the outside lookups into the tunnel. “Straight into the tunnel” resolves outside names and loses the ones on your own network.':
		'«از راه dnsmasq» نام دستگاه‌های داخل شبکه و نام‌های DHCP را سرِ جایش نگه می‌دارد و فقط جست‌وجوی نام‌های بیرونی را به تونل می‌برد. «مستقیم داخل تونل» نام‌های بیرونی را حل می‌کند ولی نام‌های شبکهٔ خودتان را از دست می‌دهید.',
	'Through dnsmasq (recommended)': 'از راه dnsmasq (پیشنهادی)',
	'Straight into the tunnel': 'مستقیم داخل تونل',
	'Leave alone': 'دست نزن',
	'Force DNS through the router': 'اجبار DNS از راه روتر',
	'Some devices ignore the router and ask 8.8.8.8 or 1.1.1.1 themselves. Those questions leave without the tunnel, so the answer is whatever the censor wants it to be, and the device then connects to it — looking perfectly healthy while doing so. This drags such queries back to the router. Leave it on unless a device on your network genuinely has to reach a DNS server of its own.':
		'بعضی دستگاه‌ها روتر را نادیده می‌گیرند و خودشان مستقیم از ‎8.8.8.8‎ یا ‎1.1.1.1‎ می‌پرسند. آن پرسش‌ها بدون تونل بیرون می‌روند، پس جوابش هر چیزی است که فیلترچی بخواهد، و دستگاه بعد به همان وصل می‌شود — بدون اینکه ظاهراً چیزی خراب باشد. این گزینه آن پرسش‌ها را به زور به روتر برمی‌گرداند. روشن بگذارید، مگر دستگاهی در شبکه‌تان واقعاً لازم داشته باشد به DNS خودش برسد.',
	'IPv6': 'IPv6',
	'Almost no node on a free list carries IPv6, and a client that prefers it leaves without the tunnel while looking perfectly fine. Refusing it makes the client fall back to IPv4, which is tunnelled.':
		'تقریباً هیچ نودی در لیست‌های رایگان IPv6 ندارد، و دستگاهی که IPv6 را ترجیح می‌دهد بدون تونل بیرون می‌رود و ظاهرش هم کاملاً سالم است. رد کردن IPv6 باعث می‌شود دستگاه به IPv4 برگردد، که تونل می‌شود.',
	'Refuse it while connected (recommended)': 'تا وقتی وصل است رد شود (پیشنهادی)',
	'Leave it alone': 'دست نزن',
	'Refuse QUIC': 'رد کردن QUIC',
	'Makes browsers fall back to TCP. Worth turning on when the chosen node carries UDP badly; off by default, because where UDP works QUIC is faster.':
		'مرورگرها را وادار می‌کند به TCP برگردند. وقتی نود انتخاب‌شده UDP را بد جابه‌جا می‌کند روشن کردنش می‌ارزد؛ به‌طور پیش‌فرض خاموش است، چون هر جا UDP کار کند QUIC سریع‌تر است.',
	'Firewall': 'فایروال',
	'Automatic is right unless this router has both and the wrong one is being picked.':
		'خودکار درست است، مگر اینکه این روتر هر دو را داشته باشد و اشتباهی انتخاب شود.',
	'Auto': 'خودکار',
	'Interfaces to tunnel': 'اینترفیس‌هایی که تونل شوند',
	'Read from this router. Left unset — which is how it ships — every LAN interface is tunnelled, which is what almost everyone wants. Choose one to pick traffic up from that interface only.':
		'از خود همین روتر خوانده شده. اگر خالی بماند — که حالت پیش‌فرض است — همهٔ اینترفیس‌های LAN تونل می‌شوند، و تقریباً همه همین را می‌خواهند. اگر یکی را انتخاب کنید فقط ترافیک همان اینترفیس برداشته می‌شود.',
	'Reconnect after a reboot': 'اتصال دوباره بعد از ریستارت',

	'Choosing a node': 'انتخاب نود',
	'Two passes. A quick handshake to every node, then a real request through the ones that answered — ten at a time, best first, stopping at the first node fast enough. Connecting therefore takes seconds, not a minute.':
		'دو مرحله. اول یک هندشیک سریع به همهٔ نودها، بعد یک درخواست واقعی از داخل آن‌هایی که جواب داده‌اند — ده‌تا ده‌تا، بهترین اول، و همان‌جا که اولین نودِ به‌قدر کافی سریع پیدا شد متوقف می‌شود. برای همین اتصال چند ثانیه طول می‌کشد، نه یک دقیقه.',
	'First pass': 'مرحلهٔ اول',
	'A TCP handshake to the node’s real port is the right test. A ping is quicker and wrong often enough to matter: a node behind a CDN answers pings at the edge whatever state it is in, and plenty of working nodes drop ICMP entirely.':
		'یک هندشیک TCP به پورت واقعی نود، تست درست است. پینگ سریع‌تر است ولی آن‌قدر اشتباه می‌کند که مهم باشد: نودی که پشت CDN است در هر حالی از لبه به پینگ جواب می‌دهد، و خیلی از نودهای سالم اصلاً ICMP را می‌اندازند دور.',
	'TCP handshake (recommended)': 'هندشیک TCP (پیشنهادی)',
	'Ping, then handshake': 'پینگ، بعد هندشیک',
	'Good enough (ms)': 'به‌قدر کافی خوب (میلی‌ثانیه)',
	'The first node measured faster than this is the one used. Lower means a better node and a longer wait.':
		'اولین نودی که اندازه‌اش از این کمتر دربیاید همان استفاده می‌شود. عدد کمتر یعنی نود بهتر و انتظار بیشتر.',
	'Measured at a time': 'هم‌زمان اندازه‌گیری‌شونده',
	'How many nodes are measured properly in one go.':
		'در هر نوبت چند نود به‌طور کامل اندازه‌گیری شوند.',
	'Batches at most': 'حداکثر تعداد دسته',
	'How far down the list to keep going when nothing is fast enough.':
		'وقتی هیچ‌کدام به‌قدر کافی سریع نیستند، تا کجای لیست ادامه داده شود.',
	'Checked at once': 'هم‌زمان بررسی‌شونده',
	'How many handshakes run in parallel in the first pass. Lower this on a router that struggles.':
		'در مرحلهٔ اول چند هندشیک هم‌زمان اجرا شود. روی روتری که کم می‌آورد این را کم کنید.',

	'Traffic': 'ترافیک',
	'Every (Min)': 'هر (دقیقه)',
	'How often the running total is written to storage, in minutes. Anything not yet written is lost if the router loses power. Five is the default and matches how often the counters are read, so at most one reading is ever at risk.':
		'جمعِ در جریان هر چند دقیقه روی حافظه نوشته شود. هر چه هنوز نوشته نشده باشد با قطع برق روتر از دست می‌رود. پیش‌فرض پنج است و با فاصلهٔ خواندن شمارنده‌ها یکی است، پس حداکثر یک نوبتِ خوانده‌شده در خطر است.',

	'Does this router have what it needs?': 'آیا این روتر آنچه لازم دارد را دارد؟',
	'These are questions put to the running system, not a list of package names. A package can be installed and the thing it provides still not work.':
		'این‌ها سؤال‌هایی است که از سیستمِ در حال اجرا پرسیده شده، نه یک لیست از اسم پکیج‌ها. یک پکیج می‌تواند نصب باشد و چیزی که فراهم می‌کند باز هم کار نکند.',
	'Transparent proxy': 'پروکسی شفاف',
	'the kernel can redirect traffic': 'کرنل می‌تواند ترافیک را منحرف کند',
	'the kernel module for this is missing — nothing will be tunnelled':
		'ماژول کرنلِ این کار نیست — هیچ چیزی تونل نمی‌شود',
	'Policy routing': 'مسیریابی سیاستی',
	'the full ip command is installed': 'دستور کامل ip نصب است',
	'busybox ip cannot add the route this needs — install ip-full':
		'ip بیزی‌باکس این مسیر را نمی‌تواند اضافه کند — ip-full را نصب کنید',
	'HTTPS': 'HTTPS',
	'the router can fetch over HTTPS': 'روتر می‌تواند روی HTTPS چیزی بگیرد',
	'certificates are missing or the connection is blocked — nothing can be downloaded':
		'گواهی‌ها نیستند یا اتصال مسدود است — هیچ چیزی دانلود نمی‌شود',
	'Firewall in use': 'فایروال در حال استفاده',
	'none found': 'چیزی پیدا نشد',
	'Packages': 'پکیج‌ها',
	'%d missing': '%d مورد کم است',
	'everything needed is installed': 'هرچه لازم بود نصب است',
	'Install them': 'نصبشان کن',
	'Installing. This needs a working connection and may take a minute.':
		'در حال نصب. به یک اتصال سالم نیاز دارد و ممکن است یک دقیقه طول بکشد.',

	'Addresses (geoip.dat)': 'آدرس‌ها (geoip.dat)',
	'Names (geosite.dat)': 'نام‌ها (geosite.dat)',
	'updated %s': 'به‌روزرسانی: %s',
	'date unknown': 'تاریخ نامعلوم',
	'not downloaded': 'دانلود نشده',
	'Download': 'دانلود',
	'Update': 'به‌روزرسانی',
	'Downloading. The page will show the new size when it is done.':
		'در حال دانلود. وقتی تمام شد، حجم جدید در همین صفحه نشان داده می‌شود.',
	'Free space': 'فضای خالی',
	'Remove both': 'حذف هر دو',
	'Routing data removed.': 'دادهٔ مسیریابی حذف شد.',
	'The full files are about 17 MB and 8 MB. If they will not fit, the same project publishes geoip-lite.dat (38 KB) and geosite-lite.dat (2 MB), which carry the Iranian categories and nothing else — put those addresses in the boxes above. A download that will not fit is refused rather than half written.':
		'فایل‌های کامل حدود ۱۷ و ۸ مگابایت هستند. اگر جا نمی‌شوند، همان پروژه ‎geoip-lite.dat‎ (۳۸ کیلوبایت) و ‎geosite-lite.dat‎ (۲ مگابایت) را هم منتشر می‌کند که فقط دسته‌های ایرانی را دارند — آدرس آن‌ها را در کادرهای بالا بگذارید. دانلودی که جا نشود رد می‌شود، نه اینکه نصفه نوشته شود.',

	'Cores': 'هسته‌ها',
	'installed': 'نصب‌شده',
	'not installed': 'نصب نشده',
	'no build for this router': 'برای این روتر بیلدی ندارد',
	'latest is %s': 'آخرین نسخه %s است',
	'Update to %s': 'به‌روزرسانی به %s',
	'Install': 'نصب',
	'Downloading %s.': 'در حال دانلود %s.',
	'Remove': 'حذف',
	'%s removed.': '%s حذف شد.',
	'Check for new versions': 'بررسی نسخه‌های جدید',
	'Asking each project what it has published. The versions above will fill in shortly.':
		'از هر پروژه پرسیده می‌شود چه نسخه‌ای منتشر کرده. نسخه‌های بالا تا لحظاتی دیگر پر می‌شوند.',
	'(installed by another package — left alone)':
		'(توسط پکیج دیگری نصب شده — دست‌نخورده مانده)',
	'Xray carries the traffic. sing-box and hysteria are only needed for nodes that speak hysteria2 or tuic, which Xray does not — one of them is then run as a local helper for that one node, and everything else works exactly as before.':
		'ترافیک را Xray می‌برد. sing-box و hysteria فقط برای نودهایی لازم‌اند که hysteria2 یا tuic حرف می‌زنند و Xray بلد نیست — آن وقت یکی از این دو فقط برای همان یک نود به‌عنوان کمکیِ محلی اجرا می‌شود و بقیهٔ چیزها دقیقاً مثل قبل کار می‌کنند.',

	'Traffic history': 'تاریخچهٔ ترافیک',
	'Forget all recorded traffic': 'همهٔ ترافیک ثبت‌شده را فراموش کن',
	'Traffic history cleared.': 'تاریخچهٔ ترافیک پاک شد.',

	'yes': 'بله',
	'no': 'خیر'
};

function tr(s) {
	if (LANG !== 'fa') return s;
	var v = FA[s];
	return (v === undefined) ? s : v;
}

/* The box everything a view returns has to go in.

   Persian is right to left, and a Persian sentence laid out inside a
   left-to-right box comes apart wherever a Latin word appears in it: the
   browser puts each right-to-left run where the surrounding direction wants
   it and only then reverses the letters within the run, so "…تنظیمات QUIC
   می‌باشد" arrives with its two halves swapped. Setting the direction on one
   element that contains the whole page fixes every string on it at once,
   including the ones LuCI itself draws inside the form.

   Anything that is a sequence rather than a sentence keeps dir="ltr" of its
   own - the fortnight of daily bars, for one. Mirroring those would put
   yesterday to the right of today without saying so. */
function page(children) {
	if (LANG !== 'fa') return E([], children);

	return E('div', { 'dir': 'rtl', 'class': 'pwplus-rtl' }, [
		E('style', { 'type': 'text/css' },
			'.pwplus-rtl{text-align:right}' +
			'.pwplus-rtl [dir="ltr"]{text-align:left}' +
			/* The cross that puts the message away belongs in the corner the
			   text ends at, which is the other one now. */
			'.pwplus-rtl #pwp-msg button{float:left}' +
			/* A number with a unit after it is one run and must not be split. */
			'.pwplus-rtl .cbi-value-field input,.pwplus-rtl .cbi-value-field textarea{' +
			'direction:ltr;text-align:left}'),
		E('div', {}, children)
	]);
}

return baseclass.extend({
	/* Called by each view once it knows what the setting says. Anything other
	   than "fa" is English, including a value nobody has set yet. */
	setLang: function(l) { LANG = (l === 'fa') ? 'fa' : 'en'; },
	get: function() { return LANG; },
	dir: function() { return LANG === 'fa' ? 'rtl' : 'ltr'; },
	page: page,
	tr: tr
});
