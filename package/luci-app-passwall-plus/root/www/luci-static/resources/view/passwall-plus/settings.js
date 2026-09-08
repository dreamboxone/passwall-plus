/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Settings, plus the three things that have to be fetched rather than typed:
 * the routing data, the cores, and whatever the router is missing.
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


/* The public Iranian resolvers, offered rather than typed. Nothing is chosen
   by default and nothing has to be: with none of them selected the Iran split
   still sends Iranian names and addresses straight out, and only the lookup
   itself takes the ordinary path. Picking one means that resolver sees every
   name this router looks up, which is a decision worth making deliberately. */
var IR_RESOLVERS = [
	'178.22.122.100',
	'185.51.200.2',
	'78.157.42.101',
	'10.202.10.202',
	'10.202.10.102',
	'10.202.10.10',
	'10.202.10.11',
	'185.55.226.26',
	'185.55.225.25'
];

var callSystem = rpc.declare({ object: 'luci.passwall-plus', method: 'system', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.passwall-plus', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

function bytes(n) {
	n = Number(n) || 0;
	if (n >= 1073741824) return (n / 1073741824).toFixed(2) + ' GB';
	if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
	if (n >= 1024) return Math.round(n / 1024) + ' KB';
	return n + ' B';
}

function pill(text, colour) {
	return E('span', {
		'style': 'background:' + colour + ';color:#fff;border-radius:9px;padding:1px 9px;' +
		         'font-size:11px;font-weight:600;white-space:nowrap'
	}, text);
}

function yes() { return pill(_('yes'), '#10b981'); }
function no()  { return pill(_('no'), '#ef4444'); }

function row(label, value, action) {
	return E('div', {
		'style': 'display:flex;gap:12px;align-items:center;padding:7px 0;flex-wrap:wrap;' +
		         'border-bottom:1px solid rgba(127,127,127,.14)'
	}, [
		E('div', { 'style': 'flex:0 0 150px;font-weight:600;font-size:13px' }, label),
		E('div', { 'style': 'flex:1 1 200px;font-size:13px;display:flex;gap:8px;' +
		                    'align-items:center;flex-wrap:wrap' }, value),
		E('div', { 'style': 'flex:0 0 auto;display:flex;gap:6px' }, action || [])
	]);
}

function btn(text, cls, fn) {
	return E('button', {
		'class': 'btn cbi-button ' + cls,
		'style': 'padding:3px 12px;font-size:12px',
		'click': ui.createHandlerFn(null, fn)
	}, text);
}

function act(name, arg, note) {
	return callAction(name, arg || '').then(function() {
		if (note) ui.addNotification(null, E('p', {}, note), 'info');
	});
}

function renderSystem(d) {
	d = d || {};
	var geo = d.geo || {}, cores = d.cores || {}, deps = d.deps || {};

	var job = document.getElementById('pwp-job');
	if (job) {
		job.style.display = d.job ? 'block' : 'none';
		job.textContent = d.job ? d.job + '…' : '';
	}

	/* ---- what the router can actually do ---- */
	var can = deps.can || {};
	var dbox = document.getElementById('pwplus-deps');
	if (dbox) {
		while (dbox.firstChild) dbox.removeChild(dbox.firstChild);
		dbox.appendChild(row(_('Transparent proxy'),
			[ can.tproxy ? yes() : no(),
			  E('span', { 'style': 'opacity:.65' },
			    can.tproxy ? _('the kernel can redirect traffic')
			               : _('the kernel module for this is missing — nothing will be tunnelled')) ]));
		dbox.appendChild(row(_('Policy routing'),
			[ can.policy_routing ? yes() : no(),
			  E('span', { 'style': 'opacity:.65' },
			    can.policy_routing ? _('the full ip command is installed')
			                       : _('busybox ip cannot add the route this needs — install ip-full')) ]));
		dbox.appendChild(row(_('HTTPS'),
			[ can.https ? yes() : no(),
			  E('span', { 'style': 'opacity:.65' },
			    can.https ? _('the router can fetch over HTTPS')
			              : _('certificates are missing or the connection is blocked — nothing can be downloaded')) ]));
		dbox.appendChild(row(_('Firewall in use'),
			[ E('span', {}, deps.backend == 'nft' ? 'nftables'
			              : deps.backend == 'ipt' ? 'iptables' : _('none found')) ]));

		var missing = deps.missing || [];
		dbox.appendChild(row(_('Packages'),
			missing.length
				? [ pill(_('%d missing').format(missing.length), '#f59e0b'),
				    E('span', { 'style': 'opacity:.75;font-family:monospace;font-size:12px' },
				      missing.join(' ')) ]
				: [ yes(), E('span', { 'style': 'opacity:.65' }, _('everything needed is installed')) ],
			missing.length
				? [ btn(_('Install them'), 'cbi-button-apply', function() {
						return act('deps_install', '', _('Installing. This needs a working connection and may take a minute.'));
					}) ]
				: []));
	}

	/* ---- the routing data ---- */
	var gbox = document.getElementById('pwplus-geo');
	if (gbox) {
		while (gbox.firstChild) gbox.removeChild(gbox.firstChild);
		[ [ 'geoip', _('Addresses (geoip.dat)') ], [ 'geosite', _('Names (geosite.dat)') ] ]
			.forEach(function(p) {
				var f = geo[p[0]] || {};
				/* When it was last replaced, said in words rather than left as
				   a bare date with nothing to say what it is a date of. A file
				   that arrived some other way has no stamp beside it and the
				   router falls back to when the file itself was written, so
				   there is an answer here for every file that is present. */
				gbox.appendChild(row(p[1],
					f.present
						? [ pill(bytes(f.bytes), '#10b981'),
						    E('span', { 'style': 'opacity:.6;font-size:12px' },
						      f.updated
						        ? _('updated %s').format(new Date(f.updated * 1000).toLocaleString())
						        : _('date unknown')) ]
						: [ pill(_('not downloaded'), '#94a3b8') ],
					[ btn(f.present ? _('Update') : _('Download'), 'cbi-button-apply', function() {
							return act('geo_update', p[0],
								_('Downloading. The page will show the new size when it is done.'));
						}) ]));
			});
		gbox.appendChild(row(_('Free space'),
			[ E('span', {}, bytes(geo.free)),
			  E('span', { 'style': 'opacity:.6' }, geo.dir || '') ],
			geo.geoip && geo.geoip.present
				? [ btn(_('Remove both'), 'cbi-button-remove', function() {
						return act('geo_remove', '', _('Routing data removed.'));
					}) ]
				: []));
		gbox.appendChild(E('div', {
			'style': 'font-size:12px;opacity:.7;margin-top:8px;line-height:1.6'
		}, _('The full files are about 17 MB and 8 MB. If they will not fit, the same project publishes geoip-lite.dat (38 KB) and geosite-lite.dat (2 MB), which carry the Iranian categories and nothing else — put those addresses in the boxes above. A download that will not fit is refused rather than half written.')));
	}

	/* ---- the cores ---- */
	var cbox = document.getElementById('pwplus-cores');
	if (cbox) {
		while (cbox.firstChild) cbox.removeChild(cbox.firstChild);
		(cores.cores || []).forEach(function(c) {
			var value = [];
			if (c.installed) {
				value.push(pill(c.version || _('installed'), '#10b981'));
				/* What the project has published, when it is not what is
				   installed. Two different strings, not "newer" - version
				   numbers written by three different projects are a way to be
				   confidently wrong about which way round they go. Both are
				   shown and the reader decides. */
				if (c.update && c.latest)
					value.push(pill('→ ' + c.latest, '#3b82f6'));
				value.push(E('span', { 'style': 'opacity:.6;font-size:12px;font-family:monospace' },
					c.path));
				if (!c.ours)
					value.push(E('span', { 'style': 'opacity:.75;font-size:12px' },
						_('(installed by another package — left alone)')));
			} else if (!c.arch_ok) {
				value.push(pill(_('no build for this router'), '#94a3b8'));
			} else {
				value.push(pill(_('not installed'), '#94a3b8'));
				if (c.latest)
					value.push(E('span', { 'style': 'opacity:.6;font-size:12px' },
						_('latest is %s').format(c.latest)));
			}

			var actions = [];
			if (c.arch_ok)
				actions.push(btn(c.installed
					? (c.update && c.latest ? _('Update to %s').format(c.latest) : _('Update'))
					: _('Install'), 'cbi-button-apply', function() {
					return act('core_install', c.name, _('Downloading %s.').format(c.name));
				}));
			if (c.installed && c.ours && c.name != 'xray')
				actions.push(btn(_('Remove'), 'cbi-button-remove', function() {
					return act('core_remove', c.name, _('%s removed.').format(c.name));
				}));

			cbox.appendChild(row(c.name, value, actions));
		});
		cbox.appendChild(row(_('Free space'),
			[ E('span', {}, bytes(cores.free)),
			  E('span', { 'style': 'opacity:.6' }, cores.dir || '') ],
			[ btn(_('Check for new versions'), 'cbi-button-neutral', function() {
					return act('cores_latest', '',
						_('Asking each project what it has published. The versions above will fill in shortly.'));
				}) ]));
		cbox.appendChild(E('div', {
			'style': 'font-size:12px;opacity:.7;margin-top:8px;line-height:1.6'
		}, _('Xray carries the traffic. sing-box and hysteria are only needed for nodes that speak hysteria2 or tuic, which Xray does not — one of them is then run as a local helper for that one node, and everything else works exactly as before.')));
	}
}

return view.extend({
	load: function() {
		return Promise.all([
			/* The interface list comes back inside this same answer. Asking
			   LuCI's own network model for it instead is the thorough way and
			   takes seconds on a small router - three or four of them between
			   pressing Settings and the page appearing, for a dropdown with
			   two entries in it. */
			callSystem().catch(function() { return {}; }),
			/* So that a value already in the file can be offered back even
			   when it is not one of the ones listed here. Replacing a setting
			   with a list is only safe if the list can hold what was there. */
			uci.load('passwall-plus').catch(function() { return null; })
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		var m, s, o, i;
		var sys = (data && data[0]) || {};

		/* Every device carrying a network, as the router names it. wan is
		   left out on purpose, on the router's side of this: the setting says
		   which side to pick traffic up from, and picking it up from the wan
		   side would be redirecting the internet into itself. */
		var devs = [], seen = {};
		(sys.interfaces || []).forEach(function(it) {
			if (!it || !it.dev || seen[it.dev]) return;
			seen[it.dev] = true;
			devs.push([ it.dev, it.dev + ' (' + (it.net || '') + ')' ]);
		});

		m = new form.Map('passwall-plus', _('Settings'));

		/* ------------------------------------------------------ language */
		s = m.section(form.NamedSection, 'config', 'passwall-plus');
		s.anonymous = true;

		o = s.option(form.ListValue, 'lang', _('Language'),
			_('The language of these three pages. The rest of LuCI keeps whatever language it was already in. Save, then reload the page to see it.'));
		o.value('en', _('English'));
		o.value('fa', _('Persian'));
		o.default = 'en';

		/* ------------------------------------------------------- routing */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Routing'));
		s.anonymous = true;

		o = s.option(form.Flag, 'route_ir', _('Send Iranian traffic direct'),
			_('Iranian sites and addresses skip the tunnel. Needs the routing data below — until that is downloaded this does nothing, because a core asked for a geo file it has not got refuses to start rather than carrying on without it.'));
		o.rmempty = false;

		o = s.option(form.Value, 'geoip_url', _('Geoip source'),
			_('Where geoip.dat comes from — the list of Iranian addresses. Leave it as it ships unless you have a reason.'));
		o.depends('route_ir', '1');

		o = s.option(form.Value, 'geosite_url', _('Geosite source'),
			_('Where geosite.dat comes from — the list of Iranian names. Leave it as it ships unless you have a reason.'));
		o.depends('route_ir', '1');

		o = s.option(form.ListValue, 'ir_dns', _('Iranian resolver'),
			_('Used for Iranian names when the split is on. One inside Iran keeps an Iranian CDN from answering with a foreign edge, which would send “direct” the long way round. Leave it unset and the split still works — only the lookup takes the ordinary path, and no Iranian resolver sees what this router asks for.'));
		o.depends('route_ir', '1');
		o.value('', '');
		for (i = 0; i < IR_RESOLVERS.length; i++)
			o.value(IR_RESOLVERS[i], IR_RESOLVERS[i]);
		/* Whatever was already set, if it is not one of the above. A list
		   that cannot hold the existing value would silently change it on the
		   next save. */
		var curdns = uci.get('passwall-plus', 'config', 'ir_dns');
		if (curdns && IR_RESOLVERS.indexOf(curdns) < 0)
			o.value(curdns, curdns);

		o = s.option(form.Flag, 'block_ads', _('Block advertising'),
			_('Also needs the routing data.'));
		o.rmempty = false;

		o = s.option(form.Flag, 'block_torrent', _('Block BitTorrent'),
			_('BitTorrent through a free node is how a free node stops existing.'));
		o.default = '1';
		o.rmempty = false;

		/* ------------------------------------------------------- network */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Network'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'dns_mode', _('Name lookups'),
			_('“Through dnsmasq” keeps local machine names and DHCP names working and moves only the outside lookups into the tunnel. “Straight into the tunnel” resolves outside names and loses the ones on your own network.'));
		o.value('dnsmasq', _('Through dnsmasq (recommended)'));
		o.value('direct', _('Straight into the tunnel'));
		o.value('off', _('Leave alone'));
		o.default = 'dnsmasq';

		o = s.option(form.Flag, 'dns_hijack', _('Catch hardcoded resolvers'),
			_('A phone set to ask 8.8.8.8 directly gets answers from outside the tunnel and then connects to whatever it was told. This forces those queries back through the router.'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'ipv6', _('IPv6'),
			_('Almost no node on a free list carries IPv6, and a client that prefers it leaves without the tunnel while looking perfectly fine. Refusing it makes the client fall back to IPv4, which is tunnelled.'));
		o.value('block', _('Refuse it while connected (recommended)'));
		o.value('off', _('Leave it alone'));
		o.default = 'block';

		o = s.option(form.Flag, 'block_quic', _('Refuse QUIC'),
			_('Makes browsers fall back to TCP. Worth turning on when the chosen node carries UDP badly; off by default, because where UDP works QUIC is faster.'));
		o.rmempty = false;

		o = s.option(form.ListValue, 'firewall_backend', _('Firewall'),
			_('Automatic is right unless this router has both and the wrong one is being picked.'));
		o.value('auto', _('Auto'));
		o.value('nftables', 'nftables');
		o.value('iptables', 'iptables');
		o.default = 'auto';

		o = s.option(form.ListValue, 'lan_zone', _('Interfaces to tunnel'),
			_('Read from this router. Left unset — which is how it ships — every LAN interface is tunnelled, which is what almost everyone wants. Choose one to pick traffic up from that interface only.'));
		o.value('', '');
		for (i = 0; i < devs.length; i++)
			o.value(devs[i][0], devs[i][1]);
		var curlan = uci.get('passwall-plus', 'config', 'lan_zone');
		if (curlan && !seen[curlan])
			o.value(curlan, curlan);

		o = s.option(form.Flag, 'autostart', _('Reconnect after a reboot'));
		o.rmempty = false;

		/* ------------------------------------------------------ choosing */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Choosing a node'),
			_('Two passes. A quick handshake to every node, then a real request through the ones that answered — ten at a time, best first, stopping at the first node fast enough. Connecting therefore takes seconds, not a minute.'));
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
			_('How many handshakes run in parallel in the first pass. Lower this on a router that struggles.'));
		o.datatype = 'range(1,100)';
		o.default = '30';

		/* -------------------------------------------------------- traffic */
		s = m.section(form.NamedSection, 'config', 'passwall-plus', _('Traffic'));
		s.anonymous = true;

		o = s.option(form.Value, 'stats_flush_minutes', _('Every (Min)'),
			_('How often the running total is written to storage, in minutes. Anything not yet written is lost if the router loses power. Five is the default and matches how often the counters are read, so at most one reading is ever at risk.'));
		o.datatype = 'range(1,1440)';
		o.default = '5';
		o.placeholder = '5';
		/* Written out on save rather than left absent. A router upgraded from
		   1.0.0 has no value for this at all - the old field was in seconds
		   and is gone - and an empty box beside a number that is quietly
		   being used is a worse answer than the number. */
		o.rmempty = false;

		var self = this;

		return m.render().then(function(mapEl) {
			var extra = E('div', { 'style': 'margin-top:24px' }, [
				/* The theme gives every select a fixed width, so an option
				   whose text is longer than that is simply cut off - the box
				   ends up narrower than the words inside it and the reader
				   cannot see what is selected. Sizing to the content fixes
				   the cause rather than shortening the wording to fit. */
				E('style', { 'type': 'text/css' },
					'.cbi-value select, select.cbi-input-select {' +
					'width:auto;min-width:14em;max-width:100%;' +
					'text-overflow:ellipsis}'),

				E('div', {
					'id': 'pwp-job',
					'style': 'display:none;margin-bottom:14px;padding:9px 12px;border-radius:7px;' +
					         'background:rgba(139,92,246,.14);border:1px solid rgba(139,92,246,.4);' +
					         'font-size:13px'
				}, ''),

				E('h3', {}, _('Does this router have what it needs?')),
				E('p', { 'style': 'font-size:13px;opacity:.7;margin:0 0 6px 0' },
					_('These are questions put to the running system, not a list of package names. A package can be installed and the thing it provides still not work.')),
				E('div', { 'id': 'pwplus-deps' }, []),

				E('h3', { 'style': 'margin-top:24px' }, _('Routing data')),
				E('div', { 'id': 'pwplus-geo' }, []),

				E('h3', { 'style': 'margin-top:24px' }, _('Cores')),
				E('div', { 'id': 'pwplus-cores' }, []),

				E('h3', { 'style': 'margin-top:24px' }, _('Traffic history')),
				E('div', { 'style': 'padding:8px 0' }, [
					btn(_('Forget all recorded traffic'), 'cbi-button-remove', function() {
						return act('stats_reset', '', _('Traffic history cleared.'));
					})
				])
			]);

			poll.add(function() {
				return callSystem().then(renderSystem).catch(function() {});
			}, 5);

			renderSystem(sys);
			return i18n.page([ mapEl, extra ]);
		});
	}
});
