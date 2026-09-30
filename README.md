# Runestone for Hako / Mihomo

Routing-only post-merge override for **Hako + Mihomo/Clash**.

Runestone keeps the incoming network layer intact and rebuilds only:

- `proxy-groups`
- `rule-providers`
- `rules`

## v2 policy model

### Core

- `Proxy` — normal proxy-region selector
- `Final` — dedicated catch-all group used by `MATCH`

### Regions

- `CN` — mainland China + Hong Kong + Taiwan nodes
- `US`
- `JP`
- `SG`
- `Other`

A region with 2+ nodes uses `url-test`; a one-node region becomes a one-member `select`.

There is no separate Global-Auto, Global-Fallback, All-Nodes or PROXY-Gate group.

### Apple Push

`*.push.apple.com` is routed independently:

```text
Apple Push
├── DIRECT
├── APNs-Fallback
└── Proxy
```

`APNs-Fallback` prefers `JP -> SG -> US` and uses Mihomo `fallback`.

### Services

- Apple
- Google
- Microsoft
- OpenAI
- Anthropic
- GitHub
- Telegram
- X
- Cloudflare
- Amazon
- TikTok
- Disney+
- Spotify
- Meta
- Emby
- YouTube
- Netflix
- HBO
- PrimeVideo
- Bahamut
- Bilibili
- Steam

Gemini stays inside the Google policy rather than creating another visible group.

## Rules

Most service rules use MRS files from MetaCubeX/meta-rules-dat.

Emby is the only current supplementary rule hosted in this repository:

`rules/emby.yaml`

Important ordering guarantees:

- Apple Push before Apple
- YouTube before Google
- PrimeVideo before Amazon
- Bilibili before CN direct rules
- `MATCH,Final`

## SVG icons

All visible generated groups use SVG icons served from this repository:

`assets/icons/`

Notable functional icons:

- Proxy: Lucide `waypoints.svg`
- Final: Lucide `fish-symbol.svg`
- Apple Push: Lucide `bell-ring.svg`
- APNs-Fallback: Lucide `refresh-cw.svg`
- Other: Lucide `globe.svg`

Region flags use flag-icons. Brand SVGs primarily come from Dashboard Icons, with Anthropic from Simple Icons and Bahamut from the approved SVG source. See `assets/icons/README.md`.

## Hako usage

Use the post-merge script:

```text
https://raw.githubusercontent.com/lxy-l/runestone-hako/main/JS/Runestone.js
```

For a stable release, pin the tag instead of `main`, for example:

```text
https://raw.githubusercontent.com/lxy-l/runestone-hako/v2.0.0/JS/Runestone.js
```

## Security

Never commit real subscription URLs, tokens, UUID credentials, private keys, controller secrets or private logs.

## Test

```bash
npm test
npm run check
```

## References

- https://clash.md/zh/guide/config/best-practice
- https://clash.md/zh/guide/config/
- https://github.com/MetaCubeX/meta-rules-dat

## License

MIT
