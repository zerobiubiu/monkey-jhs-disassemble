/**
 * 升级特性开关中心（doc/76/78 引入；doc/165 收敛为强类型契约）。
 *
 * 运行时读 `localStorage['jhs_upgrade_flags']`（JSON）覆盖默认值，便于对比调试：
 * 在控制台执行
 *   localStorage.setItem('jhs_upgrade_flags', JSON.stringify({ caseInsensitiveCarNum: false }))
 * 即可回退该项到旧逻辑，刷新页面生效。
 *
 * 类型契约：{@link FeatureFlags} 以**封闭接口**（无索引签名）声明全部已知开关，
 * 取代原先的弱类型 `Record<string, boolean>`，使键集合成为编译期可校验的文档化契约，
 * 与项目其余强类型代码风格统一。所有读取点均为按名访问（`featureFlags.xxx`），
 * 故封闭接口不破坏任何调用点；下方 IIFE 的 `Object.assign` 覆盖语义**逐字节保留**，
 * 未知覆盖键在类型层不被承认、在运行期无害（与旧行为一致）。
 *
 * 行为不变量（doc/165）：键集合、默认布尔值、localStorage 覆盖合并逻辑均与收敛前
 * 完全一致；本轮仅收紧静态类型与补全文档，不增删开关、不改默认值。
 */

/**
 * 全部已知特性开关的封闭契约。每个键对应一项可被 localStorage 覆盖的升级开关；
 * 默认值即「全开/全关」基线，注释标明其门控的代码位置或插件。
 */
export interface FeatureFlags {
    // —— 行为优化（批次 A）——
    /** 升级签名 300s 缓存窗口（constants/api.ts 签名复用判定）。 */
    upgradeSignature300s: boolean;
    /** 番号匹配忽略大小写（storage-manager / 列表 / 想看已看 等多处）。 */
    caseInsensitiveCarNum: boolean;
    /** 自动翻页是否改写地址栏 history（doc/121 后运行时代码已不读取，保留默认值以维持覆盖键契约）。 */
    autoPageReplaceState: boolean;
    /** 想看/已看列表批量解析路径（want-and-watched-videos-plugin）。 */
    wantWatchBatchImport: boolean;
    /** 列表页是否按设置显示影片类型（list-page-plugin）。 */
    movieShowTypeVisibility: boolean;
    /** 读取缓存时是否深拷贝/冻结（storage-manager 多处 get*List）。 */
    storageCacheDeepCopy: boolean;
    /** WebDAV 建目录幂等：先 PROPFIND 再 MKCOL（webdav.ts）。 */
    webdavIdempotentMkdir: boolean;
    /** 西方番号格式归一（base-plugin._formatWesternCar）。 */
    westernCarFormat: boolean;
    /** 演员名 user-select:all（经组件 prop 间接生效；保留覆盖键契约）。 */
    actressUserSelectAll: boolean;
    /** 禁用导航搜索框粘贴增强（nav-bar-plugin）。 */
    navBarNoPaste: boolean;

    // —— 基础设施 + 独立新插件（批次 B）——
    /** 详情页标题翻译插件注册/handle 开关（main.tsx / translate-plugin）。 */
    translatePlugin: boolean;
    /** javstore 截图墙插件注册/handle 开关（main.tsx / screenshot-plugin）。 */
    screenShotPlugin: boolean;
    /** FC2-123Av 列表走聚合 API 渲染（fc2-by-123av-plugin）。 */
    javDbApiAggregate: boolean;

    // —— 依赖型新插件（批次 C）——
    /** 多引擎磁链聚合插件注册与按钮渲染开关（main.tsx / magnet-hub / detail-page-button / nav-bar）。 */
    magnetHubPlugin: boolean;
    /** 以图识图插件注册与入口绑定开关（main.tsx / image-recognition / nav-bar）。 */
    imageRecognitionPlugin: boolean;

    // —— 复合型新插件（批次 D）——
    /** 123Av FC2 浏览插件注册与 handle 开关（main.tsx / fc2-by-123av-plugin）。 */
    fc2By123AvPlugin: boolean;
}

export const featureFlags: FeatureFlags = {
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
