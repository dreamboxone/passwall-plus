/*
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (C) 2026 dreamboxone <https://t.me/routekernel1>
 * Part of Zirgozar - https://github.com/dreamboxone/zirgozar
 *
 * PassWall2's Geo View: two questions put to the routing data with its tool,
 * Geoview. Which lists hold a name or an address - and which shunt rules
 * name one of them - and what one list holds.
 */

'use strict';
'require view';
'require rpc';
'require ui';
'require uci';
'require zirgozar.i18n as i18n';
'require zirgozar.ui as pui';

var _ = i18n.tr;

var callGeoview = rpc.declare({ object: 'luci.zirgozar', method: 'geoview',
                                params: [ 'action', 'value' ], expect: { '': {} } });
var callAction  = rpc.declare({ object: 'luci.zirgozar', method: 'action',
                                params: [ 'name', 'arg' ], expect: { '': {} } });

function ask(b, action, input, out) {
	var v = String(input.value || '').trim();
	if (!v) {
		pui.note(b, _('Enter something to look for first.'), 'warn');
		return;
	}
	out.value = _('Processing, please wait…');
	return callGeoview(action, v).then(function(r) {
		r = r || {};
		if (r.error == 'nogeoview') {
			out.value = '';
			pui.note(b, _('Geoview is not installed. Install it with the button below, or on the App Update page.'), 'warn');
			return;
		}
		if (r.error == 'nogeo') {
			out.value = '';
			pui.note(b, _('The routing data is not on the router yet. Download it on the Rule Manage page.'), 'warn');
			return;
		}
		if (r.error) {
			out.value = '';
			pui.note(b, action == 'extract'
				? _('Write the list as geoip: or geosite: and its name, such as geosite:google.')
				: _('That is not a name or an address.'), 'error');
			return;
		}
		var text = String(r.result || '').trim();
		var rules = String(r.rules || '').trim();
		if (!text && !rules) {
			out.value = _('No results were found!');
			return;
		}
		if (rules)
			text += (text ? '\n--------------------\n' : '') + _('Rules containing this value:') + '\n' + rules;
		out.value = text;
		pui.note(b, '', 'info');
	}).catch(function(e) {
		out.value = '';
		pui.note(b, String(e && e.message || e), 'error');
	});
}

function field(label, placeholder, action, out) {
	var input = E('input', { 'type': 'text', 'placeholder': placeholder,
	                         'style': 'direction:ltr;text-align:left;flex:1 1 260px;min-width:0' });
	var go = pui.btn(_('Query'), 'primary mk-small', function(ev) {
		return ask(ev.currentTarget, action, input, out);
	}, 'globe');
	input.addEventListener('keydown', function(ev) {
		if (ev.key == 'Enter') {
			ev.preventDefault();
			go.click();
		}
	});
	return E('div', { 'class': 'cbi-value' }, [
		E('label', { 'class': 'cbi-value-title' }, label),
		E('div', { 'class': 'cbi-value-field', 'style': 'display:flex;gap:10px;align-items:center;flex-wrap:wrap' }, [ input, go ])
	]);
}

return view.extend({
	load: function() {
		return uci.load('zirgozar').catch(function() { return null; });
	},

	render: function() {
		i18n.setLang(uci.get('zirgozar', 'config', 'lang'));

		var out = E('textarea', {
			'readonly': 'readonly', 'rows': 25, 'wrap': 'off',
			'style': 'width:100%;direction:ltr;text-align:left;font-family:monospace;font-size:12.5px;margin-top:12px'
		});

		var body = E('div', {}, [
			E('p', { 'style': 'font-size:13px;color:var(--muted);margin:0 0 12px' },
				_('Searches the routing data on this router with Geoview: which lists hold a domain or an address, and what a list such as geosite:ir holds. Useful for writing shunt rules.')),
			field(_('Domain/IP Query'), 'google.com  /  8.8.8.8', 'lookup', out),
			field(_('GeoIP/Geosite Query'), 'geosite:ir  /  geoip:ir', 'extract', out),
			out,
			E('div', { 'style': 'margin-top:12px' }, [
				pui.btn(_('Install Geoview'), 'soft-blue mk-small', function(ev) {
					var b = ev.currentTarget;
					return callAction('core_install', 'geoview').then(function(r) {
						if (r && r.error) pui.note(b, _(r.error), 'error');
						else pui.note(b, _('Downloading Geoview. It is ready when it shows on the App Update page.'), 'info');
					});
				}, 'download')
			])
		]);

		return pui.page([ pui.card(_('Geo View'), 'globe', '#0ea5e9', body) ]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
