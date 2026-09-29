/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * Runtime Logs, the way PassWall2 has them: this program's own log, a date on
 * every line and each step of a start indented under it - the node, the
 * core, the DNS, the firewall - with a button that empties it. And under it,
 * what the core itself said, which is where the reason is when a node is
 * refused.
 */

'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';
'require passwall-plus.i18n as i18n';
'require passwall-plus.ui as pui';

/* Our own strings, in the language the setting names. */
var _ = i18n.tr;

var callLog = rpc.declare({ object: 'luci.passwall-plus', method: 'log', expect: { '': {} } });
var callAction = rpc.declare({ object: 'luci.passwall-plus', method: 'action',
                               params: [ 'name', 'arg' ], expect: { '': {} } });

/* Left to right whatever the interface language is: these are log lines,
   every one of them English with paths and numbers in it. Laid out right to
   left they would be unreadable. */
function box() {
	return E('pre', { 'dir': 'ltr', 'class': 'mk-log' }, '');
}

/* Kept at the bottom while the reader is at the bottom, and left alone once
   they have scrolled up to read something. */
function fill(el, text, empty) {
	var atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 10;
	el.textContent = text || empty;
	if (atEnd || !el.dataset.drawn) el.scrollTop = el.scrollHeight;
	el.dataset.drawn = '1';
}

return view.extend({
	load: function() {
		return Promise.all([
			callLog().catch(function() { return {}; }),
			uci.load('passwall-plus').catch(function() { return null; })
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		var runtime = box(), core = box();

		function draw(d) {
			d = d || {};
			fill(runtime, d.text, _('Nothing has been logged yet.'));
			fill(core, d.core, uci.get('passwall-plus', 'config', 'log_node') === '0'
				? _('The node log is switched off in Settings → Log.')
				: _('The core has not said anything yet.'));
		}

		poll.add(function() {
			return callLog().then(draw).catch(function() {});
		}, 5);

		var page = pui.page([
			pui.card(_('Runtime Logs'), 'book', '#1e88e5', E('div', {}, [
				E('div', { 'class': 'mk-row', 'style': 'margin-bottom:10px;justify-content:space-between' }, [
					E('span', { 'style': 'font-size:13px;color:var(--muted)' },
						_('What this program did, step by step. It refreshes every five seconds and lives in memory, so it is empty again after a restart.')),
					pui.btn(_('Clear logs'), 'danger mk-small', function() {
						return callAction('clear_log', '').then(function() {
							return callLog().then(draw);
						});
					}, 'trash')
				]),
				runtime
			])),
			pui.card(_('Node log'), 'cpu', '#8b5cf6', E('div', {}, [
				E('p', { 'style': 'font-size:13px;color:var(--muted);margin:0 0 10px' },
					_('What Xray itself said. When a node is refused or a connection fails, the reason is usually here.')),
				core
			]))
		]);

		/* Once LuCI has put the page in the document. */
		window.setTimeout(function() { draw(data[0]); }, 0);
		return page;
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
