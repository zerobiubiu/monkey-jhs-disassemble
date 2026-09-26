/**
 * check-site-selectors.ts — 站点选择器依赖棘轮门禁
 *
 * 目的：防止**新增**对 JavDB/MissAV 原生 DOM 的裸选择器字面量。
 * 新增站点选择器必须先进 `src/core/util/site/selectors.ts` 注册表，再从注册表取用。
 *
 * 机制（仿 check-structure.ts 的棘轮）：以 `scripts/site-selector-baseline.json`
 * 记录每个文件的**现状计数**，只允许下降、不允许上升；新文件出现即失败。
 *
 * 用法：
 *   bun run check:selectors              # 门禁（默认）
 *   bun run check:selectors --report     # 打印按文件排序的清单
 *   bun run check:selectors --update-baseline   # 重写基线（仅在人工确认后）
 *
 * 独立命令：不接入 build / lint / test。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** 站点原生 DOM 的**辨识性**特征串（刻意排除 `.box`/`.item`/`.tag` 等通用 Bulma 名，避免误伤自有 UI）。 */
const SITE_SIGNATURES: readonly string[] = [
    // 详情页
    "movie-panel-info",
    "video-meta-panel",
    "column-video-cover",
    "video-detail",
    "video-cover",
    "preview-images",
    "tile-item",
    "tile-images",
    "video-panel",
    "review-buttons",
    "score-stars",
    "current-title",
    "origin-title",
    "translated-title",
    "複製番號",
    // 演员页
    "actor-female",
    "actor-male",
    "actor-section-name",
    "actor-tags",
    "actor-box",
    "section-meta",
    "section-columns",
    // 列表页
    "movie-list",
    "video-title",
    "main-tabs",
    "navbar-menu-hero",
    "navbar-menu-user",
    "navbar-end",
    "navbar-search",
    "section-title",
    "empty-message",
    "search-bar-container",
    "search-keyword",
    "search-type",
    // 标签页
    "tag-expand",
    "tag-category",
    "tag_labels",
    // 用户清单
    "list-name",
    "list-item",
    "jdb-wf-loader",
    // 分页
    "pagination-link",
    "pagination-ellipsis",
    "pagination-list",
    "pagination-next",
    "pagination-previous",
    // 结构定位
    "body > section > div",
    // 站点 id（带 # 以免误伤自有命名）
    "#tags",
    "#lists",
    "#magnets",
    "#reviews",
    "#navbar-menu"
];

/** 合法持有站点字面量的文件（注册表与其先例）——豁免。 */
const EXEMPT_FILES: readonly string[] = [
    "src/core/util/site/selectors.ts",
    "src/core/util/site/actress-links.ts"
];

const SRC = "src";
const BASELINE = "scripts/site-selector-baseline.json";

/** 转义正则元字符。 */
function escapeRegExp(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** 匹配「引号内含某站点特征串」的字面量（只统计选择器字面量，不统计注释）。 */
const SIGNATURE_RE = new RegExp(
    `['"\`][^'"\`\\n]*(?:${SITE_SIGNATURES.map(escapeRegExp).join("|")})[^'"\`\\n]*['"\`]`,
    "g"
);

/** 递归收集 src 下的 .ts/.tsx 相对路径。 */
function collectFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
            collectFiles(full, out);
        } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
            out.push(full.replace(/\\/g, "/"));
        }
    }
    return out;
}

/** 统计每个文件的站点选择器字面量数（豁免文件记 0）。 */
function countByFile(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const file of collectFiles(SRC)) {
        if (EXEMPT_FILES.includes(file)) {
            continue;
        }
        const text = readFileSync(file, "utf8");
        const hits = text.match(SIGNATURE_RE);
        if (hits && hits.length > 0) {
            counts[file] = hits.length;
        }
    }
    return counts;
}

const args = process.argv.slice(2);
const current = countByFile();
const total = Object.values(current).reduce((sum, n) => sum + n, 0);

if (args.includes("--update-baseline")) {
    const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`, "utf8");
    console.log(
        `check-site-selectors: baseline updated (${Object.keys(sorted).length} files, ${total} literals) → ${BASELINE}`
    );
    process.exit(0);
}

if (args.includes("--report")) {
    const rows = Object.entries(current).sort(([, a], [, b]) => b - a);
    console.log(`check-site-selectors: ${Object.keys(current).length} files, ${total} site-selector literals`);
    for (const [file, n] of rows) {
        console.log(`  ${String(n).padStart(3)}  ${file}`);
    }
    process.exit(0);
}

let baseline: Record<string, number> = {};
try {
    baseline = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, number>;
} catch {
    console.error(`check-site-selectors: baseline missing (${BASELINE}); run with --update-baseline once`);
    process.exit(1);
}

const violations: string[] = [];
for (const [file, n] of Object.entries(current)) {
    const allowed = baseline[file];
    if (allowed === undefined) {
        violations.push(`${file}: NEW site-selector literal(s) (${n}) — 请先加入 core/util/site/selectors.ts 注册表`);
    } else if (n > allowed) {
        violations.push(`${file}: ${n} > ${allowed} — 新增了站点选择器字面量，请改用注册表`);
    }
}

if (violations.length > 0) {
    console.error("check-site-selectors: FAIL");
    for (const v of violations) {
        console.error(`  ${v}`);
    }
    console.error("  （站点选择器请统一走 src/core/util/site/selectors.ts）");
    process.exit(1);
}

const decreased = Object.keys(baseline).filter((f) => (current[f] ?? 0) < (baseline[f] ?? 0)).length;
console.log(
    `check-site-selectors: OK (${Object.keys(current).length} files, ${total} literals; ` +
        `${decreased} file(s) below baseline — 可下调基线)`
);
process.exit(0);
