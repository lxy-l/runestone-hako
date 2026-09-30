# Runestone for Hako / Mihomo

A routing-only post-merge override for **Hako + Mihomo/Clash**.

Runestone deliberately does **not** try to become a universal network-tuning template. Hako (or your client) remains responsible for nodes, DNS/TUN/listeners/controller settings and platform-specific behavior. Runestone rebuilds only:

- `proxy-groups`
- `rule-providers`
- `rules`

It also sets `mode: rule` and enables `profile.store-selected` only when that value was not already configured.

## Why this design

The current Clash configuration guidance recommends keeping profiles simple and auditable, using Rule mode for daily routing, preferring MRS for large `domain`/`ipcidr` providers on iOS, and avoiding unnecessary exposure of LAN listeners or external controllers. It also recommends dedicated Apple Push failover and explicit final routing such as `MATCH,PROXY`.

References:

- https://clash.md/zh/guide/config/best-practice
- https://clash.md/zh/guide/config/
- https://clash.md/zh/guide/config/proxy-groups
- https://clash.md/zh/guide/config/rule-providers
- https://clash.md/zh/guide/config/security
- https://github.com/MetaCubeX/meta-rules-dat

## What is improved compared with Runestone V2/V3

### Compared with V2

- Does not replace DNS, TUN, ports, controller or other network-layer settings.
- Uses MRS rule providers instead of large text/YAML rule lists where practical.
- Adds input validation and broken-reference detection.
- Separates `url-test` (fastest selection) from `fallback` (ordered health failover).

### Compared with V3

- Restores broad regional coverage rather than limiting the region list.
- Restores a real `Global-Fallback` group.
- Keeps Amazon and adds a consistent service-policy layout.
- A region with one node is represented as a one-member `select` group instead of running a meaningless `url-test` against one candidate.
- Preserves original proxy groups that are actually required by a node's `dialer-proxy`, including dependent groups.
- Rejects dangling `dialer-proxy`, missing group members, missing providers and generated-name collisions.
- Uses explicit local CIDR rules before remote rule providers, so LAN routing does not depend entirely on a remote download.

## Generated policy layout

Core groups:

- `🧭 PROXY-Gate` — primary manual entry point.
- `⚡ Global-Auto` — latency-based selection across usable nodes.
- `🛟 Global-Fallback` — health-based regional failover when multiple region groups exist.
- `🖥️ All-Nodes` — manual access to every usable node.
- `🍎 APNs-Fallback` / `🍎 Apple-Push` — Apple Push path independent from normal traffic.

Regional groups are generated only when matching nodes exist, for example:

- `🇭🇰 HK-Auto`
- `🇯🇵 JP-Auto`
- `🇸🇬 SG-Auto`
- `🇺🇸 US-Auto`
- `🇩🇪 DE-Auto`
- `🇦🇺 AU-Auto`

With 2+ candidates the region uses `url-test`. With exactly one candidate it becomes a one-member `select` group.

Service groups:

- AI
- Google
- YouTube
- GitHub
- Telegram
- Netflix
- Spotify
- Microsoft
- Apple
- Amazon
- Pixiv
- LinkedIn

Every service can independently choose `PROXY-Gate`, `Global-Fallback`, a region, an individual node or `DIRECT`.

## Hako usage

1. Add and merge your node sources in Hako.
2. Ensure the merged profile contains real `proxies` before this script executes.
3. Add `JS/Runestone.js` as the **post-merge** override.
4. Do not put private subscription URLs, tokens, UUIDs, passwords or private keys in this repository.
5. After activating the profile, verify:
   - policy groups load correctly;
   - rule providers download successfully;
   - DNS behavior is what you expect;
   - the real exit IP matches the selected policy.

The script intentionally does not hard-code a subscription URL.

## Rules and MRS

Runestone uses the `meta` branch of `MetaCubeX/meta-rules-dat` and requests `.mrs` resources for `domain` and `ipcidr` providers. Examples include AI, Google, GitHub, Telegram, Netflix, China and private-network rules.

MRS is used because it avoids parsing large text/YAML rule lists at runtime, which is especially useful on iOS where the Network Extension has tighter memory constraints.

## DNS and TUN

This repository intentionally does **not** force a DNS or TUN configuration in the Hako override.

Why:

- DNS trust and resolver reachability are environment-specific.
- Hako/Clash on Apple platforms manages parts of TUN, routes and provider storage itself.
- Copying `allow-lan`, `external-controller`, custom listeners or certificate-bypass settings can enlarge the attack surface.

If you need a standalone Mihomo profile instead of a Hako post-merge override, see `examples/minimal-mihomo.yaml` and adapt it deliberately.

## Node naming

Regional classification depends on node names. Recognized examples include country flags, Chinese names, common English names and short country codes such as `HK`, `JP`, `SG`, `US`, `DE`.

Nodes that look like subscription-information entries (`剩余`, `流量`, `到期`, `traffic`, `expire`, etc.) are excluded from generated automatic candidates but remain untouched in the original profile.

## Apple Push

`*.push.apple.com` is routed to `🍎 Apple-Push`, which can choose between `🍎 APNs-Fallback`, `DIRECT` and `PROXY-Gate`. This keeps APNs behavior independent from ordinary web routing.

No health-check URL can prove that Apple Push itself is healthy; the fallback group only measures reachability of its candidates.

## Security

Never commit real:

- subscription/Profile URLs containing tokens;
- passwords;
- UUIDs used as credentials;
- private keys;
- controller `secret` values;
- logs containing personal information.

The sample files use placeholders only.

## Testing

The repository has dependency-free Node tests:

```bash
npm test
```

The tests verify routing-only preservation, region generation, single-node behavior, duplicate-name rejection and `dialer-proxy` dependency preservation.

## License

MIT
