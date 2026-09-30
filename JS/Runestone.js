"use strict";

const SETTINGS = Object.freeze({
  testUrl: "https://www.gstatic.com/generate_204",
  testInterval: 300,
  testTimeout: 5000,
  testTolerance: 50,
  ruleInterval: 86400,
});

const REPO_RAW = "https://raw.githubusercontent.com/lxy-l/runestone-hako/main";
const ICON_BASE = "https://cdn.jsdelivr.net/gh/lxy-l/runestone-hako@main/assets/icons/png";
const RULE_BASE = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta";

const GROUP = Object.freeze({
  proxy: "Proxy",
  final: "Final",
  applePush: "Apple Push",
  apnsFallback: "APNs-Fallback",
});

const REGION_ORDER = Object.freeze(["CN", "US", "JP", "SG", "Other"]);

const REGIONS = Object.freeze([
  {
    id: "CN",
    re: /(?:🇨🇳|🇭🇰|🇹🇼|中国|中國|大陆|大陸|香港|台湾|台灣|China|Hong\s*Kong|Taiwan|\bCN\b|\bHK\b|\bTW\b)/i,
  },
  {
    id: "US",
    re: /(?:🇺🇸|美国|美國|United\s*States|America|\bUSA?\b)/i,
  },
  {
    id: "JP",
    re: /(?:🇯🇵|日本|Japan|Tokyo|Osaka|\bJP\b)/i,
  },
  {
    id: "SG",
    re: /(?:🇸🇬|新加坡|Singapore|\bSG\b)/i,
  },
]);

const ICONS = Object.freeze({
  Proxy: "waypoints.png",
  Final: "fish-symbol.png",
  CN: "cn.png",
  US: "us.png",
  JP: "jp.png",
  SG: "sg.png",
  Other: "globe.png",
  Apple: "apple.png",
  "Apple Push": "bell-ring.png",
  "APNs-Fallback": "refresh-cw.png",
  Google: "google.png",
  Microsoft: "microsoft.png",
  OpenAI: "openai.png",
  Anthropic: "anthropic.png",
  GitHub: "github.png",
  Telegram: "telegram.png",
  X: "x.png",
  Cloudflare: "cloudflare.png",
  Amazon: "amazon.png",
  TikTok: "tiktok.png",
  "Disney+": "disney-plus.png",
  Spotify: "spotify.png",
  Meta: "meta.png",
  Emby: "emby.png",
  YouTube: "youtube.png",
  Netflix: "netflix.png",
  HBO: "hbo.png",
  PrimeVideo: "prime-video.png",
  Bahamut: "bahamut.png",
  Bilibili: "bilibili.png",
  Steam: "steam.png",
});

const SERVICE_DEFS = Object.freeze([
  { name: "Apple", targets: ["DIRECT", GROUP.proxy, "US", "JP", "SG"] },
  { name: "Google", targets: [GROUP.proxy, "US", "JP", "SG", "DIRECT"] },
  { name: "Microsoft", targets: ["DIRECT", GROUP.proxy, "US", "JP"] },
  { name: "OpenAI", targets: ["US", "JP", "SG", GROUP.proxy] },
  { name: "Anthropic", targets: ["US", "JP", "SG", GROUP.proxy] },
  { name: "GitHub", targets: [GROUP.proxy, "US", "JP", "SG", "DIRECT"] },
  { name: "Telegram", targets: [GROUP.proxy, "SG", "US", "JP", "Other"] },
  { name: "X", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "Cloudflare", targets: [GROUP.proxy, "DIRECT", "US", "JP", "SG"] },
  { name: "Amazon", targets: [GROUP.proxy, "US", "JP", "SG", "DIRECT"] },
  { name: "TikTok", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "Disney+", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "Spotify", targets: [GROUP.proxy, "US", "JP", "SG", "DIRECT"] },
  { name: "Meta", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "Emby", targets: [GROUP.proxy, "DIRECT", "US", "JP", "SG", "Other"] },
  { name: "YouTube", targets: [GROUP.proxy, "US", "JP", "SG", "CN"] },
  { name: "Netflix", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "HBO", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "PrimeVideo", targets: [GROUP.proxy, "US", "JP", "SG", "Other"] },
  { name: "Bahamut", targets: ["CN", "JP", "SG", GROUP.proxy] },
  { name: "Bilibili", targets: ["DIRECT", "CN", GROUP.proxy] },
  { name: "Steam", targets: ["DIRECT", GROUP.proxy, "US", "JP", "SG"] },
]);

const BUILTIN_OUTBOUNDS = new Set([
  "DIRECT",
  "REJECT",
  "REJECT-DROP",
  "PASS",
  "COMPATIBLE",
]);

const INFO_NODE_RE = /(?:剩余|流量|套餐|到期|过期|官网|网站|订阅|客服|traffic|expire|quota|reset)/i;

function main(config) {
  assertPlainObject(config, "config");

  const fixed = { ...config };
  fixed.mode = "rule";
  fixed.profile = isPlainObject(config.profile) ? { ...config.profile } : {};
  if (fixed.profile["store-selected"] === undefined) {
    fixed.profile["store-selected"] = true;
  }

  const proxies = normalizeProxies(config.proxies);
  const proxyNames = proxies.map((proxy) => proxy.name);
  assertUnique(proxyNames, "proxy node");

  const candidates = proxyNames.filter((name) => !INFO_NODE_RE.test(name));
  const usableNames = candidates.length > 0 ? candidates : proxyNames;

  const originalGroups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"].filter(isPlainObject)
    : [];

  const preservedGroups = collectDialerProxyDependencies(
    proxies,
    originalGroups,
    new Set(proxyNames),
  );

  const regionGroups = buildRegionGroups(usableNames);
  const generatedGroups = buildGeneratedGroups(regionGroups);

  validateGeneratedNames({
    proxyNames,
    preservedGroups,
    generatedGroups,
    providerNames: Object.keys(
      isPlainObject(config["proxy-providers"]) ? config["proxy-providers"] : {},
    ),
  });

  fixed["proxy-groups"] = [...preservedGroups, ...generatedGroups];
  fixed["rule-providers"] = buildRuleProviders();
  fixed.rules = buildRules();

  validateDialerProxyReferences(proxies, fixed["proxy-groups"], proxyNames);
  validateGroupReferences(fixed["proxy-groups"], proxyNames, config["proxy-providers"]);
  validateRules(fixed.rules, fixed["proxy-groups"], fixed["rule-providers"]);

  return fixed;
}

function buildRegionGroups(proxyNames) {
  const buckets = Object.fromEntries(REGION_ORDER.map((name) => [name, []]));

  for (const proxyName of proxyNames) {
    const matched = REGIONS.find((region) => region.re.test(proxyName));
    buckets[matched ? matched.id : "Other"].push(proxyName);
  }

  return REGION_ORDER.flatMap((name) => {
    const members = buckets[name];
    if (members.length === 0) return [];
    return [makeRegionGroup(name, members)];
  });
}

function makeRegionGroup(name, proxies) {
  if (proxies.length === 1) {
    return {
      name,
      type: "select",
      proxies: [...proxies],
      icon: icon(name),
    };
  }

  return {
    name,
    type: "url-test",
    proxies: [...proxies],
    url: SETTINGS.testUrl,
    interval: SETTINGS.testInterval,
    timeout: SETTINGS.testTimeout,
    tolerance: SETTINGS.testTolerance,
    lazy: true,
    icon: icon(name),
  };
}

function buildGeneratedGroups(regionGroups) {
  const availableRegions = regionGroups.map((group) => group.name);
  const availableSet = new Set(availableRegions);

  const proxyGroup = {
    name: GROUP.proxy,
    type: "select",
    proxies: filterTargets(["US", "JP", "SG", "CN", "Other", "DIRECT"], availableSet),
    icon: icon(GROUP.proxy),
  };

  const finalGroup = {
    name: GROUP.final,
    type: "select",
    proxies: filterTargets([GROUP.proxy, "DIRECT", "CN", "US", "JP", "SG", "Other"], availableSet),
    icon: icon(GROUP.final),
  };

  const apnsTargets = filterTargets(["JP", "SG", "US"], availableSet);
  const apnsFallback = makeFallbackGroup(
    GROUP.apnsFallback,
    apnsTargets.length > 0 ? apnsTargets : [GROUP.proxy],
  );

  const applePush = {
    name: GROUP.applePush,
    type: "select",
    proxies: ["DIRECT", GROUP.apnsFallback, GROUP.proxy],
    icon: icon(GROUP.applePush),
  };

  const services = SERVICE_DEFS.map((service) => ({
    name: service.name,
    type: "select",
    proxies: filterTargets(service.targets, availableSet),
    icon: icon(service.name),
  }));

  return [
    proxyGroup,
    finalGroup,
    ...regionGroups,
    apnsFallback,
    applePush,
    ...services,
  ];
}

function makeFallbackGroup(name, proxies) {
  if (proxies.length === 1) {
    return {
      name,
      type: "select",
      proxies: [...proxies],
      icon: icon(name),
    };
  }

  return {
    name,
    type: "fallback",
    proxies: [...proxies],
    url: SETTINGS.testUrl,
    interval: SETTINGS.testInterval,
    timeout: SETTINGS.testTimeout,
    lazy: true,
    icon: icon(name),
  };
}

function buildRuleProviders() {
  const domain = (file) => ({
    type: "http",
    behavior: "domain",
    format: "mrs",
    interval: SETTINGS.ruleInterval,
    url: `${RULE_BASE}/geo/geosite/${file}.mrs`,
  });

  const ip = (file) => ({
    type: "http",
    behavior: "ipcidr",
    format: "mrs",
    interval: SETTINGS.ruleInterval,
    url: `${RULE_BASE}/geo/geoip/${file}.mrs`,
  });

  const classical = (url) => ({
    type: "http",
    behavior: "classical",
    format: "yaml",
    interval: SETTINGS.ruleInterval,
    url,
  });

  return {
    RS_PrivateDomain: domain("private"),
    RS_PrivateIP: ip("private"),
    RS_Apple: domain("apple"),
    RS_Google: domain("google"),
    RS_Microsoft: domain("microsoft"),
    RS_OpenAI: domain("openai"),
    RS_Anthropic: domain("anthropic"),
    RS_GitHub: domain("github"),
    RS_Telegram: domain("telegram"),
    RS_TelegramIP: ip("telegram"),
    RS_X: domain("twitter"),
    RS_Cloudflare: domain("cloudflare"),
    RS_Amazon: domain("amazon"),
    RS_TikTok: domain("tiktok"),
    RS_Disney: domain("disney"),
    RS_Spotify: domain("spotify"),
    RS_Meta: domain("meta"),
    RS_Emby: classical(`${REPO_RAW}/rules/emby.yaml`),
    RS_YouTube: domain("youtube"),
    RS_Netflix: domain("netflix"),
    RS_NetflixIP: ip("netflix"),
    RS_HBO: domain("hbo"),
    RS_PrimeVideo: domain("primevideo"),
    RS_Bahamut: domain("bahamut"),
    RS_Bilibili: domain("bilibili"),
    RS_Steam: domain("steam"),
    RS_CNDomain: domain("cn"),
    RS_CNIP: ip("cn"),
  };
}

function buildRules() {
  return [
    "IP-CIDR,10.0.0.0/8,DIRECT,no-resolve",
    "IP-CIDR,172.16.0.0/12,DIRECT,no-resolve",
    "IP-CIDR,192.168.0.0/16,DIRECT,no-resolve",
    "IP-CIDR,100.64.0.0/10,DIRECT,no-resolve",
    "IP-CIDR6,fc00::/7,DIRECT,no-resolve",
    "IP-CIDR6,fe80::/10,DIRECT,no-resolve",
    "DOMAIN-SUFFIX,lan,DIRECT",
    "DOMAIN-SUFFIX,local,DIRECT",
    "RULE-SET,RS_PrivateDomain,DIRECT",
    "RULE-SET,RS_PrivateIP,DIRECT,no-resolve",

    "DOMAIN-SUFFIX,push.apple.com,Apple Push",

    "RULE-SET,RS_OpenAI,OpenAI",
    "RULE-SET,RS_Anthropic,Anthropic",

    "RULE-SET,RS_YouTube,YouTube",
    "RULE-SET,RS_Google,Google",

    "RULE-SET,RS_GitHub,GitHub",
    "RULE-SET,RS_Telegram,Telegram",
    "RULE-SET,RS_TelegramIP,Telegram,no-resolve",
    "RULE-SET,RS_X,X",
    "RULE-SET,RS_Cloudflare,Cloudflare",

    "RULE-SET,RS_Netflix,Netflix",
    "RULE-SET,RS_NetflixIP,Netflix,no-resolve",
    "RULE-SET,RS_Disney,Disney+",
    "RULE-SET,RS_HBO,HBO",
    "RULE-SET,RS_PrimeVideo,PrimeVideo",
    "RULE-SET,RS_Spotify,Spotify",
    "RULE-SET,RS_Emby,Emby",
    "RULE-SET,RS_Bahamut,Bahamut",

    "RULE-SET,RS_Amazon,Amazon",
    "RULE-SET,RS_TikTok,TikTok",
    "RULE-SET,RS_Meta,Meta",
    "RULE-SET,RS_Steam,Steam",

    "RULE-SET,RS_Apple,Apple",
    "RULE-SET,RS_Microsoft,Microsoft",

    "RULE-SET,RS_Bilibili,Bilibili",

    "RULE-SET,RS_CNDomain,DIRECT",
    "RULE-SET,RS_CNIP,DIRECT,no-resolve",

    `MATCH,${GROUP.final}`,
  ];
}

function filterTargets(targets, availableRegions) {
  return dedupe(targets.filter((target) => {
    if (REGION_ORDER.includes(target)) return availableRegions.has(target);
    return true;
  }));
}

function icon(name) {
  const file = ICONS[name];
  if (!file) throw new Error(`No icon configured for proxy-group: ${name}`);
  return `${ICON_BASE}/${file}`;
}

function collectDialerProxyDependencies(proxies, originalGroups, proxyNameSet) {
  const groupMap = new Map();
  for (const group of originalGroups) {
    if (typeof group.name === "string" && group.name.trim()) {
      if (groupMap.has(group.name)) {
        throw new Error(`Duplicate original proxy-group name: ${group.name}`);
      }
      groupMap.set(group.name, group);
    }
  }

  const required = new Set();
  const queue = [];

  for (const proxy of proxies) {
    const ref = proxy["dialer-proxy"];
    if (typeof ref === "string" && ref && groupMap.has(ref)) queue.push(ref);
  }

  while (queue.length > 0) {
    const name = queue.shift();
    if (required.has(name)) continue;
    required.add(name);

    const group = groupMap.get(name);
    if (!group) continue;

    for (const member of Array.isArray(group.proxies) ? group.proxies : []) {
      if (
        typeof member === "string" &&
        !proxyNameSet.has(member) &&
        !BUILTIN_OUTBOUNDS.has(member) &&
        groupMap.has(member) &&
        !required.has(member)
      ) {
        queue.push(member);
      }
    }
  }

  return originalGroups.filter((group) => required.has(group.name));
}

function validateGeneratedNames({
  proxyNames,
  preservedGroups,
  generatedGroups,
  providerNames,
}) {
  const proxySet = new Set(proxyNames);
  const providerSet = new Set(providerNames);
  const preservedSet = new Set(preservedGroups.map((group) => group.name));
  const generatedNames = generatedGroups.map((group) => group.name);

  assertUnique(generatedNames, "generated proxy-group");

  for (const name of generatedNames) {
    if (proxySet.has(name)) {
      throw new Error(`Generated proxy-group conflicts with proxy node: ${name}`);
    }
    if (preservedSet.has(name)) {
      throw new Error(`Generated proxy-group conflicts with required original group: ${name}`);
    }
    if (providerSet.has(name)) {
      throw new Error(`Generated proxy-group conflicts with proxy-provider: ${name}`);
    }
  }
}

function validateDialerProxyReferences(proxies, groups, proxyNames) {
  const valid = new Set([
    ...proxyNames,
    ...groups.map((group) => group.name),
    ...BUILTIN_OUTBOUNDS,
  ]);

  for (const proxy of proxies) {
    const ref = proxy["dialer-proxy"];
    if (typeof ref === "string" && ref && !valid.has(ref)) {
      throw new Error(
        `Proxy ${JSON.stringify(proxy.name)} has dangling dialer-proxy reference: ${JSON.stringify(ref)}`,
      );
    }
  }
}

function validateGroupReferences(groups, proxyNames, proxyProviders) {
  const groupNames = new Set(groups.map((group) => group.name));
  const validProxyTargets = new Set([
    ...proxyNames,
    ...groupNames,
    ...BUILTIN_OUTBOUNDS,
  ]);
  const providerNames = new Set(
    Object.keys(isPlainObject(proxyProviders) ? proxyProviders : {}),
  );

  for (const group of groups) {
    for (const member of Array.isArray(group.proxies) ? group.proxies : []) {
      if (!validProxyTargets.has(member)) {
        throw new Error(
          `Proxy-group ${JSON.stringify(group.name)} references missing target: ${JSON.stringify(member)}`,
        );
      }
    }

    for (const provider of Array.isArray(group.use) ? group.use : []) {
      if (!providerNames.has(provider)) {
        throw new Error(
          `Proxy-group ${JSON.stringify(group.name)} references missing proxy-provider: ${JSON.stringify(provider)}`,
        );
      }
    }
  }
}

function validateRules(rules, groups, ruleProviders) {
  const validTargets = new Set([
    ...groups.map((group) => group.name),
    ...BUILTIN_OUTBOUNDS,
  ]);
  const validProviders = new Set(Object.keys(ruleProviders));

  for (const rule of rules) {
    if (typeof rule !== "string") continue;
    const parts = rule.split(",");
    if (parts.length < 2) continue;

    if (parts[0] === "RULE-SET") {
      const provider = parts[1];
      const target = parts[2];
      if (!validProviders.has(provider)) {
        throw new Error(`Rule references missing rule-provider: ${rule}`);
      }
      if (!validTargets.has(target)) {
        throw new Error(`Rule references missing target: ${rule}`);
      }
      continue;
    }

    const target = parts[0] === "MATCH" ? parts[1] : parts[2];
    if (target && !validTargets.has(target)) {
      throw new Error(`Rule references missing target: ${rule}`);
    }
  }
}

function normalizeProxies(value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("No merged proxies found. Runestone must execute after Hako merges node sources.");
  }

  return value.map((proxy, index) => {
    assertPlainObject(proxy, `proxies[${index}]`);
    if (typeof proxy.name !== "string" || proxy.name.trim() === "") {
      throw new Error(`proxies[${index}] has no valid name`);
    }
    return proxy;
  });
}

function assertUnique(values, label) {
  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) {
      throw new Error(`Duplicate ${label} name: ${value}`);
    }
    seen.add(value);
  }
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function assertPlainObject(value, label) {
  if (!isPlainObject(value)) {
    throw new TypeError(`${label} must be an object`);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    main,
    buildRuleProviders,
    buildRules,
    buildRegionGroups,
    GROUP,
    REGIONS,
    REGION_ORDER,
    SERVICE_DEFS,
    ICONS,
  };
}
