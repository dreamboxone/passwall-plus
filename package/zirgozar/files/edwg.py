p='zgz-parse'
s=open(p,encoding='utf-8',newline='').read()
a='''	return "{\\"protocol\\":\\"wireguard\\",\\"settings\\":{" \
	       "\\"secretKey\\":\\"" jesc(secret) "\\"" \'''
assert a in s, 'mk_wg'
b='''	# noKernelTun: Xray otherwise asks the kernel for a TUN device of its own,
	# and a router without that support - most of them - refuses to start the
	# whole core with "protocol not supported". With it the tunnel is carried
	# in user space, which needs nothing from the kernel.
	return "{\\"protocol\\":\\"wireguard\\",\\"settings\\":{\\"noKernelTun\\":true," \
	       "\\"secretKey\\":\\"" jesc(secret) "\\"" \'''
s=s.replace(a,b,1)
# decorate: an outbound already stored without it
a='''	ss = jraw(p, "streamSettings")
	if (ss == "") ss = "{}"
	sock = jraw(ss, "sockopt")'''
assert a in s, 'decorate'
b='''	if (proto == "wireguard") {
		wgs = jraw(p, "settings")
		if (wgs != "" && jraw(wgs, "noKernelTun") == "")
			p = jset(p, "settings", jset(wgs, "noKernelTun", "true"))
	}

'''+a
s=s.replace(a,b,1)
s=s.replace("function decorate(p, hp,   proto, ss, sock, net, fm, tcp, udp, first, d) {","function decorate(p, hp,   proto, ss, sock, net, fm, tcp, udp, first, d, wgs) {",1)
open(p,'w',encoding='utf-8',newline='').write(s)
