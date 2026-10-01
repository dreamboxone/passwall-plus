/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * What PassWall2 shows at the top of its Basic Settings page, and this
 * program's first page shows the same way: a row of tiles - the core and
 * whether it is running, and three sites to press for a connection check -
 * then what the tunnel is doing and through which node, and at the foot of
 * the page how much has gone through it.
 *
 * There is no switch here. The main switch is the one in the form below,
 * saved and applied the way PassWall2's is; two switches for one thing is one
 * too many.
 */

'use strict';
'require baseclass';
'require rpc';
'require poll';
'require ui';
'require zirgozar.i18n as i18n';
'require zirgozar.ui as pui';

var _ = i18n.tr;

var callState   = rpc.declare({ object: 'luci.zirgozar', method: 'state',   expect: { '': {} } });
var callTraffic = rpc.declare({ object: 'luci.zirgozar', method: 'traffic', expect: { '': {} } });
var callCheck   = rpc.declare({ object: 'luci.zirgozar', method: 'check',
                                params: [ 'url' ], expect: { '': {} } });
var callAction  = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                                params: [ 'name', 'arg' ], expect: { '': {} } });

var UP = '#f59e0b', DOWN = '#3b82f6';

/* The one message the reader has already read and put away. Kept for as long
   as the page is open, which is exactly as long as it needs to be: a reload
   is a fresh look at the router and the message ought to be shown again. */
var dismissed = '';

/* The three sites' marks, drawn in one colour like every other icon on the
   page - white on the tile's own colour - rather than in their makers'. */
var BRANDS = {
	cloudflare: '<path d="M16.5 17.5H3.6a3.6 3.6 0 0 1-.4-7.18A5.9 5.9 0 0 1 14.4 8.6a4.46 4.46 0 0 1 2.1 8.9z"/>' +
	            '<path d="M18.2 17.5h2.4a3.4 3.4 0 0 0 .1-6.8 3.1 3.1 0 0 0-2.3 1.1 6.4 6.4 0 0 1-.2 5.7z" opacity=".75"/>',
	google:     '<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>',
	github:     '<path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>'
};

function brand(name) {
	var s = E('span', { 'class': 'mk-ico', 'aria-hidden': 'true' });
	s.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" stroke="none">' + (BRANDS[name] || '') + '</svg>';
	return s;
}

function svg(tag, attrs, children) {
	var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
	(children || []).forEach(function(c) { e.appendChild(c); });
	return e;
}

/* A size as its number and its unit, apart - so that the middle of a ring can
   show the number large and the unit small under it. "1.40 گیگابایت" on one
   line was wider than the ring. */
function sizeParts(n) {
	var t = pui.bytes(n), i = t.indexOf(' ');
	return i < 0 ? [ t, '' ] : [ t.slice(0, i), t.slice(i + 1) ];
}

/* A ring split between what went up and what came down, with the total in the
   middle. Drawn with stroke-dasharray on two arcs of one circle rather than
   with paths: no arc maths, nothing to get wrong at 0% or 100%, and it scales
   to whatever size the caller asks for. */
function donut(title, up, down) {
	var total = (Number(up) || 0) + (Number(down) || 0);
	var R = 46, C = 2 * Math.PI * R;
	var upLen = total > 0 ? (up / total) * C : 0;

	var ring = [
		svg('circle', {
			cx: 60, cy: 60, r: R, fill: 'none',
			stroke: 'currentColor', 'stroke-opacity': '.12', 'stroke-width': 14
		}),
		svg('circle', {
			cx: 60, cy: 60, r: R, fill: 'none', stroke: DOWN, 'stroke-width': 14,
			'stroke-dasharray': C + ' ' + C, 'stroke-dashoffset': 0,
			transform: 'rotate(-90 60 60)'
		}),
		svg('circle', {
			cx: 60, cy: 60, r: R, fill: 'none', stroke: UP, 'stroke-width': 14,
			'stroke-dasharray': upLen + ' ' + C, 'stroke-dashoffset': 0,
			transform: 'rotate(-90 60 60)'
		})
	];

	/* An empty ring must read as "nothing yet" rather than as "all download". */
	if (total === 0) ring = [ ring[0] ];

	/* Transparent, and it takes an !important to say so: the LuCI theme paints
	   a background on every svg on the page with rules that are !important
	   themselves, and an important declaration in a style attribute is the one
	   thing that outranks them. */
	var g = svg('svg', { viewBox: '0 0 120 120', width: 120, height: 120,
	                     style: 'display:block;background-color:transparent!important' }, ring);

	var mid = sizeParts(total);

	return E('div', { 'style': 'text-align:center;flex:1 1 140px;min-width:140px' }, [
		E('div', { 'style': 'font-size:12px;color:var(--muted);margin-bottom:6px' }, title),
		E('div', { 'style': 'position:relative;display:inline-block' }, [
			g,
			E('div', {
				'style': 'position:absolute;inset:0;display:flex;flex-direction:column;' +
				         'align-items:center;justify-content:center;pointer-events:none;line-height:1.15'
			}, [
				E('div', { 'style': 'font-size:17px;font-weight:800;direction:ltr' }, mid[0]),
				E('div', { 'style': 'font-size:10px;font-weight:600;color:var(--muted)' }, mid[1]),
				E('div', { 'style': 'font-size:9px;color:var(--muted);margin-top:2px' }, _('total'))
			])
		]),
		E('div', { 'style': 'margin-top:6px;font-size:11px;line-height:1.6' }, [
			E('div', {}, [
				E('span', { 'style': 'display:inline-block;width:8px;height:8px;border-radius:50%;' +
				                     'background:' + DOWN + ';margin-inline-end:5px' }),
				E('span', { 'style': 'color:var(--muted)' }, _('down') + ' '),
				E('span', { 'style': 'font-weight:700' }, pui.bytes(down))
			]),
			E('div', {}, [
				E('span', { 'style': 'display:inline-block;width:8px;height:8px;border-radius:50%;' +
				                     'background:' + UP + ';margin-inline-end:5px' }),
				E('span', { 'style': 'color:var(--muted)' }, _('up') + ' '),
				E('span', { 'style': 'font-weight:700' }, pui.bytes(up))
			])
		])
	]);
}

/* The last fortnight, one stacked bar a day. Bars are scaled against the
   busiest day rather than against a fixed ceiling, so a quiet fortnight is
   still legible instead of being a row of invisible stubs. */
function bars(days) {
	days = (days || []).slice(-14);
	var max = 1;
	days.forEach(function(d) { max = Math.max(max, (d.up || 0) + (d.down || 0)); });

	var cols = days.map(function(d) {
		var t = (d.up || 0) + (d.down || 0);
		var h = Math.max(2, Math.round((t / max) * 88));
		var uh = t > 0 ? Math.round((d.up / t) * h) : 0;
		return E('div', {
			'style': 'flex:1 1 0;display:flex;flex-direction:column;justify-content:flex-end;' +
			         'align-items:center;gap:2px;min-width:0',
			'title': d.d + '  ↓ ' + pui.bytes(d.down) + '  ↑ ' + pui.bytes(d.up)
		}, [
			E('div', { 'style': 'width:100%;max-width:22px;display:flex;flex-direction:column;' +
			                    'justify-content:flex-end;height:' + h + 'px;border-radius:4px;overflow:hidden' }, [
				E('div', { 'style': 'height:' + uh + 'px;background:' + UP }),
				E('div', { 'style': 'height:' + (h - uh) + 'px;background:' + DOWN })
			]),
			E('div', { 'style': 'font-size:9px;color:var(--muted);white-space:nowrap' }, d.d.slice(8))
		]);
	});

	if (!cols.length)
		return E('div', { 'style': 'color:var(--muted);font-size:12px;padding:12px 0' },
			_('Nothing recorded yet.'));

	return E('div', { 'style': 'display:flex;align-items:flex-end;gap:4px;height:110px' }, cols);
}

function badge(st) {
	var text, cls;
	/* The switch is the intent. Off with the core still going is a tunnel on
	   its way down; off and still is simply off, whatever the last attempt
	   ended as - a failed measurement from before is not news with the switch
	   off. */
	if (!st.enabled && (st.running || st.connected))
	                                   { text = _('Disconnecting…'); cls = 'warn'; }
	else if (st.connected)             { text = _('Connected');    cls = 'ok'; }
	else if (st.status == 'selecting') { text = _('Finding a node…'); cls = 'warn'; }
	else if (st.status == 'starting')  { text = _('Starting…');    cls = 'warn'; }
	else if (!st.enabled)              { text = _('Main switch is off'); cls = ''; }
	else if (st.status == 'failed')    { text = _('Could not connect'); cls = 'error'; }
	else if (st.running)               { text = _('Connecting…');  cls = 'warn'; }
	else                               { text = _('Disconnected'); cls = ''; }

	return E('span', { 'class': 'mk-chip ' + cls, 'style': 'font-size:13px;padding:5px 14px' }, text);
}

/* The server's address beside its protocol, hidden until asked for - a
   screenshot of this page is the usual way a server's address gets passed
   around, and nobody means to. The choice is remembered in this browser. */
function ipShown() {
	try { return window.localStorage.getItem('zirgozar-show-ip') == '1'; } catch (e) { return false; }
}

function protoLine() {
	var shown = ipShown();
	var host = E('span', { 'id': 'pwp-host', 'class': 'pwp-ip' + (shown ? '' : ' pwp-ip-hidden'), 'dir': 'ltr' }, '');
	var eye = E('button', {
		'type': 'button', 'class': 'pwp-eye',
		'title': shown ? _('Hide the address') : _('Show the address'),
		'click': function() {
			shown = !shown;
			try { window.localStorage.setItem('zirgozar-show-ip', shown ? '1' : '0'); } catch (e) {}
			host.className = 'pwp-ip' + (shown ? '' : ' pwp-ip-hidden');
			eye.title = shown ? _('Hide the address') : _('Show the address');
			while (eye.firstChild) eye.removeChild(eye.firstChild);
			eye.appendChild(pui.icon(shown ? 'eye' : 'eye-off'));
		}
	}, [ pui.icon(shown ? 'eye' : 'eye-off') ]);
	return E('div', { 'style': 'display:flex;gap:10px;padding:4px 0;align-items:baseline' }, [
		E('span', { 'style': 'flex:0 0 130px;color:var(--muted);font-size:13px' }, _('Protocol')),
		E('span', { 'style': 'flex:1 1 auto;font-weight:600;display:inline-flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
			E('span', { 'id': 'pwp-proto' }, '-'),
			E('span', { 'id': 'pwp-hostwrap', 'style': 'display:none;gap:6px;align-items:center' }, [
				E('span', { 'style': 'color:var(--muted)' }, '·'), host, eye
			])
		])
	]);
}

function line(label, id) {
	return E('div', { 'style': 'display:flex;gap:10px;padding:4px 0;align-items:baseline' }, [
		E('span', { 'style': 'flex:0 0 130px;color:var(--muted);font-size:13px' }, label),
		E('span', { 'style': 'flex:1 1 auto;font-weight:600', 'id': id }, '-')
	]);
}

/* The page's pieces while they are still being built and not yet in the
   document, so the first values can go straight in rather than waiting for
   the first poll; afterwards, the document. */
var scope = null;

function byId(id) {
	if (scope)
		for (var i = 0; i < scope.length; i++) {
			if (scope[i].id == id) return scope[i];
			var f = scope[i].querySelector('#' + id);
			if (f) return f;
		}
	return document.getElementById(id);
}

function setNode(id, content) {
	var n = byId(id);
	if (!n) return;
	while (n.firstChild) n.removeChild(n.firstChild);
	if (content == null) return;
	n.appendChild(content instanceof Node ? content
		: document.createTextNode(content === '' ? '-' : String(content)));
}

/* One of PassWall2's row of tiles, drawn as Makhzan's metric card, with the
   icon given as an element so a brand mark can stand in for a line icon. */
function tile(id, ico, colour, title, value, onclick) {
	return E('div', {
		'class': 'mk-metric' + (onclick ? ' mk-click' : ''),
		'style': '--accent:' + colour,
		'id': id,
		'click': onclick || null
	}, [
		E('span', { 'class': 'mk-metric-ico' }, ico),
		E('div', { 'class': 'mk-metric-title', 'id': id + '-t' }, title),
		E('div', { 'class': 'mk-big', 'id': id + '-v' }, value)
	]);
}

function coreName(n) {
	n = String(n || 'xray');
	return n == 'xray' ? 'Xray' : n;
}

function coreTile(id, word, name, version, running) {
	var t = byId(id + '-t'), v = byId(id + '-v'), box = byId(id);
	if (t) t.textContent = word + ' ' + name;
	if (box) box.setAttribute('title', name + (version ? ' ' + version : ''));
	if (v) {
		v.className = 'mk-big ' + (running ? 'mk-on' : 'mk-bad');
		v.textContent = running ? _('RUNNING') : _('NOT RUNNING');
	}
}

function renderState(st) {
	st = st || {};
	setNode('pwp-version', pui.versionText(st.version));
	setNode('pwp-state', badge(st));
	setNode('pwp-node', st.server || '-');
	setNode('pwp-proto', st.protocol ? st.protocol : '-');
	setNode('pwp-host', st.host ? st.host : '');
	var hw = byId('pwp-hostwrap');
	if (hw) hw.style.display = st.host ? 'inline-flex' : 'none';
	setNode('pwp-latency', st.latency_ms > 0 ? pui.ms(st.latency_ms) : '-');
	setNode('pwp-route', st.route_ir
		? (st.geo_ready ? _('Iran is Direct')
		                : _('Iran split is on, but the routing data is missing'))
		: _('Everything goes through the tunnel'));

	/* The core, the way PassWall2 shows it: its name beside the word, on
	   one line, and under it whether it is running, in green or in red. The
	   version is there when the pointer rests on the tile. */
	coreTile('pwp-core', _('Core'), coreName(st.core_name), st.core_version, st.core_running);
	var bridge = byId('pwp-bridge');
	if (bridge) {
		bridge.style.display = st.bridge ? '' : 'none';
		if (st.bridge)
			coreTile('pwp-bridge', _('Helper core'), coreName(st.bridge), st.bridge_version, st.bridge_running);
	}

	/* Anything the user has to act on - and only that. The cross puts it away:
	   a stored message is cleared, and one worked out fresh each time is
	   remembered as dismissed so it does not come straight back. */
	var msg = byId('pwp-msg');
	if (msg) {
		var text = st.message ? _(st.message) : '';
		if (!text && st.passwall)
			text = _('PassWall2 is also redirecting traffic — turn one of them off.');
		if (text && text === dismissed) text = '';
		msg.style.display = text ? 'flex' : 'none';
		msg.setAttribute('data-text', text);
		setNode('pwp-msg-text', text);
	}

	var busy = (st.status == 'selecting' || st.status == 'starting' || !!st.job);
	var reselect = byId('pwp-reselect');
	if (reselect) reselect.disabled = busy;

	/* Two passes, and they measure different things, so one bar that silently
	   changes meaning half way through would be a lie told twice. */
	var ok  = (st.connected || st.status == 'idle' || st.status == 'ready');
	/* With the switch off, how the last attempt ended is not news. */
	var bad = (st.status == 'failed') && !!st.enabled;
	var pct = 0, label = '';

	if (st.job) {
		pct = 100;
		label = st.job + '…';
	} else if (st.phase == 'prefilter' && st.total > 0) {
		pct = Math.min(100, Math.round((st.done || 0) * 100 / st.total));
		label = _('Checking which of %d nodes answer at all — %d so far').format(st.total, st.alive || 0);
	} else if (st.phase == 'urltest') {
		pct = st.alive > 0 ? Math.min(100, Math.round((st.tested || 0) * 100 / st.alive)) : 0;
		label = _('Measuring the %d that answered, best first — %d done').format(st.alive || 0, st.tested || 0);
	} else if (bad) {
		pct = 100;
		label = st.alive > 0
			? _('%d of %d nodes answered, but none completed a request').format(st.alive, st.total || 0)
			: _('No node on the list answered at all');
	} else if (ok) {
		pct = 100;
		label = '';
	}

	var bar = byId('pwp-bar');
	var fill = byId('pwp-fill');
	if (bar) bar.style.display = (busy || bad) ? 'block' : 'none';
	if (fill) {
		fill.style.width = pct + '%';
		fill.style.background = bad ? '#ef4444' : (ok ? '#10b981' : '#3b82f6');
		if (st.job) fill.style.background = '#8b5cf6';
	}
	setNode('pwp-pct', label);
}

function renderTraffic(t) {
	t = t || {};
	var box = byId('pwp-donuts');
	if (box) {
		while (box.firstChild) box.removeChild(box.firstChild);
		[[ _('Today'), t.today ], [ _('Last 7 days'), t.week ], [ _('This month'), t.month ]]
			.forEach(function(p) {
				var v = p[1] || {};
				box.appendChild(donut(p[0], v.up || 0, v.down || 0));
			});
	}
	var b = byId('pwp-bars');
	if (b) {
		while (b.firstChild) b.removeChild(b.firstChild);
		b.appendChild(bars(t.days));
	}
	var d = (t.month || {}).direct_up + (t.month || {}).direct_down;
	setNode('pwp-direct', d > 0 ? pui.bytes(d) : '-');
}

function refreshState() {
	return callState().then(renderState).catch(function() {});
}

/* PassWall2's connection check: press the tile, one request, timed. */
function check(id, url) {
	var v = byId(id + '-v');
	if (v) {
		v.className = 'mk-big mk-wait';
		v.textContent = _('Checking…');
	}
	return callCheck(url).then(function(r) {
		var ms = (r && r.ms) || 0;
		if (!v) return;
		v.className = 'mk-big ' + (ms > 0 ? (ms < 1000 ? 'mk-on' : ms < 2000 ? 'mk-wait' : 'mk-bad') : 'mk-bad');
		v.textContent = ms > 0 ? pui.ms(ms) : _('Problem detected!');
	}).catch(function() {
		if (v) { v.className = 'mk-big mk-bad'; v.textContent = _('Problem detected!'); }
	});
}

return baseclass.extend({
	/* Asked for with the page, and a measurement started as it opens so that
	   by the time the reader has turned the switch on the answer is there. */
	load: function() {
		callAction('prepare', '').catch(function() {});
		return Promise.all([
			callState().catch(function() { return {}; }),
			callTraffic().catch(function() { return {}; })
		]);
	},

	/* Everything for the top of the page, and the traffic for its foot. */
	render: function(data) {
		var st = (data && data[0]) || {};
		var tr = (data && data[1]) || {};

		var tiles = E('div', { 'class': 'mk-grid mk-metrics', 'style': 'margin-bottom:18px' }, [
			tile('pwp-core', pui.icon('cpu'), '#3b82f6', _('Core'), '-'),
			tile('pwp-bridge', pui.icon('layers'), '#8b5cf6', _('Helper core'), '-'),
			tile('pwp-chk-cf', brand('cloudflare'), '#f59e0b', _('Cloudflare Connection'), _('Touch Check'),
				function() { check('pwp-chk-cf', 'https://www.cloudflare.com/cdn-cgi/trace'); }),
			tile('pwp-chk-google', brand('google'), '#10b981', _('Google Connection'), _('Touch Check'),
				function() { check('pwp-chk-google', 'https://www.google.com/generate_204'); }),
			tile('pwp-chk-github', brand('github'), '#6366f1', _('GitHub Connection'), _('Touch Check'),
				function() { check('pwp-chk-github', 'https://github.com'); })
		]);
		/* The helper core only has a tile while a node needs one. */
		tiles.querySelector('#pwp-bridge').style.display = 'none';

		var status = pui.card(_('Status'), 'pulse', '#10b981', E('div', {}, [
			E('div', { 'class': 'mk-row', 'style': 'justify-content:space-between;margin:0 0 12px' }, [
				E('span', { 'style': 'font-size:13px;color:var(--muted)' },
					_('The main switch is in the Main tab below.')),
				E('span', { 'id': 'pwp-state' }, '-')
			]),
			E('div', { 'id': 'pwp-msg', 'class': 'mk-alert', 'style': 'display:none' }, [
				E('span', { 'id': 'pwp-msg-text', 'style': 'flex:1 1 200px' }, ''),
				E('button', {
					'type': 'button',
					'title': _('Dismiss'),
					'style': 'border:0;background:none;cursor:pointer;font-size:18px;line-height:1;opacity:.6;padding:0 2px;color:inherit',
					'click': function() {
						var box = byId('pwp-msg');
						dismissed = (box && box.getAttribute('data-text')) || '';
						if (box) box.style.display = 'none';
						callAction('clear_message', '').catch(function() {});
					}
				}, '×')
			]),
			E('div', { 'id': 'pwp-bar', 'style': 'display:none;margin:0 0 14px 0' }, [
				E('div', { 'style': 'height:8px;border-radius:6px;overflow:hidden;background:var(--line)' }, [
					E('div', {
						'id': 'pwp-fill',
						'style': 'height:100%;width:0%;background:#3b82f6;border-radius:6px;' +
						         'transition:width .45s ease,background .45s ease'
					}, '')
				]),
				E('div', { 'id': 'pwp-pct', 'style': 'margin-top:5px;font-size:12px;color:var(--muted)' }, '')
			]),
			line(_('Node'), 'pwp-node'),
			protoLine(),
			line(_('Latency'), 'pwp-latency'),
			line(_('Routing'), 'pwp-route'),
			E('div', { 'class': 'mk-row', 'style': 'margin-top:14px' }, [
				E('button', {
					'id': 'pwp-reselect',
					'type': 'button',
					'class': 'mk-btn soft-blue',
					'click': ui.createHandlerFn(null, function() {
						return callAction('reselect', '').then(refreshState);
					})
				}, [ pui.icon('refresh'), E('span', {}, _('Choose again')) ])
			])
		]));

		var traffic = pui.card(_('Traffic through the tunnel'), 'chart', '#3b82f6', E('div', {}, [
			E('div', {
				'id': 'pwp-donuts',
				'style': 'display:flex;gap:14px;flex-wrap:wrap;justify-content:space-around;margin-bottom:18px'
			}, []),
			E('div', { 'style': 'font-size:12px;color:var(--muted);margin-bottom:6px' }, _('Last 14 days')),
			/* Left to right whatever the language: these are days in order. */
			E('div', { 'id': 'pwp-bars', 'dir': 'ltr' }, []),
			E('div', { 'style': 'margin-top:12px;font-size:12px;color:var(--muted)' }, [
				E('span', {}, _('Sent straight out this month (not tunnelled): ')),
				E('span', { 'id': 'pwp-direct', 'style': 'font-weight:600' }, '-')
			])
		]));

		poll.add(refreshState, 3);
		/* Traffic moves in five-minute steps. */
		poll.add(function() {
			return callTraffic().then(renderTraffic).catch(function() {});
		}, 15);

		/* Filled in now, in the pieces themselves. */
		scope = [ tiles, status, traffic ];
		renderState(st);
		renderTraffic(tr);
		scope = null;

		return { top: [ tiles, status ], bottom: [ traffic ], version: st.version };
	}
});
