"use strict";

const assert = require("node:assert/strict");
const { main, GROUP } = require("../JS/Runestone.js");

function proxy(name, extra = {}) {
  return { name, type: "ss", server: "127.0.0.1", port: 443, ...extra };
}

function groupByName(result, name) {
  return result["proxy-groups"].find((g) => g.name === name);
}

// Routing-only: unrelated network-layer fields survive the transform.
{
  const input = {
    "mixed-port": 7890,
    dns: { enable: true, "enhanced-mode": "fake-ip" },
    tun: { enable: true, stack: "mixed" },
    "external-controller": "127.0.0.1:9090",
    proxies: [proxy("🇯🇵 JP-01"), proxy("🇯🇵 JP-02"), proxy("🇺🇸 US-01")],
  };

  const output = main(input);
  assert.equal(output["mixed-port"], 7890);
  assert.deepEqual(output.dns, input.dns);
  assert.deepEqual(output.tun, input.tun);
  assert.equal(output["external-controller"], input["external-controller"]);
  assert.equal(output.mode, "rule");
  assert.equal(output.profile["store-selected"], true);
}

// 2+ nodes => regional url-test; 1 node => one-member select.
{
  const output = main({
    proxies: [proxy("🇯🇵 JP-01"), proxy("🇯🇵 JP-02"), proxy("🇺🇸 US-01")],
  });

  const jp = groupByName(output, "🇯🇵 JP-Auto");
  const us = groupByName(output, "🇺🇸 US-Auto");
  assert.equal(jp.type, "url-test");
  assert.deepEqual(jp.proxies, ["🇯🇵 JP-01", "🇯🇵 JP-02"]);
  assert.equal(us.type, "select");
  assert.deepEqual(us.proxies, ["🇺🇸 US-01"]);

  const fallback = groupByName(output, GROUP.globalFallback);
  assert.equal(fallback.type, "fallback");
  assert.deepEqual(fallback.proxies, ["🇯🇵 JP-Auto", "🇺🇸 US-Auto"]);
}

// Subscription-info pseudo nodes are excluded from automatic candidates.
{
  const output = main({
    proxies: [proxy("🇸🇬 SG-01"), proxy("剩余流量 100 GB")],
  });
  assert.deepEqual(groupByName(output, GROUP.globalAuto).proxies, ["🇸🇬 SG-01"]);
  assert.deepEqual(groupByName(output, GROUP.allNodes).proxies, ["🇸🇬 SG-01"]);
}

// Required original dialer-proxy groups (and their nested dependencies) survive.
{
  const output = main({
    proxies: [
      proxy("Landing", { "dialer-proxy": "Chain-Outer" }),
      proxy("Transit"),
      proxy("🇯🇵 JP-01"),
    ],
    "proxy-groups": [
      { name: "Chain-Inner", type: "select", proxies: ["Transit"] },
      { name: "Chain-Outer", type: "select", proxies: ["Chain-Inner"] },
      { name: "Unused", type: "select", proxies: ["🇯🇵 JP-01"] },
    ],
  });

  const names = output["proxy-groups"].map((g) => g.name);
  assert(names.includes("Chain-Inner"));
  assert(names.includes("Chain-Outer"));
  assert(!names.includes("Unused"));
}

// Duplicate node names are rejected.
assert.throws(
  () => main({ proxies: [proxy("same"), proxy("same")] }),
  /Duplicate proxy node name/,
);

// Dangling dialer-proxy is rejected.
assert.throws(
  () => main({ proxies: [proxy("Node", { "dialer-proxy": "Missing" })] }),
  /dangling dialer-proxy/,
);

console.log("Runestone tests passed");
