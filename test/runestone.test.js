"use strict";

const assert = require("node:assert/strict");
const {
  main,
  buildRules,
  buildRuleProviders,
  GROUP,
  ICONS,
  SERVICE_DEFS,
} = require("../JS/Runestone.js");

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
  assert.deepEqual(groupByName(output, GROUP.applePush).proxies, ["DIRECT", GROUP.apnsFallback, GROUP.proxy]);
  assert.deepEqual(groupByName(output, GROUP.apnsFallback).proxies, ["JP", "SG", "US"]);
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
}

{
  const output = main({ proxies: [proxy("US-01"), proxy("JP-01"), proxy("SG-01"), proxy("CN-01"), proxy("DE-01")] });
  for (const group of output["proxy-groups"]) {
    if (!ICONS[group.name]) continue;
    assert.match(group.icon, /^https:\/\/cdn\.jsdelivr\.net\/gh\/lxy-l\/runestone-hako@main\/assets\/icons\/.+\.svg$/);
  }
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
