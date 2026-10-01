/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * PassWall2's Node Subscribe: the keyword filter for every subscription, the
 * two buttons for all of them at once, and the table of subscriptions with
 * what each one last brought and a button to read it again or to delete what
 * it brought. Each subscription's own settings are in its edit window.
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

var callSubs   = rpc.declare({ object: 'luci.zirgozar', method: 'subs', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

/* The week as it runs in Iran, from Saturday. The numbers are cron's. */
var WEEK = [
	[ '7', 'Every day' ], [ '6', 'Every Saturday' ], [ '0', 'Every Sunday' ],
	[ '1', 'Every Monday' ], [ '2', 'Every Tuesday' ], [ '3', 'Every Wednesday' ],
	[ '4', 'Every Thursday' ], [ '5', 'Every Friday' ]
];

/* What the router last said about each subscription, by section. */
var info = {};

function ago(when) {
	if (!when) return '';
	var s = Math.max(0, Math.floor(Date.now() / 1000) - when);
	if (s < 60) return _('just now');
	if (s < 3600) return _('%d min ago').format(Math.floor(s / 60));
	if (s < 86400) return _('%d h ago').format(Math.floor(s / 3600));
	return _('%d days ago').format(Math.floor(s / 86400));
}

/* PassWall2's Subscribe Info column: how many nodes, what is left of the
   allowance and when it runs out - the last two only when the provider says
   - and here also when it was last read, or why it could not be. */
function infoCell(sid) {
	var d = info[sid];
	var out = [ E('div', {}, _('Node num') + ': ' + ((d && d.count) || 0)) ];
	if (d) {
		var extra = [];
		if (d.rem >= 0) extra.push(pui.bytes(d.rem));
		if (d.expire > 0)
			extra.push(new Date(d.expire * 1000).toLocaleDateString(i18n.get() === 'fa' ? 'fa-IR' : undefined));
		if (extra.length)
			out.push(E('div', { 'style': 'font-size:12px;color:var(--muted)' }, extra.join(' / ')));
		if (d.error)
			out.push(E('div', { 'style': 'font-size:12px;color:#dc2626;font-weight:600' }, _(d.error)));
		else if (d.when)
			out.push(E('div', { 'style': 'font-size:12px;color:var(--muted)' }, ago(d.when)));
	}
	return out;
}

function renderInfo(d) {
	info = {};
	((d && d.subs) || []).forEach(function(s) {
		if (s.section) info[s.section] = s;
	});
	var cells = document.querySelectorAll('.pwp-subinfo');
	for (var i = 0; i < cells.length; i++) {
		var c = cells[i];
		while (c.firstChild) c.removeChild(c.firstChild);
		infoCell(c.getAttribute('data-sub')).forEach(function(e) { c.appendChild(e); });
	}
}

/* A column of the table that is a button or a live value rather than a
   setting. A grid section draws its cells as read-only text unless an option
   is marked editable, and looks the widget up by id when it saves - so the
   hidden field is there for it to find. */
function column(s, name, title, draw) {
	var o = s.option(form.DummyValue, name, title);
	o.modalonly = false;
	o.editable = true;
	o.renderWidget = function(section_id) {
		return E([ draw(section_id), new ui.Hiddenfield('', { id: this.cbid(section_id) }).render() ]);
	};
	return o;
}

/* A configuration file rather than an address. It is read in the browser and
   its text put in the box: nothing is uploaded, and what is saved is exactly
   what would have been typed. */
function withBrowse(o, hint) {
	o.renderWidget = function(section_id, option_index, cfgvalue) {
		var self = this;
		var box = form.TextValue.prototype.renderWidget.apply(this,
			[ section_id, option_index, cfgvalue ]);
		var browse = E('button', {
			'class': 'btn cbi-button',
			'click': function(ev) { ev.preventDefault(); picker.click(); }
		}, _('Browse…'));
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
					pui.note(browse, _('That file could not be read.'), 'error');
				};
				reader.readAsText(f);
				ev.target.value = '';
			}
		});
		return E([ box, E('div', { 'style': 'margin-top:6px' }, [
			browse,
			E('span', { 'style': 'margin-inline-start:8px;font-size:12px;opacity:.65' }, hint),
			picker
		]) ]);
	};
	return o;
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

/* PassWall2's five filter modes, the same numbers. */
function filterModes(o, withGlobal) {
	o.value('0', _('Close'));
	o.value('1', _('Discard List'));
	o.value('2', _('Keep List'));
	o.value('3', _('Discard List,But Keep List First'));
	o.value('4', _('Keep List,But Discard List First'));
	if (withGlobal) o.value('5', _('Use global config'));
}

function done(b, r, ok) {
	if (r && r.error) pui.note(b, _(r.error), 'error');
	else pui.note(b, ok, 'ok');
}

return view.extend({
	load: function() {
		return Promise.all([
			callSubs().catch(function() { return {}; }),
			uci.load('zirgozar').catch(function() { return null; })
		]);
	},

	/* Saved and applied, the list is put together again from what has been
	   read already - a subscription switched off drops out at once. */
	handleSave: function(ev) {
		return view.prototype.handleSave.apply(this, [ ev ]).then(function() {
			return callAction('rebuild_nodes', '').catch(function() {});
		});
	},

	render: function(data) {
		i18n.setLang(uci.get('zirgozar', 'config', 'lang'));
		renderInfo(data[0]);

		var m, s, o;

		m = new form.Map('zirgozar');

		/* --------------------------------------------- for all of them */
		s = m.section(form.NamedSection, 'config', 'zirgozar');
		s.anonymous = true;

		if ((uci.get('zirgozar', 'config', 'sources') || 'own') == 'own') {
			o = s.option(form.DummyValue, '_unused');
			o.render = function() {
				return E('div', { 'class': 'cbi-value' }, E('div', {
					'style': 'color:#dc2626;font-weight:600;font-size:13px;padding:4px 0'
				}, _('Subscriptions are not used now: on the Node List page, “Nodes to use” is set to only manually added configs.')));
			};
		}

		o = s.option(form.ListValue, 'filter_keyword_mode', _('Filter keyword Mode'),
			_('Nodes are kept or dropped by words in their names. A word matches anywhere in the name, exactly as written.'));
		filterModes(o, false);
		o.default = '1';

		o = s.option(form.DynamicList, 'filter_discard_list', _('Discard List'));
		o.depends('filter_keyword_mode', '1');
		o.depends('filter_keyword_mode', '3');
		o.depends('filter_keyword_mode', '4');

		o = s.option(form.DynamicList, 'filter_keep_list', _('Keep List'));
		o.depends('filter_keyword_mode', '2');
		o.depends('filter_keyword_mode', '3');
		o.depends('filter_keyword_mode', '4');

		o = s.option(form.Value, 'max_nodes', _('Nodes kept at most'),
			_('From all the subscriptions together. A long list takes longer to measure and more memory to hold.'));
		o.datatype = 'range(10,2000)';
		o.default = '300';
		o.placeholder = '300';

		o = s.option(form.DummyValue, '_all');
		o.render = function() {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, ''),
				E('div', { 'class': 'cbi-value-field', 'style': 'display:flex;gap:10px;flex-wrap:wrap;align-items:center' }, [
					pui.btn(_('Manual subscription All'), 'primary mk-small', function(ev) {
						var b = ev.currentTarget;
						return callAction('refresh_nodes', '').then(function(r) {
							done(b, r, _('Reading the subscriptions. This page will fill in shortly.'));
						});
					}, 'refresh'),
					pui.btn(_('Delete All Subscribe Node'), 'danger mk-small', function(ev) {
						var b = ev.currentTarget;
						if (!window.confirm(_('Delete the nodes of every subscription? They come back the next time the subscriptions are read.')))
							return;
						return callAction('forget_nodes', '').then(function(r) {
							done(b, r, _('Deleted.'));
							return callSubs().then(renderInfo);
						});
					}, 'trash')
				])
			]);
		};

		/* ------------------------------------------ the subscriptions */
		s = m.section(form.GridSection, 'subscription', _('Subscriptions'),
			_('When each subscription is read is set in its own edit window. Xray, sing-box, Hysteria, Clash and WireGuard files are accepted, as are a plain list of links and a single base64 block. When adding a new subscription, save and apply first, then update it manually.'));
		s.addremove = true;
		s.anonymous = true;
		s.sortable = true;
		s.handleAdd = function(ev) {
			return form.GridSection.prototype.handleAdd.apply(this, [ ev, sectionName('s') ]);
		};

		/* The table shows what PassWall2's does; everything else is in the
		   edit window. */
		s.tab('main', _('Main'));
		s.tab('keywords', _('Filter keyword Mode'));
		s.tab('sched', _('Auto Update'));
		s.tab('chain', _('Chain Proxy'));

		o = s.taboption('main', form.Value, 'name', _('Name'));
		o.rmempty = false;
		o.placeholder = 'my list';
		o.validate = function(section_id, value) {
			value = String(value || '').trim();
			if (!value) return _('Remark cannot be empty.');
			var dup = uci.sections('zirgozar', 'subscription').some(function(x) {
				return x['.name'] != section_id && String(x.name || '').toLowerCase() == value.toLowerCase();
			});
			return dup ? _('This remark already exists, please change a new remark.') : true;
		};

		o = column(s, '_info', _('Subscribe Info'), function(sid) {
			return E('div', { 'class': 'pwp-subinfo', 'data-sub': sid }, infoCell(sid));
		});

		o = s.taboption('main', form.Value, 'url', _('Subscribe URL'));
		o.placeholder = 'https://…';
		o.textvalue = function(section_id) {
			var v = String(this.cfgvalue(section_id) || '');
			if (!v) return uci.get('zirgozar', section_id, 'content') ? _('a file') : '-';
			return E('span', { 'style': 'direction:ltr;display:inline-block;max-width:260px;overflow:hidden;' +
			                            'text-overflow:ellipsis;white-space:nowrap;vertical-align:middle',
			                   'title': v }, v);
		};
		o.validate = function(section, value) {
			if (!value) return true;
			if (!/^https?:\/\//.test(value))
				return _('Must start with http:// or https://');
			return true;
		};

		/* A source that is a file rather than an address. It goes through
		   exactly the same path as a fetched subscription, so a JSON file
		   dropped in here yields the same nodes it would have if it had been
		   published at a URL. */
		o = s.taboption('main', form.TextValue, 'content', _('Or a file'),
			_('Instead of an address: a configuration file — Xray, sing-box, Clash, a WireGuard .conf, or a plain list of links. Leave the address empty when you use this.'));
		o.modalonly = true;
		o.rows = 6;
		withBrowse(o, _('a .json or .conf file'));

		o = s.taboption('main', form.Flag, 'enabled', _('On'));
		o.default = '1';
		o.rmempty = false;
		o.editable = true;

		o = s.taboption('main', form.ListValue, 'access_mode', _('Subscribe URL Access Method'),
			_('Auto reads it the way the router’s own traffic goes when Localhost Proxy is on; otherwise through the tunnel when it is up, and straight out when it is not.'));
		o.modalonly = true;
		o.value('', _('Auto'));
		o.value('direct', _('Direct Connection'));
		o.value('proxy', _('Proxy'));

		o = s.taboption('main', form.Value, 'user_agent', _('User-Agent'));
		o.modalonly = true;
		o.default = 'v2rayN/9.99';
		o.value('curl', 'Curl');
		o.value('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0', 'Edge for Linux');
		o.value('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0', 'Edge for Windows');
		o.value('v2rayN/9.99', 'v2rayN');

		o = s.taboption('keywords', form.ListValue, 'filter_keyword_mode', _('Filter keyword Mode'));
		o.modalonly = true;
		filterModes(o, true);
		o.default = '5';

		o = s.taboption('keywords', form.DynamicList, 'filter_discard_list', _('Discard List'));
		o.modalonly = true;
		o.depends('filter_keyword_mode', '1');
		o.depends('filter_keyword_mode', '3');
		o.depends('filter_keyword_mode', '4');

		o = s.taboption('keywords', form.DynamicList, 'filter_keep_list', _('Keep List'));
		o.modalonly = true;
		o.depends('filter_keyword_mode', '2');
		o.depends('filter_keyword_mode', '3');
		o.depends('filter_keyword_mode', '4');

		/* ------------------------------------------ when it is read
		   PassWall2's own schedule for a subscription, and one choice more:
		   with the node list's quarter-hourly refresh, which is how the
		   default list is read. */
		o = s.taboption('sched', form.Flag, 'boot_update', _('Update Once on Boot'),
			_('Updates the subscription the first time runs automatically after each system boot.'));
		o.modalonly = true;
		o.default = '0';

		o = s.taboption('sched', form.ListValue, 'update_week_mode', _('Auto Update Mode'),
			_('Disable: read only when its button is pressed, or once if it has never been read. What it brought is kept on flash, so a reboot does not lose it.'));
		o.modalonly = true;
		o.value('', _('Disable'));
		o.value('refresh', _('Every 15 minutes'));
		o.value('8', _('Loop Mode'));
		WEEK.forEach(function(d) { o.value(d[0], _(d[1])); });

		o = s.taboption('sched', form.Value, 'update_time_mode', _('Update Time'));
		o.modalonly = true;
		for (var h = 0; h < 24; h++)
			o.value(h + ':00');
		o.default = '0:00';
		o.datatype = 'timehhmm';
		WEEK.forEach(function(d) { o.depends('update_week_mode', d[0]); });

		o = s.taboption('sched', form.ListValue, 'update_interval_mode', _('Update Interval(hour)'));
		o.modalonly = true;
		for (var k = 1; k <= 24; k++)
			o.value(String(k), k + ' ' + _('Hour'));
		o.default = '2';
		o.depends('update_week_mode', '8');

		/* ---------------------------------------------------- its chain
		   PassWall2's Chain Proxy on a subscription, for every node in it.
		   Only nodes added by hand can be named: they are the only ones that
		   stay put. */
		var manual = uci.sections('zirgozar', 'node');

		o = s.taboption('chain', form.ListValue, 'chain_proxy', _('Chain Proxy'),
			_('Chained proxy works only with Xray nodes; a hysteria2 or tuic node of this subscription is left out of a landing chain. Only support a layer of proxy.'));
		o.modalonly = true;
		o.value('', _('Close (Not use)'));
		o.value('1', _('Preproxy Node'));
		o.value('2', _('Landing Node'));

		o = s.taboption('chain', form.ListValue, 'preproxy_node', _('Preproxy Node'),
			_('Every node of this subscription is reached through the one chosen here.'));
		o.modalonly = true;
		o.depends('chain_proxy', '1');
		manual.forEach(function(n) { o.value(n['.name'], n.name || n['.name']); });

		o = s.taboption('chain', form.ListValue, 'to_node', _('Landing Node'),
			_('Traffic goes through a node of this subscription first and leaves from the one chosen here.'));
		o.modalonly = true;
		o.depends('chain_proxy', '2');
		manual.forEach(function(n) { o.value(n['.name'], n.name || n['.name']); });

		column(s, '_remove', _('Delete the subscribed node'), function(sid) {
			return pui.btn(_('Delete the subscribed node'), 'danger mk-small', function(ev) {
				var b = ev.currentTarget;
				return callAction('forget_nodes', sid).then(function(r) {
					done(b, r, _('Deleted.'));
					return callSubs().then(renderInfo);
				});
			}, 'trash');
		});

		column(s, '_update', _('Manual subscription'), function(sid) {
			return pui.btn(_('Manual subscription'), 'primary mk-small', function(ev) {
				var b = ev.currentTarget;
				return callAction('refresh_nodes', sid).then(function(r) {
					done(b, r, _('Reading it now. The count will change when it is done.'));
				});
			}, 'refresh');
		});

		return m.render().then(function(mapEl) {
			poll.add(function() {
				return callSubs().then(renderInfo).catch(function() {});
			}, 5);
			pui.sortable(mapEl, 'zirgozar');
			return pui.page([ mapEl ]);
		});
	}
});
