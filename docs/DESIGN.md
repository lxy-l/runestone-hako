# Runestone v2 design

## Scope

Runestone is a routing-only Hako/Mihomo post-merge transform.

The incoming profile remains authoritative for DNS, TUN, listeners, controller,
proxy providers and real proxy nodes. Runestone rebuilds only policy groups,
rule providers and routing rules.

## Core groups

### Proxy

`Proxy` is the normal manual proxy selector. It exposes only regions that
actually exist in the merged node set, plus `DIRECT`.

Preferred order:

`US -> JP -> SG -> CN -> Other -> DIRECT`

There is no separate global automatic-selection group.

### Final

`Final` is independent from `Proxy` and receives only unmatched traffic:

`MATCH,Final`

This keeps catch-all behavior independently controllable.

## Regions

Only five visible regions are generated:

- `CN` — mainland China, Hong Kong and Taiwan nodes
- `US`
- `JP`
- `SG`
- `Other`

Every node not recognized as CN/US/JP/SG enters `Other`.

Two or more nodes in a region use `url-test`; one node uses a one-member
`select` group.

## Apple Push

APNs remains independently controllable:

```text
*.push.apple.com
        ↓
Apple Push
├── DIRECT
├── APNs-Fallback
└── Proxy
```

`APNs-Fallback` is intentionally small and uses:

`JP -> SG -> US`

with Mihomo `fallback` semantics. It is a backup path, not a generic
all-node failover pool.

## Service policies

The generic AI policy is removed. AI traffic is divided into:

- OpenAI
- Anthropic
- Google (including Gemini)

Other visible service groups are Microsoft, GitHub, Telegram, X, Cloudflare,
Amazon, TikTok, Disney+, Spotify, Meta, Emby, YouTube, Netflix, HBO,
PrimeVideo, Bahamut, Bilibili and Steam.

Service groups intentionally have different target choices instead of sharing
one oversized template.

## Rule ordering

Specific services must precede broader overlapping rules:

1. private/LAN
2. Apple Push
3. OpenAI / Anthropic
4. YouTube / Google
5. GitHub / Telegram / X / Cloudflare
6. streaming services
7. Amazon / TikTok / Meta / Steam
8. Apple / Microsoft
9. Bilibili
10. CN direct rules
11. `MATCH,Final`

Important guarantees:

- Apple Push before Apple
- YouTube before Google
- PrimeVideo before Amazon
- Bilibili before CN direct rules

## Rule providers

MRS from MetaCubeX/meta-rules-dat is preferred for domain/ipcidr providers.

Emby currently uses a small self-hosted classical rule file because there is no
suitable MetaCubeX MRS category for the desired policy.

## SVG icons

Every generated visible group has a self-hosted SVG icon under
`assets/icons/`.

Functional icons use Lucide:

- Proxy — waypoints
- Final — fish-symbol
- Other — globe
- Apple Push — bell-ring
- APNs-Fallback — refresh-cw

Region flags use flag-icons. Brand icons are self-hosted copies from the
approved upstream SVG sources documented in `assets/icons/README.md`.

## Preserving dialer-proxy dependencies

Original groups are not blindly retained. Runestone computes the dependency
closure of groups referenced by proxy `dialer-proxy` fields and preserves only
those required groups.

Dangling references fail generation instead of producing a silently broken
profile.

## Validation

Runestone validates:

- non-empty merged proxies
- duplicate proxy names
- generated group-name collisions
- preserved-group collisions
- dangling `dialer-proxy`
- missing group members
- missing rule providers
- missing rule targets

## Security

No subscription URLs, tokens, UUID credentials, controller secrets or private
keys belong in this repository.

## References

- https://clash.md/zh/guide/config/best-practice
- https://clash.md/zh/guide/config/
- https://github.com/MetaCubeX/meta-rules-dat
