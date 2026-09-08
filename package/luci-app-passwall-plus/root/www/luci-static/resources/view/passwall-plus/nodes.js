/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Subscriptions, nodes added by hand, and what the last measurement made of
 * all of them.
 */

'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';
'require uci';
'require passwall-plus.i18n as i18n';

/* Our own strings, in the language the setting names. The global _()
   is shadowed for this file only: LuCI translates through .lmo
   catalogues built by a tool this package's build does not have. */
var _ = i18n.tr;


var callNodes  = rpc.declare({ object: 'luci.passwall-plus', method: 'nodes', expect: { '': {} } });
var callSubs   = rpc.declare({ object: 'luci.passwall-plus', method: 'subs',  expect: { '': {} } });
var callTests  = rpc.declare({ object: 'luci.passwall-plus', method: 'tests', expect: { '': {} } });
var callInuse  = rpc.declare({ object: 'luci.passwall-plus', method: 'inuse', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.passwall-plus', method: 'action',
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
   name whoever published it gave the node. A reader who pastes a link and
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

/* ------------------------------------------------------------- three tests

   Three columns, the way PassWall has them, and they are three because they
   answer three different questions.

   Ping is ICMP and nothing more: it says how far away the address is, and
   nothing at all about the server. One behind a CDN answers at the edge
   whatever state the server is in, and plenty of working servers drop ICMP
   entirely, which shows here as no answer.

   TCPing is a handshake to the port the tunnel will actually use. It proves
   something is listening and how long the round trip takes.

   URL Test is a whole HTTP request carried by the node. It is the only one of
   the three that proves the node works, and the slowest, which is why it is
   not what the first pass uses on a hundred nodes.

   Each cell says "Test" until it is pressed. The measurement happens on the
   router and takes seconds, so pressing one only asks for it; the answer
   arrives with the next poll. */
var TESTS = [ 'ping', 'tcp', 'url' ];
var results = {};

function testTitle(kind) {
	return kind == 'ping' ? _('Ping') : kind == 'tcp' ? _('TCPing') : _('URL Test');
}

function testHint(kind) {
	return kind == 'ping' ? _('ICMP round trip to the address. Says nothing about the server behind it, which may not answer pings at all.')
	     : kind == 'tcp'  ? _('A handshake to the port the tunnel will use.')
	     :                  _('One whole request carried by this node. The only one that proves it works.');
}

/* undefined never asked, -1 asked for and still running, -2 cannot be asked
   of this node, 0 no answer, anything else milliseconds. */
function testText(v) {
	if (v === undefined) return _('Test');
	if (v == -1) return '…';
	if (v == -2) return '—';
	if (v == 0)  return '✕';
	return v + ' ms';
}

function testColour(v) {
	if (v === undefined || v == -1) return '';
	if (v == -2) return 'opacity:.5';
	if (v == 0)  return 'color:#ef4444';
	return 'color:#10b981;font-weight:600';
}

function testCell(sid, kind) {
	var key = sid + '.' + kind;
	var out = E('span', {
		'class': 'pwp-test-value',
		'data-key': key,
		'title': testHint(kind),
		'style': 'cursor:pointer;user-select:none;white-space:nowrap;' + testColour(results[key]),
		'click': function(ev) {
			ev.preventDefault();
			ev.stopPropagation();
			out.textContent = '…';
			out.setAttribute('style', 'cursor:pointer;user-select:none;white-space:nowrap');
			callAction('node_test', kind + ':' + sid).catch(function() {});
		}
	}, testText(results[key]));
	return out;
}

/* ------------------------------------------------------------ give a file

   A WireGuard .conf and an Xray or sing-box configuration both arrive as
   files, not as a line of text, and asking somebody to open one in an editor
   and copy it out is asking them to do by hand what the browser will do for
   nothing.

   The file is read in the browser and its text goes into the box. It is never
   uploaded anywhere, and what gets saved is the same text as if it had been
   typed - so everything downstream, the parser included, sees exactly what it
   saw before and none of it had to learn about files. */
function withBrowse(o, hint) {
	o.renderWidget = function(section_id, option_index, cfgvalue) {
		var self = this;
		var box = form.TextValue.prototype.renderWidget.apply(this,
			[ section_id, option_index, cfgvalue ]);

		var picker = E('input', {
			'type': 'file',
			'accept': '.conf,.txt,.json,.yaml,.yml,text/plain',
			'style': 'display:none',
			'change': function(ev) {
				var f = ev.target.files && ev.target.files[0];
				if (!f) return;
				var reader = new FileReader();
				reader.onload = function() {
					var el = self.getUIElement(section_id);
					if (el) el.setValue(String(reader.result || '').trim());
				};
				reader.onerror = function() {
					ui.addNotification(null, E('p', {},
						_('That file could not be read.')), 'warning');
				};
				reader.readAsText(f);
				/* So that choosing the same file twice in a row still fires
				   a change. */
				ev.target.value = '';
			}
		});

		return E([ box, E('div', { 'style': 'margin-top:6px' }, [
			E('button', {
				'class': 'btn cbi-button',
				'click': function(ev) { ev.preventDefault(); picker.click(); }
			}, _('Browse…')),
			E('span', { 'style': 'margin-inline-start:8px;font-size:12px;opacity:.65' }, hint),
			picker
		]) ]);
	};
	return o;
}

function renderTests(d) {
	results = (d && d.tests) || {};
	var cells = document.querySelectorAll('.pwp-test-value');
	for (var i = 0; i < cells.length; i++) {
		var k = cells[i].getAttribute('data-key');
		/* A cell showing "…" for a test the router has not written anything
		   about yet is a request in flight, not a stale value: leave it. */
		if (!(k in results) && cells[i].textContent == '…') continue;
		cells[i].textContent = testText(results[k]);
		cells[i].setAttribute('style',
			'cursor:pointer;user-select:none;white-space:nowrap;' + testColour(results[k]));
	}
}

function renderNodes(d) {
	var box = document.getElementById('pwp-nodelist');
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
		E('th', { 'class': 'th' }, _('Node')),
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
				}, _('Use'))
			])
		]));
	});

	box.appendChild(E('table', { 'class': 'table cbi-section-table' }, rows));
	var m = document.getElementById('pwp-nodecount');
	if (m) m.textContent = _('%d nodes').format(nodes.length);
}

function renderSubs(d) {
	var box = document.getElementById('pwp-substatus');
	if (!box) return;
	while (box.firstChild) box.removeChild(box.firstChild);

	var subs = (d && d.subs) || [];
	if (!subs.length) return;

	subs.forEach(function(s) {
		box.appendChild(E('div', {
			'style': 'display:flex;gap:10px;align-items:center;padding:3px 0;font-size:12px'
		}, [
			E('span', { 'style': 'font-weight:600;min-width:120px' }, s.name),
			s.error ? pill(s.error, '#ef4444') : pill(_('%d nodes').format(s.count), '#10b981'),
			E('span', { 'style': 'opacity:.55' }, s.error ? '' : ago(s.when))
		]));
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			callNodes().catch(function() { return {}; }),
			callSubs().catch(function() { return {}; }),
			callTests().catch(function() { return {}; }),
			uci.load('passwall-plus').catch(function() { return null; })
		]);
	},

	/* A node deleted here vanishes from the file the moment Save is pressed,
	   and used to sit in the list underneath until the quarter-hourly refresh
	   came round - so the reader deleted something and watched it stay, for up
	   to fifteen minutes, with nothing to say why. This rebuilds the list from
	   what has already been fetched: no subscription is re-read, so it costs
	   no network and finishes at once. */
	handleSave: function(ev) {
		return view.prototype.handleSave.apply(this, [ ev ]).then(function() {
			return callAction('rebuild_nodes', '').catch(function() {});
		});
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		/* Before the form is built, not after. The cells are drawn by
		   m.render() below, and a cell can only show a number it already has
		   - anything set afterwards would find no cells in the document yet
		   and the table would sit empty until the first poll five seconds
		   later, for measurements the router had already finished. */
		results = (data[2] && data[2].tests) || {};

		var m, s, o;

		m = new form.Map('passwall-plus', _('Nodes'),
			_('Where nodes come from, and which ones to add by hand. Changes take effect the next time the list is read.'));

		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Which nodes to use'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'sources', _('Nodes to use'),
			_('This decides who may be measured, not who wins: whichever node answers fastest is the one used, wherever it came from. A node added by hand joins the list rather than replacing it. To insist on one node, press “Use” beside it below.'));
		o.value('both', _('Mine and the subscriptions'));
		o.value('own', _('Only the ones I added by hand'));
		o.value('subs', _('Only the subscriptions'));
		o.default = 'both';

		s = m.section(form.GridSection, 'subscription', _('Subscriptions'),
			_('Each one is fetched every fifteen minutes. A source that hands back a single base64 block is understood as well as a plain list of links, and so is a whole configuration file — Xray, sing-box, Clash or a WireGuard .conf.'));
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

		/* A source that is a file rather than an address. It goes through
		   exactly the same path as a fetched subscription - which already
		   understands an Xray, sing-box or Clash configuration whole - so a
		   JSON file dropped in here yields the same nodes it would have if it
		   had been published at a URL. Nothing is re-fetched for it, because
		   there is nowhere to re-fetch it from: it is read again from here
		   every time the list is rebuilt. */
		o = s.option(form.TextValue, 'content', _('Or a file'),
			_('Instead of an address: a configuration file — Xray, sing-box, Clash, a WireGuard .conf, or a plain list of links. Leave the address empty when you use this.'));
		o.modalonly = true;
		o.rows = 6;
		withBrowse(o, _('a .json or .conf file'));

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.GridSection, 'node', _('Nodes added manually'),
			_('One share link per entry — vless, vmess, trojan, shadowsocks, socks, hysteria2, tuic or wireguard. A whole WireGuard .conf file can be pasted in as it stands. These are tried before the subscription list. The three test columns each measure something different; press one to run it.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = 'my server';

		/* In the edit dialog rather than in the table. The table has room for
		   one useful column beside the name, and a share link is sixty
		   characters of base64 that tells the reader nothing they did not
		   already know — whereas what they actually want to know about a node
		   they have just typed in is whether it works. */
		o = s.option(form.TextValue, 'link', _('Share link'),
			_('A share link, several of them one per line, or a whole WireGuard .conf file. Choose a file and its contents are put in the box for you.'));
		o.modalonly = true;
		o.rows = 6;
		withBrowse(o, _('a .conf file, or a list of links'));		o.rmempty = false;
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

		/* One column each, and every one of them has to be marked editable.
		   A grid section renders its cells as read-only text by default and
		   never calls renderWidget at all - which is why a column of three
		   buttons came out as the word "none" in italics. The hidden field is
		   what DummyValue itself puts there: the form looks the widget up by
		   id when it saves, and finds nothing without it. */
		TESTS.forEach(function(kind) {
			var t = s.option(form.DummyValue, '_test_' + kind, testTitle(kind));
			t.modalonly = false;
			t.editable = true;
			t.renderWidget = function(section_id) {
				return E([
					testCell(section_id, kind),
					new ui.Hiddenfield('', { id: this.cbid(section_id) }).render()
				]);
			};
		});

		o = s.option(form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.rmempty = false;

		/* The node carrying traffic right now is not one to delete by
		   accident: the tunnel would keep running on a node that no longer
		   exists in the file, and the next refresh would drop the connection
		   with no explanation whatever. Asked afresh at the moment of the
		   press rather than remembered, because between opening this page and
		   pressing Delete the router may well have moved to another node. */
		s.handleRemove = function(section_id, ev) {
			var section = this;
			return callInuse().catch(function() { return {}; }).then(function(d) {
				if (d && d.active && d.section && d.section == section_id) {
					ui.addNotification(null, E('p', {},
						_('This is the node the tunnel is using at the moment. Press Disconnect, or Choose again, before deleting it.')),
						'warning');
					return Promise.resolve();
				}
				return form.GridSection.prototype.handleRemove.apply(section, [ section_id, ev ]);
			});
		};

		var self = this;

		return m.render().then(function(mapEl) {
			var extra = E('div', { 'style': 'margin-top:20px' }, [
				E('h3', {}, _('Last time the sources were read')),
				E('div', { 'id': 'pwp-substatus', 'style': 'margin-bottom:12px' }, []),
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
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'style': 'margin-left:8px',
					'click': ui.createHandlerFn(self, function() {
						return callAction('measure_all', '').then(function() {
							ui.addNotification(null,
								E('p', {}, _('Knocking on every node once. The Reachable column will fill in as answers come back.')),
								'info');
						});
					})
				}, _('Check every node')),

				E('h3', { 'style': 'margin-top:24px;display:flex;gap:10px;align-items:baseline' }, [
					E('span', {}, _('Nodes')),
					E('span', { 'id': 'pwp-nodecount',
					            'style': 'font-size:13px;font-weight:normal;opacity:.55' }, '')
				]),
				E('p', { 'style': 'font-size:13px;opacity:.7;margin:0 0 8px 0' },
					_('“Reachable in” is the handshake time every node is checked with first. “Measured” is a complete request through the node, which is only done for the ones that answered and only until a fast enough one is found — so most of this column is empty by design.')),
				E('div', { 'id': 'pwp-nodelist' }, [])
			]);

			poll.add(function() {
				return Promise.all([
					callNodes().then(renderNodes).catch(function() {}),
					callSubs().then(renderSubs).catch(function() {}),
					callTests().then(renderTests).catch(function() {})
				]);
			}, 5);

			renderNodes(data[0]);
			renderSubs(data[1]);

			return i18n.page([ mapEl, extra ]);
		});
	}
});
