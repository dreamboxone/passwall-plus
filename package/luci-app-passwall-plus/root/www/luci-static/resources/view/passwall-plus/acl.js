/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Access Control: PassWall2's page of the same name, field for field - the
 * main switch, then a sortable table of rules, each one opened to edit with a
 * Main and a Proxy tab. The same option names are written to the
 * configuration, so a rule reads the same here as it did there.
 *
 * What PassWall2 has and this does not: the DNS and Log tabs. PassWall2 runs
 * a resolver and a core per rule; this runs one of each for the whole router,
 * so a per-rule resolver or log would have nothing behind it.
 *
 * "Proxy" with a node of its own is limited to nodes added by hand. A
 * subscription is re-read every quarter of an hour and its nodes renumbered,
 * so a rule naming one of them would be naming a different node by the
 * afternoon.
 */

'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require passwall-plus.i18n as i18n';
'require passwall-plus.ui as pui';

var _ = i18n.tr;

var callLan = rpc.declare({ object: 'luci.passwall-plus', method: 'lan', expect: { '': {} } });
var callHostHints = rpc.declare({ object: 'luci-rpc', method: 'getHostHints', expect: { '': {} } });

var PORTS_RE = /^\d+([:-]\d+)?(,\d+([:-]\d+)?)*$/;

function portValidate(section_id, value) {
	if (!value || PORTS_RE.test(value.replace(/\s+/g, ''))) return true;
	return _('The port settings support single ports and ranges. Separate multiple ports with commas (,). Example: 21,80,443,1000:2000.');
}

function ip4(v) {
	var m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})(\/(\d{1,2}))?$/.exec(v);
	if (!m) return false;
	for (var i = 1; i <= 4; i++)
		if (+m[i] > 255) return false;
	return !m[6] || +m[6] <= 32;
}

function sourceOk(v) {
	if (/^ipset:.+/.test(v)) return true;
	if (/^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(v)) return true;
	if (ip4(v)) return true;
	var r = v.split('-');
	return r.length == 2 && ip4(r[0]) && ip4(r[1]) && r[0].indexOf('/') < 0 && r[1].indexOf('/') < 0;
}

return view.extend({
	load: function() {
		return Promise.all([
			callLan().catch(function() { return {}; }),
			callHostHints().catch(function() { return {}; }),
			uci.load('passwall-plus').catch(function() { return null; })
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		var lan = data[0] || {}, hints = data[1] || {};
		var m, s, o;

		m = new form.Map('passwall-plus');

		/* ----------------------------------------------------- main switch */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('ACLs'),
			E('font', { 'color': 'red' }, _('ACLs is a tools which used to designate specific IP proxy mode.')));
		s.anonymous = true;

		o = s.option(form.Flag, 'acl_enable', _('Main switch'));
		o.rmempty = false;
		o.default = '0';

		/* ----------------------------------------------------------- rules */
		s = m.section(form.GridSection, 'acl_rule');
		s.sortable = true;
		s.anonymous = true;
		s.addremove = true;
		s.nodescriptions = true;
		s.modaltitle = _('ACLs');

		s.tab('main', _('Main'));
		s.tab('proxy', _('Proxy'));

		o = s.taboption('main', form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('main', form.Value, 'remarks', _('Remarks'));
		o.rmempty = true;

		o = s.taboption('main', form.ListValue, 'interface', _('Source Interface'));
		o.value('', _('All'));
		(lan.interfaces || []).forEach(function(it) {
			if (it && it.dev) o.value(it.dev, it.dev + ' (' + (it.net || '') + ')');
		});
		var cur = {};
		uci.sections('passwall-plus', 'acl_rule').forEach(function(r) {
			if (r.interface) cur[r.interface] = true;
		});
		Object.keys(cur).forEach(function(d) {
			if (!o.keylist || o.keylist.indexOf(d) < 0) o.value(d, d);
		});
		o.textvalue = function(section_id) {
			return uci.get('passwall-plus', section_id, 'interface') || _('All');
		};

		/* The devices the router knows about, offered by MAC with their
		   address beside it, sorted by address as PassWall2 sorts them. */
		o = s.taboption('main', form.DynamicList, 'sources', _('Source'),
			E('ul', {}, [
				E('li', {}, _('Example:')),
				E('li', {}, _('MAC') + ': 00:00:00:FF:FF:FF'),
				E('li', {}, _('IP') + ': 192.168.1.100'),
				E('li', {}, _('IP CIDR') + ': 192.168.1.0/24'),
				E('li', {}, _('IP range') + ': 192.168.1.100-192.168.1.200'),
				E('li', {}, _('IPSet') + ': ipset:lanlist')
			]));
		Object.keys(hints).map(function(mac) {
			var h = hints[mac] || {};
			return { mac: mac, ip: (h.ipaddrs || [])[0] || '', name: h.name || '' };
		}).filter(function(h) {
			return /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/.test(h.mac);
		}).sort(function(a, b) {
			if (a.ip.length != b.ip.length) return a.ip.length - b.ip.length;
			return a.ip < b.ip ? -1 : a.ip > b.ip ? 1 : 0;
		}).forEach(function(h) {
			o.value(h.mac, '%s (%s)'.format(h.mac, h.name ? h.name + ', ' + h.ip : h.ip));
		});
		o.validate = function(section_id, value) {
			if (!value || sourceOk(value)) return true;
			return _('Not true format, please re-enter!');
		};
		o.textvalue = function(section_id) {
			var v = L.toArray(uci.get('passwall-plus', section_id, 'sources'));
			var out = [];
			v.forEach(function(x, i) {
				if (i) out.push(E('br'));
				out.push(x);
			});
			return out.length ? E('span', {}, out) : '';
		};

		o = s.taboption('main', form.ListValue, 'mode', _('Mode'));
		o.value('0', _('No Proxy'));
		o.value('1', _('Proxy'));
		o.value('2', _('Proxy') + ' ' + _('Use global config') + ' (' + _('the node the tunnel is using') + ')');

		o = s.taboption('main', form.ListValue, 'node', E('a', { 'style': 'color:red' }, _('Node')),
			_('Nodes added by hand on the Node List page. A hysteria2 or tuic node cannot be given a rule of its own; such a rule uses the node the tunnel is using instead.'));
		o.modalonly = true;
		o.depends('mode', '1');
		uci.sections('passwall-plus', 'node').forEach(function(n) {
			o.value(n['.name'], n.name || n['.name']);
		});

		/* ------------------------------------------------------------ proxy */
		o = s.taboption('proxy', form.Value, 'tcp_no_redir_ports', _('TCP No Redir Ports'));
		o.modalonly = true;
		o.value('', _('No patterns are used'));
		o.value('1:65535', _('All'));
		o.depends('mode', '1');
		o.depends('mode', '2');
		o.validate = portValidate;

		o = s.taboption('proxy', form.Value, 'udp_no_redir_ports', _('UDP No Redir Ports'));
		o.modalonly = true;
		o.value('', _('No patterns are used'));
		o.value('1:65535', _('All'));
		o.depends('mode', '1');
		o.depends('mode', '2');
		o.validate = portValidate;

		o = s.taboption('proxy', form.Value, 'tcp_redir_ports', _('TCP Redir Ports'));
		o.modalonly = true;
		o.value('1:65535', _('All'));
		o.value('22,25,53,80,143,443,465,587,853,873,993,995,5222,8080,8443,9418', _('Common Use'));
		o.value('80,443', '80,443');
		o.default = '1:65535';
		o.depends('mode', '1');
		o.depends('mode', '2');
		o.validate = portValidate;

		o = s.taboption('proxy', form.Value, 'udp_redir_ports', _('UDP Redir Ports'));
		o.modalonly = true;
		o.value('1:65535', _('All'));
		o.default = '1:65535';
		o.depends('mode', '1');
		o.depends('mode', '2');
		o.validate = portValidate;

		o = s.taboption('proxy', form.DummyValue, '_tips', ' ');
		o.modalonly = true;
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<font color="red">' +
				_('The port settings support single ports and ranges. Separate multiple ports with commas (,). Example: 21,80,443,1000:2000.') +
				'</font>';
		};
		o.depends('mode', '1');
		o.depends('mode', '2');

		return m.render().then(function(el) {
			return pui.page([ el ]);
		});
	}
});
