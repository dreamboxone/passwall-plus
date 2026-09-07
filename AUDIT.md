# Audit of ovpn 1.0.0

What was found wrong before this version was released, how each thing was
confirmed, and what was done about it.

Everything below was measured on a real router — an OpenWrt 25.12.5 build on
`ipq40xx`, `arm_cortex-a7_neon-vfpv4`, with PassWall2 installed alongside — in
front of a real Xray 26.3.27, a real nftables, real servers and a real browser
on the network. Nothing here was arrived at by reading the code and reasoning
about it. Where I suspected something and turned out to be wrong, that is
written down too: a fix for a problem that does not exist is its own kind of
bug, and the list of things that turned out to be fine is the more useful half
of an audit.

---

## 1. The Iran split made the tunnel impossible to start

**Severity: the tunnel never came up at all.**

Switch on *Send Iranian traffic direct*, and the service failed with:

```
no xray on this router can run the generated configuration
```

on a router carrying twenty-five megabytes of correct, current routing data in
`/etc/ovpn/geo`.

A core reads `geoip.dat` and `geosite.dat` from its own asset directory —
`XRAY_LOCATION_ASSET`, defaulting to `/usr/share/xray` and the directory the
binary sits in. Ours are in `/etc/ovpn/geo`. `find_xray` offers each candidate
core the generated configuration and keeps the first that accepts it, which is
the right way to choose a core — but it offered that configuration **without
telling any of them where to look**. So each core went to its default asset
directory, found either nothing or another front-end's file, and refused the
whole configuration. Every candidate refused it for the same reason, the list
of candidates ran out, and the service gave up.

Reproduced exactly, with the router's own settings and its own files:

```
failed to parse domain rule: geosite:ir > failed to load geosite: IR
  > code not found in geosite.dat: IR
```

The `geosite.dat` it had found was PassWall2's, which carries different
categories. The right file was thirty centimetres away in `/etc/ovpn/geo` and
nothing had told the core about it.

It only bit with the split switched on, because that is the only thing that
puts a geo category into the configuration. With it off, the same router
connected perfectly — which is what made this look like a problem with the
split rather than with where the core had been told to look.

**Fixed** in `find_xray`: the configuration is now offered to each core exactly
as the service will run it, asset directory included. Confirmed on the router —
the same configuration that every core refused is now accepted by the first.

**And a second layer**, because a geo file found on a router is not necessarily
the pair this expects: when every core still refuses a configuration that names
a geo category, the tunnel is brought up once more without the split, and the
page says that is what happened and why. Connected without the split beats a
page reading *could not connect*.

---

## 2. Refusing QUIC refused nothing

**Severity: a setting that did nothing, silently, in the one case it exists
for.**

`block_quic` writes a rule refusing UDP 443 so that browsers fall back to TCP.
It sat on the `forward` hook. A packet that the `prerouting` chain has handed
to the local transparent-proxy socket never reaches `forward` at all, so the
rule was never consulted.

Measured rather than reasoned about. With the setting **on**, a Chromium on the
network still fetched twenty-two of YouTube's files over `h3` — which is QUIC,
which is the thing the setting says it refuses:

| | resources over h3 | UDP 443 packets dropped |
|---|---|---|
| rule on the forward hook | 22 | 0 |
| rule in prerouting, ahead of tproxy | falls to reused sessions only | 72 |

The comment above the rule explained why it was on `forward`: nftables has no
`reject` in `prerouting`, and an earlier attempt to `reject` there made the
whole ruleset fail to load. Both halves of that are true. The conclusion was
wrong. `drop` is available in `prerouting`, and is what this needs — a browser
races QUIC against TCP on a first connection, so a dropped attempt costs the
race rather than the page.

**Fixed** in both firewall backends: the rule moves into `prerouting`, after
the reserved-address returns — so QUIC between two machines on the network is
left alone — and ahead of the tproxy rules, which is the only position where it
does anything.

**And a test that would have caught it.** Every combination of settings was
already generated and put in front of a real `nft`, and this rule passed every
one of those checks the entire time it was doing nothing: it was valid, and
unreachable. The suite now asserts *where* the rule is, not only that the
ruleset loads.

---

## 3. A warning about the one thing the reader had already done

Stopping PassWall2 leaves its `inet passwall2` table behind, empty. The check
for a second transparent proxy asked whether that table existed, so on a router
where PassWall2 had been switched off — exactly what the page was asking for —
the front page still said:

> PassWall is also redirecting traffic on this router. Two transparent proxies
> will fight over the same packets.

Confirmed both ways on the router: the table is present with PassWall2 stopped,
and the rules inside it are only there when it is running. The check now asks
whether anything in that table is still taking traffic — a `tproxy`, a
`redirect` or a `dnat` — rather than whether the table exists.

---

## 4. The front page reported the wrong failure

On a router that connects perfectly through a server added by hand, the page
said, before anything had been pressed:

> No subscription could be read, and there is no saved list to fall back on

Reading a subscription and being able to connect are different facts. Opening
the page starts a measurement, the measurement reads the sources, a source
failed, and the failure went straight to the front page — past the fact that
the router had a perfectly good server of its own and was about to connect
through it.

Which source failed and why belongs beside that source, on the Servers page,
and was already there. The front page now speaks once, when there is genuinely
nothing left to connect through, and names the way out of it.

---

## 5. The list's own address is blocked by the thing the list exists to fix

The default server list is published on `raw.githubusercontent.com`, which is
among the first things to disappear on the connection this program exists to
repair. The circle is real: the list cannot be read until the tunnel is up, and
the tunnel cannot come up without a server.

A fetch that fails outright is now retried through two public mirrors of the
same GitHub path — for the server list and for the routing data both. They
serve the identical file out of the identical public repository. Only
`raw.githubusercontent.com` addresses have mirrors; a subscription hosted
anywhere else is fetched exactly as it was written and nowhere else.

This does not remove the need for the cached list on disk, and does not replace
adding one server by hand, which is still the reliable way out of a cold start.

---

## 6. Smaller things, all confirmed

**`xhttp` links carry an `extra` object and it was being dropped.** Padding,
`xmux`, the separate download connection — all of it travels in the link as one
JSON object, and none of it was reaching the core, which means connecting on
terms the server was never told about. Passed through as JSON now. Measured
against a real server it changes nothing today; that is the good outcome and
not a reason to keep guessing.

**Several links pasted into one box were split on every space.** A link ending
`#سرور خانه` became `#سرور` plus a stray word that parsed as nothing, and the
name was quietly cut in half. They are split where a new link begins instead.

**Names were trimmed to 48 bytes with no regard for where a character ended.**
The parser runs in the C locale — deliberately, because a UTF-8 locale would
re-encode every byte above 127 while decoding base64 and corrupt every
non-English name. But that makes `length()` count bytes, and Persian is two
bytes a character, so the trim landed mid-character about as often as not. Half
a character is not a shorter name; it is a byte sequence that is no longer
UTF-8, and it travelled all the way to the web interface as a broken one. It
walks back to a character boundary now.

**A link's own name is used when none was typed.** Practically every share link
ends in `#something`. Someone who pastes one and leaves the name box empty
meant that name, in percent-encoded UTF-8, or inside the base64 of a `vmess`
link.

**A test that could not fail.** `geo_dir` deliberately falls back to
`/usr/share/xray` and `/usr/share/v2ray`, because twenty-five megabytes already
on the router is not worth downloading twice. That made the test for *no
routing data present* measure another front-end's files on any router that had
them. The search path is a variable now and the test empties it, which is the
only way for that test to mean what it says.

---

## Things I suspected and was wrong about

Recorded because each of these was a plausible cause of "it connects but
YouTube will not open", and each was measured and found innocent. Three of the
four would have been shipped as fixes if I had trusted the reasoning.

**The server.** Both of the user's own servers were put behind a throwaway
SOCKS inbound and asked for real pages. Both carried YouTube's front page —
877 KB of it — plus `i.ytimg.com` and `googlevideo.com`, at about 1.6 MB/s.
Neither server was the problem, and swapping servers would have "fixed" it for
exactly as long as the first server happened to be slow.

**`h3` in the ALPN list.** One of the links advertises `h2,http/1.1,h3` on a
TCP transport, which is nonsense — `h3` is HTTP/3, which is QUIC, which is not
TCP — and stripping it looked like an obvious correctness fix. Measured with
and without: no difference at all. A server that is not broken does not select
it. Left alone; the link says what it says.

**The missing `extra`.** Fixed on principle (§6) and measured before and after:
no difference on this server today. Worth passing through, not worth claiming
as a cure.

**QUIC being unusable through the tunnel.** The strongest hypothesis, and the
one the reporter's symptom fits best — YouTube is the most QUIC-heavy site
there is, and most free servers carry UDP badly. Wrong here: twenty-two of
YouTube's resources loaded over `h3` through this server, with everything
working. `block_quic` therefore stays **off** by default. It is a remedy for a
server that carries UDP badly, and it now works when it is switched on, which
is more than it did before.

**The DNS path.** Suspected because a poisoned or lost lookup looks exactly
like "the tunnel works but that one site does not". Ran the whole generated
configuration on spare ports and queried its own resolver: `www.youtube.com`,
`googlevideo.com` and `digikala.ir` all resolved, and the Iranian name came
back with Iranian addresses, which is the split working. Nothing wrong with it.

---

## What is still not covered by a test

Said plainly, because the value of the suite is in knowing where it ends.

**The transparent proxy path, end to end, in CI.** The rules are generated for
every combination of settings and loaded into a real `nft`, the positions that
matter are asserted, and the whole path was driven by hand on the router for
this release — PassWall2 stopped, tunnel up, a browser on the network fetching
real pages, counters read back. None of that runs on a build machine, because
it needs a second machine on a LAN behind the router.

**The iptables backend against a real firewall3 router.** Written, and checked
for the shape of what it emits. Never run on a router that actually uses it —
every machine to hand runs nftables.

**hysteria2 and tuic carrying real traffic.** The bridge is exercised as far as
"the helper starts and offers a SOCKS port". Whether a real hysteria2 server
carries a real page through it is untested.

**The mirrors.** They only run when the primary address fails, which on a
working connection it does not. The rewriting is unit-tested; the mirrors
themselves being up is somebody else's uptime.

**dnsmasq on a router with several instances.** PassWall2 runs three more, and
the drop-in is written into the directory the generated configuration names. It
was correct on the router tested. A router with a different arrangement of
instances has not been tried.
