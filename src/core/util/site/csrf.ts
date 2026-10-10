/**
 * CSRF 令牌读取 —— JavDB 站点提供的 `meta[name="csrf-token"]`（doc/47）。
 *
 * 重构前同一读取散落 5 处（`vlt-helpers`、`jhs-sync/sync-common`、
 * `dpb-rating-api`、`vlt-create-list-api`、`new-video/actress-card-renderer`），
 * 其中两处**逐字重复**、两处各自加了不同的兜底（表单单字段 / 无引号选择器）。
 * 选择器与取字段完全一致，差异只在「无 meta 时返回 null 还是空串」——
 * 统一为 `null`（调用方一律按 falsy 判定，语义不变）。
 *
 * 归入 `util/site/`：meta 令牌是**站点原生 DOM 事实**（同目录还有站点选择器注册表、
 * 演员链接兼容、MissAV 路径判定）。
 */

/**
 * 读取页面 CSRF 令牌。
 *
 * @returns 令牌字符串；页面无 `meta[name="csrf-token"]` 时返回 null
 */
export function getCsrfToken(): string | null {
    const meta = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement | null;
    return meta ? meta.content : null;
}

/**
 * 表单提交场景读取令牌：meta 缺失时回退到表单内的 `authenticity_token` 字段。
 *
 * 这是 `vlt-create-list-api` 建清单路径的既有口径（meta 优先、表单字段兜底、
 * 都缺则空串），单独具名以避免被当成通用读取。
 *
 * @param formData 表单字段（键为表单字段名）
 * @returns 令牌字符串；两处都没有时为空串
 */
export function getCsrfTokenWithFormFallback(formData: Record<string, unknown>): string {
    const token = getCsrfToken();
    if (token) return token;
    const fromForm = formData['authenticity_token'];
    return typeof fromForm === 'string' ? fromForm : '';
}