/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Rule Manage, PassWall2's page of that name: the routing data - where it
 * comes from, where it is kept, when it is updated, and going back to the
 * copy before - and the shunt rules, which traffic each rule is about. Where
 * each one goes is set in the Shunt Rule tab of Basic Settings.
 *
 * Under them, this program's own: Iranian traffic direct, the blocks, the
 * sites dnsmasq should stop refusing, and the names that never go through
 * the tunnel.
 */

'use strict';
'require view';
'require form';
'require rpc';
'require poll';
'require uci';
'require passwall-plus.i18n as i18n';
'require passwall-plus.ui as pui';

/* Our own strings, in the language the setting names. */
var _ = i18n.tr;

var callAction = rpc.declare({ object: 'luci.passwall-plus', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });
var callGeo    = rpc.declare({ object: 'luci.passwall-plus', method: 'geo', expect: { '': {} } });

/* The week as it runs in Iran, from Saturday. The numbers are cron's. */
var WEEK = [
	[ '7', 'Every day' ], [ '6', 'Every Saturday' ], [ '0', 'Every Sunday' ],
	[ '1', 'Every Monday' ], [ '2', 'Every Tuesday' ], [ '3', 'Every Wednesday' ],
	[ '4', 'Every Thursday' ], [ '5', 'Every Friday' ]
];

/* Where the two files can come from: PassWall2's list, with the Iranian
   project this program has always used first, and its small editions for a
   router short of flash. */
function sources(what) {
	var f = what + '.dat', lite = what + '-lite.dat';
	return [
		[ 'https://raw.githubusercontent.com/Chocolate4U/Iran-v2ray-rules/release/' + f, 'Chocolate4U/' + what + ' (IR)' ],
		[ 'https://raw.githubusercontent.com/Chocolate4U/Iran-v2ray-rules/release/' + lite, 'Chocolate4U/' + what + '-lite (IR)' ],
		[ 'https://github.com/Chocolate4U/Iran-v2ray-rules/releases/latest/download/' + f, 'Chocolate4U/' + what + ' (IR, release)' ],
		[ 'https://github.com/Loyalsoldier/v2ray-rules-dat/releases/latest/download/' + f, 'Loyalsoldier/' + what ],
		[ 'https://cdn.jsdelivr.net/gh/Loyalsoldier/v2ray-rules-dat@release/' + f, 'Loyalsoldier/' + what + ' (CDN)' ],
		[ 'https://github.com/MetaCubeX/meta-rules-dat/releases/latest/download/' + f, 'MetaCubeX/' + what ],
		[ 'https://cdn.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/' + f, 'MetaCubeX/' + what + ' (CDN)' ],
		[ 'https://github.com/runetfreedom/russia-v2ray-rules-dat/releases/latest/download/' + f, 'runetfreedom/' + what + ' (RU)' ]
	];
}

function when(t) {
	return t ? new Date(t * 1000).toLocaleString(i18n.get() === 'fa' ? 'fa-IR' : undefined) : _('date unknown');
}

/* The version line of each file, with its Rollback button while a copy from
   before the last update is kept. */
function renderGeo(g) {
	var box = document.getElementById('pwp-geo-status');
	if (!box) return;
	g = g || {};
	while (box.firstChild) box.removeChild(box.firstChild);
	[ [ 'geoip', 'GeoIP' ], [ 'geosite', 'Geosite' ] ].forEach(function(p) {
		var f = g[p[0]] || {};
		box.appendChild(E('div', { 'style': 'display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:4px 0' }, [
			E('span', { 'style': 'font-weight:700;min-width:70px' }, p[1]),
			f.present
				? E('span', { 'class': 'mk-chip ok' }, pui.bytes(f.bytes))
				: E('span', { 'class': 'mk-chip' }, _('not downloaded')),
			f.present ? E('span', { 'style': 'font-size:12px;color:var(--muted)' }, _('updated %s').format(when(f.updated))) : '',
			f.backup
				? pui.btn(_('Rollback') + ' ' + p[1], 'soft-blue mk-small', function(ev) {
					var b = ev.currentTarget;
					return callAction('geo_rollback', p[0]).then(function(r) {
						if (r && r.error) pui.note(b, _(r.error), 'error');
						else pui.note(b, _('Put back. Reconnect for it to take effect.'), 'ok');
						return callGeo().then(renderGeo);
					});
				}, 'refresh')
				: ''
		]));
	});
	box.appendChild(E('div', { 'style': 'font-size:12px;color:var(--muted);padding-top:4px' },
		_('Free space') + ': ' + pui.bytes(g.free) + (g.dir ? '  ·  ' + g.dir : '')));
}

/* Once per page load, however many times the page is saved. The rebind list
   belongs to dnsmasq, and dnsmasq's configuration is not ours to have LuCI
   write: the router brings it in step with this list itself, once the list
   has actually been applied. */
var listening = false;

function hostname(v) {
	return /^[A-Za-z0-9_]([A-Za-z0-9_-]{0,62}\.)*[A-Za-z0-9_-]{1,63}\.?$/.test(v);
}

/* One entry a line, as Xray writes them, # starting a comment. The first line
   that is not one is named in the answer. */
function eachLine(value, ok) {
	var lines = String(value || '').split(/\r?\n/);
	for (var i = 0; i < lines.length; i++) {
		var l = lines[i].trim();
		if (!l || l.charAt(0) == '#') continue;
		if (!ok(l)) return _('Not valid, please re-enter: %s').format(l);
	}
	return true;
}

function domainEntry(l) {
	if (/\s/.test(l)) return false;
	if (/^(regexp|keyword|geosite|ext|rule-set|rs):./.test(l)) return true;
	return hostname(l.replace(/^(domain|full):/, '').replace(/^\./, ''));
}

function ipEntry(l) {
	if (/^(geoip|ext|rule-set|rs):\S+$/.test(l)) return true;
	if (/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(l)) return true;
	return /^[0-9a-fA-F:]+:[0-9a-fA-F:]*(\/\d{1,3})?$/.test(l);
}

/* Where a rule goes, as the Shunt Rule tab says it: the words for a choice,
   or the name of the hand-added node. */
function whereText(v) {
	switch (v || '') {
	case '': return _('Close (Not use)');
	case '_default': return _('Use default node');
	case '_proxy': return _('The node the tunnel is using');
	case '_direct': return _('Direct Connection');
	case '_blackhole': return _('Blackhole (Block)');
	}
	return uci.get('passwall-plus', v, 'name') || v;
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('passwall-plus').catch(function() { return null; }),
			callGeo().catch(function() { return {}; })
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		if (!listening) {
			listening = true;
			document.addEventListener('uci-applied', function() {
				callAction('rebind_apply', '').catch(function() {});
			});
		}

		var m, s, o, i;

		/* No title over the page: the tab bar already says where this is. */
		m = new form.Map('passwall-plus');

		/* ----------------------------------------------------- rule status
		   PassWall2's, option for option. */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Rule status'));
		s.anonymous = true;

		o = s.option(form.Value, 'geoip_url', _('GeoIP Update URL'));
		sources('geoip').forEach(function(v) { o.value(v[0], v[1]); });
		o.default = sources('geoip')[0][0];
		o.rmempty = false;

		o = s.option(form.Value, 'geosite_url', _('Geosite Update URL'));
		sources('geosite').forEach(function(v) { o.value(v[0], v[1]); });
		o.default = sources('geosite')[0][0];
		o.rmempty = false;

		o = s.option(form.Value, 'geo_dir', _('Location of Geo rule files'),
			_('This variable specifies a directory where geoip.dat and geosite.dat files are. The full files are about 17 MB and 8 MB; on a router short of flash, point this at USB storage or choose the lite files above.'));
		o.placeholder = '/etc/passwall-plus/geo';
		o.default = '/etc/passwall-plus/geo';

		o = s.option(form.ListValue, 'geo_update_week_mode', _('Auto Update Mode'),
			_('The files ticked below are downloaded again at this time, and the tunnel, if it is running, restarted to read them.'));
		o.value('', _('Disable'));
		o.value('8', _('Loop Mode'));
		WEEK.forEach(function(d) { o.value(d[0], _(d[1])); });

		o = s.option(form.Value, 'geo_update_time_mode', _('Update Time'));
		for (i = 0; i < 24; i++)
			o.value(i + ':00');
		o.default = '0:00';
		o.datatype = 'timehhmm';
		WEEK.forEach(function(d) { o.depends('geo_update_week_mode', d[0]); });

		o = s.option(form.ListValue, 'geo_update_interval_mode', _('Update Interval(hour)'));
		for (i = 1; i <= 24; i++)
			o.value(String(i), i + ' ' + _('Hour'));
		o.default = '2';
		o.depends('geo_update_week_mode', '8');

		o = s.option(form.Flag, 'geoip_update', 'GeoIP', _('Updated by the button below and by the automatic update.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'geosite_update', 'Geosite', _('Updated by the button below and by the automatic update.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.DummyValue, '_geo_update', _('Rule version'));
		o.render = function() {
			var map = this.map;
			function ticked(name) {
				var opt = map.lookupOption(name, 'config');
				return opt && opt[0] ? opt[0].formvalue('config') == '1' : true;
			}
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Rule version')),
				E('div', { 'class': 'cbi-value-field' }, [
					E('div', { 'id': 'pwp-geo-status' }, []),
					E('div', { 'style': 'display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:10px' }, [
						pui.btn(_('Manually update'), 'primary mk-small', function(ev) {
							var b = ev.currentTarget;
							var ip = ticked('geoip_update'), site = ticked('geosite_update');
							if (!ip && !site) {
								pui.note(b, _('Tick GeoIP, Geosite or both first.'), 'warn');
								return;
							}
							return callAction('geo_update', ip && site ? 'all' : ip ? 'geoip' : 'geosite').then(function(r) {
								if (r && r.error) pui.note(b, _(r.error), 'error');
								else pui.note(b, _('Downloading. The page will show the new size when it is done.'), 'info');
							});
						}, 'download'),
						pui.btn(_('Remove both'), 'danger mk-small', function(ev) {
							var b = ev.currentTarget;
							return callAction('geo_remove', '').then(function() {
								pui.note(b, _('Routing data removed.'), 'ok');
								return callGeo().then(renderGeo);
							});
						}, 'trash')
					])
				])
			]);
		};

		/* ------------------------------------------------ shunt rules
		   PassWall2's Rule Manage, field for field. */
		s = m.section(form.GridSection, 'shunt_rules', _('Shunt Rule'),
			_('Which traffic each rule is about. Where it goes — a node, direct, or blocked — is chosen in the Shunt Rule tab of Basic Settings. The rules steer the tunnel’s own traffic, in this order, ahead of the Iran split; a device with a node of its own on the Access Control page keeps it.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;

		o = s.option(form.Value, 'remarks', _('Remarks'));
		o.rmempty = false;
		o.validate = function(section_id, value) {
			value = String(value || '').trim();
			if (!value) return _('Remark cannot be empty.');
			var dup = uci.sections('passwall-plus', 'shunt_rules').some(function(x) {
				return x['.name'] != section_id && String(x.remarks || '') == value;
			});
			return dup ? _('This remark already exists, please change a new remark.') : true;
		};

		var groups = {};
		uci.sections('passwall-plus', 'shunt_rules').forEach(function(r) {
			if (r.group) groups[r.group] = true;
		});
		o = s.option(form.Value, 'group', _('Shunt Rule Group'));
		o.value('', _('default'));
		Object.keys(groups).sort().forEach(function(g) { o.value(g); });
		o.textvalue = function(section_id) {
			return this.cfgvalue(section_id) || _('default');
		};

		o = s.option(form.DummyValue, '_where', _('Node'));
		o.modalonly = false;
		o.textvalue = function(section_id) {
			return whereText(uci.get('passwall-plus', section_id, 'node'));
		};

		o = s.option(form.MultiValue, 'protocol', _('Protocol'));
		o.modalonly = true;
		o.value('http');
		o.value('tls');
		o.value('quic');
		o.value('bittorrent');

		o = s.option(form.MultiValue, 'inbound', _('Inbound Tag'),
			_('None ticked is both.'));
		o.modalonly = true;
		o.value('tproxy', _('Transparent proxy'));
		o.value('socks', 'Socks');

		o = s.option(form.ListValue, 'network', _('Network'));
		o.modalonly = true;
		o.value('tcp,udp', 'TCP UDP');
		o.value('tcp', 'TCP');
		o.value('udp', 'UDP');

		o = s.option(form.DynamicList, 'source', _('Source'),
			_('A device’s address, a range such as 192.168.1.0/24, or geoip:private.'));
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!value || /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/.test(value) || /^geoip:\S+$/.test(value)) return true;
			return _('Not valid, please re-enter: %s').format(value);
		};

		o = s.option(form.Value, 'port', _('Port'),
			_('Such as 443, 80,443 or 1000-2000.'));
		o.modalonly = true;
		o.validate = function(section_id, value) {
			if (!value || /^[0-9]+([-:][0-9]+)?(,[0-9]+([-:][0-9]+)?)*$/.test(String(value).replace(/\s/g, ''))) return true;
			return _('Not valid, please re-enter: %s').format(value);
		};

		o = s.option(form.TextValue, 'domain_list', _('Domain'),
			_('One a line. domain:example.com is that name and everything under it; full: that name only; regexp: a regular expression; keyword: or a plain word anywhere in the name; geosite: a list from the routing data. A line starting with # is a comment.'));
		o.modalonly = true;
		o.rows = 8;
		o.wrap = 'off';
		o.validate = function(section_id, value) {
			return eachLine(value, domainEntry);
		};

		o = s.option(form.TextValue, 'ip_list', 'IP',
			_('One a line: an address, a range such as 10.0.0.0/8, or geoip: and a country code from the routing data. A line starting with # is a comment.'));
		o.modalonly = true;
		o.rows = 8;
		o.wrap = 'off';
		o.validate = function(section_id, value) {
			return eachLine(value, ipEntry);
		};

		/* ------------------------------------------------------ Iran split */
		s = m.section(form.NamedSection, 'config', 'passwall-plus');
		s.anonymous = true;

		o = s.option(form.Flag, 'route_ir', _('Send Iranian traffic direct'),
			_('Iranian sites and addresses skip the tunnel. Needs the routing data above — until that is downloaded this does nothing, because a core asked for a geo file it has not got refuses to start rather than carrying on without it.'));
		o.rmempty = false;

		/* ----------------------------------------------------------- block */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Block'));
		s.anonymous = true;

		o = s.option(form.Flag, 'block_ads', _('Block advertising'),
			_('For every device on the network. The names come from the category-ads-all list inside the same routing data, so this also needs it.'));
		o.rmempty = false;

		o = s.option(form.Flag, 'block_torrent', _('Block BitTorrent'),
			_('BitTorrent through a free node is how a free node stops existing.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Flag, 'block_quic', _('Refuse QUIC'),
			_('Makes browsers fall back to TCP. Worth turning on when the chosen node carries UDP badly; off by default, because where UDP works QUIC is faster.'));
		o.rmempty = false;

		/* ------------------------------------------------------ rebind */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Sites with a rebind weakness'),
			_('Some sites answer with a private address — Iranian banks and government services among them, which resolve to 10.x addresses inside the country. The router’s DNS protection against rebind attacks refuses those answers, and the site simply does not open. Every name listed here is excused from that protection, together with everything under it.'));
		s.anonymous = true;

		o = s.option(form.DynamicList, 'rebind_domain', _('Domains'));
		o.placeholder = 'example.ir';
		o.validate = function(section_id, value) {
			if (!value || hostname(value)) return true;
			return _('That does not look like a domain name');
		};

		/* Direct addresses are PassWall2's "Direct IP List", and live where it
		   keeps it: Other Settings, under Forwarding. */

		/* --------------------------------------------------- direct names */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Direct domains'),
			_('These sites always go straight out, never through the tunnel. A name covers everything under it: example.com also covers www.example.com. Xray’s own forms — full:, regexp:, keyword: — are accepted as written.'));
		s.anonymous = true;

		o = s.option(form.DynamicList, 'direct_domain', _('Domains'));
		o.placeholder = 'example.com';
		o.validate = function(section_id, value) {
			if (!value) return true;
			if (/^(domain|full):/.test(value)) value = value.replace(/^[a-z]+:/, '');
			else if (/^(regexp|keyword):./.test(value)) return true;
			if (hostname(value.replace(/^\./, ''))) return true;
			return _('That does not look like a domain name');
		};

		return m.render().then(function(el) {
			/* Filled in once it is in the document, then kept current - a
			   download takes a while, and this is where it shows. */
			window.setTimeout(function() { renderGeo(data[1]); }, 0);
			poll.add(function() {
				return callGeo().then(renderGeo).catch(function() {});
			}, 5);
			pui.sortable(el, 'passwall-plus');
			return pui.page([ el ]);
		});
	}
});
