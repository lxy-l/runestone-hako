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
├── Proxy
├── APNs-Fallback
├── CN
├── US
├── JP
├── SG
└── Other
```

Apple Push lists each available region as a direct selection. `APNs-Fallback`
checks the available regions in this order, then tries `DIRECT`:

`CN -> US -> JP -> SG -> Other -> DIRECT`

with Mihomo `fallback` semantics. It is a backup path, not a generic
all-node failover pool.

## Service policies

AI traffic has named service policies plus a fallback for other non-China AI
chat domains:

- Apple AI
- OpenAI
- Anthropic
- Google (including Gemini)

Named service rules precede the generic AI chat fallback, which routes to
`Proxy`.

Other visible service groups are Microsoft, GitHub, Telegram, X, Cloudflare,
Amazon, TikTok, Disney+, Spotify, Meta, Emby, YouTube, Netflix, HBO,
PrimeVideo, Bahamut, BiliIntl, Bilibili and Steam.

Service groups keep service-specific target choices and also include `CN`
whenever the `CN` region group exists.

## Rule ordering

Specific services must precede broader overlapping rules:

1. private/LAN
2. Apple Push and Apple AI exceptions
3. general Apple
4. OpenAI / Anthropic
5. YouTube / Google
6. GitHub / Telegram / X / Cloudflare
7. streaming services
8. Amazon / TikTok / Meta / Steam
9. Microsoft
10. BiliIntl / Bilibili
11. generic AI chat fallback
12. CN direct rules
13. `MATCH,Final`

Important guarantees:

- Apple Push before Apple
- Apple AI exceptions and Apple Intelligence before general Apple
- YouTube before Google
- PrimeVideo before Amazon
- BiliIntl before Bilibili and CN direct rules
- Named AI services before generic AI chat fallback

## Rule providers

MRS from MetaCubeX/meta-rules-dat is preferred for domain/ipcidr providers.

Emby uses a small self-hosted classical rule file to retain domain-keyword
matching for self-hosted servers. MetaCubeX now also provides
`category-emby.mrs`, which can supplement the local rules if its domain coverage
fits the deployment.

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
PNG generation keeps a square canvas and scales artwork proportionally within
it. Apple AI and Microsoft icons use a 288×288 canvas at twice the default
144×144 resolution.

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
