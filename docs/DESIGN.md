# Design notes

## Scope

Runestone is a **routing-only post-merge transform** for Hako/Mihomo. Its job is
not to replace the whole profile. The incoming profile remains authoritative
for platform-sensitive settings such as DNS, TUN, listeners, controller,
proxy providers and the actual proxy nodes.

Runestone changes only the parts needed to provide a consistent routing model:

- `mode` (forced to `rule`)
- `profile.store-selected` (enabled only when missing)
- `proxy-groups`
- `rule-providers`
- `rules`

## Why routing-only

The Clash configuration guide recommends starting from a configuration whose
behavior is understood, avoiding unnecessary optimization layers, and not
copying LAN/controller/TUN settings without a concrete reason. Apple platforms
also manage parts of DNS/TUN/provider storage at the app boundary.

A Hako post-merge script therefore has a useful separation of responsibilities:

1. Hako merges node sources and owns platform/network settings.
2. Runestone classifies the already-merged nodes.
3. Runestone generates policy groups and routing rules.
4. Mihomo evaluates those rules at runtime.

## Policy hierarchy

### Manual and automatic entry points

- `🧭 PROXY-Gate`: normal manual entry point.
- `⚡ Global-Auto`: latency-based `url-test` across usable nodes.
- `🛟 Global-Fallback`: ordered health failover across available regional groups.
- `🖥️ All-Nodes`: manual per-node selection.

`url-test` and `fallback` are not interchangeable. `url-test` chooses a fast
candidate. `fallback` walks candidates in order and keeps the first healthy one.

### Regional groups

A region is created only when at least one matching node exists.

- one node: `select` with one member (no pointless health race);
- two or more: `url-test` with lazy checks.

The region list is intentionally explicit so the matching rules can be audited.

### Apple Push

Apple Push is intentionally separated from the normal proxy gate:

`*.push.apple.com -> 🍎 Apple-Push -> 🍎 APNs-Fallback / DIRECT / 🧭 PROXY-Gate`

The fallback health check tests candidate reachability. It cannot prove that the
APNs service itself is healthy.

## Rule providers

Large `domain` and `ipcidr` providers use Mihomo MRS resources when available.
MRS reduces parsing work and is particularly useful on iOS where the Network
Extension has tighter memory constraints.

Rules are ordered from specific to broad:

1. literal private/LAN ranges;
2. Apple Push;
3. explicit service providers;
4. broad non-CN geography;
5. CN direct rules;
6. final `MATCH` to the proxy gate.

Literal private CIDRs are retained even though a remote private rule provider
also exists. LAN access should not depend entirely on the availability of a
remote rule download.

## Preserving dialer-proxy dependencies

Hako profiles may contain chained nodes whose `dialer-proxy` points at an
existing proxy group. Replacing every original group would leave those nodes
with dangling references.

Runestone scans every node for `dialer-proxy`, recursively follows referenced
original groups, and preserves only that dependency closure. Unrelated original
groups are discarded so the generated policy layout remains deterministic.

## Validation

Runestone fails instead of silently emitting ambiguous configuration when it
finds:

- invalid or empty proxy input;
- duplicate proxy names;
- duplicate required original group names;
- generated group-name collisions;
- dangling `dialer-proxy` references;
- missing proxy-group members;
- missing proxy providers referenced by preserved groups;
- rules targeting groups that do not exist.

This is deliberate: a visible merge error is preferable to a profile that
activates but routes traffic differently from what the user expects.

## Security boundary

The repository contains no real provider/Profile URLs, tokens, passwords,
UUID credentials, private keys, logs or controller secrets. Subscription URLs
should be treated as credentials and kept out of screenshots, issues and public
commits.

## References

- https://clash.md/zh/guide/config/best-practice
- https://clash.md/zh/guide/config/
- https://github.com/MetaCubeX/meta-rules-dat
