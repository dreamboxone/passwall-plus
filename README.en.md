# Passwall+ — a router-wide tunnel for OpenWrt

**Version 1.0.0** · support / contact: [t.me/routekernel1](https://t.me/routekernel1)
🇮🇷 **[راهنمای فارسی: README.md](README.md)**

Install it on the router, press **Connect**, and from that moment every device
on your network — phone, laptop, TV, console — goes through the tunnel. You
install nothing on any of them and paste no config anywhere.

The router keeps the server list itself, fetches a fresh one every quarter of
an hour, and finds one that actually works. If you want it to, Iranian traffic
skips the tunnel and goes straight out. And it shows you what you have used:
today, the last seven days, this month.

It runs on [Xray](https://github.com/XTLS/Xray-core). It does not need
PassWall2 or any other package and does not touch their settings. If the router
already has an Xray core, it uses that one rather than downloading a second
copy.

---

## 1. Before you install: has your router got room?

| | Minimum | Comfortable |
|---|---|---|
| **Free flash** | 20 MB | 50 MB |
| **RAM** | 128 MB | 256 MB or more |
| **CPU** | any architecture Xray publishes a build for | two cores or more |

**Flash.** The package itself is about **13 MB**, because it carries the Xray
core. If the router already has `xray-core` — because PassWall2 pulled it in —
Passwall+ uses that one and downloads nothing. The Iranian routing data is
optional and counted separately: 25 MB for the full pair, about 2 MB for the
`-lite` pair.

Routers with **32 MB of flash**, which is most older models, do not have room,
unless you add USB storage.

**RAM.** The running core takes 40–80 MB. It works on a 128 MB router, but if
you use a hundred-config subscription, turn **Checked at once** down from 30 to
10 in the settings. That number is how many handshakes go out at once, and on a
small router it is what puts it under pressure — not the tunnel itself.

**CPU.** Throughput is decided by TLS, not by core count. Measured on the
reference router — four Cortex-A7 cores at 717 MHz — **1.6 MB/s** through the
tunnel, and choosing a server out of 98 configs took **8.8 seconds**. A weaker
CPU does the same work, more slowly.

---

## 2. Install

Every release carries both package formats, because OpenWrt changed package
manager in 25.12. Take the pair that matches your router:

| Your OpenWrt | Package manager | The two files you need |
|---|---|---|
| 25.12 and later | `apk` | `passwall-plus-<version>.<arch>.apk` and `luci-app-passwall-plus-<version>.apk` |
| 24.10, 23.05 | `opkg` | `passwall-plus_<version>_<arch>.ipk` and `luci-app-passwall-plus_<version>_all.ipk` |

Your architecture is on the `DISTRIB_ARCH` line of `/etc/openwrt_release`. The
`luci-app-passwall-plus` package has no architecture and fits every router.

### The easy way: from LuCI itself

In LuCI go to **System → Software** and press **Upload Package…**. Upload and
install the main file first, then the `luci-app-…` one. After the second, press
**Ctrl+F5** once so the new page appears.

### The other way: from a terminal

```sh
scp -O passwall-plus-*.apk luci-app-passwall-plus-*.apk root@192.168.1.1:/tmp/
ssh root@192.168.1.1 'apk add --allow-untrusted /tmp/passwall-plus-*.apk /tmp/luci-app-passwall-plus-*.apk'
```

On 24.10 and 23.05, instead of the second command:

```sh
ssh root@192.168.1.1 'opkg install /tmp/passwall-plus_*.ipk /tmp/luci-app-passwall-plus_*.ipk'
```

> Write `-O` with a capital letter. Most OpenWrt routers have no sftp service
> and plain `scp` fails on them with `sftp-server: not found`; `-O` makes it use
> the older method instead.

### The router needs working internet while you install

Several things Passwall+ relies on are not in a stock OpenWrt image —
`kmod-nft-tproxy`, `curl`, `ip-full` — and the package manager fetches them as
it installs. So do this on a connection that works, **before** you need the
tunnel.

If that step went wrong, or you installed the file by hand, go to **Settings**
and scroll to **Does this router have what it needs?**. It puts three questions
to the running system — can it redirect traffic, can it do policy routing, can
it fetch over HTTPS — and installs whatever is missing at the press of a button.
It never touches `xray-core`, so a router that has PassWall2 is left alone.

Nothing runs by itself after installation. The tunnel stays off until you press
**Connect**.

---

## 3. Your first connection

1. In LuCI go to **Services → Passwall+**.
2. As the page opens, the router starts measuring servers straight away. Watch
   the progress bar.
3. When the bar turns green, press **Connect**.

That is all. If the default subscription cannot be read, or you have no list at
all, go to the **Servers** page, put one of your own configs into **Servers
added by hand**, and come back.

**If PassWall2 is running on the same router, turn it off first.** Two
transparent proxies fight over the same packets and the loser is your
connection. If Passwall+ sees PassWall2 redirecting traffic, it says so at the
top of the page.

---

## 4. The three pages you will see

### Status

| Button | What it does |
|---|---|
| **Connect** | Finds a server and sends every device on the network through it |
| **Disconnect** | Stops the tunnel. Your network goes back to normal immediately |
| **Choose again** | Throws away the current choice and measures from scratch |

Measuring starts **when the page opens**, not when you press the button — so by
the time you have decided, the answer is usually ready. The progress bar says
which pass is running and counts real servers, not guessed seconds.

**Connected means traffic is genuinely going through the tunnel** — the process
is alive *and* the firewall rules are in place. A core that is running with no
rules in front of it is not a connection, and this page will not call it one.

Below that is **Traffic through the tunnel**: today, the last seven days and
this month as rings, upload against download, plus the last fortnight as bars.
The numbers are read from the core every five minutes and added up in RAM, and
reach the router's storage **once an hour** — so leaving this page open does not
wear the flash out.

### Servers

At the top you choose which sources may be used:

| Option | Means |
|---|---|
| **Mine and the subscriptions** | Hand-added configs and every subscription that is on (the default) |
| **Only the ones I added by hand** | The subscriptions are not even fetched |
| **Only the subscriptions** | Hand-added configs are set aside |

This decides who gets **measured**, not who wins. The server that answers
fastest is the one used, wherever it came from. A hand-added config **joins**
the list rather than replacing it. If you want one particular server used, press
**Use this one** beside it further down the page.

**Subscriptions.** You give the address and it is read every quarter of an hour.
You do not need to know what format it is in: a plain list of configs, one
base64 block, or a whole JSON file — an Xray config, a sing-box config, a Clash
list. WireGuard is read too.

**Servers added by hand.** Put your own config here — `vless`, `vmess`,
`trojan`, `ss`, `socks`, `hysteria2`, `tuic` or `wireguard`. If you leave the
Name box empty, the name written after the `#` in the config itself is used,
even if it is in Persian.

**The table at the bottom.** Every server the router knows about, with what was
measured for it:

- **Reachable in** — one TCP handshake to the server. Filled in for all of them.
- **Measured** — a complete request through the server. **Most of this column is
  empty on purpose**, because measuring stops as soon as a server that is fast
  enough is found.

The **Check every server** button fills in the first column for all of them,
without disturbing a tunnel that is already carrying traffic.

### Settings

The ones that matter most:

**Send Iranian traffic direct.** Iranian sites and addresses skip the tunnel. It
needs two data files, fetched with the **Update** buttons under **Routing
data**.

> **On size.** The full `geoip.dat` is about 17 MB and `geosite.dat` about 8 MB
> — more than the free space on a great many routers. The same project also
> publishes `geoip-lite.dat` (38 KB) and `geosite-lite.dat` (2 MB), which carry
> the Iranian categories and nothing else; if the full ones will not fit, put
> those addresses in the same boxes. Either way the free space is checked first
> and a download that will not fit is **refused** rather than half written:
> filling a router's overlay remounts it read-only, and from that moment nothing
> works.

**Cores.** If you have a server that speaks `hysteria2` or `tuic` — which Xray
does not — install sing-box or hysteria here. That core is then run as a local
helper for that one server and nothing else changes. What each project has
published is shown beside what is installed, and the button says **Update to
…**.

**Language.** English or Persian. Save, then reload the page once.

---

## 5. How a server is chosen

You do not need to know this, but if you are curious: choosing happens in **two
passes**, which is why it takes seconds rather than half a minute.

1. **One TCP handshake to every server**, thirty at a time. On a typical list
   this takes about eight seconds and throws out a third to a half of them
   before anything expensive happens. A server that will not complete a
   handshake cannot carry anything.
2. **The survivors, nearest first, ten at a time** — this time a complete web
   request through each one. As soon as one comes back under a second, that is
   the one, and the rest are never run.

The results are kept, so when the chosen server dies later the router takes the
next one down the list rather than starting again.

> **Why a handshake and not a ping.** Most of these servers sit behind
> Cloudflare, where the ping is answered by the CDN edge — which tells you
> nothing about the server itself. Plenty of healthy servers do not answer pings
> at all. So ping keeps servers that do not work and discards servers that do.
> If you want ping anyway, it is under **First pass** in the settings.

---

## 6. Every setting

The ones worth changing are on the page. The rest live in
`/etc/config/passwall-plus`, an ordinary UCI file. The name in backticks is the
option in that file.

### Routing

| Setting | Default | What it does |
|---|---|---|
| Send Iranian traffic direct `route_ir` | off | Iranian traffic skips the tunnel. Until the routing data is downloaded it deliberately does nothing |
| Address data `geoip_url` | Chocolate4U | Where the Iranian address list comes from. Editable, for when you want the `-lite` file |
| Name data `geosite_url` | Chocolate4U | The same, for names |
| Iranian resolver `ir_dns` | *none* | Which resolver answers Iranian names while the split is on. Leaving it empty is a real answer: the split works without one, and no Iranian resolver gets to see what you ask for. Pick one if an Iranian CDN is answering you with a foreign node |
| Block advertising `block_ads` | off | Blocks advertising and tracking domains, for every device on the network. No separate list is downloaded: the names come from the `category-ads-all` category inside the same `geosite.dat` |
| Block BitTorrent `block_torrent` | on | BitTorrent through a free server is how a free server stops existing |

### Network

| Setting | Default | What it does |
|---|---|---|
| Name lookups `dns_mode` | Through dnsmasq | `dnsmasq` means the router's own resolver keeps answering and only its upstream moves into the tunnel, so the names of your own devices and your printer keep working. `direct` sends every query straight into the tunnel and you lose the local names |
| Catch hardcoded resolvers `dns_hijack` | on | A phone that asks 8.8.8.8 directly gets its answer from outside the tunnel and then connects to whatever it was told. This brings those queries back to the router |
| IPv6 `ipv6` | refuse | Almost no free server carries IPv6, and a client that prefers it leaves without the tunnel — while looking perfectly healthy doing so. Refusing it sends the client back to IPv4 |
| Refuse QUIC `block_quic` | off | Drops UDP 443 before the tunnel so the browser falls back to TCP. Turn it on only when your server carries UDP badly |
| Firewall `firewall_backend` | automatic | nftables or iptables. Automatic is right unless the router has both |
| Interfaces to tunnel `lan_zone` | *all* | Read from the router itself. Empty means every LAN interface |
| Reconnect after a reboot `autostart` | off | The tunnel comes back by itself after a reboot or a power cut |

### Choosing a server

| Setting | Default | What it does |
|---|---|---|
| Servers to use `sources` | Mine and the subscriptions | Which sources are allowed in |
| First pass `prefilter` | TCP handshake | How it is decided that a server is worth measuring properly |
| Good enough (ms) `good_ms` | 1000 | The first server faster than this is the one used. Lower means a better server and a longer wait |
| Measured at a time `batch_size` | 10 | How many are measured properly at once |
| Batches at most `max_batches` | 5 | How far down the list to keep going when none is good enough |
| Checked at once `sift_parallel` | 30 | How many handshakes at once. **Turn this down on a small router** |

### Traffic

| Setting | Default | What it does |
|---|---|---|
| Save to flash every (s) `stats_flush_seconds` | 3600 | Totals are added up in RAM every five minutes; this is how often that sum is written to flash. Lower loses less to a power cut and wears the flash faster |

### In the file only

These are not on the page, because changing them is rare and getting them wrong
is quiet.

| Option | Default | What it does |
|---|---|---|
| `tproxy_port` `dns_port` `api_port` `bridge_port` | 1082, 1053, 10853, 10808 | The ports the tunnel, the resolver, the statistics interface and the protocol helper listen on |
| `sift_timeout` | 2 s | How long each handshake is given |
| `test_timeout` | 6 s | How long each full request is given |
| `test_url` | `gstatic.com/generate_204` | What is fetched to measure a server |
| `fresh_seconds` | 3600 s | A measurement younger than this is not taken again |
| `max_nodes` | 300 | A ceiling on the configs in one round |
| `geo_dir` | `/etc/passwall-plus/geo` | Where the routing data is kept. If another program has the same files in `/usr/share/xray`, those are used |
| `remote_dns` | `1.1.1.1` | The resolver used through the tunnel for everything that is not Iranian |
| `core_dir` | `/usr/libexec/passwall-plus` | Where downloaded cores are kept. Point it at USB storage on a router short of flash |
| `core_xray` | *empty* | Forces one particular Xray |
| `loglevel` | `warning` | What the core writes to the log. `debug` is a great deal of output |

Subscriptions and hand-added configs are UCI sections in the same file. Anything
the Servers page does can be done by editing it, and the other way round.

---

## 7. If it does not work

**It says there is no server list yet.** No subscription could be read and you
have no hand-added config. Check the subscription address on the Servers page,
or — more reliably — paste in one of your own configs. On a censored connection
the subscription address usually will not open until the tunnel is up, and the
tunnel will not come up without a server; one hand-added config breaks that
circle.

**It says servers answered but none completed a request.** The servers are there
and something between you and them is stopping the traffic. Press **Choose
again**, and if it says the same thing, change the list.

**It says no server answered at all.** The list has gone stale, or your
connection is blocking all of them. The router reads a fresh list every quarter
of an hour and repairs itself when the tunnel should be up and is not, so
sometimes the answer is to wait.

**It connects but a site will not open.** First check the Status page really
does say **Connected**. If it does:

- If PassWall2 is also running, turn it off.
- Turn on **Refuse QUIC** in the settings. Some servers carry UDP badly and the
  browser gets stuck on QUIC.
- Press **Choose again** to pick a different server.

**Some sites open and some do not.** Usually name resolution. Check that
**Settings → Name lookups** is on *Through dnsmasq*.

**The names of my own devices stopped resolving.** That is exactly what *Through
dnsmasq* prevents; *Straight into the tunnel* has that problem by design.

**I turned the Iran split on and it seems to do nothing.** If the files are not
downloaded, the status page says *Iran split is on, but the routing data is
missing* and until then everything goes through the tunnel. If the router has
geo files left by another program and they do not carry the Iranian categories,
Passwall+ brings the tunnel up **without** the split and says so at the top of
the page.

**The traffic figures are stuck at zero.** The core is not answering its
statistics interface. Look at the log.

**I want to see what is actually happening:**

```sh
logread -e passwall-plus
/usr/libexec/pwplus-rules status
```

The second one says whether the firewall rules really loaded and how much
traffic they have taken.

Support and contact: [t.me/routekernel1](https://t.me/routekernel1)

---

## 8. Uninstall

```sh
/etc/init.d/passwall-plus stop
apk del luci-app-passwall-plus passwall-plus
```

On 24.10 and 23.05 write `opkg remove` instead of `apk del`.

That removes the service, the core and the web page, and takes the scheduled
jobs out of the router's crontab. Your settings are left behind **on purpose**.
To erase those too, including the routing data and the traffic history:

```sh
rm -rf /etc/config/passwall-plus /etc/passwall-plus
```

Nothing else is touched: no firewall zone, no other package's configuration. The
routing rules exist only while the tunnel is up.

---

If you want to know in more detail what was checked, what was wrong and how each
thing was confirmed — and what is still not covered by a test — see
[AUDIT.md](AUDIT.md).

---

## 9. Licence

GPL-3.0-only. Xray-core is licensed by its own authors under MPL-2.0.

---

## 10. Thanks

The default server list is the **TOP 100** collection published by
[@Raydikalx](https://t.me/raydikalx), gathered and kept current as free, public
work. The Iranian routing data is
[Chocolate4U/Iran-v2ray-rules](https://github.com/Chocolate4U/Iran-v2ray-rules).
This project runs no servers of its own: it measures what those lists offer and
picks whichever answers fastest from where you are. Without them there would be
nothing here to measure. Thank you.
