/**
 * MagnetResultCard —— 磁链搜索结果卡片（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/magnet-hub-plugin.tsx 的 displayResults（L194-205，原
 * `$(`<div class="magnet-result">...`)` 模板字符串）：标题行（.magnet-title
 * 内 `<a href={magnet}>` 链接）+ 信息行（.magnet-info 内大小/日期两个
 * `<span>`，空值回退「未知」由调用方以 `|| '未知'` 传入）+ 复制行
 * （.magnet-copy 内 .magnet-hub-btn.copy-btn 按钮，data-magnet 携带磁链
 * 供点击复制事件读取）。
 *
 * 保留原类名/结构/属性顺序原样不动（本卡片无内联 style）。`href` 经
 * jsxToString 的 sanitizeUrl 校验（magnet: 协议不在拦截名单，原样输出）；
 * `data-magnet` 经 escapeAttr 转义 `&<>"`——磁链中 `&` 被转义为 `&amp;`
 * 后，jQuery `.data('magnet')` 读取时 HTML 解析自动还原为 `&`，复制结果
 * 与原模板一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 displayResults 中 `$()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `const $result = $(jsxToString(<MagnetResultCard magnet={...} title={...} size={...} date={...} />))`
 * 复制按钮的点击事件（.copy-btn 委托绑定）仍由 displayResults 持有，
 * 组件只负责单条结果的静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** MagnetResultCard 的属性。 */
export interface MagnetResultCardProps {
    /** 磁链地址（原 result.magnet，同时作为标题链接 href 与复制按钮 data-magnet）。 */
    magnet: string;
    /** 结果标题（原 result.title，作为链接文本）。 */
    title: string;
    /** 大小显示文本（原 `result.size || '未知'`，回退由调用方处理）。 */
    size: string;
    /** 日期显示文本（原 `result.date || '未知'`，回退由调用方处理）。 */
    date: string;
}

/**
 * 渲染单条磁链搜索结果卡片的 JSX。
 * @param props.magnet 磁链地址
 * @param props.title 结果标题
 * @param props.size 大小显示文本
 * @param props.date 日期显示文本
 * @returns 结果卡片 JSX，经 jsxToString 转 HTML 字符串后供
 *          `$(html)` 创建后 `.append()` 消费。
 */
export function MagnetResultCard({ magnet, title, size, date }: MagnetResultCardProps) {
    return (
        <div className="magnet-result">
            <div className="magnet-title">
                <a href={magnet}>{title}</a>
            </div>
            <div className="magnet-info">
                <span>大小: {size}</span>
                <span>日期: {date}</span>
            </div>
            <div className="magnet-copy">
                <button className="magnet-hub-btn copy-btn" data-magnet={magnet}>
                    复制链接
                </button>
            </div>
        </div>
    );
}
