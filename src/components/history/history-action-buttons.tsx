/**
 * HistoryActionButtons —— 鉴定记录表格行操作按钮组（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 loadTableData（L616 操作列
 * formatter）：行内操作区——
 *   - sub-btns 下拉：变更按钮（sub-btns-toggle，黄色）+ 子菜单
 *     （编辑 history-editBtn 蓝 / 移除 history-deleteBtn 灰 /
 *      已观看 history-hasWatchBtn / 收藏 history-favoriteBtn / 屏蔽 history-filterBtn）
 *   - 详情页按钮 history-detailBtn（蓝色）
 * 外层 div.action-btns 带 data-car-num / data-href 数据属性。
 *
 * 保留原 HTML 结构、id/class、内联 style 值（display:flex / gap:5px /
 * justify-content:center / 各按钮 background-color 与 color、`!important`/
 * 普通值原样保留）、data-* 属性零偏差。番号/链接通过 data-* 属性注入；
 * 已观看/收藏/屏蔽三按钮的背景色与文案通过 props 注入（对应原
 * WATCHED_COLOR/TEXT、FAVORITE_COLOR/TEXT、BLOCK_COLOR/TEXT）。原模板中的
 * `\n` 转义与缩进、闭合标签由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadTableData 操作列 formatter
 * `return jsxToString(<HistoryActionButtons carNum={...} ... />)` 消费。编辑
 * 按钮的 click 绑定（onRendered 回调内 addEventListener）仍由 formatter 持有，
 * 组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值（data-car-num/data-href）不做转义，与原
 * Tabulator formatter 字符串返回行为一致。
 */

/** HistoryActionButtons 的属性。 */
export interface HistoryActionButtonsProps {
    /** 行记录番号（写入 data-car-num）。 */
    carNum: string;
    /** 行记录来源链接（写入 data-href，空字符串表示无链接）。 */
    url: string;
    /** 已观看按钮背景色（原 WATCHED_COLOR）。 */
    watchedColor: string;
    /** 已观看按钮文案（原 WATCHED_TEXT）。 */
    watchedText: string;
    /** 收藏按钮背景色（原 FAVORITE_COLOR）。 */
    favoriteColor: string;
    /** 收藏按钮文案（原 FAVORITE_TEXT）。 */
    favoriteText: string;
    /** 屏蔽按钮背景色（原 BLOCK_COLOR）。 */
    blockColor: string;
    /** 屏蔽按钮文案（原 BLOCK_TEXT）。 */
    blockText: string;
}

/**
 * 渲染鉴定记录表格行操作按钮组的 JSX。
 * @param props.carNum 行记录番号。
 * @param props.url 行记录来源链接（空串表示无）。
 * @param props.watchedColor 已观看按钮背景色。
 * @param props.watchedText 已观看按钮文案。
 * @param props.favoriteColor 收藏按钮背景色。
 * @param props.favoriteText 收藏按钮文案。
 * @param props.blockColor 屏蔽按钮背景色。
 * @param props.blockText 屏蔽按钮文案。
 * @returns 操作按钮组 React 元素，经 jsxToString 转 HTML 字符串后供
 *          Tabulator formatter return。
 */
export function HistoryActionButtons({
    carNum,
    url,
    watchedColor,
    watchedText,
    favoriteColor,
    favoriteText,
    blockColor,
    blockText
}: HistoryActionButtonsProps) {
    return (
        <div
            className="action-btns"
            style={{
                display: 'flex',
                gap: '5px',
                justifyContent: 'center'
            }}
            data-car-num={carNum}
            data-href={url}
        >
            <div className="sub-btns">
                <a
                    className="jhs-toolbar-menu-btn sub-btns-toggle"
                    style={{
                        backgroundColor: '#c59d36',
                        color: 'white',
                        marginBottom: '5px'
                    }}
                >
                    <span>✏️ 变更</span>
                </a>
                <div className="sub-btns-menu">
                    <a
                        className="jhs-toolbar-menu-btn history-editBtn"
                        style={{
                            backgroundColor: '#007bff',
                            color: 'white',
                            marginBottom: '5px'
                        }}
                    >
                        <span>✏️ 编辑</span>
                    </a>
                    <a
                        className="jhs-toolbar-menu-btn history-deleteBtn"
                        style={{
                            backgroundColor: '#8c8080',
                            color: 'white',
                            marginBottom: '5px'
                        }}
                    >
                        <span>✂️ 移除</span>
                    </a>
                    <a
                        className="jhs-toolbar-menu-btn history-hasWatchBtn"
                        style={{
                            backgroundColor: watchedColor,
                            marginBottom: '5px'
                        }}
                    >
                        {watchedText}
                    </a>
                    <a
                        className="jhs-toolbar-menu-btn history-favoriteBtn"
                        style={{
                            backgroundColor: favoriteColor,
                            marginBottom: '5px'
                        }}
                    >
                        {favoriteText}
                    </a>
                    <a
                        className="jhs-toolbar-menu-btn history-filterBtn"
                        style={{
                            backgroundColor: blockColor,
                            marginBottom: '5px'
                        }}
                    >
                        {blockText}
                    </a>
                </div>
            </div>
            <a
                className="jhs-toolbar-menu-btn history-detailBtn"
                style={{
                    backgroundColor: '#3397de',
                    color: 'white',
                    marginBottom: '5px'
                }}
            >
                <span>📄 详情页</span>
            </a>
        </div>
    );
}
