p='zgz-sbconfig'
s=open(p,encoding='utf-8',newline='').read()
def R(a,b):
    global s
    assert a in s,a[:60]
    s=s.replace(a,b,1)
R("""// zgz-sbconfig mode=bridge: the whole configuration of the helper that offers
// one OpenVPN server as a SOCKS port on loopback - what zgz-bridge runs when
// Xray is the engine.""","""// An AmneziaWG node: a WireGuard endpoint with the obfuscation fields of
// sing-box-lx in it. Only that build has them; a sing-box without them refuses
// the configuration, which is how this learns it cannot be used.
function awg_endpoint(b, tag, mark) {
	let peer = { address: b.server, port: int(b.port), public_key: b.public_key, allowed_ips: [ '0.0.0.0/0', '::/0' ] };
	if (b.pre_shared_key)
		peer.pre_shared_key = b.pre_shared_key;
	if (b.keepalive)
		peer.persistent_keepalive_interval = b.keepalive;
	let e = { type: 'wireguard', tag, address: b.address ?? [], private_key: b.private_key, peers: [ peer ], routing_mark: mark };
	if (b.mtu)
		e.mtu = b.mtu;
	for (let k, v in (b.awg ?? {}))
		e[k] = v;
	return e;
}

// The endpoint a profile record is, whichever kind it is.
function bridge_endpoint(b, tag, mark) {
	return b.type == 'amneziawg' ? awg_endpoint(b, tag, mark) : ovpn_endpoint(b, tag, mark);
}

// zgz-sbconfig mode=bridge: the whole configuration of the helper that offers
// one OpenVPN or AmneziaWG server as a SOCKS port on loopback - what
// zgz-bridge runs when Xray is the engine.""")
R("""	if (type(b) != 'object' || b.type != 'openvpn') {
		stderr.write('error: There is no OpenVPN profile to run.\n');""","""	if (type(b) != 'object' || (b.type != 'openvpn' && b.type != 'amneziawg')) {
		stderr.write('error: There is no OpenVPN profile to run.\n');""")
R("		endpoints: [ ovpn_endpoint(b, 'out', int(args.mark ?? 255)) ],","		endpoints: [ bridge_endpoint(b, 'out', int(args.mark ?? 255)) ],")
R("""	if (b.type == 'openvpn')
		return ovpn_endpoint(b, 'proxy', MARK);""","""	if (b.type == 'openvpn' || b.type == 'amneziawg')
		return bridge_endpoint(b, 'proxy', MARK);""")
R("		// An OpenVPN profile is an endpoint in sing-box, not an outbound.\n		push(nb.type == 'openvpn-client' ? endpoints : outbounds, nb);","		// An OpenVPN profile and an AmneziaWG node are endpoints in sing-box,\n		// not outbounds.\n		push(nb.type == 'openvpn-client' || nb.type == 'wireguard' ? endpoints : outbounds, nb);")
open(p,'w',encoding='utf-8',newline='').write(s)
