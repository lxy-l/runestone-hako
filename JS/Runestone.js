"use strict";

/**
 * Runestone - routing-only post-merge override for Hako / Mihomo.
 *
 * Design goals:
 * - Keep the incoming network layer intact (DNS/TUN/listeners/controller/etc.).
 * - Rebuild only policy groups, rule providers and rules.
 * - Prefer MRS rule providers for lower parsing/memory overhead.
 * - Preserve original proxy groups only when they are required by dialer-proxy.
 * - Fail fast on ambiguous or broken references instead of emitting a bad profile.
 */

const SETTINGS = Object.freeze({
  testUrl: "https://www.gstatic.com/generate_204",
  testInterval: 300,
  testTimeout: 5000,
  testTolerance: 50,
  ruleInterval: 86400,
});

const GROUP = Object.freeze({
  gate: "🧭 PROXY-Gate",
  globalAuto: "⚡ Global-Auto",
  globalFallback: "🛟 Global-Fallback",
  allNodes: "🖥️ All-Nodes",
  apnsFallback: "🍎 APNs-Fallback",
  applePush: "🍎 Apple-Push",
});

const BUILTIN_OUTBOUNDS = new Set([
  "DIRECT",
  "REJECT",
  "REJECT-DROP",
  "PASS",
  "COMPATIBLE",
]);

const INFO_NODE_RE = /(?:剩余|流量|套餐|到期|过期|官网|网站|订阅|traffic|expire|quota|reset|官网|客服)/i;

const REGIONS = [
  { id: "HK", flag: "🇭🇰", re: /(?:🇭🇰|香港|Hong\s*Kong|\bHK\b)/i },
  { id: "TW", flag: "🇹🇼", re: /(?:🇹🇼|台湾|台灣|Taiwan|\bTW\b)/i },
  { id: "JP", flag: "🇯🇵", re: /(?:🇯🇵|日本|Japan|Tokyo|Osaka|\bJP\b)/i },
  { id: "SG", flag: "🇸🇬", re: /(?:🇸🇬|新加坡|Singapore|\bSG\b)/i },
  { id: "US", flag: "🇺🇸", re: /(?:🇺🇸|美国|美國|United\s*States|America|\bUSA?\b)/i },
  { id: "KR", flag: "🇰🇷", re: /(?:🇰🇷|韩国|韓國|Korea|Seoul|\bKR\b)/i },
  { id: "CA", flag: "🇨🇦", re: /(?:🇨🇦|加拿大|Canada|\bCA\b)/i },
  { id: "UK", flag: "🇬🇧", re: /(?:🇬🇧|英国|英國|United\s*Kingdom|Britain|England|\bUK\b|\bGB\b)/i },
  { id: "DE", flag: "🇩🇪", re: /(?:🇩🇪|德国|德國|Germany|Frankfurt|\bDE\b)/i },
  { id: "FR", flag: "🇫🇷", re: /(?:🇫🇷|法国|法國|France|Paris|\bFR\b)/i },
  { id: "NL", flag: "🇳🇱", re: /(?:🇳🇱|荷兰|荷蘭|Netherlands|Amsterdam|\bNL\b)/i },
  { id: "CH", flag: "🇨🇭", re: /(?:🇨🇭|瑞士|Switzerland|Zurich|\bCH\b)/i },
  { id: "SE", flag: "🇸🇪", re: /(?:🇸🇪|瑞典|Sweden|Stockholm|\bSE\b)/i },
  { id: "NO", flag: "🇳🇴", re: /(?:🇳🇴|挪威|Norway|Oslo|\bNO\b)/i },
  { id: "FI", flag: "🇫🇮", re: /(?:🇫🇮|芬兰|芬蘭|Finland|Helsinki|\bFI\b)/i },
  { id: "PL", flag: "🇵🇱", re: /(?:🇵🇱|波兰|波蘭|Poland|Warsaw|\bPL\b)/i },
  { id: "IT", flag: "🇮🇹", re: /(?:🇮🇹|意大利|Italy|Milan|Rome|\bIT\b)/i },
  { id: "ES", flag: "🇪🇸", re: /(?:🇪🇸|西班牙|Spain|Madrid|\bES\b)/i },
  { id: "AU", flag: "🇦🇺", re: /(?:🇦🇺|澳大利亚|澳大利亞|Australia|Sydney|Melbourne|\bAU\b)/i },
  { id: "NZ", flag: "🇳🇿", re: /(?:🇳🇿|新西兰|紐西蘭|New\s*Zealand|Auckland|\bNZ\b)/i },
  { id: "IN", flag: "🇮🇳", re: /(?:🇮🇳|印度|India|Mumbai|Delhi|\bIN\b)/i },
  { id: "MY", flag: "🇲🇾", re: /(?:🇲🇾|马来西亚|馬來西亞|Malaysia|Kuala\s*Lumpur|\bMY\b)/i },
  { id: "TH", flag: "🇹🇭", re: /(?:🇹🇭|泰国|泰國|Thailand|Bangkok|\bTH\b)/i },
  { id: "VN", flag: "🇻🇳", re: /(?:🇻🇳|越南|Vietnam|Hanoi|Saigon|Ho\s*Chi\s*Minh|\bVN\b)/i },
  { id: "PH", flag: "🇵🇭", re: /(?:🇵🇭|菲律宾|菲律賓|Philippines|Manila|\bPH\b)/i },
  { id: "ID", flag: "🇮🇩", re: /(?:🇮🇩|印度尼西亚|印度尼西亞|Indonesia|Jakarta|\bID\b)/i },
  { id: "RU", flag: "🇷🇺", re: /(?:🇷🇺|俄罗斯|俄羅斯|Russia|Moscow|\bRU\b)/i },
];

const SERVICES = [
  "🤖 AI",
  "🔎 Google",
  "📺 YouTube",
  "💻 GitHub",
  "✈️ Telegram",
  "🎬 Netflix",
  "🎵 Spotify",
  "🪟 Microsoft",
  "🍎 Apple",
  "📦 Amazon",
  "🎨 Pixiv",
  "💼 LinkedIn",
];

const RULE_BASE = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/meta";

function main(config) {
  assertPlainObject(config, "config");

  const fixed = { ...config };
  fixed.mode = "rule";
  fixed.profile = isPlainObject(config.profile) ? { ...config.profile } : {};
  if (fixed.profile["store-selected"] === undefined) {
    fixed.profile["store-selected"] = true;
  }

  const proxies = normalizeProxies(config.proxies);
  const proxyNames = proxies.map((p) => p.name);
  assertUnique(proxyNames, "proxy node");

  const candidateNames = proxyNames.filter((name) => !INFO_NODE_RE.test(name));
  const usableNames = candidateNames.length > 0 ? candidateNames : proxyNames;

  const originalGroups = Array.isArray(config["proxy-groups"])
    ? config["proxy-groups"].filter(isPlainObject)
    : [];

  const preservedGroups = collectDialerProxyDependencies(
    proxies,
    originalGroups,
    new Set(proxyNames),
  );

  const regionalGroups = buildRegionalGroups(usableNames);
  const generatedGroups = buildGeneratedGroups(usableNames, regionalGroups);

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
  validateRuleTargets(fixed.rules, fixed["proxy-groups"]);

  return fixed;
}

function buildRegionalGroups(proxyNames) {
  const groups = [];

  for (const region of REGIONS) {
    const matched = proxyNames.filter((name) => region.re.test(name));
    if (matched.length === 0) continue;

    const name = regionGroupName(region);
    if (matched.length === 1) {
      groups.push({
        name,
        type: "select",
        proxies: matched,
      });
      continue;
    }

    groups.push({
      name,
      type: "url-test",
      proxies: matched,
      url: SETTINGS.testUrl,
      interval: SETTINGS.testInterval,
      timeout: SETTINGS.testTimeout,
      tolerance: SETTINGS.testTolerance,
      lazy: true,
    });
  }

  return groups;
}

function buildGeneratedGroups(proxyNames, regionalGroups) {
  const regionalNames = regionalGroups.map((group) => group.name);

  const allNodes = {
    name: GROUP.allNodes,
    type: "select",
    proxies: proxyNames,
  };

  const globalAuto = makeAutoGroup(GROUP.globalAuto, proxyNames);

  const globalFallbackCandidates =
    regionalNames.length >= 2 ? regionalNames : proxyNames;
  const globalFallback = makeFallbackGroup(
    GROUP.globalFallback,
    globalFallbackCandidates,
  );

  const apnsCandidates = regionalNames.length >= 2 ? regionalNames : proxyNames;
  const apnsFallback = makeFallbackGroup(GROUP.apnsFallback, apnsCandidates);

  const gateCandidates = dedupe([
    GROUP.globalAuto,
    GROUP.globalFallback,
    ...regionalNames,
    GROUP.allNodes,
    "DIRECT",
  ]);

  const gate = {
    name: GROUP.gate,
    type: "select",
    proxies: gateCandidates,
  };

  const serviceCandidates = dedupe([
    GROUP.gate,
    GROUP.globalFallback,
    ...regionalNames,
    GROUP.allNodes,
    "DIRECT",
  ]);

  const services = SERVICES.map((name) => ({
    name,
    type: "select",
    proxies: serviceCandidates,
  }));

  const applePush = {
    name: GROUP.applePush,
    type: "select",
    proxies: [GROUP.apnsFallback, "DIRECT", GROUP.gate],
  };

  return [
    allNodes,
    globalAuto,
    globalFallback,
    ...regionalGroups,
    apnsFallback,
    gate,
    applePush,
    ...services,
  ];
}

function makeAutoGroup(name, proxies) {
  if (proxies.length === 1) {
    return { name, type: "select", proxies: [...proxies] };
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
  };
}

function makeFallbackGroup(name, proxies) {
  if (proxies.length === 1) {
    return { name, type: "select", proxies: [...proxies] };
  }

  return {
    name,
    type: "fallback",
    proxies: [...proxies],
    url: SETTINGS.testUrl,
    interval: SETTINGS.testInterval,
    timeout: SETTINGS.testTimeout,
    lazy: true,
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

  return {
    RS_PrivateDomain: domain("private"),
    RS_PrivateIP: ip("private"),
    RS_AI: domain("category-ai-!cn"),
    RS_GitHub: domain("github"),
    RS_YouTube: domain("youtube"),
    RS_Google: domain("google"),
    RS_GoogleIP: ip("google"),
    RS_Telegram: domain("telegram"),
    RS_TelegramIP: ip("telegram"),
    RS_Netflix: domain("netflix"),
    RS_NetflixIP: ip("netflix"),
    RS_Spotify: domain("spotify"),
    RS_Microsoft: domain("microsoft"),
    RS_Apple: domain("apple"),
    RS_iCloud: domain("icloud"),
    RS_Amazon: domain("amazon"),
    RS_Pixiv: domain("pixiv"),
    RS_LinkedIn: domain("linkedin"),
    RS_GeolocationNonCN: domain("geolocation-!cn"),
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
    "DOMAIN-SUFFIX,push.apple.com,🍎 Apple-Push",
    "RULE-SET,RS_YouTube,📺 YouTube",
    "RULE-SET,RS_AI,🤖 AI",
    "RULE-SET,RS_GitHub,💻 GitHub",
    "RULE-SET,RS_Telegram,✈️ Telegram",
    "RULE-SET,RS_TelegramIP,✈️ Telegram,no-resolve",
    "RULE-SET,RS_Netflix,🎬 Netflix",
    "RULE-SET,RS_NetflixIP,🎬 Netflix,no-resolve",
    "RULE-SET,RS_Spotify,🎵 Spotify",
    "RULE-SET,RS_Amazon,📦 Amazon",
    "RULE-SET,RS_Pixiv,🎨 Pixiv",
    "RULE-SET,RS_LinkedIn,💼 LinkedIn",
    "RULE-SET,RS_iCloud,🍎 Apple",
    "RULE-SET,RS_Apple,🍎 Apple",
    "RULE-SET,RS_Microsoft,🪟 Microsoft",
    "RULE-SET,RS_Google,🔎 Google",
    "RULE-SET,RS_GoogleIP,🔎 Google,no-resolve",
    "RULE-SET,RS_GeolocationNonCN,🧭 PROXY-Gate",
    "RULE-SET,RS_CNDomain,DIRECT",
    "RULE-SET,RS_CNIP,DIRECT,no-resolve",
    "MATCH,🧭 PROXY-Gate",
  ];
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
    if (typeof ref === "string" && ref && groupMap.has(ref)) {
      queue.push(ref);
    }
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
  const preservedSet = new Set(preservedGroups.map((g) => g.name));
  const generatedNames = generatedGroups.map((g) => g.name);

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
    ...groups.map((g) => g.name),
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

function validateRuleTargets(rules, groups) {
  const validTargets = new Set([
    ...groups.map((g) => g.name),
    ...BUILTIN_OUTBOUNDS,
  ]);

  for (const rule of rules) {
    if (typeof rule !== "string") continue;
    const parts = rule.split(",");
    if (parts.length < 2) continue;

    let target;
    if (parts[0] === "MATCH") target = parts[1];
    else if (parts[0] === "RULE-SET") target = parts[2];
    else target = parts[2];

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

function regionGroupName(region) {
  return `${region.flag} ${region.id}-Auto`;
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
    REGIONS,
    GROUP,
  };
}
