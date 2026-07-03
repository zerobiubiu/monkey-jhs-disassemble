/**
 * CdnSelectDialog —— 头像 CDN 源选择弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 editActress 内 #select-cdn-btn
 * 点击回调（L354-359，原 archetype/jhs.user.js L11238 的 layer.open
 * content）：标题提示（当前源名称）+ 一组单选按钮（cdn-${index}，每个源
 * 一项，含名称与 jsdelivr 推荐标记，当前源默认 checked）+ 切换说明小字。
 *
 * 保留原 HTML 结构、id（cdn-${index}）、name（cdn-source）、内联 style
 * 原样不动；\n 转义与缩进亦原样保留，与原 content 字符串零偏差。
 * 原代码先在 editActress 内 `GFRIENDS_SOURCES.map(...)` 拼出
 * radioButtonsHtml，再拼到外层 cdnDialogContent；本组件将两步合并内部完成，
 * sources（含 name/json 字段）与 currentIndex（当前选中索引）通过 props
 * 注入，组件内 map 生成单选按钮并按 currentIndex 标记 checked。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 editActress 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: CdnSelectDialog({ sources, currentIndex }), ... })`
 * 确定按钮（yes 回调读取选中值、写 localStorage、clearCache、清 IndexedDB、
 * show.ok）仍由 editActress 持有，组件只负责静态结构 + 动态单选列表插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本弹窗含动态值（源列表/当前索引），故用 props。
 */

/** CdnSelectDialog 的单个 CDN 源（结构兼容 ../resources/gfriends 的 GfriendsSource 子集）。 */
export interface CdnSelectSource {
    /** 源显示名称（原 GfriendsSource.name）。 */
    name: string;
    /** 源 Filetree.json URL（原 GfriendsSource.json，用于判断是否 jsdelivr 推荐源）。 */
    json: string;
}

/** CdnSelectDialog 的属性。 */
interface CdnSelectDialogProps {
    /** CDN 源列表（原 GFRIENDS_SOURCES，每项需 name/json 字段）。 */
    sources: CdnSelectSource[];
    /** 当前选中的源索引（原 getCurrentCdnSource().index，用于标题提示与单选 checked）。 */
    currentIndex: number;
}

/**
 * 渲染头像 CDN 源选择弹窗的 HTML 字符串。
 * @param props.sources CDN 源列表（含 name/json）。
 * @param props.currentIndex 当前选中的源索引。
 * @returns CDN 源选择弹窗 HTML（标题提示 + 单选按钮组 + 切换说明），
 *          供 layer.open({ content }) 直接消费。
 */
export function CdnSelectDialog({
    sources,
    currentIndex,
}: CdnSelectDialogProps): string {
    const radioButtonsHtml: string = sources
        .map(
            (source, index) =>
                `\n        <div style="margin-bottom: 10px;">\n            <input type="radio" id="cdn-${index}" name="cdn-source" value="${index}" ${index === currentIndex ? "checked" : ""} style="margin-right: 10px;">\n            <label for="cdn-${index}">${source.name} ${source.json.includes("jsdelivr") ? "(推荐)" : ""}</label>\n        </div>\n    `,
        )
        .join("");
    return `\n        <div style="padding: 20px;">\n            <p style="margin-bottom: 15px; font-weight: bold; color: #333;">请选择头像数据源 (当前: ${sources[currentIndex].name}):</p>\n            ${radioButtonsHtml}\n            <p style="margin-top: 20px; color: #555; font-size: 12px;">切换源会清除本地缓存的数据，并在下次搜索时重新加载。</p>\n        </div>\n    `;
}
