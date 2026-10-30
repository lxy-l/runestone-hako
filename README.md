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
├── Proxy
├── APNs-Fallback
├── CN
├── US
├── JP
├── SG
└── Other
```

Apple Push also lists each available region for direct selection. `APNs-Fallback` checks
`CN -> US -> JP -> SG -> Other -> DIRECT` in order and uses Mihomo `fallback`.

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

## Icons

All visible generated groups use 144×144 transparent PNG icons generated proportionally from the SVG source files in this repository and delivered through GitHub raw:

`assets/icons/png/`

Notable functional icons:

- Proxy: Lucide `waypoints.svg`
- Final: Lucide `fish-symbol.svg`
- Apple Push: Lucide `bell-ring.svg`
- APNs-Fallback: Lucide `refresh-cw.svg`
- Other: Lucide `globe.svg`

Region flags use flag-icons. Brand SVGs primarily come from Dashboard Icons, with Anthropic from Simple Icons and Bahamut from the approved SVG source. SVG source files remain in `assets/icons/`; PNG files are generated into `assets/icons/png/`. See `assets/icons/README.md`.

## Hako usage

Use the post-merge script:

```text
https://raw.githubusercontent.com/lxy-l/runestone-hako/main/JS/Runestone.js
```

## Clash Verge Rev usage

Use the Clash Verge Rev compatible script in the target subscription's **Extended Script**:

```text
https://raw.githubusercontent.com/lxy-l/runestone-hako/main/JS/Runestone.ClashVerge.js
```

It provides the same groups, rules, rule-providers, icons and reference checks as `JS/Runestone.js`. It supports both inline `proxies` and subscription nodes supplied through `proxy-providers`. For provider-based subscriptions, regional groups use Mihomo provider filters, so they appear as selectable groups even though JavaScript cannot inspect the provider's remote node list while the script runs.

For a stable release, pin the tag instead of `main`, for example:

```text
https://raw.githubusercontent.com/lxy-l/runestone-hako/v20261030.101503597.0/JS/Runestone.js
```

## Security

Never commit real subscription URLs, tokens, UUID credentials, private keys, controller secrets or private logs.

## Test

```bash
npm test
npm run check
```

## Version

The pre-commit hook updates the version to an Asia/Shanghai timestamp in
`YYYYMMDD.HHmmssSSS.0` format and synchronizes `package.json`, both script
headers, and the pinned README URL. Enable the hook once per checkout with
`git config core.hooksPath .githooks`. Run `npm run version:auto` to update it
manually; on Windows without Node installed, run
`powershell -NoProfile -ExecutionPolicy Bypass -File scripts/update-version.ps1`.

## References

- https://clash.md/zh/guide/config/best-practice
- https://clash.md/zh/guide/config/
- https://github.com/MetaCubeX/meta-rules-dat

## License

MIT
