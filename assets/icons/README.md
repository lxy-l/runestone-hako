# Icon sources and Hako PNG assets

SVG files are the source artwork. GitHub Actions generates PNG files under `assets/icons/png/` for Hako compatibility. Artwork is scaled proportionally and centered on the square canvas; Apple Intelligence and Microsoft are 288×288, while the other icons are 144×144.

| Files | Source |
|---|---|
| waypoints.svg, fish-symbol.svg, globe.svg, bell-ring.svg, refresh-cw.svg | Lucide |
| cn.svg, us.svg, jp.svg, sg.svg | flag-icons |
| apple.svg, google.svg, microsoft.svg, openai.svg, github.svg, telegram.svg, x.svg, cloudflare.svg, amazon.svg, tiktok.svg, disney-plus.svg, spotify.svg, meta.svg, emby.svg, youtube.svg, netflix.svg, hbo.svg, prime-video.svg, bilibili.svg, steam.svg | Homarr Dashboard Icons |
| apple-intelligence.svg | Apple Newsroom official Apple Intelligence icon, cropped from the published image asset |
| anthropic.svg | Simple Icons |
| bahamut.svg | approved Bahamut SVG source used by the project |

The generated PNG files are derived from the SVG sources and are not edited independently. Apple Intelligence and Microsoft PNGs are generated at 288×288; the other icons use 144×144. The Microsoft SVG uses the Dashboard Icons four-color mark on a transparent canvas. `microsoft-transparent.png` is an alias used to avoid stale client caches while preserving the existing `microsoft.png` URL. Upstream projects retain their own licenses and brand/trademark terms. Brand marks remain subject to their respective trademark policies.

Sources:

- https://github.com/lucide-icons/lucide
- https://github.com/lipis/flag-icons
- https://github.com/homarr-labs/dashboard-icons
- https://github.com/simple-icons/simple-icons
- https://www.apple.com.cn/newsroom/2024/06/ios-18-makes-iphone-more-personal-capable-and-intelligent-than-ever/
