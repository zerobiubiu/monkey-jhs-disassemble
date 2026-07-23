/**
 * Fc2MagnetItem —— FC2 详情弹窗磁力列表单条（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-plugin.tsx 的 handleMagnets（L321-342 的
 * `magnetsHtml +=` 模板字符串）：
 *   - div.item.columns.is-desktop 行容器（奇偶行 class 由 rowClass prop 注入，
 *     调用方按 `i % 2 === 0 ? 'odd' : ''` 计算）
 *   - magnet-name 列：磁链 `<a href="magnet:?xt=urn:btih:<hash>">` 内
 *     名称 span.name + 元信息 span.meta（`<size>GB, <files>個文件`）
 *     + tags（高清 / 字幕 条件渲染）
 *   - buttons 列：copy-to-clipboard 复制按钮（data-clipboard-text 携带磁链）
 *   - date 列：created_at 时间 span.time
 *
 * 保留原 class/结构/属性原样不动。原模板中 `<a>` 内嵌套 `<div class="tags">`
 * 的非法 HTML 结构原样保留（浏览器解析行为一致）。`magnet:` 协议经
 * jsxToString sanitizeUrl 校验（不在拦截名单，原样输出）；按钮文案
 * `&nbsp;複製&nbsp;` 以 JSX 实体 `&nbsp;` 书写，输出等价。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleMagnets 循环消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串后拼接：
 *   `magnetsHtml += jsxToString(<Fc2MagnetItem magnet={magnet} rowClass={rowClass} />)`
 * 复制按钮的点击事件（.copy-to-clipboard 委托绑定）由全局脚本持有，
 * 组件只负责单条磁力的静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** 磁力条目对象（API magnets 数组元素，本组件消费字段）。 */
export interface Fc2MagnetData {
    /** BTIH hash（拼入 magnet 链接与复制按钮 data-clipboard-text）。 */
    hash: string;
    /** 磁力名称。 */
    name: string;
    /** 大小（MB，渲染时 `/ 1024` 转 GB）。 */
    size: number;
    /** 文件数。 */
    files_count: number;
    /** 是否高清（渲染「高清」tag）。 */
    hd?: boolean;
    /** 是否有字幕（渲染「字幕」tag）。 */
    cnsub?: boolean;
    /** 创建时间文本。 */
    created_at: string;
}

/** Fc2MagnetItem 的属性。 */
export interface Fc2MagnetItemProps {
    /** 磁力条目对象。 */
    magnet: Fc2MagnetData;
    /** 行 class 附加段（原 rowClass：偶数行 'odd'，奇数行 ''）。 */
    rowClass: string;
}

/**
 * 渲染单条磁力列表项的 JSX。
 * @param props.magnet 磁力条目（hash/name/size/files_count/hd/cnsub/created_at）
 * @param props.rowClass 行 class 附加段
 * @returns item 行 JSX，经 jsxToString 转 HTML 字符串后供拼接
 *          `$('#magnets-content').html(...)` 消费。
 */
export function Fc2MagnetItem({ magnet, rowClass }: Fc2MagnetItemProps) {
    const magnetUri = `magnet:?xt=urn:btih:${magnet.hash}`;
    return (
        <div className={`item columns is-desktop ${rowClass}`}>
            <div className="magnet-name column is-four-fifths">
                <a href={magnetUri} title="右鍵點擊並選擇「複製鏈接地址」">
                    <span className="name">{magnet.name}</span>
                    <br />
                    <span className="meta">
                        {(magnet.size / 1024).toFixed(2)}GB, {magnet.files_count}個文件
                    </span>
                    <br />
                    <div className="tags">
                        {magnet.hd ? (
                            <span className="tag is-primary is-small is-light">高清</span>
                        ) : (
                            ''
                        )}
                        {magnet.cnsub ? (
                            <span className="tag is-warning is-small is-light">字幕</span>
                        ) : (
                            ''
                        )}
                    </div>
                </a>
            </div>
            <div className="buttons column">
                <button
                    className="button is-info is-small copy-to-clipboard"
                    data-clipboard-text={magnetUri}
                    type="button"
                >
                    &nbsp;複製&nbsp;
                </button>
            </div>
            <div className="date column">
                <span className="time">{magnet.created_at}</span>
            </div>
        </div>
    );
}
