/**
 * check-structure.ts — 大文件行数 / 目录扁平度机械门禁（§10 / §11）
 *
 * 独立命令：`bun run check:structure`。不接入 build / lint / test。
 * 棘轮（ratchet）机制：对当前已超限的文件/目录以精确现状值设上限，
 * 只允许下调，不允许抬高；新文件/新目录直接受硬上限约束。
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const HARD_FILE_LIMIT = 800;
const HARD_DIR_LIMIT = 20;

// RATCHET: these are current oversized files. Lower a ceiling (or delete the entry once the file is <=800) when you split it. NEVER raise a ceiling. New files have no entry and are bound by HARD_FILE_LIMIT.
const FILE_CEILINGS: Record<string, number> = {
  "src/plugins/setting-plugin.tsx": 1564,
  "src/core/storage-manager.ts": 1324,
  "src/plugins/video-lists-tag/vlt-tags.ts": 1015,
  "src/plugins/list-page-plugin.tsx": 843,
};

// RATCHET: these are current over-flat directories. Lower a ceiling (or delete the entry once the dir is <=20) when you reorganize it. NEVER raise a ceiling. New dirs have no entry and are bound by HARD_DIR_LIMIT.
const DIR_CEILINGS: Record<string, number> = {
  "src/plugins": 39,
  "src/styles": 37,
  "src/core": 28,
};

const SRC = "src";
const violations: string[] = [];
let fileCount = 0;
let dirCount = 0;

function countLines(path: string): number {
  // Count newline-terminated lines, same as `wc -l` (number of `\n` bytes).
  const buf = readFileSync(path);
  let n = 0;
  for (const byte of buf) if (byte === 0x0a) n++;
  return n;
}

function walk(dir: string): void {
  const entries = readdirSync(dir, { withFileTypes: true });

  // Direct child files (not subdirectories) — dir flatness check.
  const directFiles = entries.filter((e) => e.isFile()).length;
  dirCount++;
  const relDir = dir.replace(/\\/g, "/");
  const dirCeiling = DIR_CEILINGS[relDir] ?? HARD_DIR_LIMIT;
  if (directFiles > dirCeiling) {
    violations.push(`${relDir}: ${directFiles} direct files > ${dirCeiling}`);
  }

  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      fileCount++;
      const rel = full.replace(/\\/g, "/");
      const lines = countLines(full);
      const ceiling = FILE_CEILINGS[rel] ?? HARD_FILE_LIMIT;
      if (lines > ceiling) {
        violations.push(`${rel}: ${lines} > ${ceiling}`);
      }
    }
  }
}

if (!statSync(SRC).isDirectory()) {
  console.error(`check-structure: src/ not found at ${process.cwd()}`);
  process.exit(1);
}

walk(SRC);

if (violations.length > 0) {
  for (const v of violations) console.log(v);
  console.log(
    `check-structure: FAIL (${violations.length} violation${violations.length === 1 ? "" : "s"})`,
  );
  process.exit(1);
}

console.log(
  `check-structure: OK (${fileCount} files, ${dirCount} dirs within limits; ` +
    `${Object.keys(FILE_CEILINGS).length} file-ceilings, ${Object.keys(DIR_CEILINGS).length} dir-ceilings in ratchet)`,
);
process.exit(0);
