p='test/test-config.sh'
s=open(p,encoding='utf-8',newline='').read()
def R(a,b):
    global s
    assert a in s,a[:60]
    s=s.replace(a,b,1)
R('check "$(printf \'%s%s\' "$LX" | wc -l | tr -d \' \')" "2" "the two nodes a core here can run"'.replace("%s%s","%s\n"),'check "$(printf \'%s\n\' "$LX" | wc -l | tr -d \' \')" "3" "the three nodes: two an Xray can run and the AmneziaWG one"')
a=s.index("# AmneziaWG is WireGuard with the packets disguised, and Xray cannot speak it.")
b=s.index("# ------------------------------------------------------------ the Xray tab")
new='''# AmneziaWG is WireGuard with the packets disguised, and Xray cannot speak it.
# It is a node of its own kind, carried by sing-box-lx, and not a plain
# WireGuard one: that would measure like any other and connect to nothing.
if printf '%s' "$LX" | grep -q 'amneziawg.*"jc":10'; then
	ok "AmneziaWG is a node of its own kind, with its parameters"
else
	bad "AmneziaWG is a node of its own kind, with its parameters"
fi
echo "== an AmneziaWG .conf"
AW="$RIG/work/awg.conf"
printf '[Interface]\nPrivateKey = abc\nAddress = 10.8.1.2/32\nJc = 5\nJmin = 10\nJmax = 50\nS1 = 77\nH1 = 1234-5678\nI1 = <b 0xc2><r 8>\n[Peer]\nPublicKey = def\nEndpoint = 203.0.113.7:51820\nPersistentKeepalive = 25\n' > "$AW"
AWOUT="$(LC_ALL=C awk -f "$RIG/lib/zgz-parse" < "$AW")"
check "$(printf '%s' "$AWOUT" | cut -f3-5 | tr '\t' ' ')" "amneziawg 203.0.113.7 51820" "a .conf with the AmneziaWG lines is an AmneziaWG node"
for want in '"jc":5' '"h1":"1234-5678"' '"i1":"<b 0xc2><r 8>"' '"keepalive":25'; do
	if printf '%s' "$AWOUT" | grep -qF "$want"; then ok "carried through: $want"; else bad "carried through: $want"; fi
done

'''
s=s[:a]+new+s[b:]
open(p,'w',encoding='utf-8',newline='').write(s)
