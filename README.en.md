<p align="center">
  <img alt="Zirgozar" src="package/luci-app-zirgozar/root/www/luci-static/resources/zirgozar/logo-anim.webp" width="420">
</p>

<h3 align="center">A router-wide tunnel for OpenWrt</h3>

<p align="center">
  <a href="https://github.com/dreamboxone/zirgozar/releases/latest"><img alt="release" src="https://img.shields.io/github/v/release/dreamboxone/zirgozar?style=for-the-badge&color=0b3d91&label=release"></a>
  <a href="https://github.com/dreamboxone/zirgozar/releases"><img alt="downloads" src="https://img.shields.io/github/downloads/dreamboxone/zirgozar/total?style=for-the-badge&color=0ea5e9"></a>
  <img alt="OpenWrt" src="https://img.shields.io/badge/OpenWrt-23.05%20%7C%2024.10%20%7C%2025.12-00B5E2?style=for-the-badge&logo=openwrt&logoColor=white">
  <img alt="Xray" src="https://img.shields.io/badge/core-Xray-7c3aed?style=for-the-badge">
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-AGPL--3.0-16a34a?style=for-the-badge"></a>
  <a href="https://t.me/routekernel1"><img alt="Telegram" src="https://img.shields.io/badge/Telegram-routekernel1-26A5E4?style=for-the-badge&logo=telegram&logoColor=white"></a>
</p>

<p align="center">
  <a href="https://github.com/dreamboxone/zirgozar/releases/latest">⬇️ <b>Download the latest release</b></a> ·
  <a href="README.md">🇮🇷 <b>فارسی</b></a> ·
  <a href="https://t.me/routekernel1">💬 <b>Support on Telegram</b></a>
</p>

> [!NOTE]
> **Zirgozar is Passwall+ under a new name.** If Passwall+ is installed on your
> router, just install Zirgozar: the settings, configs, subscriptions, routing
> data and traffic history move across by themselves and Passwall+ is switched
> off. Then remove the old package: `apk del luci-app-passwall-plus passwall-plus`

## ✨ Features

- 🌐 **Every device on the network** — phone, laptop, TV, console — goes through the tunnel with nothing installed on it
- ⚡ **Picks the fastest working config** by itself, and moves to the next one when a config stops working
- 🔗 **Subscriptions** on schedules of their own; the default free list is refreshed every quarter of an hour
- 🇮🇷 **Iranian traffic direct** — Iranian sites skip the tunnel and cost the config nothing
- 🧭 **Shunt rules** as in PassWall2: any site or service through a config of your choice, direct, or blocked
- 📊 **Traffic used** today, this week and this month
- 🔄 **One-button update**, from the program's own page
- 💾 **Saving without dropping connections** — a change the tunnel does not use does not restart it
- 🧩 Runs on [Xray](https://github.com/XTLS/Xray-core); does not need PassWall2, and its pages have PassWall2's layout and names

---

## 💾 1. Before you install: has your router got room?

| | Minimum | Comfortable |
|---|---|---|
| **Free flash** | 20 MB | 50 MB |
| **RAM** | 128 MB | 256 MB or more |
| **CPU** | any architecture Xray publishes a build for | two cores or more |

**Flash.** The package itself is about **13 MB**, because it carries the Xray
core. If the router already has `xray-core` — because PassWall2 pulled it in —
Zirgozar uses that one and downloads nothing. The Iranian routing data is
optional and counted separately: 25 MB for the full pair, about 2 MB for the
`-lite` pair.

> [!CAUTION]
> Routers with **32 MB of flash**, which is most older models, do not have room,
> unless you add USB storage.

**RAM.** The running core takes 40–80 MB. It works on a 128 MB router, but if
you use a hundred-config subscription, turn **Checked at once** on the **Node
List** page down from 30 to 10. That number is how many handshakes go out at
once, and on a small router it is what puts it under pressure — not the tunnel
itself.

**CPU.** Throughput is decided by TLS, not by core count. Measured on the
reference router — four Cortex-A7 cores at 717 MHz — **1.6 MB/s** through the
tunnel, and choosing a config out of 98 took **8.8 seconds**. A weaker CPU does
the same work, more slowly.

---

## 📦 2. Install

Every release carries both package formats, because OpenWrt changed package
manager in 25.12. Take the pair that matches your router:

| Your OpenWrt | Package manager | The two files you need |
|---|---|---|
| 25.12 and later | `apk` | `zirgozar-<version>.<arch>.apk` and `luci-app-zirgozar-<version>.apk` |
| 24.10, 23.05 | `opkg` | `zirgozar_<version>_<arch>.ipk` and `luci-app-zirgozar_<version>_all.ipk` |

Your architecture is on the `DISTRIB_ARCH` line of `/etc/openwrt_release`. The
`luci-app-zirgozar` package has no architecture and fits every router.

### The easy way: from LuCI itself

In LuCI go to **System → Software** and press **Upload Package…**. Upload and
install the main file first, then the `luci-app-…` one. After the second, press
**Ctrl+F5** once so the new page appears.

### The other way: from a terminal

First **put both files in `/tmp` on the router yourself** — with WinSCP, with
FileZilla, or through **System → Software → Upload Package…** in LuCI. Then SSH
in, and on 25.12 or later:

```sh
apk add --allow-untrusted /tmp/zirgozar-*.apk /tmp/luci-app-zirgozar-*.apk
```

On 24.10 and 23.05:

```sh
opkg install /tmp/zirgozar_*.ipk /tmp/luci-app-zirgozar_*.ipk
```

> [!IMPORTANT]
> **The router needs working internet while you install.** Several things
> Zirgozar relies on are not in a stock OpenWrt image — `kmod-nft-tproxy`,
> `curl`, `ip-full` — and the package manager fetches them as it installs. So do
> this on a connection that works, **before** you need the tunnel.

If that step went wrong, or you installed the file by hand, open the **App
Update** page and look at **Router requirements**. It puts
three questions to the running system — can it redirect traffic, can it do
policy routing, can it fetch over HTTPS — and installs whatever is missing at
the press of a button. It never touches `xray-core`, so a router that has
PassWall2 is left alone.

> [!TIP]
> Nothing runs by itself after installation. The tunnel stays off until you turn
> the **Main switch** on.

---

## 🚀 3. Your first connection

1. In LuCI go to **Services → Zirgozar**. The first page is **Basic
   Settings**.
2. As the page opens, the router starts measuring configs straight away; the
   status card shows how far it has got.
3. In the **Main** tab turn on **Main switch**, then press **Save & Apply**.

That is all. If there is no list to choose from — the default subscription
cannot be read, and you have no config of your own — go to **Node List**, press
**Add the node via the link**, paste one of your own configs, and come back.

> [!WARNING]
> **If PassWall2 is running on the same router, turn it off first.** Two
> transparent proxies fight over the same packets and the loser is your
> connection. If Zirgozar sees PassWall2 redirecting traffic, it says so in the
status card.

---

## 🧭 4. The pages, and every option on them

The tabs across the top are PassWall2's, in PassWall2's order: **Basic
Settings, Node List, Node Subscribe, Other Settings, App Update, Rule Manage,
Geo View, Access Control, Runtime Logs**.

Every option is also a line in `/etc/config/zirgozar`, an ordinary UCI
file; the name in backticks is its name there. Anything a page does can be done
by editing the file, and the other way round.

Two things hold on every page:

- **Nothing is changed until you press Save & Apply** at the foot of the page.
  Buttons that act at once — Manually update, Delete, Use and the like — say so
  beside the button, never at the top of the page.
- **Messages appear beside what they are about.** A warning is red and stays
  until the next press; anything else fades after a few seconds.

### ⚙️ 4.1 Basic Settings

At the top, PassWall2's row of tiles:

| Tile | What it shows |
|---|---|
| **Core Xray** | The core's name beside the word, and under it **RUNNING** in green or **NOT RUNNING** in red. Rest the pointer on it for its version |
| **Helper core** | Only while a config needs sing-box or hysteria as a helper |
| **Cloudflare / Google / GitHub Connection** | Press one: a single request is made through whatever the router's traffic goes through, and the time it took is shown — green under a second, amber under two, red above, or *Problem detected!* |

Under them the **Status** card: whether the tunnel is connected, which config
it is using, its protocol, its latency, and how routing is set. The server's
IP address is **blurred** so that it does not end up in a screenshot or a video;
the **eye** beside it shows it, and the choice is remembered in that browser. A
config chosen by hand gets its latency from one handshake to its port. A
progress bar appears while configs are being measured; **Choose again** throws away the
current choice and measures afresh. A message the router needs you to act on
appears here, with a cross to put it away.

The form below has four tabs, in PassWall2's order.

#### Main

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Main switch** | `enabled` | off | The tunnel on or off. Save and apply for it to take effect; it holds across a reboot |
| **Node** | `node` | Auto (fastest) | Auto measures the configs and uses the fastest. A config added by hand is used as it is, and nothing is measured |
| **Preproxy** | `preproxy_enabled` | off | Every config the tunnel may choose dials out through a config of yours first — PassWall2's pre-proxy. For configs that cannot be reached from here directly, or to hide which ones are being used. With it on, the first-pass handshake is skipped, because no config is reached directly |
| **Preproxy Node** | `preproxy_node` | — | The config dialled first. Only configs added by hand on Node List |
| **Localhost Proxy** | `localhost_proxy` | on | The router's own traffic goes through the tunnel too — its downloads, its clock, its package manager, and so the routing data and the cores from GitHub. While a config is being measured or a subscription read it goes direct, so the router can always repair its own tunnel. On by default, as in PassWall2 |
| **Client Proxy** | `client_proxy` | on | Devices on the LAN go through the tunnel. Turned off, they do not, but the devices named on Access Control still do |
| **Node Socks Listen Port** | `node_socks_port` | 1070 | A SOCKS server on the router that goes out the way the tunnel does. Empty for none |
| **Node Socks Bind Local** | `node_socks_bind_local` | on | That SOCKS server answers the router itself only |
| **Socks Main switch** | `socks_enabled` | off | More SOCKS ports, each through a config of its own — the **Socks Config** table under it |
| **Restore defaults** | `factory_reset` | off | Tick it and save: the tunnel comes down, every config and subscription is deleted and every setting goes back to how it was installed (an untouched copy lives in `/usr/share/zirgozar`). The routing data, the downloaded cores and the traffic history are kept. It asks before it is ticked, and there is no undo |
| **Language** | `lang` | English | English or Persian. The language button in the banner does the same without a save |

**Socks Config** (a `config socks` section per row):

| Column | In the file | What it does |
|---|---|---|
| **Enable** | `enabled` | This port on or off |
| **Socks Node** | `node` | The config this port goes out through; empty is the one the tunnel is using |
| **Socks Listen Port** | `port` | The port. A new row suggests the next free one from 1090 |

#### Shunt Rule

PassWall2's routing by rules. The rules themselves — which traffic each is
about — and where each one goes are both here, in one table.

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Domain Strategy** | `domainStrategy` | Auto | *AsIs*: only the name is used for routing. *IPIfNonMatch*: when no rule matches the name, it is resolved to addresses and the rules are tried again. *IPOnDemand*: the name is resolved as soon as an address rule is met. Auto picks IPIfNonMatch when a rule or the Iran split has addresses in it, and AsIs otherwise |
| **Domain matcher** | `domainMatcher` | hybrid | Xray's matching engine: *hybrid* is faster, *linear* uses less memory |
| **FakeDNS Main switch** | `shunt_fakedns` | off | Lets the rules below use FakeDNS: their names get made-up addresses and the config looks up the real one at the far end — for streaming services that unlock by DNS, or to save a lookup. The router itself can open those names only with Localhost Proxy on |
| **Shunt Rule Group** | `shunt_group` | default | Only the rules of this group are used. Save and apply for the table to show them |
| **Default** | `default_node` | the config the tunnel is using | Where everything no rule claims goes |
| **Default FakeDNS** | `default_fakedns` | off | Everything the tunnel carries gets made-up addresses — the DNS tab's FakeDNS, and like it, only with lookups sent straight into the tunnel |
| **Default Preproxy** | `default_preproxy` | none | When the Default row goes to a config added by hand, it is reached through this one first |

The table has a row per rule of the chosen group (each row a
`config shunt_rules` section). **Add** makes a new rule, **Edit** opens its
details, **Delete** removes it, and the blue handle changes their order — the
rules are applied in that order. Its columns:

| Column | In the file | What it does |
|---|---|---|
| **Rule** | `remarks` | The rule's name |
| **Node** | `node` | *Close (Not use)*: the rule is ignored. *Use default node*: wherever Default goes. *The config the tunnel is using*, *Direct Connection*, *Blackhole (Block)*, or one of your configs |
| **FakeDNS** | `fakedns` | This rule's names get made-up addresses, when the main switch above is on. Not for a rule going direct or blocked |
| **Preproxy** | `preproxy` | When the rule goes to one of your configs, it is reached through this one first. One layer only: a config with a chain of its own keeps it |

In each rule's edit window, PassWall2's fields:

| Field | In the file | What it does |
|---|---|---|
| **Shunt Rule Group** | `group` | Its group; this tab uses one group at a time. A new rule is made in the chosen group |
| **Protocol** | `protocol` | http, tls, quic, bittorrent — matches only those |
| **Inbound Tag** | `inbound` | Transparent proxy, Socks, or — none ticked — both |
| **Network** | `network` | TCP, UDP or both |
| **Source** | `source` | A device's address, a range, or `geoip:private` |
| **Port** | `port` | Such as `443`, `80,443` or `1000-2000` |
| **Domain** | `domain_list` | One a line: `domain:` a name and everything under it, `full:` that name only, `regexp:`, `keyword:` or a plain word anywhere in the name, `geosite:` a list from the routing data. `#` starts a comment |
| **IP** | `ip_list` | One a line: an address, a range, or `geoip:` and a country code |

Shunt rules steer the tunnel's own traffic — the transparent proxy and the
SOCKS ports without a config of their own. They come after the blocks, the
local network and the direct names, and before the Iran split, so a rule about
one Iranian site is not overruled by the split. A device with a config of its
own on Access Control keeps that config.

#### DNS

PassWall2's DNS tab: a **Direct DNS** for everything that goes straight out, and
a **Remote DNS** for everything that goes through the tunnel.

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Name lookups** | `dns_mode` | Through dnsmasq | *Through dnsmasq* keeps local device names and DHCP names working and moves only the outside lookups into the tunnel. *Straight into the tunnel* resolves outside names and loses the ones on your own network. *Leave alone* does not touch DNS at all |
| **Direct DNS Protocol** | `direct_dns_protocol` | Auto | Direct DNS answers for everything that goes straight out, and for the names of the configs themselves — which can never be looked up through the tunnel they are the way into. Auto uses the router's own upstream, then the ISP's |
| **Direct DNS** | `direct_dns` | — | With UDP or TCP above: the resolver, `1.2.3.4` or `1.2.3.4:53`. Iranian public resolvers are offered; picking one means it sees every name that goes straight out |
| **Direct Query Strategy** | `direct_dns_query_strategy` | UseIPv4 | Which address families to ask the direct resolver for |
| **Remote DNS Protocol** | `remote_dns_protocol` | TCP | TCP, UDP or DoH. TCP is the default because a great many free configs carry no UDP, and a lookup sent as UDP through one of them is simply lost |
| **Remote DNS** | `remote_dns` | 1.1.1.1 | The resolver for TCP or UDP. Cloudflare, Google, Quad9 and OpenDNS are offered |
| **Remote DNS DoH** | `remote_dns_doh` | `https://1.1.1.1/dns-query` | For DoH: an address, or an address and the server's own IP after a comma so its name is never itself a lookup |
| **Remote DNS EDNS Client Subnet** | `remote_dns_client_ip` | — | Tells the DNS server where the client is, so a CDN can answer with an edge near it. Not a private address, and the server must support RFC 7871 |
| **Remote DNS Outbound** | `remote_dns_detour` | Remote | Whether the remote resolver is reached through the tunnel or straight out |
| **FakeDNS** | `remote_fakedns` | off | Answers with made-up addresses and lets the tunnel find the real one at the far end, saving a lookup on every new site. Only with *Straight into the tunnel*: with dnsmasq in front, the router's own lookups would be made up too |
| **Remote Query Strategy** | `remote_dns_query_strategy` | UseIPv4 | Which address families to ask the remote resolver for |
| **Domain Override** | `dns_hosts` | — | One per line: a name, a space, and the address it should resolve to |
| **DNS Redirect** | `dns_hijack` | on | Some devices ignore the router and ask 8.8.8.8 or 1.1.1.1 themselves. Those questions leave without the tunnel, so the answer is whatever the censor wants, and the device connects to it looking perfectly healthy. This drags them back to the router |

#### Log

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Enable Node Log** | `log_node` | on | What the core itself says, shown on Runtime Logs beside this program's own log |
| **Log Level** | `loglevel` | warning | debug, info, warning or error. debug is a great deal of output |

Under them, **Traffic through the tunnel**: today, the last seven days and this
month as rings — the total in the middle, download and upload under it — and
the last fortnight as bars, plus how much went straight out this month. The
figures are read from the core every five minutes and added up in memory; how
often they reach flash is set on Other Settings.

### 📋 4.2 Node List

PassWall2's Node List: which configs are used and how they are measured, the
configs you add by hand, and every config the router has.

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Nodes to use** | `sources` | Only manually added configs | *Only manually added configs*, *All configs*, or *Only the subscriptions*. This decides who may be measured, not who wins: the fastest is used, wherever it came from. A config added by hand joins the list rather than replacing it |
| **Automatic detection delay** | `auto_detection_time` | TCP Ping | When the page opens, each config added by hand is measured this way and the answer put in its column: *Close*, *Ping*, or *TCP Ping* |
| **Show server address and port** | `show_node_info` | off | Shows each config's address and port under its name in the list at the bottom |
| **URL Test Address** | `test_url` | `http://www.gstatic.com/generate_204` | What a real request through a config asks for — when configs are measured and when the URL Test column is pressed |

**Node selection** — this program's own, with no PassWall2 equivalent: how the
fastest config is found when the Node in Basic Settings is Auto (section 5).

| Option | In the file | Default | What it does |
|---|---|---|---|
| **First pass** | `prefilter` | TCP handshake | How it is decided a config is worth measuring properly: a TCP handshake to its real port, a ping, or both. A ping is wrong often enough to matter: a config behind a CDN answers at the edge, and many working ones drop ICMP |
| **Good enough (ms)** | `good_ms` | 1000 | The first config measured faster than this is the one used. Lower means a better config and a longer wait |
| **Measured at a time** | `batch_size` | 10 | How many configs are measured properly in one go |
| **Batches at most** | `max_batches` | 5 | How far down the list to keep going when none is fast enough |
| **Checked at once** | `sift_parallel` | 30 | How many handshakes run at once in the first pass. **Lower it on a router with little RAM** |

**Nodes added manually** — a `config node` section per row. Above the table,
PassWall2's buttons:

| Button | What it does |
|---|---|
| **Add the node via the link** | Paste share links, one per line; each becomes a config of its own, named the way its link names it |
| **Select all / DeSelect all** | Ticks or clears the box on every row |
| **Delete select nodes** | Deletes the ticked configs — never the one the tunnel is using right now |
| **Reassign Group** | Puts the ticked configs in a group |
| **Clear all nodes** | Deletes every config added by hand |

Every setting that named a deleted config — the Node in Basic Settings, a
preproxy, a Socks port, an access rule, a shunt rule — is cleared with it,
rather than left pointing at nothing.

| Column / field | In the file | What it does |
|---|---|---|
| **Name** | `name` | Your name for it. Left empty, the name after the `#` in the link is used, Persian included |
| **Type** | — | What the link is: vless, vmess, trojan, shadowsocks, socks, hysteria2, tuic, wireguard |
| **Group Name** | `group` | For your own order; empty is the default group |
| **Ping / TCPing / URL Test** | — | Three different questions: an ICMP round trip to the address (says nothing about the server behind it); a handshake to the port the tunnel will use; a whole request carried through the config — the only one that proves it works. Each says *Test* until pressed. `✕` is no answer, `—` a test that cannot be run on that config |
| **On** | `enabled` | This config on or off |
| **Share link** (edit window) | `link` | A share link — vless, vmess, trojan, ss, socks, hysteria2, tuic, wireguard — several one per line, or a whole WireGuard `.conf`. **Browse…** puts a file's contents in the box; nothing is uploaded |
| **Chain Proxy** (edit window) | `chain_proxy` | PassWall2's chain: *Preproxy Node* — this config is reached through another; *Landing Node* — traffic goes through this config and leaves from another |
| **Preproxy Node** | `preproxy_node` | The config dialled first |
| **Landing Node** | `to_node` | The config traffic finally leaves from |

Beside **Edit** and **Delete** on each row: **To Top** moves it to the top,
**Use** makes it the Node in Basic Settings and reconnects if the tunnel is on,
**Copy** makes a copy under it.

**WireGuard.** `PrivateKey`, `Address`, `MTU`, `Reserved`, `PublicKey`,
`PresharedKey`, `Endpoint` and `PersistentKeepalive` are read. `AllowedIPs` and
`DNS` are deliberately ignored: routing and name lookups are Zirgozar's own
settings.

**The list at the bottom** — every config the router knows about, measured
first. **TCPing** is filled in for all of them; **URL Test** only for those that
answered, and only until one fast enough was found, so most of that column is
empty by design. **Check every node** runs the handshake for the whole list
without disturbing a tunnel that is carrying traffic; **Use** beside a row
connects through that config.

### 🔗 4.3 Node Subscribe

PassWall2's Node Subscribe. First, for all subscriptions:

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Filter keyword Mode** | `filter_keyword_mode` | Discard List | Configs are kept or dropped by words in their names; a word matches anywhere in the name, exactly as written. *Close*, *Discard List*, *Keep List*, *Discard List, But Keep List First*, *Keep List, But Discard List First* — PassWall2's five modes |
| **Discard List** | `filter_discard_list` | — | The words that drop a config |
| **Keep List** | `filter_keep_list` | — | The words that keep a config |
| **Nodes kept at most** | `max_nodes` | 300 | From all the subscriptions together. A long list takes longer to measure and more memory to hold |
| **Manual subscription All** | — | — | Reads every subscription now |
| **Delete All Subscribe Node** | — | — | Drops what every subscription brought; it comes back the next time they are read |

Then the table, a `config subscription` section per row: **Name**, **Subscribe
Info** (how many configs, what is left of the allowance and when it runs out —
when the provider says — and when it was last read or why it could not be),
**Subscribe URL**, **On**, and per row **Delete the subscribed node** and
**Manual subscription**.

Accepted: a plain list of links, one base64 block, or a whole configuration —
Xray, sing-box (the [sing-box-lx](https://github.com/Leadaxe/sing-box-lx) fork
and its `xhttp` too), Clash JSON or `.yaml`, a hysteria2 `.yaml`, a WireGuard
`.conf`. AmneziaWG is deliberately skipped: Xray cannot speak it.

Each subscription's edit window:

| Tab | Option | In the file | Default | What it does |
|---|---|---|---|---|
| Main | **Name** | `name` | — | Its name; two subscriptions cannot share one |
| Main | **Subscribe URL** | `url` | — | Its address, `http://` or `https://` |
| Main | **Or a file** | `content` | — | Instead of an address: a configuration file. **Browse…** fills it in; leave the address empty |
| Main | **On** | `enabled` | on | This subscription on or off |
| Main | **Subscribe URL Access Method** | `access_mode` | Auto | *Auto*: the way the router's own traffic goes when Localhost Proxy is on; otherwise through the tunnel when it is up, and straight out when it is not. *Direct Connection*, or *Proxy* — through the tunnel's own SOCKS port |
| Main | **User-Agent** | `user_agent` | v2rayN/9.99 | What the request says it is. Some providers answer an unknown client with a page instead of the list |
| Filter keyword Mode | **Filter keyword Mode** | `filter_keyword_mode` | Use global config | This subscription's own filter, or the global one above |
| Filter keyword Mode | **Discard List / Keep List** | `filter_discard_list` / `filter_keep_list` | — | Its own words |
| Auto Update | **Update Once on Boot** | `boot_update` | off | Read once after every boot |
| Auto Update | **Auto Update Mode** | `update_week_mode` | Disable | *Disable*: only when its button is pressed, or once if it has never been read. *Every 15 minutes* — how the default list is read. *Loop Mode*: every so many hours. *Every day*, or one day of the week |
| Auto Update | **Update Time** | `update_time_mode` | 0:00 | The time, for every day or one day of the week |
| Auto Update | **Update Interval(hour)** | `update_interval_mode` | 2 | The hours, for Loop Mode |
| Chain Proxy | **Chain Proxy** | `chain_proxy` | Close | For every config of this subscription: *Preproxy Node* or *Landing Node*. Xray configs only; a hysteria2 or tuic one is left out of a landing chain |
| Chain Proxy | **Preproxy Node** | `preproxy_node` | — | Each config of this subscription is reached through this one |
| Chain Proxy | **Landing Node** | `to_node` | — | Traffic goes through a config of this subscription and leaves from this one |

What a subscription brought is kept on flash as well — written only when it
changed — so a reboot does not lose a list that is read once a week.

### 🧰 4.4 Other Settings

PassWall2's Other Settings, section by section.

**Delay Settings**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Open and close Daemon** | `start_daemon` | on | Every quarter of an hour: bring the tunnel back when it should be up and is not, and move to another config when the one in use carries nothing |
| **Delay Start** | `start_delay` | 1 | Seconds to wait after the router boots before starting |
| **Stop automatically mode** / **Stop Time** | `stop_week_mode` / `stop_time_mode` | Disable / 0:00 | Stop the tunnel every day or on one day of the week, at this time |
| **Start automatically mode** / **Start Time** | `start_week_mode` / `start_time_mode` | Disable / 0:00 | Start it the same way |
| **Restart automatically mode** / **Restart Time** | `restart_week_mode` / `restart_time_mode` | Disable / 0:00 | Restart it the same way — or, with *Loop Mode*, every so many hours |
| **Restart Interval(Hour)** | `restart_interval_mode` | 2 | The hours, for Loop Mode |

The week starts on Saturday. These scheduled jobs are kept only while the Main
switch is on.

**Forwarding Settings**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **TCP No Redir Ports** | `tcp_no_redir_ports` | none | TCP ports that never go through the tunnel — before everything else |
| **UDP No Redir Ports** | `udp_no_redir_ports` | none | The same for UDP |
| **TCP Redir Ports** | `tcp_redir_ports` | All | The TCP ports that do: all, common ones, or only web (80, 443) |
| **UDP Redir Ports** | `udp_redir_ports` | All | The same for UDP |
| **Prefer firewall tools** | `firewall_backend` | Auto | nftables or iptables. Auto is right unless the router has both and the wrong one is picked |
| **TCP Proxy Way** | `tcp_proxy_way` | TPROXY | TPROXY carries TCP and UDP on one port. REDIRECT sends TCP to a port of its own, for a kernel whose TPROXY misbehaves with TCP; UDP is always TPROXY |
| **Hijacking ICMP (PING)** | `accept_icmp` | off | A tunnel carries no ICMP, so a ping to a tunnelled address never comes back. With this on, the router answers it |
| **IPv6** | `ipv6` | Refuse it while connected | Almost no free config carries IPv6, and a client that prefers it leaves without the tunnel while looking fine. Refusing it makes the client fall back to IPv4, which is tunnelled |
| **Interfaces to tunnel** | `lan_zone` | All | Read from this router. Unset, every LAN interface is tunnelled; choose one to pick up traffic from that interface only |
| **Direct IP List** | `direct_ip` | — | Addresses that connect directly and never enter the core |

**Xray Settings**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Fragment** | `fragment` | off | TCP fragments, which can deceive the censor in some cases — getting past an SNI blacklist, for one |
| **Fragment Packets** | `fragment_packets` | tlshello | *tlshello* splits the TLS client hello; *1-3* and the like split at the TCP layer, the client's first writes |
| **Fragment Length** | `fragment_lengths` | 3-5,6-8,10-20 | The length of each piece, in bytes |
| **Fragment Delay** | `fragment_delays` | 10-20 | The gap between pieces, in ms |
| **Max Split** | `fragment_maxSplit` | 3-6 | The most pieces |
| **Noise** | `noise` | off | UDP noise, which gets past some UDP restrictions. Xray sends it on mKCP configs and on xhttp over HTTP/3. The packets are in the table below |
| **Mux** | `mux` | off | Several connections carried in one. Not used on a VLESS flow, xhttp or WireGuard config, where it cannot work |
| **Mux concurrency** | `mux_concurrency` | 8 | Connections per Mux |
| **XUDP Mux concurrency** | `xudp_concurrency` | 16 | The same for UDP |
| **Override the connection destination address** | `sniffing_override_dest` | on | Replace the destination with the name found in the connection. Off, the name is used for routing only |
| **Excluded Domains** | `excluded_domains` | Apple push, Xiaomi, WeChat | A name found in the traffic and in this list does not replace the destination — services that break when their address is replaced |
| **Buffer Size** | `buffer_size` | — | Buffer per connection, in kB. Empty is Xray's own |

**Xray Noise Packets** — a `config xray_noise_packets` section per row:

| Column | In the file | What it does |
|---|---|---|
| **Enable** | `enabled` | This packet on or off |
| **Type** | `type` | rand (a random length), str, hex, base64 or array |
| **Packet \| Rand Length** | `packet` | The packet itself, or for rand its length or range, such as `10-20` |
| **Delay (ms)** | `delay` | The gap after it, in ms, or a range |

**Traffic history**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Traffic: written every (Min)** | `stats_flush_minutes` | 5 | How often the running total reaches flash. What is not yet written is lost if the router loses power; five matches how often the counters are read |
| **Forget all recorded traffic** | — | — | Deletes the recorded usage; counting starts again from zero |

**Router clock** — **Set router clock** sets the router's clock to Iran time.
If the router clock is wrong, secure connections and tunnel connections cannot
be made.

### ⬆️ 4.5 App Update

| Card | What it shows |
|---|---|
| **App Update** | This program's version and whether a newer one is published. **Update to …** downloads the new version from GitHub, checks it against that release's checksums and installs it with the router's own package manager (apk or opkg); the settings are kept, the tunnel comes back if it was on, and the page reloads by itself |
| **Cores** | Xray, sing-box, hysteria and Geoview: what is installed, what each project has published, **Check update**, **Install / Update to …**, **Remove**. An update is only offered for something actually newer. Beside Xray is a list of its recent releases, pre-releases included, with **Install this version**. Of the Xray cores on the router the **newest** is always used; to pin one, put its path in Xray App Path. sing-box and hysteria are only for configs that speak hysteria2 or tuic, which Xray does not; Geoview only for the Geo View page |
| **Router requirements** | One line: everything is ready, or how many things are missing. **Details** opens the questions put to the running system — transparent proxy, policy routing, HTTPS, the firewall in use, missing packages — with **Install them**. They open by themselves when something is missing |

**App Path**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Folder for downloaded cores** | `core_dir` | `/usr/libexec/zirgozar` | Point it at USB storage on a router short of flash. A core another package installed is used where it is and never moved |
| **Xray App Path** | `core_xray` | — | Empty means whichever Xray on this router accepts the configuration, preferring one already installed |
| **Sing-Box App Path** | `core_singbox` | — | The file sing-box is installed, updated and run from. Empty is this program's own copy in the folder above |
| **Hysteria App Path** | `core_hysteria` | — | The same for hysteria |
| **Geoview App Path** | `core_geoview` | — | The same for Geoview |

To run a core from memory, give a path beginning with `/tmp`, save and apply,
and press Install beside it; it has to be installed again after every reboot.

### 🗺️ 4.6 Rule Manage

PassWall2's Rule Manage: the routing data and the shunt rules — then this
program's own Iran split, blocks, rebind list and direct names.

**Rule status**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **GeoIP Update URL** | `geoip_url` | Chocolate4U (IR) | Where `geoip.dat` comes from. The Iranian project first, its lite file, Loyalsoldier, MetaCubeX, runetfreedom |
| **Geosite Update URL** | `geosite_url` | Chocolate4U (IR) | The same for `geosite.dat` |
| **Location of Geo rule files** | `geo_dir` | `/etc/zirgozar/geo` | Where the two files are kept. The full files are about 17 MB and 8 MB; on a router short of flash, point this at USB storage or choose the lite files |
| **Auto Update Mode** | `geo_update_week_mode` | Disable | The ticked files are downloaded again every day, one day of the week, or every so many hours, and the tunnel, if running, restarted to read them |
| **Update Time** | `geo_update_time_mode` | 0:00 | The time |
| **Update Interval(hour)** | `geo_update_interval_mode` | 2 | The hours, for Loop Mode |
| **GeoIP** / **Geosite** | `geoip_update` / `geosite_update` | on | Which files the button below and the automatic update fetch |

**Rule version** shows each file's size and when it was last updated.
**Manually update** fetches the ticked files now; **Remove both** deletes them;
**Rollback** puts back the copy an update replaced — kept in memory, like
PassWall2, until the next reboot or update. A download that will not fit is
refused rather than half written, and a file the core cannot read is never
installed.

The shunt rules are in the **Shunt Rule** tab of Basic Settings.

**This program's own**

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Send Iranian traffic direct** | `route_ir` | off | Iranian sites and addresses skip the tunnel. Needs the routing data above — until then it does nothing, because a core asked for a geo file it has not got refuses to start |
| **Block advertising** | `block_ads` | off | For every device. The names come from `category-ads-all` in the same routing data |
| **Block BitTorrent** | `block_torrent` | on | BitTorrent gets a VPN server blocked and your config cut off for good |
| **Refuse QUIC** | `block_quic` | off | When the config cannot carry UDP, browsers are made to use TCP. Off by default: where UDP works, QUIC is faster |
| **Sites with a rebind weakness** | `rebind_domain` | Iranian banks and services | Some sites answer with a private address — Iranian banks and government services among them. The router's rebind protection refuses those answers and the site does not open; every name here is excused, with everything under it |
| **Direct domains** | `direct_domain` | — | Sites that always go straight out. A name covers everything under it; `full:`, `regexp:`, `keyword:` are accepted as written |

### 🔍 4.7 Geo View

PassWall2's Geo View, with its tool Geoview (install it with the button on the
page, or on App Update).

| Field | What it does |
|---|---|
| **Domain/IP Query** | Which geoip or geosite lists hold a name or an address — and which shunt rules name one of those lists, or it |
| **GeoIP/Geosite Query** | What one list holds: `geosite:ir`, `geoip:ir`, `geosite:google`… The first five thousand lines are shown |

### 🛡️ 4.8 Access Control

PassWall2's Access control: devices with their own way out.

| Option | In the file | Default | What it does |
|---|---|---|---|
| **Main switch** | `acl_enable` | off | The rules below on or off |

A `config acl_rule` section per row:

| Tab | Field | In the file | What it does |
|---|---|---|---|
| Main | **Enable** | `enabled` | This rule on or off |
| Main | **Remarks** | `remarks` | Its name |
| Main | **Source Interface** | `interface` | Only devices on this interface; all by default |
| Main | **Source** | `sources` | The devices: a MAC address, an IP, a range (`192.168.1.50-192.168.1.60`), a network, or `ipset:` and a set's name. Your router's known devices are offered |
| Main | **Mode** | `mode` | *No Proxy*: never through the tunnel. *Proxy* through one config. *Proxy* through the config the tunnel is using |
| Main | **Node** | `node` | For Proxy through one config: one of your configs. A hysteria2 or tuic one cannot have a rule of its own; such a rule uses the tunnel's config |
| Proxy | **TCP / UDP No Redir Ports**, **TCP / UDP Redir Ports** | `tcp_no_redir_ports` … `udp_redir_ports` | The same as Forwarding Settings, for these devices only |

### 📜 4.9 Runtime Logs

PassWall2's Runtime Logs: this program's own log — each start and stop step by
step, which config was chosen and why, what failed — with **Clear logs**, and
under it the **Node log**, what the core itself said. Both refresh every few
seconds. The lines are never translated: it is the router's own log.

---

## 🎯 5. How a config is chosen

You do not need to know this, but if you are curious: choosing happens in **two
passes**, which is why it takes seconds rather than half a minute.

1. **One TCP handshake to every config**, thirty at a time. On a typical list
   this takes about eight seconds and throws out a third to a half of them
   before anything expensive happens. A config that will not complete a
   handshake cannot carry anything.
2. **The survivors, nearest first, ten at a time** — this time a complete web
   request through each one. As soon as one comes back under a second, that is
   the one, and the rest are never run.

The results are kept, so when the chosen config dies later the router takes
the next one down the list rather than starting again.

> **Why a handshake and not a ping.** Most of these configs sit behind
> Cloudflare, where the ping is answered by the CDN edge — which tells you
> nothing about the server itself. Plenty of healthy servers do not answer pings
> at all. So ping keeps configs that do not work and discards configs that do.
> If you want ping anyway, it is **First pass** on Node List.

---

## 📝 6. In the file only

These are not on any page, because changing them is rare and getting them
wrong is quiet.

| Option | Default | What it does |
|---|---|---|
| `tproxy_port` `dns_port` `api_port` `bridge_port` `redir_port` | 1082, 1053, 10853, 10808, 1085 | The ports the tunnel, the resolver, the statistics interface, the protocol helper and REDIRECT listen on |
| `sift_timeout` | 2 s | How long each handshake is given |
| `test_timeout` | 6 s | How long each full request is given |
| `fresh_seconds` | 3600 s | A measurement younger than this is not taken again |
| `https_probe` | a small file on GitHub | What the Dependencies check fetches to prove the router can reach HTTPS |
| `rebind_seeded` | 1 | The Iranian rebind list has been added once and is never added back behind your back |
| `subs_scheduled` | 1 | Set once subscriptions got schedules of their own |

Configs you add by hand and subscriptions are given a name of their own
(`n…`, `s…`) rather than being known by their place in the file, as PassWall2
names its nodes: add, move or delete one and every setting naming another still
names the right one.

> Upgrading from 1.0.x: the old `stats_flush_seconds` is no longer read — use
> `stats_flush_minutes`. `ir_dns` became the Direct DNS, `autostart` the Main
> switch. The default list keeps its quarter-hourly read; any other subscription
> is read on its own schedule from Node Subscribe.

---

## 🛠️ 7. If it does not work

**It says there is no node list yet.** No subscription could be read and you
have no config of your own. Check the subscription on Node Subscribe or — more
reliably — add one of your own configs on Node List. On a censored connection
the subscription address usually will not open until the tunnel is up, and the
tunnel will not come up without a config; one config of your own breaks that
circle.

**It says configs answered but none completed a request.** The configs are
there and something between you and them is stopping the traffic. Press
**Choose again**, and if it says the same thing, change the list.

**It says no config answered at all.** The list has gone stale, or your
connection is blocking all of them. The default list is read every quarter of
an hour and the router repairs itself when the tunnel should be up and is not,
so sometimes the answer is to wait.

**It connects but a site will not open.** First check the Status card really
says **Connected**. If it does:

- If PassWall2 is also running, turn it off.
- Turn on **Refuse QUIC** on Rule Manage. Some configs carry UDP badly and the
  browser gets stuck on QUIC.
- Press **Choose again** to pick a different config.

**Some sites open and some do not.** Usually name resolution. Check that **Name
lookups** in the DNS tab is on *Through dnsmasq*.

**The names of my own devices stopped resolving.** That is exactly what
*Through dnsmasq* prevents; *Straight into the tunnel* has that problem by
design.

**I turned the Iran split on and it seems to do nothing.** If the files are not
downloaded, the Status card says *Iran split is on, but the routing data is
missing* and until then everything goes through the tunnel. Download them on
Rule Manage. If the router has geo files left by another program and they do not
carry the Iranian categories, Zirgozar brings the tunnel up **without** the
split and says so.

**The traffic figures are stuck at zero.** The core is not answering its
statistics interface. Look at Runtime Logs.

### What the Status card can say

The message box in the Status card is only ever for something you have to act
on. The cross in its corner puts it away, and it comes back if the same thing
happens again.

| Message (in short) | What it means | What to do |
|---|---|---|
| PassWall2 is also redirecting traffic | Two transparent proxies on one router | Turn one of them off |
| The routing data on this router is not the pair this expects | Geo files without the Iranian categories. The tunnel came up **without** the split | Update the routing data on Rule Manage |
| Iran routing is on but geoip/geosite are not on the router | The split is on and the files are not downloaded | Manually update on Rule Manage |
| The file that came back is not readable routing data | A wrong address, or an error page. The old file was kept | Check the address on Rule Manage |
| Not enough room in … | Not enough free space for that download | Use the `-lite` files, or free some space |
| Download failed / looks truncated | The address was unreachable or the file arrived half-written | Check the connection and press it again |
| *core* publishes no build for this router's processor | That project has no release for this architecture | That one cannot be installed here |
| The *core* that was downloaded could not be installed | The file arrived but is not for this processor, or is damaged | Try again |
| `unzip` is needed and is not on this router | The archive tool is missing | Install them, on App Update |
| Could not reach GitHub to find out which sing-box is current | This needs a working connection of its own | Connect the tunnel first, then try again |
| This router has neither opkg nor apk | Nothing can be installed automatically | Install by hand |
| These would not install: … | The package names differ on this OpenWrt build | Install by hand |
| This kernel cannot do transparent proxying with nftables/iptables | The tproxy module is missing | Install them, on App Update |
| This router has neither nftables nor iptables | There is no firewall to redirect traffic with | The router image is incomplete |
| Could not find the directory dnsmasq reads its extra configuration from | Names are resolved straight into the tunnel and local device names stop resolving | Usually nothing |
| No node on the list answered at all | The list is stale, or your connection is blocking all of them | Read the subscriptions again, or add a config of your own |
| … answered a handshake, but none could complete a request | The configs are there, the traffic is not getting through | Choose again, or another list |
| Nothing in the list could be read as a node | The subscription's format was not recognised | Check the subscription |
| There is no node list yet | No subscription read and no config of your own | Add one on Node List |
| The chosen node speaks hysteria2/tuic, which Xray cannot | A helper core is needed | Install sing-box or hysteria on App Update |
| The helper for this node's protocol would not start | The helper core did not run | Check Runtime Logs, or pick another config |
| The tunnel process started but never accepted connections | The core ran and never listened | Look at Runtime Logs |
| The node chosen in Basic Settings cannot be read | The config set as Node is broken or gone | Choose another, or set it back to Auto |

**I want to see what is actually happening:**

```sh
logread -e zirgozar
cat /tmp/log/zirgozar.log
/usr/libexec/zgz-rules status
```

The last one says whether the firewall rules really loaded and how much traffic
they have taken.

Support and contact: [t.me/routekernel1](https://t.me/routekernel1)

---

## 🗑️ 8. Uninstall

```sh
/etc/init.d/zirgozar stop
apk del luci-app-zirgozar zirgozar
```

On 24.10 and 23.05 write `opkg remove` instead of `apk del`.

That removes the service, the core and the web pages, and takes the scheduled
jobs out of the router's crontab. Your settings are left behind **on purpose**.
To erase those too, including the routing data, the kept subscriptions and the
traffic history:

```sh
rm -rf /etc/config/zirgozar /etc/zirgozar
```

Nothing else is touched: no firewall zone, no other package's configuration.
The routing rules exist only while the tunnel is up.

---

If you want to know in more detail what was checked, what was wrong and how
each thing was confirmed — and what is still not covered by a test — see
[AUDIT.md](AUDIT.md).

---

## ⚖️ 9. Licence

GNU AGPL, version 3 or any later version (AGPL-3.0-or-later) — the full text is in [LICENSE](LICENSE). Xray-core is licensed by its own authors under MPL-2.0.

If you run a modified version on a router whose web page other people use over the network, the AGPL asks you to offer them the source of that version.

---

## 🙏 10. Thanks

The default config list is the **TOP 100** collection published by
[@Raydikalx](https://t.me/raydikalx), gathered and kept current as free, public
work. The Iranian routing data is
[Chocolate4U/Iran-v2ray-rules](https://github.com/Chocolate4U/Iran-v2ray-rules).
Geo View uses [Geoview](https://github.com/snowie2000/geoview). This project
runs no servers of its own: it measures what those lists offer and picks
whichever answers fastest from where you are. Without them there would be
nothing here to measure. Thank you.
