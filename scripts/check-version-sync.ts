/**
 * check-version-sync.ts — package.json version 与 vite.config.ts userscript.version 一致性门禁
 *
 * 独立命令：`bun run check:version`。不接入 build / lint / test。
 *
 * 背景（doc/42）：发布与构建的唯一版本权威是 vite.config.ts 的 `userscript.version`
 *（release.yml 提取的 VERSION 与产物 @version 均取此值），package.json 的
 * version 仅作元数据镜像；两者曾长期漂移（1.46.32 vs 1.47.2）造成误导。
 * 本门禁在漂移时拦下：不一致即 FAIL（exit 1）。
 */
import { readFileSync } from "node:fs";

const vite = readFileSync("vite.config.ts", "utf8");
const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: string };

const matched = vite.match(/^\s*version:\s*'([^']+)'/m);
const userscriptVersion = matched?.[1] ?? "";
const packageVersion = pkg.version ?? "";

if (!userscriptVersion) {
  console.log("check-version-sync: FAIL（无法从 vite.config.ts 提取 userscript.version）");
  process.exit(1);
}

if (userscriptVersion !== packageVersion) {
  console.log(
    `check-version-sync: FAIL（vite.config.ts userscript.version=${userscriptVersion} != ` +
      `package.json version=${packageVersion}；同步属元数据修正，见 AGENTS.md §6.3）`
  );
  process.exit(1);
}

console.log(
  `check-version-sync: OK (userscript ${userscriptVersion} = package.json ${packageVersion})`
);
process.exit(0);
