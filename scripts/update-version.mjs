import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const execFileAsync = promisify(execFile);
const timestampDate = process.env.VERSION_TIMESTAMP
  ? new Date(process.env.VERSION_TIMESTAMP)
  : new Date();
const versionRef = process.env.VERSION_REF
  ?? (await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root })).stdout.trim();

if (Number.isNaN(timestampDate.getTime())) {
  throw new Error(`Invalid VERSION_TIMESTAMP: ${process.env.VERSION_TIMESTAMP}`);
}
if (!/^[0-9a-f]{40}$/i.test(versionRef)) {
  throw new Error(`Invalid VERSION_REF: ${versionRef}`);
}

const parts = new Intl.DateTimeFormat("en-US-u-nu-latn", {
  timeZone: "Asia/Shanghai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  fractionalSecondDigits: 3,
  hourCycle: "h23",
}).formatToParts(timestampDate);
const timestamp = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
const version = `${timestamp.year}${timestamp.month}${timestamp.day}.${timestamp.hour}${timestamp.minute}${timestamp.second}${timestamp.fractionalSecond}.0`;

async function replaceIfChanged(filePath, pattern, label, makeReplacement) {
  const absolutePath = path.join(root, filePath);
  const source = await fs.readFile(absolutePath, "utf8");
  if (!pattern.test(source)) {
    throw new Error(`${label} was not found in ${filePath}`);
  }
  const updated = source.replace(pattern, makeReplacement);
  if (updated !== source) {
    await fs.writeFile(absolutePath, updated, "utf8");
  }
}

await replaceIfChanged(
  "package.json",
  /("version"\s*:\s*")[^"]*(")/,
  "package version",
  (_match, prefix, suffix) => `${prefix}${version}${suffix}`,
);

for (const filePath of ["JS/Runestone.js", "JS/Runestone.ClashVerge.js"]) {
  await replaceIfChanged(
    filePath,
    /^\/\/ Version: [^\r\n]+/,
    "version header",
    () => `// Version: ${version}`,
  );
}

await replaceIfChanged(
  "README.md",
  /(https:\/\/raw\.githubusercontent\.com\/lxy-l\/runestone-hako\/)(?:v[^/\s]+|[0-9a-f]{40})(\/JS\/Runestone\.js)/i,
  "pinned Runestone.js URL",
  (_match, prefix, suffix) => `${prefix}${versionRef}${suffix}`,
);

console.log(`Updated version to ${version}`);
