/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * PassWall2's Node List: which nodes are used and how they are measured, the
 * nodes added by hand, and every node the router has, with what the last
 * measurement made of each. The subscriptions are on Node Subscribe.
 */

'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require ui';
'require uci';
'require zirgozar.i18n as i18n';
'require zirgozar.ui as pui';

/* Our own strings, in the language the setting names. The global _()
   is shadowed for this file only: LuCI translates through .lmo
   catalogues built by a tool this package's build does not have. */
var _ = i18n.tr;


var callNodes  = rpc.declare({ object: 'luci.zirgozar', method: 'nodes', expect: { '': {} } });
var callTests  = rpc.declare({ object: 'luci.zirgozar', method: 'tests', expect: { '': {} } });
var callInuse  = rpc.declare({ object: 'luci.zirgozar', method: 'inuse', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

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
	/* A WireGuard .conf: the comment a provider puts first, or else the
	   host of its endpoint. */
	if (/^\s*\[(interface|peer)\]/im.test(String(text || ''))) {
		for (var c = 0; c < lines.length; c++) {
			var cm = lines[c].match(/^\s*[#;]\s*(.+?)\s*$/);
			if (cm) return cm[1];
		}
		var ep = String(text).match(/^\s*endpoint\s*=\s*\[?([^\]\s:]+)/im);
		return ep ? ep[1] : '';
	}
	/* An OpenVPN profile: the comment it opens with, or else its first remote. */
	if (/^\s*(client\s*$|remote\s+\S+|<ca>)/im.test(String(text || ''))) {
		for (var o = 0; o < lines.length; o++) {
			var om = lines[o].match(/^\s*[#;]\s*(.+?)\s*$/);
			if (om) return om[1];
		}
		var rm = String(text).match(/^\s*remote\s+(\S+)/im);
		return rm ? rm[1] : '';
	}
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
	return pui.ms(v);
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
			'accept': '.conf,.ovpn,.txt,.json,.yaml,.yml,text/plain',
			'style': 'display:none',
			'change': function(ev) {
				var f = ev.target.files && ev.target.files[0];
				if (!f) return;
				var reader = new FileReader();
				reader.onload = function() {
					var el = self.getUIElement(section_id);
					if (el) el.setValue(String(reader.result || '').trim());
					/* setValue puts the text in without telling anyone, so the
					   box went on counting as empty: LuCI had checked it once,
					   when it was empty, and never again - which is why the
					   Save button did nothing and said nothing. The events it
					   listens for are sent by hand. */
					var ta = box.querySelector('textarea');
					if (ta) {
						['input', 'keyup', 'change', 'blur'].forEach(function(t) {
							ta.dispatchEvent(new Event(t, { bubbles: true }));
						});
					}
				};
				reader.onerror = function() {
					pui.note(browse, _('That file could not be read.'), 'error');
				};
				reader.readAsText(f);
				/* So that choosing the same file twice in a row still fires
				   a change. */
				ev.target.value = '';
			}
		});

		var browse = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); picker.click(); }
		}, _('Browse…'));

		return E([ box, E('div', { 'style': 'margin-top:6px' }, [
			browse,
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

/* ---------------------------------------------- PassWall2's buttons

   The buttons above and beside PassWall2's list of nodes. Each is one step
   on the router, which then has the list the page shows - so the page is
   read again afterwards, the way PassWall2's is. */
function nodeAct(b, name, arg, reload, ok) {
	return callAction(name, arg).then(function(r) {
		if (r && r.error) {
			pui.note(b, _(r.error), 'error');
			return;
		}
		if (ok) pui.note(b, ok, 'ok');
		if (reload) window.setTimeout(function() { location.reload(); }, 500);
	});
}

function selected() {
	return Array.prototype.slice.call(document.querySelectorAll('.pwp-sel:checked'))
		.map(function(c) { return c.getAttribute('data-sid'); });
}

/* What kind of node a link is, from the link itself. */
function linkType(link) {
	var l = String(link || '').trim();
	var m = l.match(/^([a-z][a-z0-9+.-]*):\/\//i);
	if (m) {
		var t = m[1].toLowerCase();
		return { ss: 'shadowsocks', hy2: 'hysteria2', socks5: 'socks', wg: 'wireguard' }[t] || t;
	}
	if (/^\s*\[(interface|peer)\]/i.test(l))
		return /^\s*(jc|jmin|jmax|s[1-4]|h[1-4]|i[1-5])\s*=/im.test(l) ? 'amneziawg' : 'wireguard';
	return /^\s*(client\s*$|remote\s+\S+|<ca>)/im.test(l) ? 'openvpn' : '-';
}

function groups() {
	var g = {};
	uci.sections('zirgozar', 'node').forEach(function(n) {
		if (n.group) g[n.group] = true;
	});
	return Object.keys(g).sort();
}

function addViaLinks() {
	var box = E('textarea', {
		'rows': 8, 'wrap': 'off',
		'style': 'width:100%;direction:ltr;text-align:left;font-family:monospace',
		'placeholder': 'vless://…\nvmess://…'
	});
	ui.showModal(_('Add the node via the link'), [
		E('p', {}, _('Enter share links, one per line. Subscription links are not supported!')),
		box,
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close window')),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(null, function(ev) {
					var b = ev.currentTarget;
					if (!/:\/\//.test(box.value)) {
						pui.note(b, _('Please enter the correct link.'), 'error');
						return;
					}
					return callAction('add_links', box.value).then(function(r) {
						if (!r || !r.added) {
							pui.note(b, _('None of those could be read as a node.'), 'error');
							return;
						}
						ui.hideModal();
						location.reload();
					});
				})
			}, _('Add'))
		])
	]);
}

function reassign(b) {
	var ids = selected();
	if (!ids.length) {
		pui.note(b, _('No node is selected.'), 'warn');
		return;
	}
	var input = E('input', { 'type': 'text', 'list': 'pwp-groups', 'style': 'width:100%',
	                         'placeholder': _('default') });
	ui.showModal(_('Reassign Group'), [
		E('p', {}, _('The group for the %d nodes selected. Empty is the default group.').format(ids.length)),
		input,
		E('datalist', { 'id': 'pwp-groups' }, groups().map(function(g) { return E('option', { 'value': g }); })),
		E('div', { 'class': 'right' }, [
			E('button', { 'class': 'btn cbi-button cbi-button-neutral', 'click': ui.hideModal }, _('Close window')),
			' ',
			E('button', {
				'class': 'btn cbi-button cbi-button-positive',
				'click': ui.createHandlerFn(null, function(ev) {
					var g = input.value.trim();
					if (/[^A-Za-z0-9_ .-]/.test(g)) {
						pui.note(ev.currentTarget, _('Letters, digits, space, dot, dash and underscore only.'), 'error');
						return;
					}
					return callAction('group_nodes', g + ';' + ids.join(' ')).then(function() {
						ui.hideModal();
						location.reload();
					});
				})
			}, _('Save'))
		])
	]);
}

function toolbar() {
	var all = false;
	return E('div', { 'class': 'mk-row', 'style': 'gap:8px;flex-wrap:wrap;margin:0 0 12px' }, [
		pui.btn(_('Add the node via the link'), 'primary mk-small', addViaLinks, 'link'),
		pui.btn(_('Select all'), 'soft-blue mk-small', function(ev) {
			all = !all;
			document.querySelectorAll('.pwp-sel').forEach(function(c) { c.checked = all; });
			ev.currentTarget.querySelector('span:last-child').textContent = all ? _('DeSelect all') : _('Select all');
		}, 'check'),
		pui.btn(_('Delete select nodes'), 'danger mk-small', function(ev) {
			var b = ev.currentTarget, ids = selected();
			if (!ids.length) {
				pui.note(b, _('No node is selected.'), 'warn');
				return;
			}
			if (!window.confirm(_('Are you sure to delete select nodes?')))
				return;
			/* Not the node the tunnel is carrying traffic through - the same
			   care as the Delete beside each row. */
			return callInuse().catch(function() { return {}; }).then(function(d) {
				var keep = (d && d.active && d.section) ? d.section : '';
				var go = ids.filter(function(id) { return id != keep; });
				if (!go.length) {
					pui.note(b, _('This is the node the tunnel is using at the moment. Press Disconnect, or Choose again, before deleting it.'), 'warn');
					return;
				}
				return nodeAct(b, 'delete_nodes', go.join(' '), true);
			});
		}, 'trash'),
		pui.btn(_('Reassign Group'), 'soft-blue mk-small', function(ev) { reassign(ev.currentTarget); }, 'layers'),
		pui.btn(_('Clear all nodes'), 'danger mk-small', function(ev) {
			if (!window.confirm(_('Are you sure to clear all nodes?')))
				return;
			return nodeAct(ev.currentTarget, 'clear_nodes', '', true);
		}, 'trash')
	]);
}

/* A name of its own for a new section, the way PassWall2 names its nodes.
   A section without one is known by its place in the file, and loses that
   name - and every setting naming it - as soon as one ahead of it is added,
   moved or deleted. */
function sectionName(prefix) {
	var n;
	do {
		n = prefix + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
	} while (uci.get('zirgozar', n));
	return n;
}

/* PassWall2's "Show server address and port". */
var showInfo = false;

function renderNodes(d) {
	var box = document.getElementById('pwp-nodelist');
	if (!box) return;
	while (box.firstChild) box.removeChild(box.firstChild);

	var nodes = (d && d.nodes) || [];
	if (!nodes.length) {
		box.appendChild(E('div', { 'style': 'opacity:.65;font-size:13px;padding:8px 0' },
			_('Nothing read yet. Read the subscriptions on Node Subscribe, or turn on the main switch in Basic Settings.')));
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
		E('th', { 'class': 'th' }, _('Node name')),
		E('th', { 'class': 'th' }, _('Protocol')),
		E('th', { 'class': 'th' }, _('URL Test')),
		E('th', { 'class': 'th' }, _('TCPing')),
		E('th', { 'class': 'th' }, '')
	]) ];

	nodes.forEach(function(n) {
		rows.push(E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, [
				E('div', { 'style': 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' }, [
					E('span', { 'style': n.current ? 'font-weight:700' : '' }, n.label || n.host),
					n.current ? pill(_('in use'), '#10b981') : E('span')
				]),
				showInfo
					? E('div', { 'style': 'font-size:11px;opacity:.55;direction:ltr;text-align:start' }, n.host + ':' + n.port)
					: ''
			]),
			E('td', { 'class': 'td' }, n.protocol),
			E('td', { 'class': 'td' }, n.ms > 0 ? pui.ms(n.ms) : '—'),
			E('td', { 'class': 'td' }, n.handshake > 0 ? pui.ms(n.handshake) : '—'),
			E('td', { 'class': 'td' }, [
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'style': 'padding:2px 10px;font-size:12px',
					'click': ui.createHandlerFn(null, function(ev) {
						var b = ev.currentTarget;
						return callAction('pick', n.tag).then(function(r) {
							if (r && r.error)
								pui.note(b, _(r.error), 'error');
							else
								pui.note(b, _('Connecting through %s…').format(n.label || n.host), 'ok');
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

return view.extend({
	load: function() {
		return Promise.all([
			callNodes().catch(function() { return {}; }),
			callTests().catch(function() { return {}; }),
			uci.load('zirgozar').catch(function() { return null; })
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
		i18n.setLang(uci.get('zirgozar', 'config', 'lang'));

		/* Before the form is built, not after. The cells are drawn by
		   m.render() below, and a cell can only show a number it already has
		   - anything set afterwards would find no cells in the document yet
		   and the table would sit empty until the first poll five seconds
		   later, for measurements the router had already finished. */
		results = (data[1] && data[1].tests) || {};
		showInfo = uci.get('zirgozar', 'config', 'show_node_info') == '1';

		var m, s, o;

		/* No title over the page: the tab bar already says where this is. */
		m = new form.Map('zirgozar');

		/* ---------------------------------------------- added by hand */
		s = m.section(form.GridSection, 'node', _('Nodes added manually'),
			_('One share link per entry — vless, vmess, trojan, shadowsocks, socks, hysteria2, tuic or wireguard. A whole WireGuard .conf file can be pasted in as it stands. These are tried before the subscription list. The three test columns each measure something different; press one to run it.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.handleAdd = function(ev) {
			return form.GridSection.prototype.handleAdd.apply(this, [ ev, sectionName('n') ]);
		};

		/* A tick box on every row, for the buttons above the table. */
		o = s.option(form.DummyValue, '_select', ' ');
		o.modalonly = false;
		o.editable = true;
		o.renderWidget = function(section_id) {
			return E([
				E('input', { 'type': 'checkbox', 'class': 'pwp-sel', 'data-sid': section_id }),
				new ui.Hiddenfield('', { id: this.cbid(section_id) }).render()
			]);
		};

		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = 'my server';

		/* PassWall2's Type column: what the link is. */
		o = s.option(form.DummyValue, '_type', _('Type'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return linkType(uci.get('zirgozar', section_id, 'link'));
		};

		o = s.option(form.Value, 'group', _('Group Name'));
		o.rmempty = true;
		o.placeholder = _('default');
		groups().forEach(function(g) { o.value(g); });
		o.textvalue = function(section_id) {
			return this.cfgvalue(section_id) || _('default');
		};

		/* In the edit dialog rather than in the table. The table has room for
		   one useful column beside the name, and a share link is sixty
		   characters of base64 that tells the reader nothing they did not
		   already know — whereas what they actually want to know about a node
		   they have just typed in is whether it works. */
		o = s.option(form.TextValue, 'link', _('Share link'),
			_('A share link, several of them one per line, a whole WireGuard .conf file or an OpenVPN .ovpn profile. Choose a file and its contents are put in the box for you.'));
		o.modalonly = true;
		o.rows = 6;
		withBrowse(o, _('a .conf file, or a list of links'));
		o.rmempty = false;
		o.placeholder = 'vless://…';
		o.validate = function(section, value) {
			if (!value) return true;
			/* A WireGuard .conf is a file, not a link: it has no :// in it. */
			if (!/:\/\//.test(value) && !/^\s*\[(interface|peer)\]/im.test(value) && !/^\s*(client\s*$|remote\s+\S+|<ca>)/im.test(value))
				return _('That does not look like a share link');
			return true;
		};
		/* An OpenVPN profile does not always carry everything it needs: the user
		   name and password of the account, and the pass phrase of a private key
		   that is encrypted. They are kept with the node and used only by one. */
		o = s.option(form.Value, 'ovpn_user', _('OpenVPN user name'),
			_('Only for an OpenVPN profile that asks for a user name and password.'));
		o.modalonly = true;
		o.rmempty = true;
		o = s.option(form.Value, 'ovpn_pass', _('OpenVPN password'));
		o.modalonly = true;
		o.password = true;
		o.rmempty = true;
		o = s.option(form.Value, 'ovpn_keypass', _('OpenVPN key pass phrase'),
			_('Only for an OpenVPN profile whose private key is encrypted. Unlocking it needs the openssl-util package, which Router requirements installs.'));
		o.modalonly = true;
		o.password = true;
		o.rmempty = true;

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

		/* PassWall2's Chain Proxy, with its option names. A pre-proxy node is
		   dialled first and this node through it; a landing node is where the
		   traffic goes on to after this one, and where it finally leaves from.
		   Only nodes added by hand can be named: a subscription is re-read
		   every quarter of an hour and its nodes numbered afresh. */
		var others = uci.sections('zirgozar', 'node');

		o = s.option(form.ListValue, 'chain_proxy', _('Chain Proxy'));
		o.modalonly = true;
		o.value('', _('Close'));
		o.value('1', _('Preproxy Node'));
		o.value('2', _('Landing Node'));

		o = s.option(form.ListValue, 'preproxy_node', _('Preproxy Node'),
			_('This node is reached through the one chosen here.'));
		o.modalonly = true;
		o.depends('chain_proxy', '1');
		others.forEach(function(n) {
			o.value(n['.name'], n.name || n['.name']);
		});
		o.validate = function(section_id, value) {
			return value && value == section_id ? _('A node cannot be its own pre-proxy.') : true;
		};

		o = s.option(form.ListValue, 'to_node', _('Landing Node'),
			_('Traffic goes through this node first and leaves from the one chosen here.'));
		o.modalonly = true;
		o.depends('chain_proxy', '2');
		others.forEach(function(n) {
			o.value(n['.name'], n.name || n['.name']);
		});
		o.validate = function(section_id, value) {
			return value && value == section_id ? _('A node cannot be its own landing node.') : true;
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
			var b = ev && ev.currentTarget;
			return callInuse().catch(function() { return {}; }).then(function(d) {
				if (d && d.active && d.section && d.section == section_id) {
					pui.note(b, _('This is the node the tunnel is using at the moment. Press Disconnect, or Choose again, before deleting it.'), 'warn');
					return Promise.resolve();
				}
				return form.GridSection.prototype.handleRemove.apply(section, [ section_id, ev ]);
			});
		};

		s.renderRowActions = function(section_id) {
			var td = form.GridSection.prototype.renderRowActions.apply(this, [ section_id ]);
			var box = td.querySelector('div') || td;
			var extra = [
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, function(ev) {
						return nodeAct(ev.currentTarget, 'top_node', section_id, true);
					})
				}, _('To Top')),
				E('button', {
					'class': 'btn cbi-button cbi-button-apply',
					'click': ui.createHandlerFn(this, function(ev) {
						if (!window.confirm(_('Are you sure set this node?')))
							return;
						return nodeAct(ev.currentTarget, 'use_node', section_id, false,
							_('This is now the node in Basic Settings.'));
					})
				}, _('Use')),
				E('button', {
					'class': 'btn cbi-button cbi-button-neutral',
					'click': ui.createHandlerFn(this, function(ev) {
						return nodeAct(ev.currentTarget, 'copy_node', section_id, true);
					})
				}, _('Copy'))
			];
			for (var i = extra.length - 1; i >= 0; i--)
				box.insertBefore(extra[i], box.firstChild);
			return td;
		};

		var self = this;

		/* ------------------------------------------ PassWall2's three */
		s = m.section(form.NamedSection, 'config', 'zirgozar');
		s.anonymous = true;

		o = s.option(form.ListValue, 'sources', _('Nodes to use'),
			_('This decides who may be measured, not who wins: whichever node answers fastest is the one used, wherever it came from. A node added by hand joins the list rather than replacing it. To insist on one node, press “Use” beside it below.'));
		o.value('own', _('Only manually added configs'));
		o.value('both', _('All configs'));
		o.value('subs', _('Only the subscriptions'));
		o.default = 'own';

		o = s.option(form.ListValue, 'auto_detection_time', _('Automatic detection delay'),
			_('When this page opens, each node added by hand is measured this way, and the answer put in its column.'));
		o.value('0', _('Close'));
		o.value('icmp', 'Ping');
		o.value('tcping', 'TCP Ping');
		o.default = 'tcping';

		o = s.option(form.Flag, 'show_node_info', _('Show server address and port'));
		o.default = '0';
		o.rmempty = false;

		o = s.option(form.Value, 'test_url', _('URL Test Address'),
			_('What a real request through a node asks for, when a node is measured and when the URL Test column is pressed.'));
		o.value('http://www.gstatic.com/generate_204', 'Gstatic (HTTP)');
		o.value('https://cp.cloudflare.com/', 'Cloudflare');
		o.value('https://www.gstatic.com/generate_204', 'Gstatic');
		o.value('https://www.google.com/generate_204', 'Google');
		o.value('https://www.youtube.com/generate_204', 'YouTube');
		o.default = 'http://www.gstatic.com/generate_204';
		o.rmempty = false;
		o.validate = function(section, value) {
			if (value && !/^https?:\/\/\S+$/.test(value))
				return _('Must start with http:// or https://');
			return true;
		};

		/* ------------------------------------------- automatic choice
		   This program's own, and it has no PassWall2 equivalent: how the
		   fastest node is found when the node in Basic Settings is Auto. */
		/* The three numbers in this sentence are the settings below it, read as
		   they are saved and kept in step as they are typed. */
		function selectionText(batch, good, most) {
			return _('Two passes. A quick handshake to every node, then a real request through the ones that answered — %d at a time (at most %d batches), best first, stopping at the first node faster than %d ms. Connecting therefore takes seconds, not a minute. WireGuard has no TCP port and skips the first pass; hysteria2, tuic and OpenVPN are not part of the automatic choice.')
				.format(batch, most, good);
		}
		s = m.section(form.NamedSection, 'config', 'zirgozar', _('Node selection'),
			selectionText(parseInt(uci.get('zirgozar', 'config', 'batch_size')) || 10,
				parseInt(uci.get('zirgozar', 'config', 'good_ms')) || 1000,
				parseInt(uci.get('zirgozar', 'config', 'max_batches')) || 5));
		s.anonymous = true;

		o = s.option(form.ListValue, 'prefilter', _('First pass'),
			_('A TCP handshake to the node’s real port is the right test. A ping is quicker and wrong often enough to matter: a node behind a CDN answers pings at the edge whatever state it is in, and plenty of working nodes drop ICMP entirely.'));
		o.value('tcp', _('TCP handshake (recommended)'));
		o.value('icmp', _('Ping'));
		o.value('both', _('Ping, then handshake'));
		o.default = 'tcp';

		o = s.option(form.Value, 'good_ms', _('Good enough (ms)'),
			_('The first node measured faster than this is the one used. Lower means a better node and a longer wait.'));
		o.datatype = 'uinteger';
		o.default = '1000';

		o = s.option(form.Value, 'batch_size', _('Measured at a time'),
			_('How many nodes are measured properly in one go.'));
		o.datatype = 'range(1,50)';
		o.default = '10';

		o = s.option(form.Value, 'max_batches', _('Batches at most'),
			_('How far down the list to keep going when nothing is fast enough.'));
		o.datatype = 'range(1,30)';
		o.default = '5';

		o = s.option(form.Value, 'sift_parallel', _('Checked at once'),
			_('How many handshakes run in parallel in the first pass. If your router has little RAM, lower this number.'));
		o.datatype = 'range(1,100)';
		o.default = '30';

		return m.render().then(function(mapEl) {
			/* PassWall2's buttons, above the table of nodes added by hand. */
			var grid = mapEl.querySelector('#cbi-zirgozar-node');
			var table = grid && grid.querySelector('.cbi-section-table');
			if (table) table.parentNode.insertBefore(toolbar(), table);

			var list = pui.card(_('Nodes'), 'list', '#6366f1', E('div', {}, [
				E('div', { 'class': 'mk-row', 'style': 'margin:0 0 10px;align-items:center' }, [
					E('span', { 'id': 'pwp-nodecount', 'style': 'font-size:13px;color:var(--muted)' }, ''),
					E('span', { 'style': 'flex:1 1 auto' }),
					pui.btn(_('Check every node'), 'soft-blue mk-small', function(ev) {
						var b = ev.currentTarget;
						return callAction('measure_all', '').then(function() {
							pui.note(b, _('Knocking on every node once. The TCPing column will fill in as answers come back.'), 'info');
						});
					}, 'refresh')
				]),
				E('p', { 'style': 'font-size:13px;color:var(--muted);margin:0 0 8px 0' },
					_('“TCPing” is the handshake every node is checked with first, so it is filled in for all of them. “URL Test” is a complete request through the node, which is only run on the ones that answered and only until a fast enough one is found — so most of that column is empty by design. Both are the same measurements the buttons above take, done for the whole list at once.')),
				E('div', { 'id': 'pwp-nodelist' }, [])
			]));

			poll.add(function() {
				return Promise.all([
					callNodes().then(renderNodes).catch(function() {}),
					callTests().then(renderTests).catch(function() {})
				]);
			}, 5);

			/* Once LuCI has put the page in the document, where these can find
			   the boxes they fill - and then PassWall2's automatic detection:
			   every node added by hand measured once, the way the setting
			   says. */
			window.setTimeout(function() {
				renderNodes(data[0]);
				var auto = uci.get('zirgozar', 'config', 'auto_detection_time');
				if (auto == null) auto = 'tcping';
				var kind = auto == 'icmp' ? 'ping' : auto == 'tcping' ? 'tcp' : '';
				if (!kind) return;
				uci.sections('zirgozar', 'node').forEach(function(n) {
					if (n.enabled == '0') return;
					var cell = document.querySelector('.pwp-test-value[data-key="' + n['.name'] + '.' + kind + '"]');
					if (cell) cell.textContent = '…';
					callAction('node_test', kind + ':' + n['.name']).catch(function() {});
				});
			}, 0);

			pui.sortable(mapEl, 'zirgozar');
			return pui.page([ mapEl, list ]);
		});
	}
});
