# ovpn — a router-wide tunnel for OpenWrt

**Version 1.0.0** · support / contact: [t.me/routekernel1](https://t.me/routekernel1)
🇮🇷 **[راهنمای فارسی: README.fa.md](README.fa.md)**

Install it, press **Connect**, and every device on your network goes through
the tunnel. No settings on your phone, no settings on your laptop, nothing to
paste in.

The router keeps a list of servers, reads a fresh one every quarter of an
hour, and finds one that works. Optionally it sends Iranian sites straight out
and only tunnels the rest. It shows you how much you have used, by day, by
week and by month.

Built on [Xray](https://github.com/XTLS/Xray-core). It does not need PassWall2
or any other package, it does not touch their settings, and if a core is
already installed it uses that one rather than a second copy.

Developed on **OpenWrt 25.12**, target `ipq40xx/chromium`, architecture
`arm_cortex-a7_neon-vfpv4`. Releases also carry `.ipk` packages for **24.10
and 23.05**, across four architectures.

**What was checked, what was wrong, and what is still not covered by a test:**
[AUDIT.md](AUDIT.md).

---

## How it chooses a server

This is the part that used to be slow, and it is worth a paragraph.

A hundred servers used to mean a hundred simultaneous connections held open by
one process for half a minute, on every single connect. Now it happens in two
passes:

1. **One TCP handshake to every server**, thirty at a time. On a typical list
   this takes about eight seconds and throws out a third to a half of them
   before anything expensive happens. A server that will not complete a
   handshake cannot carry anything, and finding that out costs three packets.
2. **The survivors, nearest first, measured properly ten at a time** — a
   complete web request through each one, timed end to end, which is the only
   thing that proves a route works. As soon as one comes back fast enough
   (under a second by default) that is the answer, and the rest are never
   measured.

So connecting normally costs one small batch, not the whole list. The results
are kept, so when the chosen server dies later the router takes the next one
down the list rather than starting again.

> **Why a handshake and not a ping.** Most of these servers sit behind
> Cloudflare, where a ping is answered by the edge and tells you nothing about
> the server behind it — and many working servers drop ICMP entirely. So ping
> keeps servers that do not work and discards servers that do. A handshake to
> the real port asks the same question of the thing that matters, for the same
> three packets. Ping is available under **First pass** in the settings if you
> want it.

---

## 1. Install

Releases ship both package formats, because OpenWrt changed package manager in
25.12. Take the pair that matches your router:

| Your OpenWrt | Package manager | Files to download |
|---|---|---|
| 25.12 and later | `apk` | `ovpn-<version>.<arch>.apk` and `luci-app-ovpn-<version>.apk` |
| 24.10, 23.05 | `opkg` | `ovpn_<version>_<arch>.ipk` and `luci-app-ovpn_<version>_all.ipk` |

Your architecture is `DISTRIB_ARCH` in `/etc/openwrt_release` (on 23.05 and
24.10, `opkg print-architecture` prints it too). The `luci-app-ovpn` package
fits every router.

**OpenWrt 25.12 and later:**

```sh
scp ovpn-*.apk luci-app-ovpn-*.apk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 'apk add --allow-untrusted /tmp/ovpn-*.apk /tmp/luci-app-ovpn-*.apk'
```

**OpenWrt 24.10 and 23.05:**

```sh
scp ovpn_*.ipk luci-app-ovpn_*.ipk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 'opkg update && opkg install /tmp/ovpn_*.ipk /tmp/luci-app-ovpn_*.ipk'
```

**The router needs working internet while you install.** Several things ovpn
relies on are not in a stock OpenWrt image — `kmod-nft-tproxy`, `curl`,
`ip-full` — and the package manager fetches them as it installs. Do this on a
connection that works, before you need the tunnel.

If that step went wrong, or you installed the file by hand, go to
**Settings → Does this router have what it needs?**. It asks the running
system three questions — can it redirect traffic, can it do policy routing,
can it fetch over HTTPS — and offers to install whatever is missing. It never
touches `xray-core`, so a router that already has PassWall2 is left alone.

Then open LuCI → **Services → ovpn**.

Nothing runs after installation. The tunnel stays off until you press
**Connect**.

---

## 2. Using it

Three pages.

### Status

| | |
|---|---|
| **Connect** | Finds a server and sends every LAN device through it. |
| **Disconnect** | Stops the tunnel. Your network goes back to normal immediately. |
| **Choose again** | Throws away the current choice and measures from scratch. |

Measuring starts when the page opens, not when you press the button, so by the
time you have read this far the router is usually done. The bar says which
pass is running and counts real servers, not guessed seconds.

**Connected** means traffic is actually going through the tunnel — the process
is alive *and* the rules are in place. A core running with no rules in front
of it is not a connection, and this page will not call it one.

Below that, **Traffic through the tunnel**: today, the last seven days and this
month as rings, upload against download, with the last fortnight as bars. The
counters are read from the core every five minutes and added up in memory;
they reach storage once an hour, so watching this page does not wear the
router's flash out.

### Servers

Your subscriptions, and any servers you want to add by hand — one share link
per entry: `vless`, `vmess`, `trojan`, `ss`, `socks`, `hysteria2` or `tuic`. A
subscription that hands back one base64 block is understood as well as a plain
list. Hand-added servers are tried before the subscription list.

Underneath is every server the router knows about, with what was measured for
it, and a button to use any one of them instead of the automatic choice.

Most of the **Measured** column will be empty, and that is deliberate: the
whole point is to stop measuring once a good server is found.

### Settings

**Send Iranian traffic direct** is the tick box. Iranian sites and addresses
skip the tunnel; everything else goes through it. It needs two data files,
which are downloaded with the **Update** buttons under **Routing data**. The
addresses are editable — the default is
[Chocolate4U/Iran-v2ray-rules](https://github.com/Chocolate4U/Iran-v2ray-rules).

> **On size.** The full `geoip.dat` is about 17 MB and `geosite.dat` about
> 8 MB. That is more than the free space on a great many routers. The same
> project publishes **`geoip-lite.dat` (38 KB)** and **`geosite-lite.dat`
> (2 MB)**, which contain the Iranian categories and nothing else — if the
> full ones will not fit, put those addresses in the boxes instead. Either way
> the free space is checked first and a download that will not fit is refused
> rather than half written. Filling a router's overlay does not merely fail to
> save the file; it remounts read-only, and then nothing works.

The file is also checked before it replaces the one already there: a download
that came back as an error page is still a file of roughly the right size, and
installing it does not make routing worse — it stops the core starting at all.

**Cores** installs sing-box or hysteria. You only need one if you have a server
that speaks `hysteria2` or `tuic`, which Xray does not; the extra core is then
run as a local helper for that one server and everything else works exactly as
before. Xray itself can be updated here too.

### Every setting

The page carries the ones worth changing. The rest live in `/etc/config/ovpn`,
an ordinary UCI file, where each default is written out with the reasoning
beside it. Names in brackets are the UCI options.

**Routing**

| Setting | Default | What it does |
|---|---|---|
| Send Iranian traffic direct `route_ir` | off | Iranian sites and addresses skip the tunnel; everything else goes through it. Needs the routing data below. Until that is downloaded the setting does nothing at all, deliberately: a core asked for a geo file it has not got refuses to start rather than carrying on without it. |
| Address data `geoip_url` | Chocolate4U `geoip.dat` | Where the Iranian address list is fetched from. Editable, which is how the 38 KB `-lite` file gets used on a router with no room for the full one. |
| Name data `geosite_url` | Chocolate4U `geosite.dat` | The same for names. |
| Iranian resolver `ir_dns` | *none* | Which resolver answers Iranian names while the split is on. A list of the public Iranian ones with nothing chosen. Nothing chosen is a real answer and the shipped one: the split still works, only the lookup takes the ordinary path — and no Iranian resolver gets to see every name this router asks for. Choose one if an Iranian CDN is answering you with a foreign edge. |
| Block advertising `block_ads` | off | Refuses known advertising and tracking domains. Needs the routing data too. |
| Block BitTorrent `block_torrent` | on | BitTorrent through a free server is how a free server stops existing. |

**Network**

| Setting | Default | What it does |
|---|---|---|
| Name lookups `dns_mode` | Through dnsmasq | `dnsmasq` keeps the router's own resolver answering and moves only its upstream into the tunnel, so DHCP names, `/etc/hosts` and the printer keep working. `direct` sends every query straight into the tunnel: outside names resolve, names on your own network stop. `off` changes nothing, for a router with its own arrangement. |
| Catch hardcoded resolvers `dns_hijack` | on | A phone set to ask 8.8.8.8 directly gets its answers from outside the tunnel and then connects to whatever it was told. This forces those queries back through the router. |
| IPv6 `ipv6` | Refuse while connected | Almost nothing on a free server list carries IPv6, and a client that prefers it leaves without the tunnel while looking perfectly healthy. Refusing it makes the client fall back to IPv4, which is tunnelled. Set it to *leave alone* only on a connection that is IPv6 only. |
| Refuse QUIC `block_quic` | off | Drops UDP 443 before it reaches the tunnel, so browsers fall back to TCP. Worth turning on when the chosen server carries UDP badly. Off by default because where UDP does work QUIC is the faster path — measured on a real server, YouTube loads over QUIC through the tunnel perfectly well. |
| Firewall `firewall_backend` | automatic | nftables or iptables, decided at run time. Automatic is right unless the router has both and the wrong one is being picked. |
| Interfaces to tunnel `lan_zone` | *every LAN interface* | Read from this router rather than typed. Unset — how it ships — every LAN interface is tunnelled, which is what almost everyone wants. Choose one to pick traffic up from that interface only. |
| Reconnect after a reboot `autostart` | off | Makes the boot symlink, so the tunnel comes back after a power cut. |

**Choosing a server**

| Setting | Default | What it does |
|---|---|---|
| First pass `prefilter` | TCP handshake | How a server is judged worth measuring properly. A handshake to its real port is the right test. A ping is cheaper and wrong often enough to matter: a server behind a CDN answers pings at the edge whatever state it is in, and plenty of working servers drop ICMP entirely. *Ping, then handshake* is the strictest and discards the most. |
| Good enough `good_ms` | 1000 | The first server measured faster than this is the one used. Lower means a better server and a longer wait. |
| Measured at a time `batch_size` | 10 | How many of the survivors are measured properly at once. |
| Batches at most `max_batches` | 5 | How far down the list to keep going when nothing is fast enough. |
| Checked at once `sift_parallel` | 30 | How many handshakes run in parallel in the first pass. Lower it on a router that struggles. |

**Traffic**

| Setting | Default | What it does |
|---|---|---|
| Save to flash every `stats_flush_seconds` | 3600 s | Totals are added up in memory every five minutes; this is how often that sum is written to storage. Lower loses less to a power cut and wears the flash faster. |

**In the file only.** These have no box on the page because changing them is
rare and getting them wrong is quiet.

| Option | Default | What it does |
|---|---|---|
| `tproxy_port` `dns_port` `api_port` `bridge_port` | 1082, 1053, 10853, 10808 | Where the tunnel, the resolver, the statistics interface and the protocol helper listen. Change only if something else on the router already has one of them. |
| `sift_timeout` | 2 s | How long a first-pass handshake is given. |
| `test_timeout` | 6 s | How long a full request through a server is given. |
| `test_url` | `gstatic.com/generate_204` | What is fetched to measure a server. |
| `fresh_seconds` | 3600 s | A measurement younger than this is used as it stands instead of being taken again. |
| `max_nodes` | 300 | A ceiling on one round of candidates. |
| `geo_dir` | `/etc/ovpn/geo` | Where the routing data is kept. Another front-end's copy in `/usr/share/xray` or `/usr/share/v2ray` is used if there is one, rather than downloading twenty-five megabytes a second time. |
| `remote_dns` | `1.1.1.1` | The resolver used through the tunnel for everything that is not Iranian. |
| `core_dir` | `/usr/libexec/ovpn` | Where downloaded cores are kept. Point it at a USB stick on a router whose flash is too small for sing-box. |
| `core_xray` | *empty* | Forces a particular Xray. Empty means: use whichever one on this router accepts the generated configuration, preferring one that is already installed. |
| `loglevel` | `warning` | What the core writes to the system log. `debug` is a great deal of output and worth it only while chasing something. |
| `https_probe` | a small file on GitHub | What the dependency check fetches to prove the router can reach an HTTPS address at all. Only ever downloaded to `/dev/null`. |

Subscriptions and hand-added servers are UCI sections in the same file —
`config subscription` with a `name`, a `url` and `enabled`, and `config node`
with a `name`, a `link` and `enabled`. Anything the Servers page can do can be
done by editing that file, and the other way round.

---

## 3. Uninstall

```sh
ssh root@192.168.1.1
/etc/init.d/ovpn stop
apk del luci-app-ovpn ovpn          # opkg remove ... on 24.10 and older
```

That removes the service, the core and the web page, and takes the scheduled
jobs out of the router's crontab.

Removing the packages leaves your settings behind on purpose. To erase those
too, including any routing data and traffic history:

```sh
rm -rf /etc/config/ovpn /etc/ovpn
```

Nothing else is touched — no firewall zone, no other package's configuration.
The routing rules exist only while the tunnel is up.

---

## 4. If something does not work

**It says no server could be reached.** Look at what the page says underneath.
"*N of M servers answered a handshake, but none completed a request*" means the
servers are there and something between you and them is stopping the traffic.
"*No server answered at all*" means the list is stale or the connection is
blocking them outright. The router reads a new list every quarter of an hour
and repairs itself when the tunnel should be up and is not.

**Some sites open and others do not.** Usually name resolution. Check
**Settings → Name lookups** is on *Through dnsmasq*.

**Devices on my own network stopped resolving.** That is what *Through dnsmasq*
prevents; *Straight into the tunnel* has this trade-off by design.

**Iran routing does not seem to do anything.** The status page says
*Iran split is on, but the routing data is missing* when the files have not
been downloaded. Until then everything goes through the tunnel, on purpose —
asking the core for a geo file it has not got stops it starting at all.

**PassWall is also installed.** Both pages will warn you. Two transparent
proxies fight over the same packets; run one at a time.

**Nothing is tunnelled but it says connected.** It should not — that specific
lie was fixed. If you see it, `/usr/libexec/ovpn-rules status` says what is
actually loaded, and `logread -e ovpn` says what happened.

Support and contact: [t.me/routekernel1](https://t.me/routekernel1)

---

## 5. Building and testing it yourself

```sh
sh build/build-core.sh x86_64          # fetch the Xray core
RIG_XRAY=$PWD/prebuilt/x86_64/xray sh test/run.sh
sh build/build-ipk.sh x86_64           # packages land in dist/
```

The tests run the shipped scripts themselves against a real Xray and a real
`nft`, rather than against a description of what those accept. That distinction
is the whole reason this version exists — see [AUDIT.md](AUDIT.md).

---

## 6. Licence

GPL-3.0-only. Xray-core is licensed by its own authors under MPL-2.0.

---

## 7. Thanks

The default server list is the **TOP 100** collection published by
[@Raydikalx](https://t.me/raydikalx), gathered and kept current as free, public
work. The Iran routing data is
[Chocolate4U/Iran-v2ray-rules](https://github.com/Chocolate4U/Iran-v2ray-rules).
This project runs no servers of its own: it measures what those lists offer and
picks whichever answers fastest from where you are. Without them there would be
nothing here to measure. Thank you.
