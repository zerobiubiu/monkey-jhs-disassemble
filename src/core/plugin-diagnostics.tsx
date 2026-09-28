/**
 * 插件诊断模块 — 渲染插件执行状态 + 注册 Tampermonkey 菜单命令。
 * 从 main.tsx 提取（doc/133），供设置面板「📊 插件诊断」面板复用。
 *
 * HTML 渲染经 DiagnosticsTable 组件（src/components/diagnostics-table.tsx）
 * + jsxToString 输出（doc/16 统一规定），不再手写模板字符串；插件名由
 * jsxToString 文本转义保护（等价原 escapeHtml，良构数据下 DOM 等价）。
 * 纯文本报告（renderDiagnosticsText）与表格同源 plugins 聚合数据，含两阶段
 * 状态/耗时/错误/页面类型/站点/Flag 字段。
 */
import { jsxToString } from './jsx-to-string';

import type { PluginManager } from '../plugins/plugin-manager';

import { DiagnosticsTable } from '../components/log/diagnostics-table';
import { DiagnosticsWrapper } from '../components/log/diagnostics-wrapper';

/** 渲染诊断表格 HTML（供 layer.open / 设置面板复用）。 */
export function renderDiagnosticsHtml(pluginManager: PluginManager): string {
    return jsxToString(<DiagnosticsTable data={pluginManager.getDiagnostics().plugins} />);
}

/** 生成纯文本诊断报告（供复制到剪贴板）。 */
export function renderDiagnosticsText(pluginManager: PluginManager): string {
    const diag = pluginManager.getDiagnostics();
    const plugins = diag.plugins;
    const cssOk = plugins.filter((p) => p.cssStatus === 'fulfilled').length;
    const handleOk = plugins.filter((p) => p.handleStatus === 'fulfilled').length;
    const failed = plugins.filter((p) => p.cssStatus === 'rejected' || p.handleStatus === 'rejected');
    const skipped = plugins.filter((p) => p.cssStatus === 'skipped' && p.handleStatus === 'skipped');
    const flagged = plugins.filter((p) => p.isFeatureFlagged);
    const totalMs = plugins.reduce((sum, p) => sum + (p.totalDurationMs ?? 0), 0);
    const lines = plugins.map((p) => {
        const icon =
            p.cssStatus === 'rejected' || p.handleStatus === 'rejected'
                ? '❌'
                : p.cssStatus === 'skipped' && p.handleStatus === 'skipped'
                  ? '⏭️'
                  : '✅';
        const parts = [
            `${icon} ${p.name}`,
            `CSS:${p.cssStatus}${p.cssDurationMs != null ? `(${p.cssDurationMs}ms)` : ''}`,
            `Handle:${p.handleStatus}${p.handleDurationMs != null ? `(${p.handleDurationMs}ms)` : ''}`,
            `总耗时:${p.totalDurationMs != null ? `${p.totalDurationMs}ms` : '-'}`
        ];
        if (p.pageTypes.length) parts.push(`页面:[${p.pageTypes.join(',')}]`);
        if (p.sites.length) parts.push(`站点:[${p.sites.join(',')}]`);
        if (p.isFeatureFlagged) parts.push(`Flag:${p.featureFlagName}`);
        if (p.cssError) parts.push(`CSS错误:${p.cssError}`);
        if (p.handleError) parts.push(`Handle错误:${p.handleError}`);
        return parts.join(' | ');
    });
    return [
        'JavDB Power Tools 插件诊断报告',
        `总计 ${diag.total} 个插件 | CSS ${cssOk}/${diag.total} | Handle ${handleOk}/${diag.total} | 总耗时 ${totalMs}ms`,
        `失败 ${failed.length} 个 | 跳过 ${skipped.length} 个 | Feature Flag ${flagged.length} 个`,
        '',
        ...lines
    ].join('\n');
}

// ===== 页内缓存诊断（doc/40）=====
//
// 为什么内置：油猴脚本运行在**沙箱**中，devtools 控制台（页面主世界）看不到脚本内的
// `storageManager` 等全局，因此“手打探针”在控制台里必然拿到 undefined；
// 诊断入口必须由脚本自己提供（GM 菜单 → 沙箱内执行）。

/** GM 存储键：上次「① 记录」的快照。 */
const CACHE_PROBE_KEY = 'jhs:cache-probe';

/** 设置缓存探针需要的最小接口（便于测试注入替身）。 */
export interface SettingsReader {
    /** 读取设置项。 */
    getSetting(key: string | null, defaultValue?: unknown): Promise<unknown>;
}

/** 缓存诊断快照。 */
export interface CacheProbeSnapshot {
    /** 记录时刻（ms）。 */
    wall: number;
    /** 记录所在帧。 */
    frame: 'top' | 'iframe';
    /** 记录时设置缓存是否已就绪（非空）。 */
    warm: boolean;
    /** 该次设置读取耗时（ms）。 */
    readMs: number;
}

/** 当前帧标识。 */
function frameTag(): 'top' | 'iframe' {
    return window.top === window ? 'top' : 'iframe';
}

/**
 * 运行时读取「设置缓存是否已就绪」。
 *
 * `cacheSettingObj` 是 StorageManager 的私有字段（编译期私有、运行时可见），
 * 这里只做诊断读取，不改写。
 */
function isSettingCacheWarm(sm: SettingsReader): boolean {
    const cache = (sm as unknown as { cacheSettingObj?: unknown }).cacheSettingObj;
    return cache != null;
}

/** 读取一次设置并计时（同时会填充缓存）。 */
async function timedSettingRead(sm: SettingsReader): Promise<number> {
    const t0 = performance.now();
    await sm.getSetting('dialogOpenDetail', 'yes');
    return performance.now() - t0;
}

/**
 * ① 记录当前缓存状态（建议在**操作之前**、于父页执行）。
 *
 * @param sm 存储管理器（或其替身）
 * @returns 本次快照
 */
export async function captureCacheProbe(sm: SettingsReader): Promise<CacheProbeSnapshot> {
    const readMs = await timedSettingRead(sm);
    const snapshot: CacheProbeSnapshot = {
        wall: Date.now(),
        frame: frameTag(),
        warm: isSettingCacheWarm(sm),
        readMs
    };
    try {
        GM_setValue(CACHE_PROBE_KEY, JSON.stringify(snapshot));
    } catch {
        /* 存储不可用不影响诊断 */
    }
    return snapshot;
}

/** 读取上次快照（无则 null）。 */
export function readCacheProbeSnapshot(): CacheProbeSnapshot | null {
    try {
        const raw = GM_getValue(CACHE_PROBE_KEY, null) as unknown;
        if (typeof raw === 'string') return JSON.parse(raw) as CacheProbeSnapshot;
        return (raw as CacheProbeSnapshot) ?? null;
    } catch {
        return null;
    }
}

/**
 * ② 检查当前状态并与上次快照对比，返回可读报告。
 *
 * 判据（doc/39/40）：iframe 里做过一次操作后，父页设置缓存**应当仍是热的**
 * （数据写入不得连带清设置缓存）；若为空且读取耗时明显偏高，说明仍走了 IndexedDB。
 *
 * @param sm 存储管理器（或其替身）
 * @returns 多行报告文本
 */
export async function checkCacheProbe(sm: SettingsReader): Promise<string> {
    const before = readCacheProbeSnapshot();
    const warm = isSettingCacheWarm(sm);
    const readMs = await timedSettingRead(sm);
    return [
        `JHS 缓存诊断（当前帧 ${frameTag()}）`,
        before
            ? `快照：${new Date(before.wall).toLocaleTimeString()} 帧=${before.frame} 缓存=${before.warm ? '已就绪' : '空'} 读取=${before.readMs.toFixed(2)}ms`
            : '快照：无（请先执行「① 记录当前状态」）',
        `当前：缓存=${warm ? '已就绪' : '空'}，本次读取 ${readMs.toFixed(2)}ms`,
        '',
        warm
            ? 'OK 设置缓存仍是热的 —— 数据写入没有连带清掉它（doc/39 修复生效）'
            : 'BAD 设置缓存是空的 —— 若刚在 iframe 做过操作，说明仍被数据写入连带清除',
        readMs > 5 ? 'WARN 读取耗时 >5ms，提示走了数据库而非内存' : 'OK 读取耗时正常（内存命中量级）'
    ].join('\n');
}

/** 注册 Tampermonkey 菜单命令（main.tsx 启动序列末尾调用）。 */
export function registerDiagnosticsMenu(pluginManager: PluginManager): void {
    GM_registerMenuCommand('📊 插件诊断', () => {
        const diag = pluginManager.getDiagnostics();
        const failed = diag.handle.filter((p) => p.status === 'rejected');
        layer.open({
            type: 1,
            title: `插件诊断 — 共 ${diag.total} 个插件，${failed.length} 个失败`,
            area: ['600px', '70%'],
            content: jsxToString(<DiagnosticsWrapper html={renderDiagnosticsHtml(pluginManager)} />)
        });
    });

    // ===== 缓存诊断（doc/40）：沙箱内执行，结果进日志面板 + 剪贴板 =====
    GM_registerMenuCommand('🧪 缓存诊断 ①：记录当前状态', () => {
        void (async () => {
            const snapshot = await captureCacheProbe(storageManager as unknown as SettingsReader);
            const msg = `已记录（帧=${snapshot.frame}）：缓存=${snapshot.warm ? '已就绪' : '空'}，读取 ${snapshot.readMs.toFixed(2)}ms`;
            clog.log(`[JHS-缓存诊断] ${msg}`);
            show.ok(msg);
        })();
    });
    GM_registerMenuCommand('🧪 缓存诊断 ②：检查是否被清', () => {
        void (async () => {
            const report = await checkCacheProbe(storageManager as unknown as SettingsReader);
            clog.log(`[JHS-缓存诊断]\n${report}`);
            try {
                await navigator.clipboard.writeText(report);
                show.ok('诊断结果已复制到剪贴板（全文见日志面板）');
            } catch {
                show.error('复制失败，请从日志面板查看结果');
            }
        })();
    });
}
