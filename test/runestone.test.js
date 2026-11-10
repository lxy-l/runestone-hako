"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const packageJson = require("../package.json");
const {
  main,
  buildRules,
  buildRuleProviders,
  GROUP,
  ICONS,
  SERVICE_DEFS,
} = require("../JS/Runestone.js");

const runestoneSource = fs.readFileSync(require.resolve("../JS/Runestone.js"), "utf8");
const clashVergeSource = fs.readFileSync(require.resolve("../JS/Runestone.ClashVerge.js"), "utf8");
const readme = fs.readFileSync(require.resolve("../README.md"), "utf8");
const clashVergeContext = {};
vm.createContext(clashVergeContext);
vm.runInContext(
  `${clashVergeSource}
this.clashVergeApi = { main, buildRules, buildRuleProviders, buildRegionFilters, preserveCustomDirectRules };`,
  clashVergeContext,
);
const clashVergeApi = clashVergeContext.clashVergeApi;
const clashVergeMain = clashVergeApi.main;

assert.equal(
  runestoneSource.split(/\r?\n/, 1)[0],
  `// Version: ${packageJson.version}`,
);
assert.equal(
  clashVergeSource.split(/\r?\n/, 1)[0],
  `// Version: ${packageJson.version}`,
);
// update-version.mjs rewrites the README pin to a commit SHA, so accept a tag or a SHA.
assert.match(
  readme,
  /raw\.githubusercontent\.com\/lxy-l\/runestone-hako\/(?:v[^/\s]+|[0-9a-f]{40})\/JS\/Runestone\.js/,
);

function proxy(name, extra = {}) {
  return { name, type: "ss", server: "127.0.0.1", port: 443, ...extra };
}

function groupByName(result, name) {
  return result["proxy-groups"].find((group) => group.name === name);
}

function ruleIndex(prefix) {
  return buildRules().findIndex((rule) => rule.startsWith(prefix));
}

{
  const input = {
    "mixed-port": 7890,
    dns: { enable: true, "enhanced-mode": "fake-ip" },
    tun: { enable: true, stack: "mixed" },
    "external-controller": "127.0.0.1:9090",
    proxies: [proxy("🇯🇵 JP-01"), proxy("🇺🇸 US-01")],
  };
  const output = main(input);
  assert.equal(output["mixed-port"], 7890);
  assert.deepEqual(output.dns, input.dns);
  assert.deepEqual(output.tun, input.tun);
  assert.equal(output["external-controller"], input["external-controller"]);
  assert.equal(output.mode, "rule");
}

{
  const output = main({
    proxies: [
      proxy("🇨🇳 China-01"),
      proxy("🇭🇰 HK-01"),
      proxy("台湾 TW-01"),
      proxy("🇺🇸 US-01"),
      proxy("日本 JP-01"),
      proxy("新加坡 SG-01"),
      proxy("德国 DE-01"),
      proxy("韩国 KR-01"),
    ],
  });
  assert.deepEqual(groupByName(output, "CN").proxies, ["🇨🇳 China-01", "🇭🇰 HK-01", "台湾 TW-01"]);
  assert.deepEqual(groupByName(output, "US").proxies, ["🇺🇸 US-01"]);
  assert.deepEqual(groupByName(output, "JP").proxies, ["日本 JP-01"]);
  assert.deepEqual(groupByName(output, "SG").proxies, ["新加坡 SG-01"]);
  assert.deepEqual(groupByName(output, "Other").proxies, ["德国 DE-01", "韩国 KR-01"]);
}

{
  const output = main({
    proxies: [proxy("US-01"), proxy("US-02"), proxy("JP-01")],
  });
  assert.equal(groupByName(output, "US").type, "url-test");
  assert.equal(groupByName(output, "JP").type, "select");
}

{
  const output = main({ proxies: [proxy("US-01"), proxy("JP-01"), proxy("DE-01")] });
  const names = output["proxy-groups"].map((group) => group.name);
  for (const oldName of ["⚡ Global-Auto", "🛟 Global-Fallback", "🖥️ All-Nodes", "🧭 PROXY-Gate", "🤖 AI"]) {
    assert(!names.includes(oldName), `unexpected old group: ${oldName}`);
  }
  assert(groupByName(output, GROUP.proxy));
  assert(groupByName(output, GROUP.final));
  assert.equal(output.rules.at(-1), `MATCH,${GROUP.final}`);
}

{
  const output = main({
    proxies: [proxy("JP-01"), proxy("SG-01"), proxy("US-01"), proxy("CN-01"), proxy("DE-01")],
  });
  assert.deepEqual(groupByName(output, GROUP.applePush).proxies, [
    "DIRECT",
    GROUP.proxy,
    GROUP.apnsFallback,
    "CN",
    "US",
    "JP",
    "SG",
    "Other",
  ]);
  assert.deepEqual(groupByName(output, GROUP.apnsFallback).proxies, [
    "CN",
    "US",
    "JP",
    "SG",
    "Other",
    "DIRECT",
  ]);
  assert.equal(groupByName(output, GROUP.apnsFallback).type, "fallback");
}

{
  const output = main({ proxies: [proxy("US-01"), proxy("JP-01"), proxy("SG-01"), proxy("CN-01"), proxy("DE-01")] });
  const names = new Set(output["proxy-groups"].map((group) => group.name));
  for (const service of SERVICE_DEFS) assert(names.has(service.name), service.name);
  assert(names.has("Apple Push"));
  assert(names.has("APNs-Fallback"));
}

{
  const output = main({ proxies: [proxy("US-01")] });
  assert.deepEqual(groupByName(output, "OpenAI").proxies, ["US", "Proxy"]);
  assert.deepEqual(groupByName(output, "Bilibili").proxies, ["DIRECT", "Proxy"]);
}

{
  assert(ruleIndex("DOMAIN-SUFFIX,push.apple.com") < ruleIndex("RULE-SET,RS_Apple,"));
  assert(ruleIndex("RULE-SET,RS_YouTube,") < ruleIndex("RULE-SET,RS_Google,"));
  assert(ruleIndex("RULE-SET,RS_PrimeVideo,") < ruleIndex("RULE-SET,RS_Amazon,"));
  assert(ruleIndex("RULE-SET,RS_Bilibili,") < ruleIndex("RULE-SET,RS_CNDomain,"));
  assert.equal(buildRules().at(-1), "MATCH,Final");
}

{
  const providers = buildRuleProviders();
  assert(providers.RS_Google);
  assert(providers.RS_OpenAI);
  assert(providers.RS_Anthropic);
  assert(!providers.RS_AI);
  assert.equal(providers.RS_Emby.behavior, "classical");
  assert.match(providers.RS_Emby.url, /^https:\/\/raw\.githubusercontent\.com\/lxy-l\/runestone-hako\/main\/rules\/emby\.yaml$/);
  for (const [name, provider] of Object.entries(providers)) {
    if (name === "RS_Emby") continue;
    assert.match(provider.url, /^https:\/\/raw\.githubusercontent\.com\/MetaCubeX\/meta-rules-dat\/meta\//);
  }
}

{
  const output = main({ proxies: [proxy("US-01"), proxy("JP-01"), proxy("SG-01"), proxy("CN-01"), proxy("DE-01")] });
  for (const group of output["proxy-groups"]) {
    if (!ICONS[group.name]) continue;
    assert.match(group.icon, /^https:\/\/raw\.githubusercontent\.com\/lxy-l\/runestone-hako\/main\/assets\/icons\/png\/.+\.png$/);
  }
}

{
  const output = clashVergeMain({
    "proxy-providers": { provider1: { type: "http", url: "https://example.invalid/sub" } },
    "proxy-groups": [{ name: "Existing provider group", type: "select", use: ["provider1"] }],
  });
  for (const name of ["CN", "US", "JP", "SG", "Other"]) {
    const group = groupByName(output, name);
    assert.equal(group.type, "select");
    assert.deepEqual(Array.from(group.use), ["provider1"]);
    assert(group.filter);
    assert(group["exclude-filter"]);
    assert.match(group.icon, /^https:\/\/raw\.githubusercontent\.com\/lxy-l\/runestone-hako\/main\/assets\/icons\/png\//);
  }
  assert(groupByName(output, "HBO"));
  assert(groupByName(output, "Bahamut"));
  assert.equal(output.rules.at(-1), "MATCH,Final");
}

{
  // Parity: the Clash Verge script must emit the same rules as the Hako script.
  // Spread the vm-realm array so deepEqual compares plain local arrays.
  assert.deepEqual([...clashVergeApi.buildRules()], buildRules());
  const providers = clashVergeApi.buildRuleProviders();
  assert.equal(providers.RS_AppleIP.behavior, "ipcidr");
  assert.match(providers.RS_AppleIP.url, /meta-rules-dat\/meta\/geo-lite\/geoip\/apple\.mrs$/);
  assert.deepEqual(Object.keys(providers), Object.keys(buildRuleProviders()));
}

{
  // Inline nodes and provider nodes share the same region groups.
  const output = clashVergeMain({
    proxies: [proxy("🇺🇸 Inline-US")],
    "proxy-providers": { p1: { type: "http", url: "https://example.invalid/sub" } },
  });
  const us = groupByName(output, "US");
  assert.equal(us.type, "select");
  assert.deepEqual(Array.from(us.proxies), ["🇺🇸 Inline-US"]);
  assert.deepEqual(Array.from(us.use), ["p1"]);
  assert.match(us.filter, /🇺🇸/);

  const jp = groupByName(output, "JP");
  assert.deepEqual(Array.from(jp.use), ["p1"]);
  assert.equal(jp.proxies, undefined, "empty inline bucket must not emit proxies: []");
  assert(groupByName(output, "CN"));
  assert(groupByName(output, "SG"));
  assert(groupByName(output, "Other"));
}

{
  // Region filters follow the same first-match-wins order as inline bucketing.
  const filters = clashVergeApi.buildRegionFilters();
  assert.equal(filters.Other.filter, "(?i).*");
  assert(!filters.CN["exclude-filter"].includes("香港"));
  assert(filters.US["exclude-filter"].includes("香港"));
  assert(filters.JP["exclude-filter"].includes("美国"));
  for (const pattern of ["香港", "美国", "日本", "新加坡"]) {
    assert(filters.Other["exclude-filter"].includes(pattern), pattern);
  }
}

{
  // Providers can chain through a group, so dialer-proxy closures must survive.
  const output = clashVergeMain({
    "proxy-providers": {
      p1: {
        type: "http",
        url: "https://example.invalid/sub",
        override: { "dialer-proxy": "Relay" },
      },
    },
    "proxy-groups": [
      { name: "Relay-Base", type: "select", proxies: ["DIRECT"] },
      { name: "Relay", type: "select", proxies: ["Relay-Base"] },
      { name: "Unused", type: "select", proxies: ["DIRECT"] },
    ],
  });
  const names = output["proxy-groups"].map((group) => group.name);
  assert(names.includes("Relay"));
  assert(names.includes("Relay-Base"));
  assert(!names.includes("Unused"));
}

{
  // Re-running must not duplicate preserved custom DIRECT rules.
  const first = clashVergeMain({
    proxies: [proxy("🇺🇸 US-01")],
    rules: ["DOMAIN-SUFFIX,intranet.test,DIRECT", "DOMAIN-SUFFIX,blocked.test,REJECT"],
  });
  const second = clashVergeMain(first);
  const occurrences = (rule) => second.rules.filter((item) => item === rule).length;
  assert.equal(occurrences("DOMAIN-SUFFIX,intranet.test,DIRECT"), 1);
  assert.equal(occurrences("DOMAIN-SUFFIX,lan,DIRECT"), 1);
  assert.equal(occurrences("IP-CIDR,10.0.0.0/8,DIRECT,no-resolve"), 1);
  assert(!second.rules.includes("DOMAIN-SUFFIX,blocked.test,REJECT"));
}

{
  // The Clash Verge script is opt-in: untouched configs must pass through.
  const input = { "mixed-port": 7890, rules: ["MATCH,DIRECT"] };
  assert.equal(clashVergeMain(input), input);
}

{
  const output = main({
    proxies: [
      proxy("Landing", { "dialer-proxy": "Chain-Outer" }),
      proxy("Transit"),
      proxy("US-01"),
    ],
    "proxy-groups": [
      { name: "Chain-Inner", type: "select", proxies: ["Transit"] },
      { name: "Chain-Outer", type: "select", proxies: ["Chain-Inner"] },
      { name: "Unused", type: "select", proxies: ["US-01"] },
    ],
  });
  const names = output["proxy-groups"].map((group) => group.name);
  assert(names.includes("Chain-Inner"));
  assert(names.includes("Chain-Outer"));
  assert(!names.includes("Unused"));
}

assert.throws(
  () => main({ proxies: [proxy("same"), proxy("same")] }),
  /Duplicate proxy node name/,
);

assert.throws(
  () => main({ proxies: [proxy("Node", { "dialer-proxy": "Missing" })] }),
  /dangling dialer-proxy/,
);

console.log("Runestone tests passed");
