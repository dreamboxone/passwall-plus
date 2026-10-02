/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * The frame every page is drawn in, built the way Makhzan builds its own -
 * the same author's other LuCI application - out of Makhzan's stylesheet and
 * Makhzan's pieces: the banner with the logo and the version, a tab bar under
 * it, cards, metrics, buttons, and the footer with the Telegram group. Light
 * and dark follow the LuCI theme until the reader picks one.
 */

'use strict';
'require baseclass';
'require rpc';
'require ui';
'require uci';
'require zirgozar.i18n as i18n';

var _ = i18n.tr;

/* Put on the stylesheet's and the logo's addresses, so a browser holding the
   previous release's copies fetches these. Kept in step with PKG_VERSION. */
var BUILD = '2.0.12-1';

var callAction = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });
var callState = rpc.declare({ object: 'luci.zirgozar', method: 'state', expect: { '': {} } });

/* Makhzan's icon set, and the few this program needs besides. */
var ICONS = {
	home:     '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
	server:   '<rect x="3" y="3" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 6.5h.01M7 17.5h.01M11 6.5h6M11 17.5h6"/>',
	shield:   '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
	users:    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20a6 6 0 0 0-3-5.2"/>',
	wrench:   '<path d="M14.5 4.5a4.5 4.5 0 0 0 5 6.2L11 19.2a2.1 2.1 0 0 1-3-3l8.5-8.5a4.5 4.5 0 0 1-2-3.2z"/>',
	/* Settings as three sliders: it stays legible at the tab bar's size,
	   where the wrench's thin diagonal broke up into a smudge. */
	sliders:  '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
	grid:     '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
	download: '<path d="M12 3v12M7 10l5 5 5-5M4 20h16"/>',
	book:     '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
	power:    '<path d="M12 3v9"/><path d="M6.4 6.4a8 8 0 1 0 11.2 0"/>',
	cpu:      '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
	globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
	send:     '<path d="M21 3 3 10.5l7 2.5 2.5 7z"/><path d="M10 13 21 3"/>',
	sun:      '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
	moon:     '<path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/>',
	refresh:  '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
	trash:    '<path d="M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3"/>',
	check:    '<path d="M5 12l5 5 9-10"/>',
	alert:    '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18h.01"/>',
	pulse:    '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
	link:     '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
	code:     '<path d="M8 6l-6 6 6 6M16 6l6 6-6 6"/>',
	chart:    '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
	layers:   '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 12.5l9 5 9-5M3 16.5l9 5 9-5"/>',
	clock:    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
	list:     '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2"/><circle cx="4.5" cy="12" r="1.2"/><circle cx="4.5" cy="18" r="1.2"/>',
	rss:      '<path d="M5 11a8 8 0 0 1 8 8M5 5a14 14 0 0 1 14 14"/><circle cx="6" cy="18" r="1.5"/>',
	'chevron-down': '<path d="M6 9l6 6 6-6"/>',
	'chevron-up':   '<path d="M6 15l6-6 6 6"/>',
	eye:      '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
	'eye-off': '<path d="M3 3l18 18"/><path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A17 17 0 0 0 2 12s3.6 7 10 7a9.6 9.6 0 0 0 5.4-1.6"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>'
};

function icon(name, cls) {
	var s = E('span', { 'class': 'mk-ico ' + (cls || ''), 'aria-hidden': 'true' });
	s.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
		'stroke-linecap="round" stroke-linejoin="round">' + (ICONS[name] || '') + '</svg>';
	return s;
}

/* The artwork, transparent, at the height asked for - sixty on the banner, as
   Makhzan's own wordmark is. The banner is dark, so it takes the light
   version; the footer shows whichever suits the page. */
function logoImg(file, height, cls) {
	return E('img', {
		'class': 'mk-logo ' + (cls || ''),
		'src': L.resource('zirgozar/' + file) + '?v=' + BUILD,
		'alt': 'Zirgozar',
		'style': 'height:' + height + 'px'
	});
}

/* The browser keeps these files, and LuCI asks for them under its own
   version, not this program's - so after an update a browser went on running
   the old pages against the new router, asking for files the update had
   removed. When the router says another version than the one these pages
   were built for, each file is fetched again past the cache and the page
   reloaded, once. */
var OWN_FILES = [ 'zirgozar/ui', 'zirgozar/i18n', 'zirgozar/status', 'zirgozar/logoanim',
	'view/zirgozar/settings', 'view/zirgozar/nodes', 'view/zirgozar/subscribe', 'view/zirgozar/other',
	'view/zirgozar/update', 'view/zirgozar/traffic', 'view/zirgozar/geoview', 'view/zirgozar/acl',
	'view/zirgozar/log' ];

function freshen(installed) {
	var have = String(BUILD).replace(/-\d+$/, ''), want = String(installed).replace(/-r\d+$/, '');
	if (!want || have == want) return;
	var key = 'zirgozar-freshened-' + want;
	try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, '1'); } catch (e) { return; }
	var v = L.env.resource_version ? '?v=' + L.env.resource_version : '';
	Promise.all(OWN_FILES.map(function(f) {
		return fetch(L.env.base_url + '/' + f + '.js' + v, { cache: 'reload' }).catch(function() {});
	})).then(function() { location.reload(); });
}

function btn(text, tone, fn, ico) {
	return E('button', {
		'type': 'button',
		'class': 'mk-btn ' + (tone || 'primary'),
		'click': ui.createHandlerFn(null, fn)
	}, [ ico ? icon(ico) : '', E('span', {}, text) ]);
}

/* Makhzan's card: a coloured bar along the top, an icon and a title. */
function card(title, ico, colour, body) {
	return E('section', { 'class': 'mk-card', 'style': '--accent:' + (colour || '#3b82f6') }, [
		title ? E('h3', { 'class': 'mk-card-title' }, [
			ico ? E('span', { 'class': 'mk-badge-ico' }, icon(ico)) : '',
			E('span', {}, title)
		]) : '',
		body
	]);
}

/* Makhzan's metric: an icon tile, a title, and a big value under it. */
function metric(id, ico, colour, title, value, onclick) {
	return E('div', {
		'class': 'mk-metric' + (onclick ? ' mk-click' : ''),
		'style': '--accent:' + colour,
		'id': id,
		'click': onclick || null
	}, [
		E('span', { 'class': 'mk-metric-ico' }, icon(ico)),
		E('div', { 'class': 'mk-metric-title' }, title),
		E('div', { 'class': 'mk-big', 'id': id + '-v' }, value)
	]);
}

/* A size, or a time in milliseconds, with its unit in the page's language:
   15.8 MB, or 15.8 مگابایت. */
function bytes(n) {
	n = Number(n) || 0;
	if (n >= 1099511627776) return (n / 1099511627776).toFixed(2) + ' ' + _('TB');
	if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' ' + _('GB');
	if (n >= 1048576) return (n / 1048576).toFixed(1) + ' ' + _('MB');
	if (n >= 1024) return Math.round(n / 1024) + ' ' + _('KB');
	return n + ' ' + _('B');
}

/* A message where the thing it is about is - beside the button that was
   pressed, or under the option - and never at the top of the page, where it
   is read as being about the page. Warnings and failures in red, and they
   stay until the next press; anything else fades after a few seconds.

   note(anchor, text, kind): kind is 'ok', 'info', 'warn' or 'error'; an
   empty text takes the message away. */
function note(anchor, text, kind) {
	if (!anchor || !anchor.parentNode) return;
	var n = anchor.nextElementSibling;
	if (!n || !n.classList.contains('pwp-note')) {
		n = E('span', { 'class': 'pwp-note', 'role': 'status' });
		anchor.parentNode.insertBefore(n, anchor.nextSibling);
	}
	kind = kind || 'info';
	n.className = 'pwp-note ' + kind;
	n.textContent = text || '';
	n.style.display = text ? '' : 'none';
	window.clearTimeout(n.pwpTimer);
	if (text && kind != 'warn' && kind != 'error')
		n.pwpTimer = window.setTimeout(function() { n.style.display = 'none'; }, 10000);
}

/* Dragging rows by their ☰ handle, with pointer events.

   LuCI makes the handle a draggable <button> and relies on the browser's own
   drag and drop, which some browsers never start from a button, and which it
   swaps for a touch-only scheme on any device that has a touch screen - where
   a mouse then cannot drag at all. This does the same job with pointer
   events, which every browser sends for a mouse, a pen and a finger alike:
   the row follows the pointer's place in the table, and where it is let go
   the move is staged in the configuration exactly as LuCI's own would be,
   and saved with Save & Apply.

   Delegated from the page, so tables drawn again after a save keep it. */
function sortable(root, config) {
	root.addEventListener('pointerdown', function(ev) {
		var h = ev.target.closest && ev.target.closest('.drag-handle');
		if (!h || ev.button > 0) return;
		var row = h.closest('tr.cbi-section-table-row');
		if (!row || !row.getAttribute('data-sid')) return;
		ev.preventDefault();
		var body = row.parentNode, target = null, below = false;
		row.style.opacity = '0.45';
		try { h.setPointerCapture(ev.pointerId); } catch (e) {}

		function clear() {
			var marked = body.querySelectorAll('.drag-over-above,.drag-over-below');
			for (var i = 0; i < marked.length; i++)
				marked[i].classList.remove('drag-over-above', 'drag-over-below');
		}
		/* The row the pointer is over, by height alone: whatever is drawn on
		   top of it - the row being dragged, a tooltip - does not matter. */
		function move(e) {
			clear();
			target = null;
			var rows = body.children;
			for (var i = 0; i < rows.length; i++) {
				var tr = rows[i];
				if (tr === row || !tr.getAttribute('data-sid')) continue;
				var r = tr.getBoundingClientRect();
				if (e.clientY >= r.top && e.clientY <= r.bottom) {
					below = e.clientY > r.top + r.height / 2;
					target = tr;
					break;
				}
			}
			if (target)
				target.classList.add(below ? 'drag-over-below' : 'drag-over-above');
		}
		function done() {
			h.removeEventListener('pointermove', move);
			h.removeEventListener('pointerup', done);
			h.removeEventListener('pointercancel', done);
			row.style.opacity = '';
			clear();
			if (!target) return;
			uci.move(config, row.getAttribute('data-sid'), target.getAttribute('data-sid'), below);
			body.insertBefore(row, below ? target.nextSibling : target);
		}
		h.addEventListener('pointermove', move);
		h.addEventListener('pointerup', done);
		h.addEventListener('pointercancel', done);
	});

	/* The browser's own drag and drop, and LuCI's handlers for it, kept off
	   the handle: two kinds of drag at once would fight over the row. */
	function tame() {
		var hs = root.querySelectorAll('.drag-handle');
		for (var i = 0; i < hs.length; i++) {
			hs[i].setAttribute('draggable', 'false');
			hs[i].style.touchAction = 'none';
		}
	}
	tame();
	new MutationObserver(tame).observe(root, { childList: true, subtree: true });
	root.addEventListener('dragstart', function(ev) {
		if (ev.target.closest && ev.target.closest('.drag-handle')) ev.preventDefault();
	}, true);
	return root;
}

function ms(n) {
	return n + ' ' + _('ms');
}

/* "1.1.0-r1" as the banner shows it: v1.1.0-r1 in English, and in Persian
   words - نسخه 1.1.0 ویرایش 1. */
function versionText(v) {
	if (!v) return '';
	if (i18n.get() !== 'fa') return 'v' + v;
	var m = String(v).match(/^(.*?)-r(\d+)$/);
	return m ? _('Version %s, revision %s').format(m[1], m[2]) : _('Version %s, revision %s').format(v, '1');
}

function prefersDark() {
	var saved = null;
	try { saved = localStorage.getItem('zirgozar-theme'); } catch (e) {}
	if (saved) return saved === 'dark';
	/* Otherwise follow the LuCI theme: a dark page background means dark. */
	var m = getComputedStyle(document.body).backgroundColor.match(/\d+/g);
	return m ? (0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2]) < 128 : false;
}

function hero(root, version) {
	var fa = i18n.get() === 'fa';

	function themeBtn(dark, text, ico) {
		return E('button', { 'type': 'button', 'class': 'mk-btn glass', 'click': function() {
			root.classList.toggle('mk-dark', dark);
			/* The edit window is drawn outside the page and takes its
			   colours from here. */
			document.body.classList.toggle('pwp-dark', dark);
			paint();
			try { localStorage.setItem('zirgozar-theme', dark ? 'dark' : 'light'); } catch (e) {}
		} }, [ icon(ico), E('span', {}, text) ]);
	}
	var light = themeBtn(false, _('Light'), 'sun'), dark = themeBtn(true, _('Dark'), 'moon');
	function paint() {
		var d = root.classList.contains('mk-dark');
		light.classList.toggle('mk-seg-on', !d); light.setAttribute('aria-pressed', String(!d));
		dark.classList.toggle('mk-seg-on', d); dark.setAttribute('aria-pressed', String(d));
	}
	paint();

	/* The other language's own name, in its own script. */
	var lang = E('button', {
		'type': 'button', 'class': 'mk-btn glass', 'lang': fa ? 'en' : 'fa',
		'click': ui.createHandlerFn(null, function() {
			return callAction('set_lang', fa ? 'en' : 'fa').then(function() { location.reload(); });
		})
	}, [ icon('globe'), E('span', {}, fa ? 'English' : 'فارسی') ]);

	var ver = E('span', { 'class': 'mk-version', 'id': 'pwp-version' }, versionText(version));
	callState().then(function(st) {
		if (!st || !st.version) return;
		if (!version) ver.textContent = versionText(st.version);
		freshen(st.version);
	}).catch(function() {});

	/* The still logo at once, the moving one as soon as it has arrived. */
	var heroLogo = logoImg('logo-light.png', 60);
	L.require('zirgozar.logoanim').then(function(m) {
		if (m && m.src) heroLogo.src = m.src;
	}).catch(function() {});

	return E('div', { 'class': 'mk-hero' }, [
		E('div', { 'class': 'mk-brand' }, [ E('div', {}, [
			E('h2', { 'aria-label': 'Zirgozar' }, [ heroLogo, ver ]),
			E('p', {}, _('Complete tunnel management on your router'))
		]) ]),
		E('div', { 'class': 'mk-row' }, [
			E('div', { 'class': 'mk-seg', 'role': 'group', 'aria-label': _('Display mode') }, [ light, dark ]),
			lang
		])
	]);
}

/* Makhzan's tab bar, under the banner, for this program's pages. LuCI's own
   row of tabs above the page says the same thing and is hidden by the
   stylesheet, so there is one way between pages and it looks like Makhzan's. */
var PAGES = [
	[ 'settings',  'home',     'Basic Settings' ],
	[ 'nodes',     'server',   'Node List' ],
	[ 'subscribe', 'rss',      'Node Subscribe' ],
	[ 'other',     'grid',     'Other Settings' ],
	[ 'update',    'download', 'App Update' ],
	[ 'traffic',   'shield',   'Rule Manage' ],
	[ 'geoview',   'globe',    'Geo View' ],
	[ 'acl',      'users',    'Access Control' ],
	[ 'log',      'book',     'Runtime Logs' ]
];

function tabs() {
	var here = (L.env.dispatchpath || [])[3] || 'settings';
	if (here === 'overview') here = 'settings';
	return E('nav', { 'class': 'mk-tabs', 'role': 'tablist' }, PAGES.map(function(p) {
		return E('a', {
			'class': 'mk-tab' + (p[0] === here ? ' mk-tab-on' : ''),
			'role': 'tab',
			'aria-selected': String(p[0] === here),
			'href': L.url('admin', 'services', 'zirgozar', p[0])
		}, [ icon(p[1]), E('span', {}, _(p[2])) ]);
	}));
}

function footer() {
	return E('div', { 'class': 'mk-footer' }, [
		logoImg('logo.png', 26, 'mk-logo-dark'),
		logoImg('logo-light.png', 26, 'mk-logo-light'),
		E('div', {}, 'Zirgozar · Copyright © 2026 dreamboxone · GNU AGPLv3 · ' + _('No warranty')),
		E('a', { 'href': 'https://t.me/routekernel1', 'target': '_blank', 'rel': 'noopener noreferrer', 'class': 'mk-link' },
			[ icon('send'), 'Telegram · t.me/routekernel1' ]),
		/* The AGPL asks that people using this over a network can get its
		   source. This is where it is. */
		E('a', { 'href': 'https://github.com/dreamboxone/zirgozar', 'target': '_blank', 'rel': 'noopener noreferrer', 'class': 'mk-link' },
			[ icon('code'), _('Source code') ])
	]);
}

/* page(children, { version: '1.1.0' })

   Everything a view returns goes in here: Makhzan's root, banner, tab bar
   and footer around it. The right-to-left box for Persian is i18n's, inside
   this one. */
function page(children, opts) {
	opts = opts || {};
	var fa = i18n.get() === 'fa';
	/* Kept out of sight until its stylesheet has arrived. Drawn before, it is
	   a page of full-size icons and bare text for a moment, which reads as
	   broken rather than as loading. A stylesheet that never comes still lets
	   the page be seen after a second and a half. */
	var root = E('div', { 'class': 'mk', 'dir': fa ? 'rtl' : 'ltr', 'style': 'visibility:hidden' });
	function show() { root.style.visibility = ''; }
	root.appendChild(E('link', {
		'rel': 'stylesheet',
		'href': L.resource('zirgozar/theme.css') + '?v=' + BUILD,
		'load': show,
		'error': show
	}));
	window.setTimeout(show, 1500);
	var dark = prefersDark();
	if (dark) root.classList.add('mk-dark');
	/* For what LuCI draws outside the page: the edit window and the Save bar
	   take the page's language, typeface and colours from these. */
	document.body.classList.toggle('pwp-dark', dark);
	document.body.classList.toggle('pwp-fa', fa);
	root.appendChild(hero(root, opts.version));
	root.appendChild(tabs());
	root.appendChild(i18n.page(children));
	root.appendChild(footer());
	return root;
}

return baseclass.extend({
	icon: icon,
	btn: btn,
	card: card,
	metric: metric,
	bytes: bytes,
	ms: ms,
	versionText: versionText,
	note: note,
	sortable: sortable,
	page: page
});
