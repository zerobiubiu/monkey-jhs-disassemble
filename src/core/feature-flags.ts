/**
 * 升级特性开关中心。
 * 运行时读 localStorage['jhs_upgrade_flags']（JSON）覆盖默认值，
 * 便于对比调试：在控制台执行
 *   localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ caseInsensitiveCarNum: false }))
 * 即可回退该项到旧逻辑，刷新页面生效。
 */
export const featureFlags: Record<string, boolean> = {
    // —— 行为优化（批次 A）——
    upgradeSignature300s: true,
    caseInsensitiveCarNum: true,
    autoPageReplaceState: true,
    wantWatchBatchImport: true,
    movieShowTypeVisibility: true,
    storageCacheDeepCopy: true,
    webdavIdempotentMkdir: true,
    westernCarFormat: true,
    actressUserSelectAll: true,
    navBarNoPaste: false,
    // —— 基础设施 + 独立新插件（批次 B）——
    translatePlugin: true,
    screenShotPlugin: true,
    javDbApiAggregate: true,
    // —— 依赖型新插件（批次 C）——
    magnetHubPlugin: true,
    imageRecognitionPlugin: true,
    // —— 复合型新插件（批次 D）——
    fc2By123AvPlugin: true
};

(() => {
    try {
        const stored = JSON.parse(localStorage.getItem('jhs_upgrade_flags') || '{}');
        Object.assign(featureFlags, stored);
    } catch {
        /* 解析失败保持默认 */
    }
})();
