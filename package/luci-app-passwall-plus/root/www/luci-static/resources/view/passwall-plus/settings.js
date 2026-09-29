/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Basic Settings, PassWall2's page of that name and this program's first
 * page: the row of tiles and what the tunnel is doing at the top, then the
 * Main tab with the main switch, the node, the router's own traffic and the
 * LAN's, and the SOCKS ports; the DNS tab; the Log tab; and at the foot what
 * has gone through the tunnel. There is one main switch, the one in the Main
 * tab, and it is saved and applied the way PassWall2's is.
 *
 * How a node is chosen is on Node List, and everything else PassWall2 keeps
 * in Other Settings is on that page here as well, and nowhere else.
 */

'use strict';
'require view';
'require form';
'require uci';
'require passwall-plus.i18n as i18n';
'require passwall-plus.ui as pui';
'require passwall-plus.status as status';

/* Our own strings, in the language the setting names. The global _()
   is shadowed for this file only: LuCI translates through .lmo
   catalogues built by a tool this package's build does not have. */
var _ = i18n.tr;

/* The public Iranian resolvers, offered as the Direct DNS rather than typed.
   Nothing is chosen by default and nothing has to be: Auto uses the ISP's.
   Picking one means that resolver sees every name that goes straight out,
   which is a decision worth making deliberately. */
var IR_RESOLVERS = [
	[ '178.22.122.100', 'Shecan' ],
	[ '185.51.200.2', 'Shecan' ],
	[ '78.157.42.101', 'Electro' ],
	[ '10.202.10.202', '403.online' ],
	[ '10.202.10.102', '403.online' ],
	[ '10.202.10.10', 'Radar Game' ],
	[ '10.202.10.11', 'Radar Game' ],
	[ '185.55.226.26', 'Begzar' ],
	[ '185.55.225.25', 'Begzar' ]
];

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('passwall-plus').catch(function() { return null; }),
			status.load()
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		var m, s, o, i;

		/* The nodes added by hand, which are the only ones that stay put long
		   enough to be named in a setting: a subscription is re-read every
		   quarter of an hour and its nodes numbered afresh. */
		var manual = uci.sections('passwall-plus', 'node');
		function nodeChoices(opt) {
			manual.forEach(function(n) {
				opt.value(n['.name'], n.name || n['.name']);
			});
		}

		/* The tiles and the status card for the top of the page, and the
		   traffic for the Log tab. */
		var st = status.render(data[1]);

		m = new form.Map('passwall-plus', _('Basic Settings'));

		s = m.section(form.NamedSection, 'config', 'passwall-plus');
		s.anonymous = true;

		/* PassWall2's tabs, in PassWall2's order. */
		s.tab('main', _('Main'));
		s.tab('shunt', _('Shunt Rule'));
		s.tab('dns', _('DNS'));
		s.tab('log', _('Log'));

		/* ---------------------------------------------------------- main */
		o = s.taboption('main', form.Flag, 'enabled', _('Main switch'),
			_('The tunnel on or off. Save and apply for it to take effect; it holds across a reboot.'));
		o.rmempty = false;

		o = s.taboption('main', form.ListValue, 'node', _('Node'),
			_('Auto measures the nodes and uses the fastest. A node added by hand is used as it is, and nothing is measured.'));
		o.value('', _('Auto (fastest)'));
		nodeChoices(o);

		o = s.taboption('main', form.Flag, 'preproxy_enabled', _('Preproxy'),
			_('Every node the tunnel may choose dials out through this node first — PassWall2’s pre-proxy. For a node that cannot be reached from here directly, or to hide which nodes are being used. With it on, the first-pass handshake is skipped, because no node is reached directly.'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('main', form.ListValue, 'preproxy_node', _('Preproxy Node'),
			_('Nodes added by hand on the Node List page.'));
		o.depends('preproxy_enabled', '1');
		nodeChoices(o);

		o = s.taboption('main', form.Flag, 'localhost_proxy', _('Localhost Proxy'),
			_('When selected, the router’s own traffic goes through the tunnel as well — its downloads, its clock, its package manager. While a node is being measured it goes direct, so that the measurement is of the node. Off by default: when the tunnel is down, so is the router’s own way out.'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('main', form.Flag, 'client_proxy', _('Client Proxy'),
			_('When selected, devices in LAN go through the tunnel. Otherwise they do not, but the devices named on the Access Control page still do.'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('main', form.Value, 'node_socks_port', _('Node Socks Listen Port'),
			_('A SOCKS server on the router that goes out the way the tunnel does. Empty for none.'));
		o.datatype = 'port';
		o.placeholder = '1070';
		o.default = '1070';

		o = s.taboption('main', form.Flag, 'node_socks_bind_local', _('Node Socks Bind Local'),
			_('When selected, it can only be accessed localhost.'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('main', form.Flag, 'socks_enabled', _('Socks Main switch'),
			_('More SOCKS ports, each through a node of its own — the table below.'));
		o.default = '0';
		o.rmempty = false;

		/* PassWall2's Socks Config, inside this tab rather than under the
		   page, so it is seen with the switch that turns it on. */
		o = s.taboption('main', form.SectionValue, '_socks', form.GridSection, 'socks', _('Socks Config'));
		o.depends('socks_enabled', '1');
		var ss = o.subsection;
		ss.addremove = true;
		ss.anonymous = true;
		ss.sortable = true;
		ss.nodescriptions = true;

		var so = ss.option(form.Flag, 'enabled', _('Enable'));
		so.default = '1';
		so.rmempty = false;
		so.editable = true;

		so = ss.option(form.ListValue, 'node', _('Socks Node'));
		so.value('', _('The node the tunnel is using'));
		nodeChoices(so);

		so = ss.option(form.Value, 'port', _('Socks Listen Port'));
		so.datatype = 'port';
		so.rmempty = false;
		/* After the tunnel's own ports, so a new row never lands on one. */
		so.default = String(1090 + uci.sections('passwall-plus', 'socks').length);

		o = s.taboption('main', form.ListValue, 'lang', _('Language'));
		o.value('en', _('English'));
		o.value('fa', _('Persian'));
		o.default = 'en';

		/* ---------------------------------------------------- shunt rule
		   PassWall2's Shunt Rule tab: where each rule sends what it matches.
		   The rules themselves are made on the Traffic Rules page. */
		var rules = uci.sections('passwall-plus', 'shunt_rules');
		var groups = {};
		rules.forEach(function(r) {
			if (r.group) groups[r.group] = true;
		});
		var group = String(uci.get('passwall-plus', 'config', 'shunt_group') || '').toLowerCase();

		function whereTo(opt, withDefault) {
			if (withDefault) {
				opt.value('', _('Close (Not use)'));
				opt.value('_default', _('Use default node'));
			}
			opt.value('_proxy', _('The node the tunnel is using'));
			opt.value('_direct', _('Direct Connection'));
			opt.value('_blackhole', _('Blackhole (Block)'));
			nodeChoices(opt);
		}

		o = s.taboption('shunt', form.ListValue, 'domainStrategy', _('Domain Strategy'),
			_('AsIs: only the name is used for routing. IPIfNonMatch: when no rule matches the name, it is resolved to addresses and all the rules are tried again. IPOnDemand: whenever an address rule is met, the name is resolved at once. Auto chooses IPIfNonMatch when a rule or the Iran split has addresses in it, and AsIs otherwise.'));
		o.value('', _('Auto'));
		o.value('AsIs');
		o.value('IPIfNonMatch');
		o.value('IPOnDemand');

		o = s.taboption('shunt', form.ListValue, 'domainMatcher', _('Domain matcher'));
		o.value('', 'hybrid');
		o.value('linear');

		o = s.taboption('shunt', form.Flag, 'shunt_fakedns', _('FakeDNS Main switch'),
			_('Names that go through a node are answered with made-up addresses, and the node looks up the real one at the far end — for streaming services that unlock by DNS, or to save a lookup. Tick it for each rule below that should use it. The router itself can open those names only with Localhost Proxy on.'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('shunt', form.ListValue, 'shunt_group', _('Shunt Rule Group'),
			_('Only the rules of this group are used. Save and apply for the table below to show them.'));
		o.value('', _('default'));
		Object.keys(groups).sort().forEach(function(g) { o.value(g); });

		o = s.taboption('shunt', form.SectionValue, '_shunt', form.TableSection, 'shunt_rules');
		var sr = o.subsection;
		sr.anonymous = true;
		sr.addremove = false;
		sr.nodescriptions = true;
		sr.filter = function(section_id) {
			return String(uci.get('passwall-plus', section_id, 'group') || '').toLowerCase() == group;
		};
		/* The words only: LuCI puts them in a row of its own. */
		sr.renderSectionPlaceholder = function() {
			return E('em', {}, _('No shunt rules yet. They are made on the Rule Manage page.'));
		};

		so = sr.option(form.DummyValue, 'remarks', _('Rule'));
		so.cfgvalue = function(section_id) {
			return uci.get('passwall-plus', section_id, 'remarks') || section_id;
		};

		so = sr.option(form.ListValue, 'node', _('Node'));
		whereTo(so, true);

		so = sr.option(form.Flag, 'fakedns', 'FakeDNS');
		so.default = '0';

		so = sr.option(form.ListValue, 'preproxy', _('Preproxy'));
		so.value('', _('Close (Not use)'));
		nodeChoices(so);
		so.validate = function(section_id, value) {
			var node = this.section.formvalue(section_id, 'node');
			return value && value == node ? _('A node cannot be its own pre-proxy.') : true;
		};

		sr.description = _('FakeDNS works with its main switch on, for a rule whose names go through a node. Preproxy: the rule’s hand-added node is reached through this node first — only for a rule that goes to a hand-added node, and one layer only: a node with a chain of its own keeps it.');

		o = s.taboption('shunt', form.ListValue, 'default_node', _('Default'),
			_('Where everything no rule claims goes.'));
		whereTo(o, false);
		o.default = '_proxy';

		o = s.taboption('shunt', form.Flag, 'default_fakedns', _('Default') + ' FakeDNS',
			_('Everything the tunnel carries gets made-up addresses — the DNS tab’s FakeDNS. Like that one, it takes effect only with lookups sent straight into the tunnel.'));
		o.depends('shunt_fakedns', '1');
		o.default = '0';

		o = s.taboption('shunt', form.ListValue, 'default_preproxy', _('Default') + ' ' + _('Preproxy'),
			_('When the Default row goes to a hand-added node, it is reached through this node first.'));
		o.value('', _('Close (Not use)'));
		nodeChoices(o);

		/* ----------------------------------------------------------- DNS */
		o = s.taboption('dns', form.ListValue, 'dns_mode', _('Name lookups'),
			_('“Through dnsmasq” keeps local machine names and DHCP names working and moves only the outside lookups into the tunnel. “Straight into the tunnel” resolves outside names and loses the ones on your own network.'));
		o.value('dnsmasq', _('Through dnsmasq (recommended)'));
		o.value('direct', _('Straight into the tunnel'));
		o.value('off', _('Leave alone'));
		o.default = 'dnsmasq';

		o = s.taboption('dns', form.ListValue, 'direct_dns_protocol', _('Direct DNS Protocol'),
			_('Direct DNS answers for everything that goes straight out, and for the names of the nodes themselves — which can never be looked up through the tunnel they are the way into. Auto uses the router’s own upstream, then the ISP’s.'));
		o.value('', _('Auto'));
		o.value('udp', 'UDP');
		o.value('tcp', 'TCP');

		o = s.taboption('dns', form.Value, 'direct_dns', _('Direct DNS'));
		o.datatype = 'or(ipaddr,ipaddrport(1))';
		for (i = 0; i < IR_RESOLVERS.length; i++)
			o.value(IR_RESOLVERS[i][0], IR_RESOLVERS[i][0] + ' (' + IR_RESOLVERS[i][1] + ')');
		o.depends('direct_dns_protocol', 'udp');
		o.depends('direct_dns_protocol', 'tcp');

		o = s.taboption('dns', form.ListValue, 'direct_dns_query_strategy', _('Direct Query Strategy'));
		o.value('UseIP');
		o.value('UseIPv4');
		o.value('UseIPv6');
		o.default = 'UseIPv4';

		o = s.taboption('dns', form.ListValue, 'remote_dns_protocol', _('Remote DNS Protocol'),
			_('TCP is the default because a great many free nodes carry no UDP at all, and a lookup sent as UDP through one of them is simply lost.'));
		o.value('tcp', 'TCP');
		o.value('doh', 'DoH');
		o.value('udp', 'UDP');
		o.default = 'tcp';

		o = s.taboption('dns', form.Value, 'remote_dns', _('Remote DNS'));
		o.datatype = 'or(ipaddr,ipaddrport(1))';
		o.default = '1.1.1.1';
		o.value('1.1.1.1', '1.1.1.1 (CloudFlare)');
		o.value('1.1.1.2', '1.1.1.2 (CloudFlare-Security)');
		o.value('8.8.4.4', '8.8.4.4 (Google)');
		o.value('8.8.8.8', '8.8.8.8 (Google)');
		o.value('9.9.9.9', '9.9.9.9 (Quad9-Recommended)');
		o.value('149.112.112.112', '149.112.112.112 (Quad9-Recommended)');
		o.value('208.67.220.220', '208.67.220.220 (OpenDNS)');
		o.value('208.67.222.222', '208.67.222.222 (OpenDNS)');
		o.depends('remote_dns_protocol', 'tcp');
		o.depends('remote_dns_protocol', 'udp');

		o = s.taboption('dns', form.Value, 'remote_dns_doh', _('Remote DNS DoH'),
			_('An address, or an address and the server’s own IP after a comma so its name is never itself a lookup.'));
		o.default = 'https://1.1.1.1/dns-query';
		o.value('https://1.1.1.1/dns-query', 'CloudFlare');
		o.value('https://1.1.1.2/dns-query', 'CloudFlare-Security');
		o.value('https://8.8.4.4/dns-query', 'Google 8844');
		o.value('https://8.8.8.8/dns-query', 'Google 8888');
		o.value('https://9.9.9.9/dns-query', 'Quad9-Recommended 9.9.9.9');
		o.value('https://149.112.112.112/dns-query', 'Quad9-Recommended 149.112.112.112');
		o.value('https://208.67.222.222/dns-query', 'OpenDNS');
		o.value('https://dns.adguard.com/dns-query,94.140.14.14', 'AdGuard');
		o.value('https://doh.libredns.gr/dns-query,116.202.176.26', 'LibreDNS');
		o.depends('remote_dns_protocol', 'doh');
		o.validate = function(section_id, value) {
			if (!value) return true;
			var parts = value.split(',');
			if (!/^https:\/\/[^\s,]+$/.test(parts[0]))
				return _('DoH request address') + ' ' + _('Format must be:') + ' URL,IP';
			for (var k = 1; k < parts.length; k++)
				if (!/^[0-9.:a-fA-F\/]+$/.test(parts[k]))
					return _('DoH request address') + ' ' + _('Format must be:') + ' URL,IP';
			return true;
		};

		o = s.taboption('dns', form.Value, 'remote_dns_client_ip', _('Remote DNS EDNS Client Subnet'),
			_('Tells the DNS server where the client is, so that a CDN can answer with an edge near it. It cannot be a private address, and the server has to support EDNS Client Subnet (RFC 7871).'));
		o.datatype = 'ipaddr';

		o = s.taboption('dns', form.ListValue, 'remote_dns_detour', _('Remote DNS Outbound'));
		o.value('remote', _('Remote'));
		o.value('direct', _('Direct'));
		o.default = 'remote';

		o = s.taboption('dns', form.Flag, 'remote_fakedns', 'FakeDNS',
			_('Answers with a made-up address and lets the tunnel find the real one at the far end, which saves a lookup on every new site. Only takes effect with “Straight into the tunnel” above: with dnsmasq in front, the router’s own lookups would be made up too, and nothing the router fetches for itself would work.'));
		o.default = '0';
		o.rmempty = false;

		o = s.taboption('dns', form.ListValue, 'remote_dns_query_strategy', _('Remote Query Strategy'));
		o.value('UseIP');
		o.value('UseIPv4');
		o.value('UseIPv6');
		o.default = 'UseIPv4';

		o = s.taboption('dns', form.TextValue, 'dns_hosts', _('Domain Override'),
			_('One per line: a name, a space, and the address it should resolve to.'));
		o.rows = 5;
		o.wrap = 'off';
		o.placeholder = 'example.com 1.2.3.4';

		o = s.taboption('dns', form.Flag, 'dns_hijack', _('DNS Redirect'),
			_('Some devices ignore the router and ask 8.8.8.8 or 1.1.1.1 themselves. Those questions leave without the tunnel, so the answer is whatever the censor wants it to be, and the device then connects to it — looking perfectly healthy while doing so. This drags such queries back to the router. Leave it on unless a device on your network genuinely has to reach a DNS server of its own.'));
		o.default = '1';
		o.rmempty = false;

		/* ----------------------------------------------------------- log */
		o = s.taboption('log', form.Flag, 'log_node', _('Enable Node Log'),
			_('What the core itself says, shown on the Runtime Logs page beside this program’s own log.'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('log', form.ListValue, 'loglevel', _('Log Level'));
		o.value('debug');
		o.value('info');
		o.value('warning');
		o.value('error');
		o.default = 'warning';
		o.depends('log_node', '1');

		o = s.taboption('log', form.DummyValue, '_traffic');
		o.render = function() {
			return E('div', { 'style': 'margin-top:16px' }, st.bottom);
		};

		return m.render().then(function(mapEl) {
			return pui.page(st.top.concat([ mapEl ]), { version: st.version });
		});
	}
});
