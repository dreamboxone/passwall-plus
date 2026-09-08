/*
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Passwall+ - https://github.com/dreamboxone/passwall-plus
 *
 * What this program has been saying to the system log.
 *
 * Everything here already went to syslog, and until now reading it meant an
 * SSH session and knowing to type `logread -e passwall-plus`. Most of the
 * questions worth asking about a tunnel that will not come up are answered in
 * these lines - which node was chosen, what the core refused, whether the
 * rules went in - and none of them were reachable from the page where the
 * problem is noticed.
 */

'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require uci';
'require passwall-plus.i18n as i18n';

/* Our own strings, in the language the setting names. */
var _ = i18n.tr;

var callLog = rpc.declare({ object: 'luci.passwall-plus', method: 'log', expect: { '': {} } });

var following = true;

return view.extend({
	load: function() {
		return Promise.all([
			callLog().catch(function() { return {}; }),
			uci.load('passwall-plus').catch(function() { return null; })
		]);
	},

	render: function(data) {
		i18n.setLang(uci.get('passwall-plus', 'config', 'lang'));

		/* Left to right whatever the interface language is: these are log
		   lines, and every one of them is English with paths and numbers in
		   it. Laid out right to left they would be unreadable. */
		var box = E('pre', {
			'dir': 'ltr',
			'style': 'margin:0;padding:12px;border-radius:8px;overflow:auto;' +
			         'max-height:60vh;font-size:12px;line-height:1.5;' +
			         'white-space:pre-wrap;word-break:break-word;' +
			         'background:rgba(127,127,127,.09);' +
			         'border:1px solid rgba(127,127,127,.22)'
		}, '');

		function draw(d) {
			var text = (d && d.text) || '';
			if (!text) {
				box.textContent = _('Nothing has been logged yet.');
				return;
			}
			/* Only scroll to the newest line while the reader is already at
			   the bottom. Dragging them back down every five seconds while
			   they are reading something further up is the one thing a
			   self-refreshing log must not do. */
			var atEnd = (box.scrollTop + box.clientHeight >= box.scrollHeight - 24);
			box.textContent = text;
			if (following && atEnd) box.scrollTop = box.scrollHeight;
		}

		var refresh = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'click': ui.createHandlerFn(this, function() {
				return callLog().then(draw).catch(function() {});
			})
		}, _('Refresh'));

		var follow = E('button', {
			'class': 'btn cbi-button cbi-button-neutral',
			'style': 'margin-inline-start:8px',
			'click': function(ev) {
				following = !following;
				ev.target.textContent = following ? _('Following') : _('Not following');
			}
		}, _('Following'));

		poll.add(function() {
			return callLog().then(draw).catch(function() {});
		}, 5);

		draw(data[0]);

		return i18n.page([
			E('h2', {}, _('Log')),
			E('p', { 'style': 'font-size:13px;opacity:.7;margin:0 0 10px 0' },
				_('The last few hundred lines this program wrote to the system log, newest at the bottom. It refreshes every five seconds. Nothing here is stored by this package — it is the router’s own log, and it is emptied when the router restarts.')),
			E('div', { 'style': 'margin-bottom:10px' }, [ refresh, follow ]),
			box
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
