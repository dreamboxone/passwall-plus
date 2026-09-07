/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of ovpn - https://github.com/dreamboxone/ovpn
 */

'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';
'require ovpn.i18n as i18n';

/* Our own strings, in the language the setting names. The global _()
   is shadowed for this file only: LuCI translates through .lmo
   catalogues built by a tool this package's build does not have. */
var _ = i18n.tr;


var callState   = rpc.declare({ object: 'luci.ovpn', method: 'state',   expect: { '': {} } });
var callTraffic = rpc.declare({ object: 'luci.ovpn', method: 'traffic', expect: { '': {} } });
var callAction  = rpc.declare({ object: 'luci.ovpn', method: 'action',
                                params: [ 'name', 'arg' ], expect: { '': {} } });

var UP = '#f59e0b', DOWN = '#3b82f6';

function bytes(n) {
	n = Number(n) || 0;
	if (n >= 1099511627776) return (n / 1099511627776).toFixed(2) + ' TB';
	if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
	if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
	if (n >= 1024) return Math.round(n / 1024) + ' KB';
	return n + ' B';
}

function svg(tag, attrs, children) {
	var e = document.createElementNS('http://www.w3.org/2000/svg', tag);
	for (var k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
	(children || []).forEach(function(c) { e.appendChild(c); });
	return e;
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
			'stroke-linecap': total > 0 && upLen > 0 ? 'butt' : 'butt',
			transform: 'rotate(-90 60 60)'
		})
	];

	/* An empty ring must read as "nothing yet" rather than as "all download". */
	if (total === 0) ring = [ ring[0] ];

	/* Transparent, and it takes an !important to say so. The theme paints a
	   background on every svg on the page and does it with two rules that are
	   themselves !important:

	       svg { background-color: var(--background-color-high) !important }
	       #view div[style] > svg { ... !important }

	   They exist for the bandwidth graphs, which are drawn on that background.
	   A ring drawn on it becomes a pale square sitting on the card in a colour
	   belonging to neither, and a plain background:transparent loses to them
	   without a word. An important declaration in a style attribute outranks
	   an important declaration in a stylesheet, which is the whole of the fix.
	   The ring is the drawing; the card behind it is the background. */
	var g = svg('svg', { viewBox: '0 0 120 120', width: 120, height: 120,
	                     style: 'display:block;background-color:transparent!important' }, ring);

	return E('div', { 'style': 'text-align:center;flex:1 1 140px;min-width:140px' }, [
		E('div', { 'style': 'font-size:12px;opacity:.65;margin-bottom:6px' }, title),
		E('div', { 'style': 'position:relative;display:inline-block' }, [
			g,
			E('div', {
				'style': 'position:absolute;inset:0;display:flex;flex-direction:column;' +
				         'align-items:center;justify-content:center;pointer-events:none'
			}, [
				E('div', { 'style': 'font-size:14px;font-weight:600' }, bytes(total)),
				E('div', { 'style': 'font-size:10px;opacity:.6' }, _('total'))
			])
		]),
		E('div', { 'style': 'margin-top:6px;font-size:11px;line-height:1.6' }, [
			E('div', {}, [
				E('span', { 'style': 'display:inline-block;width:8px;height:8px;border-radius:50%;' +
				                     'background:' + DOWN + ';margin-right:5px' }),
				E('span', { 'style': 'opacity:.8' }, _('down') + ' '),
				E('span', { 'style': 'font-weight:600' }, bytes(down))
			]),
			E('div', {}, [
				E('span', { 'style': 'display:inline-block;width:8px;height:8px;border-radius:50%;' +
				                     'background:' + UP + ';margin-right:5px' }),
				E('span', { 'style': 'opacity:.8' }, _('up') + ' '),
				E('span', { 'style': 'font-weight:600' }, bytes(up))
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
			'title': d.d + '  ↓ ' + bytes(d.down) + '  ↑ ' + bytes(d.up)
		}, [
			E('div', { 'style': 'width:100%;max-width:22px;display:flex;flex-direction:column;' +
			                    'justify-content:flex-end;height:' + h + 'px;border-radius:4px;overflow:hidden' }, [
				E('div', { 'style': 'height:' + uh + 'px;background:' + UP }),
				E('div', { 'style': 'height:' + (h - uh) + 'px;background:' + DOWN })
			]),
			E('div', { 'style': 'font-size:9px;opacity:.5;white-space:nowrap' }, d.d.slice(8))
		]);
	});

	if (!cols.length)
		return E('div', { 'style': 'opacity:.6;font-size:12px;padding:12px 0' },
			_('Nothing recorded yet.'));

	return E('div', { 'style': 'display:flex;align-items:flex-end;gap:4px;height:110px' }, cols);
}

function badge(st) {
	var text, colour;
	if (st.connected)                  { text = _('Connected');    colour = '#10b981'; }
	else if (st.status == 'selecting') { text = _('Finding a server…'); colour = '#f59e0b'; }
	else if (st.status == 'starting')  { text = _('Starting…');    colour = '#f59e0b'; }
	else if (st.status == 'failed')    { text = _('Could not connect'); colour = '#ef4444'; }
	else if (st.status == 'idle')      { text = _('Ready to connect'); colour = '#94a3b8'; }
	else if (st.running)               { text = _('Connecting…');  colour = '#f59e0b'; }
	else                               { text = _('Disconnected'); colour = '#94a3b8'; }

	return E('span', {
		'style': 'background:' + colour + ';color:#fff;padding:4px 14px;border-radius:12px;' +
		         'font-weight:bold;display:inline-block'
	}, text);
}

function line(label, id) {
	return E('div', { 'style': 'display:flex;gap:10px;padding:3px 0;align-items:baseline' }, [
		E('span', { 'style': 'flex:0 0 130px;opacity:.7;font-size:13px' }, label),
		E('span', { 'style': 'flex:1 1 auto;font-weight:500', 'id': id }, '-')
	]);
}

function setNode(id, content) {
	var n = document.getElementById(id);
	if (!n) return;
	while (n.firstChild) n.removeChild(n.firstChild);
	if (content == null) return;
	n.appendChild(content instanceof Node ? content
		: document.createTextNode(content === '' ? '-' : String(content)));
}

function card(title, body) {
	return E('div', {
		'style': 'background:rgba(127,127,127,.06);border:1px solid rgba(127,127,127,.20);' +
		         'border-radius:10px;padding:16px;margin-bottom:14px'
	}, [
		title ? E('div', { 'style': 'font-weight:600;margin-bottom:12px' }, title) : E('span'),
		body
	]);
}

function renderState(st) {
	st = st || {};
	setNode('ovpn-version', st.version ? 'v' + st.version : '');
	setNode('ovpn-state', badge(st));
	setNode('ovpn-server', st.server || '-');
	setNode('ovpn-proto', st.protocol ? st.protocol + (st.host ? '  ·  ' + st.host : '') : '-');
	setNode('ovpn-latency', st.latency_ms > 0 ? st.latency_ms + ' ms' : '-');
	setNode('ovpn-route', st.route_ir
		? (st.geo_ready ? _('Iranian traffic goes direct')
		                : _('Iran split is on, but the routing data is missing'))
		: _('Everything goes through the tunnel'));

	/* Anything the user has to act on. This is the difference between a page
	   that says "failed" and a page that says why. */
	var msg = document.getElementById('ovpn-msg');
	if (msg) {
		var text = st.message || '';
		/* Asked fresh every few seconds rather than remembered, so it goes as
		   soon as PassWall does. */
		if (!text && st.passwall)
			text = _('PassWall is also redirecting traffic — turn one of them off.');
		msg.style.display = text ? 'block' : 'none';
		setNode('ovpn-msg-text', text);
	}

	var busy = (st.status == 'selecting' || st.status == 'starting' || !!st.job);
	var connect = document.getElementById('ovpn-connect');
	var disconnect = document.getElementById('ovpn-disconnect');
	var reselect = document.getElementById('ovpn-reselect');
	if (connect)    connect.disabled = busy || !!st.enabled;
	if (disconnect) disconnect.disabled = busy || !st.enabled;
	if (reselect)   reselect.disabled = busy;

	/* Two passes, and they measure different things, so one bar that silently
	   changes meaning half way through would be a lie told twice. The label
	   says which pass is running and the bar is scaled to that pass. */
	var ok  = (st.connected || st.status == 'idle' || st.status == 'ready');
	var bad = (st.status == 'failed');
	var pct = 0, label = '';

	if (st.job) {
		pct = 100;
		label = st.job + '…';
	} else if (st.phase == 'prefilter' && st.total > 0) {
		pct = Math.min(100, Math.round((st.done || 0) * 100 / st.total));
		label = _('Checking which of %d servers answer at all — %d so far').format(st.total, st.alive || 0);
	} else if (st.phase == 'urltest') {
		pct = st.alive > 0 ? Math.min(100, Math.round((st.tested || 0) * 100 / st.alive)) : 0;
		label = _('Measuring the %d that answered, best first — %d done').format(st.alive || 0, st.tested || 0);
	} else if (bad) {
		pct = 100;
		label = st.alive > 0
			? _('%d of %d servers answered, but none completed a request').format(st.alive, st.total || 0)
			: _('No server on the list answered at all');
	} else if (ok) {
		pct = 100;
		label = '';
	}

	var bar = document.getElementById('ovpn-bar');
	var fill = document.getElementById('ovpn-fill');
	if (bar) bar.style.display = (busy || bad) ? 'block' : 'none';
	if (fill) {
		fill.style.width = pct + '%';
		fill.style.background = bad ? '#ef4444' : (ok ? '#10b981' : '#3b82f6');
		if (st.job) fill.style.background = '#8b5cf6';
	}
	setNode('ovpn-pct', label);
}

function renderTraffic(t) {
	t = t || {};
	var box = document.getElementById('ovpn-donuts');
	if (box) {
		while (box.firstChild) box.removeChild(box.firstChild);
		[[ _('Today'), t.today ], [ _('Last 7 days'), t.week ], [ _('This month'), t.month ]]
			.forEach(function(p) {
				var v = p[1] || {};
				box.appendChild(donut(p[0], v.up || 0, v.down || 0));
			});
	}
	var b = document.getElementById('ovpn-bars');
	if (b) {
		while (b.firstChild) b.removeChild(b.firstChild);
		b.appendChild(bars(t.days));
	}
	/* What went straight out rather than through the tunnel. Only worth
	   showing once the split is actually sending something that way. */
	var d = (t.month || {}).direct_up + (t.month || {}).direct_down;
	setNode('ovpn-direct', d > 0 ? bytes(d) : '-');
}

function act(name, arg) {
	return callAction(name, arg || '').then(function() {
		return callState().then(renderState);
	});
}

return view.extend({
	load: function() {
		/* Start measuring as the page opens, so that by the time the reader
		   has decided to press Connect the answer is already there. The
		   backend ignores this when a choice already exists. */
		return callAction('prepare', '')
			.catch(function() {})
			.then(function() {
				return Promise.all([
					callState().catch(function() { return {}; }),
					callTraffic().catch(function() { return {}; }),
					uci.load('ovpn').catch(function() { return null; })
				]);
			});
	},

	render: function(data) {
		/* Before a single string is built. */
		i18n.setLang(uci.get('ovpn', 'config', 'lang'));

		var st = (data && data[0]) || {};
		var tr = (data && data[1]) || {};

		var status = card(null, E('div', {}, [
			E('div', { 'style': 'margin-bottom:12px' }, [ E('span', { 'id': 'ovpn-state' }, '-') ]),
			E('div', {
				'id': 'ovpn-msg',
				'style': 'display:none;margin:-4px 0 12px 0;padding:9px 12px;border-radius:7px;' +
				         'background:rgba(245,158,11,.13);border:1px solid rgba(245,158,11,.35);' +
				         'font-size:13px;line-height:1.5'
			}, [ E('span', { 'id': 'ovpn-msg-text' }, '') ]),
			E('div', { 'id': 'ovpn-bar', 'style': 'display:none;margin:0 0 14px 0' }, [
				E('div', { 'style': 'height:8px;border-radius:6px;overflow:hidden;' +
				                    'background:rgba(127,127,127,.18)' }, [
					E('div', {
						'id': 'ovpn-fill',
						'style': 'height:100%;width:0%;background:#3b82f6;border-radius:6px;' +
						         'transition:width .45s ease,background .45s ease'
					}, '')
				]),
				E('div', { 'id': 'ovpn-pct', 'style': 'margin-top:5px;font-size:12px;opacity:.7' }, '')
			]),
			line(_('Server'), 'ovpn-server'),
			line(_('Protocol'), 'ovpn-proto'),
			line(_('Response time'), 'ovpn-latency'),
			line(_('Routing'), 'ovpn-route'),
			E('div', { 'style': 'margin-top:16px;display:flex;gap:10px;flex-wrap:wrap' }, [
				E('button', {
					'id': 'ovpn-connect',
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function() { return act('connect'); })
				}, _('Connect')),
				E('button', {
					'id': 'ovpn-disconnect',
					'class': 'btn cbi-button cbi-button-reset',
					'click': ui.createHandlerFn(this, function() { return act('disconnect'); })
				}, _('Disconnect')),
				E('button', {
					'id': 'ovpn-reselect',
					'class': 'btn cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, function() { return act('reselect'); })
				}, _('Choose again'))
			])
		]));

		var traffic = card(_('Traffic through the tunnel'), E('div', {}, [
			E('div', {
				'id': 'ovpn-donuts',
				'style': 'display:flex;gap:14px;flex-wrap:wrap;justify-content:space-around;' +
				         'margin-bottom:18px'
			}, []),
			E('div', { 'style': 'font-size:12px;opacity:.65;margin-bottom:6px' },
				_('Last 14 days')),
			E('div', { 'id': 'ovpn-bars' }, []),
			E('div', { 'style': 'margin-top:12px;font-size:12px;opacity:.7' }, [
				E('span', {}, _('Sent straight out this month (not tunnelled): ')),
				E('span', { 'id': 'ovpn-direct', 'style': 'font-weight:600' }, '-')
			])
		]));

		poll.add(function() {
			return callState().then(renderState).catch(function() {});
		}, 3);

		/* Traffic moves in five-minute steps, so asking every three seconds
		   would be the page working harder than the thing it is measuring. */
		poll.add(function() {
			return callTraffic().then(renderTraffic).catch(function() {});
		}, 15);

		var page = E([], [
			E('h2', { 'style': 'display:flex;align-items:baseline;gap:10px' }, [
				E('span', {}, 'ovpn'),
				E('span', { 'id': 'ovpn-version',
				            'style': 'font-size:13px;font-weight:normal;opacity:.55' }, '')
			]),
			status,
			traffic
		]);

		renderState(st);
		renderTraffic(tr);
		return page;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
