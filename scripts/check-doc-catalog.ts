/**
 * check-doc-catalog.ts — docs/plugin-catalog.md 与代码的事实一致性门禁
 *
 * 独立命令：`bun run check:docs`。不接入 build / lint / test。
 *
 * 校验四件事（任一不符即 FAIL）：
 * 1. `src/main.tsx` 注册的插件类名集合 == catalog §1 列出的插件集合（双向，且无重复）
 * 2. catalog §1 的分组小计之和、头部总数、§1.3 flag 数 == 实际注册数
 * 3. catalog §1 声明的 JavDB/MissAV 站点拆分 == main.tsx 两个注册块的实际数量
 * 4. catalog §2 列出的单文件数（`a.ts / b.ts` 逐个计数，`storage/`、`sync/`、`util/`
 *    汇总行按该子目录实际文件数计）== `src/core/` 下 .ts/.tsx 文件总数
 *
 * 数据落点规则见 docs/README.md 与 AGENTS.md §3.3/§3.4：
 * 增删插件或核心模块时必须同步更新 catalog，本门禁负责在漂移时拦下。
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CATALOG = "docs/plugin-catalog.md";
const MAIN = "src/main.tsx";
const CORE = "src/core";

/** §2 汇总行写法（目录名 + 斜杠）→ 实际目录。 */
const CORE_SUMMARY_DIRS = ["storage", "sync", "util"];

const violations: string[] = [];

/** 统计目录下 .ts/.tsx 文件数（递归）。 */
function countFiles(dir: string): number {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) n += countFiles(join(dir, entry.name));
    else if (/\.(ts|tsx)$/.test(entry.name)) n++;
  }
  return n;
}

/** §2 列出的文件总数：单文件行逐行计，`a.ts / b.ts` 同行计 2，汇总行按目录实际数计。 */
function catalogCoreFiles(catalog: string): number {
  const section = catalog.split(/^## 2\. /m)[1] ?? "";
  const cells = [...section.matchAll(/^\| ([^|]+?) \| /gm)]
    .map((m) => m[1].trim())
    .filter((cell) => cell !== "文件");

  let count = 0;
  for (const cell of cells) {
    const summary = CORE_SUMMARY_DIRS.find((dir) => cell === `${dir}/`);
    if (summary) {
      count += countFiles(join(CORE, summary));
      continue;
    }
    // 同行多文件写法 `a.ts / b.ts`：逐个计数
    const files = cell
      .split("/")
      .map((part) => part.trim())
      .filter((part) => /\.(ts|tsx)$/.test(part));
    count += files.length > 0 ? files.length : 1;
  }
  return count;
}

const catalog = readFileSync(CATALOG, "utf8");
const main = readFileSync(MAIN, "utf8");

const classes: string[] = [];
const flagged: string[] = [];
for (const match of main.matchAll(/manager\.register\(([A-Za-z0-9_$]+)(?:\s*,\s*'([^']+)')?\)/g)) {
  classes.push(match[1]);
  if (match[2]) flagged.push(match[1]);
}

const listed = [...catalog.matchAll(/^\| ([A-Za-z0-9_$]+Plugin) \|/gm)].map((m) => m[1]);

const missing = classes.filter((c) => !listed.includes(c));
const extra = listed.filter((c) => !classes.includes(c));
if (missing.length > 0) violations.push(`${CATALOG}: 未列出已注册插件 ${missing.join(", ")}`);
if (extra.length > 0) violations.push(`${CATALOG}: 列出未注册插件 ${extra.join(", ")}`);
const dupes = [...new Set(listed.filter((c, i) => listed.indexOf(c) !== i))];
if (dupes.length > 0) violations.push(`${CATALOG}: 插件重复列出 ${dupes.join(", ")}`);

const subTotals = [...catalog.matchAll(/^### 1\.\d+ [^\n]*?（(\d+) 个/gm)].map((m) => Number(m[1]));
if (subTotals.length > 0) {
  const sum = subTotals.reduce((a, b) => a + b, 0);
  if (sum !== classes.length) {
    violations.push(
      `${CATALOG}: §1 分组小计之和 ${subTotals.join(" + ")} = ${sum} != 实际注册 ${classes.length}`,
    );
  }
}

const totalDecl = catalog.match(/共\s*(\d+)\s*个功能插件/);
if (totalDecl && Number(totalDecl[1]) !== classes.length) {
  violations.push(`${CATALOG}: 头部声明共 ${totalDecl[1]} 个插件 != 实际注册 ${classes.length}`);
}

const flagDecl = catalog.match(/### 1\.3 [^\n]*?（(\d+) 个/);
if (flagDecl && Number(flagDecl[1]) !== flagged.length) {
  violations.push(
    `${CATALOG}: §1.3 声明 ${flagDecl[1]} 个 flag 插件 != main.tsx 实际 ${flagged.length} 个`,
  );
}

// 站点拆分：`共 N 个功能插件（JavDB X + MissAV Y）`
const siteDecl = catalog.match(/共\s*\d+\s*个功能插件（JavDB\s*(\d+)\s*\+\s*MissAV\s*(\d+)）/);
const javdbIdx = main.indexOf("if (isJavdbSite)");
const missavIdx = main.indexOf("if (isMissavSite)");
if (siteDecl && javdbIdx > 0 && missavIdx > javdbIdx) {
  const javdbCount = [...main.slice(javdbIdx, missavIdx).matchAll(/manager\.register\(/g)].length;
  const missavCount = [...main.slice(missavIdx).matchAll(/manager\.register\(/g)].length;
  if (Number(siteDecl[1]) !== javdbCount || Number(siteDecl[2]) !== missavCount) {
    violations.push(
      `${CATALOG}: 声明 JavDB ${siteDecl[1]} + MissAV ${siteDecl[2]} != main.tsx 实际 ` +
        `JavDB ${javdbCount} + MissAV ${missavCount}`,
    );
  }
}

const coreListed = catalogCoreFiles(catalog);
const coreActual = countFiles(CORE);
if (coreListed !== coreActual) {
  violations.push(`${CATALOG}: §2 列出 ${coreListed} 个核心文件 != src/core 实际 ${coreActual} 个`);
}

if (violations.length > 0) {
  for (const v of violations) console.log(v);
  console.log(
    `check-doc-catalog: FAIL (${violations.length} violation${violations.length === 1 ? "" : "s"})`,
  );
  process.exit(1);
}

console.log(
  `check-doc-catalog: OK (${classes.length} plugins [${flagged.length} flagged], ` +
    `${coreActual} core files)`,
);
process.exit(0);