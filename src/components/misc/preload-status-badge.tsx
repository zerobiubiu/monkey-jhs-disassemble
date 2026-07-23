/**
 * PreloadStatusBar / PreloadStatusBadge —— 列表页预加载实时状态徽标
 * （React 函数组件，JSX）。
 *
 * OtherSitePlugin.preloadListPage 在列表页为每个 .item 预加载 missav 等站点
 * 缓存时，于 .video-title 下方注入状态条 + 每站点状态徽标，实时反映预加载
 * 进度：排队中 / 请求中 / 成功匹配 / 匹配失败。
 *
 * 渲染方式：返回 JSX，经 jsxToString 转 HTML 字符串注入；后续状态变更由
 * OtherSitePlugin.updatePreloadStatus 直接 jQuery 修改 .jhs-ps-badge 的 class
 * 与 text（实时更新，不重建 DOM，避免布局抖动与 observer 抖动）。
 *
 * 状态条注入位置：.item > a.box 内 .video-title 的下一兄弟节点（与
 * VideoListsTag 的 .jhs-vlt-tags-display 注入点 .meta afterend 不冲突）。
 * 类名前缀 jhs-preload-status-* 不匹配任何现有 observer 的谓词
 * （.item / .tag.is-success.status-tag / .thumbnail.group 等），安全。
 */

/** 预加载状态枚举。 */
export type PreloadStatus = 'queued' | 'requesting' | 'success' | 'failed';

/** 状态 → CSS class 后缀 + 文案 映射（组件初始渲染与 jQuery 实时更新共用）。 */
export const PRELOAD_STATUS_MAP: Record<PreloadStatus, { cls: string; text: string }> = {
    queued: { cls: 'jhs-ps-queued', text: '排队中' },
    requesting: { cls: 'jhs-ps-requesting', text: '请求中' },
    success: { cls: 'jhs-ps-success', text: '成功匹配' },
    failed: { cls: 'jhs-ps-failed', text: '匹配失败' }
};

/**
 * 渲染预加载状态条容器（空，徽标由 updatePreloadStatus 动态 append）。
 * @returns `.jhs-preload-status-bar` 容器 JSX。
 */
export function PreloadStatusBar() {
    return <div className="jhs-preload-status-bar" />;
}

/** PreloadStatusBadge 的属性。 */
export interface PreloadStatusBadgeProps {
    /** 站点 id（如 "missAvBtn"）。 */
    siteId: string;
    /** 站点显示名（id 去 "Btn" 后缀）。 */
    siteName: string;
    /** 初始状态。 */
    status: PreloadStatus;
}

/**
 * 渲染单站点预加载状态徽标 JSX。
 * @returns `.jhs-preload-status` 徽标 JSX，经 jsxToString 转 HTML 字符串后 append 到状态条。
 */
export function PreloadStatusBadge({ siteId, siteName, status }: PreloadStatusBadgeProps) {
    const { cls, text } = PRELOAD_STATUS_MAP[status];
    return (
        <span className="jhs-preload-status" data-site-id={siteId}>
            <span className="jhs-ps-name">{siteName}</span>
            <span className={`jhs-ps-badge ${cls}`}>{text}</span>
        </span>
    );
}
