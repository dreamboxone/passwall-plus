/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * App Update, the way PassWall2 has it: this program's version and the
 * latest one published, each core with its version, a Check update and a
 * Force update, and where each core lives. The routing data is here too -
 * PassWall2 keeps its rule files beside its cores, and so does this.
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

var _ = i18n.tr;

var callSystem = rpc.declare({ object: 'luci.zirgozar', method: 'system', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

/* Sizes in the page's language - see ui.js. */
function bytes(n) {
	return pui.bytes(n);
}

function chip(text, tone) {
	return E('span', { 'class': 'mk-chip ' + (tone || '') }, text);
}

/* What a button said, kept by row. The rows are drawn afresh every few
   seconds, and a message put beside a button would go with it - so it is
   kept here and drawn again under its row each time. */
var notes = {};

function noteFor(key) {
	var n = key && notes[key];
	if (!n || (n.until && Date.now() > n.until)) return '';
	return E('div', { 'class': 'pwp-note ' + n.kind, 'style': 'margin:0' }, n.text);
}

function say(key, text, kind) {
	kind = kind || 'info';
	notes[key] = { text: text, kind: kind,
	               until: (kind == 'warn' || kind == 'error') ? 0 : Date.now() + 15000 };
	var box = document.querySelector('[data-note="' + key + '"]');
	if (box) {
		while (box.firstChild) box.removeChild(box.firstChild);
		var n = noteFor(key);
		if (n) box.appendChild(n);
	}
}

function row(label, value, action, key) {
	return E('div', {
		'style': 'display:flex;gap:12px;align-items:center;padding:10px 0;flex-wrap:wrap;' +
		         'border-bottom:1px solid var(--line)'
	}, [
		E('div', { 'style': 'flex:0 0 150px;font-weight:800;font-size:14px' }, label),
		E('div', { 'style': 'flex:1 1 220px;font-size:13px;display:flex;gap:8px;' +
		                    'align-items:center;flex-wrap:wrap' }, value),
		E('div', { 'style': 'flex:0 0 auto;display:flex;gap:6px;flex-wrap:wrap' }, action || []),
		key ? E('div', { 'data-note': key, 'style': 'flex:1 1 100%' }, noteFor(key)) : ''
	]);
}

function act(key, name, arg, note) {
	return callAction(name, arg || '').then(function(r) {
		if (r && r.error) say(key, _(r.error), 'error');
		else if (note) say(key, note, 'info');
	}).catch(function(e) {
		say(key, String(e && e.message || e), 'error');
	});
}

function checkUpdate(key) {
	return function() {
		return act(key, 'cores_latest', '', _('Checking the latest version of each core. They will be shown in a moment.'));
	};
}

/* The version the page was opened with, and the last update result seen. */
var firstVersion = '';
var lastSelf = '';

/* What the router says it is busy with, in the page's language. */
function jobName(j) {
	var m = /^Installing (.+)$/.exec(j);
	if (m && m[1] != 'dependencies') return _('Installing %s').format(m[1]);
	return _(j);
}

function yes() { return chip(_('yes'), 'ok'); }
function no()  { return chip(_('no'), 'error'); }

/* What the router can actually do - moved here from the settings, because
   what it answers is a list of things to install. */
var depsOpen = null;

function renderDeps(deps) {
	deps = deps || {};
	var can = deps.can || {};
	var box = document.getElementById('zgz-deps');
	if (!box) return;
	while (box.firstChild) box.removeChild(box.firstChild);

	/* One line when everything is there; the details open by themselves
	   when something is missing, and otherwise only when asked for. */
	var missing = deps.missing || [];
	var fw = deps.backend == 'nft' ? 'nftables' : deps.backend == 'ipt' ? 'iptables' : '';
	var lacks = (can.tproxy ? 0 : 1) + (can.policy_routing ? 0 : 1) + (can.https ? 0 : 1) +
	            (fw ? 0 : 1) + (missing.length ? 1 : 0);
	var open = depsOpen != null ? depsOpen : lacks > 0;
	box.appendChild(E('div', { 'style': 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [
		lacks ? chip(_('%d missing').format(lacks), 'error') : chip(_('Everything is ready'), 'ok'),
		fw ? E('span', { 'style': 'font-size:12.5px;color:var(--muted)' }, _('Firewall in use') + ': ' + fw) : '',
		E('span', { 'style': 'flex:1' }),
		pui.btn(open ? _('Hide details') : _('Details'), 'soft-blue mk-small', function() {
			depsOpen = !open;
			renderDeps(deps);
		}, open ? 'chevron-up' : 'chevron-down')
	]));
	if (!open) return;
	var dbox = E('div', { 'style': 'margin-top:8px' });
	box.appendChild(dbox);
	dbox.appendChild(E('p', { 'style': 'font-size:12px;color:var(--muted);margin:0 0 4px' },
		_('These are questions put to the running system, not a list of package names. A package can be installed and the thing it provides still not work.')));
	dbox.appendChild(row(_('Transparent proxy'),
		[ can.tproxy ? yes() : no(),
		  E('span', { 'style': 'color:var(--muted)' },
		    can.tproxy ? _('the kernel can redirect traffic')
		               : _('the kernel module for this is missing — nothing will be tunnelled')) ]));
	dbox.appendChild(row(_('Policy routing'),
		[ can.policy_routing ? yes() : no(),
		  E('span', { 'style': 'color:var(--muted)' },
		    can.policy_routing ? _('the full ip command is installed')
		                       : _('busybox ip cannot add the route this needs — install ip-full')) ]));
	dbox.appendChild(row(_('HTTPS'),
		[ can.https ? yes() : no(),
		  E('span', { 'style': 'color:var(--muted)' },
		    can.https ? _('the router can fetch over HTTPS')
		              : _('certificates are missing or the connection is blocked — nothing can be downloaded')) ]));
	dbox.appendChild(row(_('Firewall in use'),
		[ E('span', {}, deps.backend == 'nft' ? 'nftables'
		              : deps.backend == 'ipt' ? 'iptables' : _('none found')) ]));
	dbox.appendChild(row(_('Packages'),
		missing.length
			? [ chip(_('%d missing').format(missing.length), 'warn'),
			    E('code', {}, missing.join(' ')) ]
			: [ yes(), E('span', { 'style': 'color:var(--muted)' }, _('everything needed is installed')) ],
		missing.length
			? [ pui.btn(_('Install them'), 'primary mk-small', function() {
					return act('deps', 'deps_install', '', _('Installing. This needs a working connection and may take a minute.'));
				}, 'download') ]
			: [], 'deps'));
}

function render(d) {
	d = d || {};
	var cores = d.cores || {};

	var job = document.getElementById('pwp-job');
	if (job) {
		job.style.display = d.job ? 'flex' : 'none';
		job.textContent = d.job ? jobName(d.job) + '…' : '';
	}

	/* This program's own update. The install restarts the services the page
	   talks to, so how it went is read afterwards from what the router left
	   behind: a failure is shown under the row, and success - a different
	   version from the one this page was opened with - reloads the page, whose
	   own files have just been replaced. */
	var app0 = (d.cores || {}).app || {};
	if (app0.version && !firstVersion) firstVersion = app0.version;
	var res = String(d.self || '');
	if (res.indexOf('error ') == 0 && res != lastSelf)
		say('app', _(res.slice(6)), 'error');
	lastSelf = res;
	if (!d.job && app0.version && firstVersion && app0.version != firstVersion) {
		say('app', _('Updated to %s.').format(app0.version), 'info');
		window.setTimeout(function() { location.reload(); }, 1500);
	}

	renderDeps(d.deps);

	/* ------------------------------------------------------ this program */
	var abox = document.getElementById('pwp-app');
	if (abox) {
		var app = cores.app || {};
		while (abox.firstChild) abox.removeChild(abox.firstChild);
		var value = [ chip('【 ' + (app.version || '?') + ' 】', 'ok') ];
		if (app.update && app.latest)
			value.push(chip(_('%s is available').format(app.latest), 'info'));
		else if (app.latest)
			value.push(E('span', { 'style': 'color:var(--muted)' }, _('It is the latest version')));
		abox.appendChild(row('Zirgozar', value, [
			pui.btn(_('Check update'), 'primary mk-small', checkUpdate('app'), 'refresh'),
			app.update && app.latest
				? pui.btn(_('Update to %s').format(app.latest), 'success mk-small', function() {
					return act('app', 'app_update', '',
						_('Downloading and installing the new version. This takes a minute or two; the page reloads by itself when it is done.'));
				}, 'download')
				: ''
		], 'app'));
		abox.appendChild(E('p', { 'style': 'font-size:12px;color:var(--muted);margin:8px 0 0' },
			_('The update button downloads the new version from GitHub, checks it against the release’s checksums and installs it with the router’s own package manager. The settings are kept, and the page reloads by itself when it is done.')));
	}

	/* ------------------------------------------------------------- cores */
	var cbox = document.getElementById('pwp-cores');
	if (cbox) {
		while (cbox.firstChild) cbox.removeChild(cbox.firstChild);
		(cores.cores || []).forEach(function(c) {
			var value = [];
			if (c.installed) {
				value.push(chip('【 ' + (c.version || _('installed')) + ' 】', 'ok'));
				/* What the project has published, when it is not what is
				   installed. Two different strings, not "newer" - version
				   numbers written by three different projects are a way to be
				   confidently wrong about which way round they go. */
				if (c.update && c.latest)
					value.push(chip('→ ' + c.latest, 'info'));
				else if (c.latest)
					value.push(E('span', { 'style': 'color:var(--muted)' }, _('It is the latest version')));
				value.push(E('code', { 'style': 'font-size:11.5px;color:var(--muted)' }, c.path));
				if (!c.ours)
					value.push(E('span', { 'style': 'font-size:12px;color:var(--muted)' },
						_('(installed by another package — left alone)')));
			} else if (!c.arch_ok) {
				value.push(chip(_('no build for this router')));
			} else {
				value.push(chip(_('not installed')));
				if (c.latest)
					value.push(E('span', { 'style': 'color:var(--muted)' }, _('latest is %s').format(c.latest)));
			}

			var actions = [];
			if (c.arch_ok) {
				actions.push(pui.btn(_('Check update'), 'soft-blue mk-small', checkUpdate('core:' + c.name), 'refresh'));
				actions.push(pui.btn(c.installed
					? (c.update && c.latest ? _('Update to %s').format(c.latest) : _('Force update'))
					: _('Install'), 'primary mk-small', function() {
					return act('core:' + c.name, 'core_install', c.name, _('Downloading %s.').format(c.name));
				}, 'download'));
			}
			/* Any recent Xray, pre-releases included - those are what most
			   people run, and GitHub's "latest" leaves them out. */
			if (c.name == 'xray' && c.arch_ok && (cores.xray_versions || []).length) {
				var sel = E('select', { 'class': 'pwp-vsel' }, (cores.xray_versions || []).map(function(v) {
					var t = v.tag.replace(/^v/, '');
					return E('option', { 'value': v.tag }, v.pre ? _('%s (pre-release)').format(t) : t);
				}));
				actions.push(sel);
				actions.push(pui.btn(_('Install this version'), 'soft-blue mk-small', function() {
					return act('core:xray', 'core_install', 'xray@' + sel.value,
						_('Downloading Xray %s.').format(sel.value.replace(/^v/, '')));
				}, 'download'));
			}
			if (c.installed && c.ours && c.name != 'xray')
				actions.push(pui.btn(_('Remove'), 'danger mk-small', function() {
					return act('core:' + c.name, 'core_remove', c.name, _('%s removed.').format(c.name));
				}, 'trash'));

			cbox.appendChild(row({ xray: 'Xray', geoview: 'Geoview' }[c.name] || c.name, value, actions, 'core:' + c.name));
		});
		cbox.appendChild(row(_('Free space'),
			[ E('span', {}, bytes(cores.free)), E('code', { 'style': 'font-size:11.5px;color:var(--muted)' }, cores.dir || '') ]));
		cbox.appendChild(E('p', { 'style': 'font-size:12px;color:var(--muted);margin:8px 0 0' },
			_('Xray carries the traffic. sing-box and hysteria are only needed for nodes that speak hysteria2 or tuic, which Xray does not — one of them is then run as a local helper for that one node, and everything else works exactly as before.')));
	}
}

return view.extend({
	/* The settings only. What the router has installed is asked for once the
	   page is up and filled in when it answers: waiting for it here held the
	   whole page back - blank, and in English - for as long as the router
	   took, which on a small one was ten seconds. */
	load: function() {
		return uci.load('zirgozar').catch(function() { return null; });
	},

	render: function() {
		i18n.setLang(uci.get('zirgozar', 'config', 'lang'));

		var m, s, o;

		/* Where each core lives. PassWall2 has an App Path per core; here one
		   folder holds the cores this package downloads, and one setting can
		   insist on a particular Xray. The routing data is on Rule Manage, as
		   it is in PassWall2. */
		m = new form.Map('zirgozar');
		s = m.section(form.NamedSection, 'config', 'zirgozar', _('App Path'));
		s.anonymous = true;

		o = s.option(form.Value, 'core_dir', _('Folder for downloaded cores'),
			_('Point this at USB storage on a router short of flash. A core another package installed is used where it is and never moved.'));
		o.placeholder = '/usr/libexec/zirgozar';

		o = s.option(form.Value, 'core_xray', _('Xray App Path'),
			_('Empty means: whichever Xray on this router accepts the configuration, preferring one already installed.'));
		o.placeholder = '/usr/bin/xray';

		/* PassWall2's App Path for the other two: the file this program
		   installs, updates and runs. Empty is its own copy in the folder
		   above. */
		o = s.option(form.Value, 'core_singbox', _('Sing-Box App Path'),
			_('Empty means this program’s own copy in the folder above.'));
		o.placeholder = '/usr/libexec/zirgozar/sing-box';

		o = s.option(form.Value, 'core_hysteria', _('Hysteria App Path'),
			_('Empty means this program’s own copy in the folder above.'));
		o.placeholder = '/usr/libexec/zirgozar/hysteria';

		o = s.option(form.Value, 'core_geoview', _('Geoview App Path'),
			_('Only the Geo View page needs it. Empty means this program’s own copy in the folder above.'));
		o.placeholder = '/usr/libexec/zirgozar/geoview';

		o = s.option(form.DummyValue, '_path_tip');
		o.render = function() {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, ''),
				E('div', { 'class': 'cbi-value-field', 'style': 'color:#dc2626;font-weight:600;font-size:13px' },
					_('To run a core from memory, give a path beginning with /tmp, save and apply, then press Install beside it above. It has to be installed again after every reboot.'))
			]);
		};


		return m.render().then(function(mapEl) {
			function waiting() {
				return E('p', { 'class': 'mk-muted', 'style': 'margin:0' }, _('Asking the router…'));
			}
			var content = [
				E('div', { 'id': 'pwp-job', 'class': 'mk-alert', 'style': 'display:none' }, ''),
				pui.card(_('App Update'), 'download', '#1e88e5', E('div', { 'id': 'pwp-app' }, [ waiting() ])),
				pui.card(_('Cores'), 'cpu', '#8b5cf6', E('div', { 'id': 'pwp-cores' }, [ waiting() ])),
				pui.card(_('Router requirements'), 'shield', '#f59e0b',
					E('div', { 'id': 'zgz-deps' }, [ waiting() ])),
				mapEl
			];
			/* Asked at once, and then every ten seconds while the page is open -
			   often enough to see a download finish. */
			function refresh() {
				return callSystem().then(render).catch(function() {});
			}
			poll.add(refresh, 10);
			window.setTimeout(refresh, 0);
			return pui.page(content);
		});
	}
});
