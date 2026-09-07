/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of ovpn - https://github.com/dreamboxone/ovpn
 *
 * Subscriptions, servers added by hand, and what the last measurement made of
 * all of them.
 */

'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';

var callNodes  = rpc.declare({ object: 'luci.ovpn', method: 'nodes', expect: { '': {} } });
var callSubs   = rpc.declare({ object: 'luci.ovpn', method: 'subs',  expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.ovpn', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

function ago(when) {
	if (!when) return '-';
	var s = Math.max(0, Math.floor(Date.now() / 1000) - when);
	if (s < 60) return _('just now');
	if (s < 3600) return _('%d min ago').format(Math.floor(s / 60));
	if (s < 86400) return _('%d h ago').format(Math.floor(s / 3600));
	return _('%d days ago').format(Math.floor(s / 86400));
}

function pill(text, colour) {
	return E('span', {
		'style': 'background:' + colour + ';color:#fff;border-radius:9px;padding:1px 8px;' +
		         'font-size:11px;font-weight:600;white-space:nowrap'
	}, text);
}

/* --------------------------------------------------- the name in the link

   Practically every share link ends in #something, and that something is the
   name whoever published it gave the server. A reader who pastes a link and
   leaves the name box empty meant that name, so there is no reason to make
   them type it a second time.

   It is percent-encoded UTF-8, so a Persian name arrives as %D8%B9%D9%84%DB%8C
   and has to be decoded rather than shown as it stands. Some links are not
   encoded at all and carry the characters directly; decodeURIComponent throws
   on those, which is what the catch is for. */
function decodeName(s) {
	s = String(s || '');
	if (!s) return '';
	try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { /* raw already */ }
	s = s.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\s+/g, ' ').trim();
	if (s.length > 60) s = s.slice(0, 60).trim();
	return s;
}

/* vmess is the one that hides its name in the middle rather than at the end:
   the whole link is one base64 object and the name is its "ps" field. atob
   hands back bytes, so a non-English name has to be read back as UTF-8 or it
   comes out as one wrong character per byte. */
function vmessName(link) {
	try {
		var b = link.replace(/^vmess:\/\//i, '').replace(/[#?].*$/, '')
		            .replace(/-/g, '+').replace(/_/g, '/');
		while (b.length % 4) b += '=';
		var raw = atob(b), bytes = new Uint8Array(raw.length);
		for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
		var o = JSON.parse(new TextDecoder('utf-8').decode(bytes));
		return decodeName(o.ps || o.remarks || '');
	} catch (e) {
		return '';
	}
}

function nameFromLink(text) {
	/* By line, not by whitespace: names have spaces in them, and splitting on
	   every space would take “سرور خانه” down to “سرور”. Only a second link
	   on the same line ends the first one's name. */
	var lines = String(text || '').split(/[\r\n]+/);
	for (var i = 0; i < lines.length; i++) {
		var l = lines[i].trim(), name = '';
		if (l.indexOf('://') < 0) continue;
		var h = l.indexOf('#');
		if (h >= 0) {
			name = l.slice(h + 1);
			var m = name.match(/\s+[a-z][a-z0-9+.-]*:\/\//i);
			if (m) name = name.slice(0, m.index);
			name = decodeName(name);
		} else if (/^vmess:\/\//i.test(l)) {
			name = vmessName(l.split(/\s+/)[0]);
		}
		if (name) return name;
	}
	return '';
}

function renderNodes(d) {
	var box = document.getElementById('ovpn-nodelist');
	if (!box) return;
	while (box.firstChild) box.removeChild(box.firstChild);

	var nodes = (d && d.nodes) || [];
	if (!nodes.length) {
		box.appendChild(E('div', { 'style': 'opacity:.65;font-size:13px;padding:8px 0' },
			_('Nothing read yet. Press Read the subscriptions, or Connect on the main page.')));
		return;
	}

	/* Measured first, then merely reachable, then the rest. The order the
	   subscription happened to list them in is the least useful order there
	   is, and it is the one the reader is scrolling through. */
	nodes = nodes.slice().sort(function(a, b) {
		if (a.ms > 0 && b.ms > 0) return a.ms - b.ms;
		if (a.ms > 0) return -1;
		if (b.ms > 0) return 1;
		if (a.handshake > 0 && b.handshake > 0) return a.handshake - b.handshake;
		if (a.handshake > 0) return -1;
		if (b.handshake > 0) return 1;
		return 0;
	});

	var rows = [ E('tr', { 'class': 'tr table-titles' }, [
		E('th', { 'class': 'th' }, _('Server')),
		E('th', { 'class': 'th' }, _('Protocol')),
		E('th', { 'class': 'th' }, _('Measured')),
		E('th', { 'class': 'th' }, _('Reachable in')),
		E('th', { 'class': 'th' }, '')
	]) ];

	nodes.forEach(function(n) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [
				E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
					E('span', { 'style': n.current ? 'font-weight:700' : '' }, n.label || n.host),
					n.current ? pill(_('in use'), '#10b981') : E('span')
				]),
				E('div', { 'style': 'font-size:11px;opacity:.55' }, n.host + ':' + n.port)
			]),
			E('td', { 'class': 'td' }, n.protocol),
			E('td', { 'class': 'td' }, n.ms > 0 ? n.ms + ' ms' : '—'),
			E('td', { 'class': 'td' }, n.handshake > 0 ? n.handshake + ' ms' : '—'),
			E('td', { 'class': 'td' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'padding:2px 10px;font-size:12px',
					'click': ui.createHandlerFn(null, function() {
						return callAction('pick', n.tag).then(function() {
							ui.addNotification(null,
								E('p', {}, _('Connecting through %s…').format(n.label || n.host)),
								'info');
						});
					})
				}, _('Use this one'))
			])
		]));
	});

	box.appendChild(E('table', { 'class': 'table cbi-section-table' }, rows));
	var m = document.getElementById('ovpn-nodecount');
	if (m) m.textContent = _('%d servers').format(nodes.length);
}

function renderSubs(d) {
	var box = document.getElementById('ovpn-substatus');
	if (!box) return;
	while (box.firstChild) box.removeChild(box.firstChild);

	var subs = (d && d.subs) || [];
	if (!subs.length) return;

	subs.forEach(function(s) {
		box.appendChild(E('div', {
			'style': 'display:flex;gap:10px;align-items:center;padding:3px 0;font-size:12px'
		}, [
			E('span', { 'style': 'font-weight:600;min-width:120px' }, s.name),
			s.error ? pill(s.error, '#ef4444') : pill(_('%d servers').format(s.count), '#10b981'),
			E('span', { 'style': 'opacity:.55' }, s.error ? '' : ago(s.when))
		]));
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			callNodes().catch(function() { return {}; }),
			callSubs().catch(function() { return {}; })
		]);
	},

	render: function(data) {
		var m, s, o;

		m = new form.Map('ovpn', _('Servers'),
			_('Where servers come from, and which ones to add by hand. Changes take effect the next time the list is read.'));

		s = m.section(form.GridSection, 'subscription', _('Subscriptions'),
			_('Each one is fetched every fifteen minutes. A source that hands back a single base64 block is understood as well as a plain list of links.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.placeholder = 'my list';

		o = s.option(form.Value, 'url', _('Address'));
		o.rmempty = false;
		o.placeholder = 'https://…';
		o.validate = function(section, value) {
			if (!value) return true;
			if (!/^https?:\/\//.test(value))
				return _('Must start with http:// or https://');
			return true;
		};

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.GridSection, 'node', _('Servers added by hand'),
			_('One share link per entry — vless, vmess, trojan, shadowsocks, socks, hysteria2 or tuic. These are tried before the subscription list.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = 'my server';

		o = s.option(form.TextValue, 'link', _('Share link'));
		o.rows = 3;
		o.rmempty = false;
		o.placeholder = 'vless://…';
		o.validate = function(section, value) {
			if (!value) return true;
			if (!/:\/\//.test(value))
				return _('That does not look like a share link');
			return true;
		};
		/* Written after the name, which is why this can fill it in: the empty
		   name has already been removed by the time this runs. A name the
		   reader typed is left exactly as they typed it. */
		o.write = function(section_id, value) {
			var rv = form.TextValue.prototype.write.apply(this, [ section_id, value ]);
			if (!this.map.data.get(this.map.config, section_id, 'name')) {
				var got = nameFromLink(value);
				if (got)
					this.map.data.set(this.map.config, section_id, 'name', got);
			}
			return rv;
		};

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.rmempty = false;

		var self = this;

		return m.render().then(function(mapEl) {
			var extra = E('div', { 'style': 'margin-top:20px' }, [
				E('h3', {}, _('Last time the sources were read')),
				E('div', { 'id': 'ovpn-substatus', 'style': 'margin-bottom:12px' }, []),
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(self, function() {
						return callAction('refresh_nodes', '').then(function() {
							ui.addNotification(null,
								E('p', {}, _('Reading the subscriptions. This page will fill in shortly.')),
								'info');
						});
					})
				}, _('Read the subscriptions now')),

				E('h3', { 'style': 'margin-top:24px;display:flex;gap:10px;align-items:baseline' }, [
					E('span', {}, _('Servers')),
					E('span', { 'id': 'ovpn-nodecount',
					            'style': 'font-size:13px;font-weight:normal;opacity:.55' }, '')
				]),
				E('p', { 'style': 'font-size:13px;opacity:.7;margin:0 0 8px 0' },
					_('“Reachable in” is the handshake time every server is checked with first. “Measured” is a complete request through the server, which is only done for the ones that answered and only until a fast enough one is found — so most of this column is empty by design.')),
				E('div', { 'id': 'ovpn-nodelist' }, [])
			]);

			poll.add(function() {
				return Promise.all([
					callNodes().then(renderNodes).catch(function() {}),
					callSubs().then(renderSubs).catch(function() {})
				]);
			}, 5);

			renderNodes(data[0]);
			renderSubs(data[1]);

			return E([], [ mapEl, extra ]);
		});
	}
});
