/**
 * NewVideoDialog —— 新作品检测面板（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 openDialog（L128-143，
 * 原 archetype/jhs.user.js L11064 的 layer.open content）：顶部工具栏
 * （新作品计数 span + paramActressType 类型下拉 + reLoad 刷新按钮，按钮
 * 内嵌刷新 SVG 图标）+ 女优卡片网格容器（actress-card-container）+
 * 分页容器（actress-pagination），整体 flex 纵向布局。
 *
 * 保留原 HTML 结构、id（checkNewVideoMsg/paramActressType/reLoad/
 * actress-card-container/actress-pagination）、类名（newVideoToolBox/
 * a-normal/jhs-scrollbar）、内联 style（经 CSSProperties 对象还原为 kebab-case
 * CSS 字符串，值原样保留）；刷新按钮内嵌的 SVG 图标（原 this.refreshSvg，
 * BasePlugin 实例属性，为原始 SVG HTML 字符串）通过 props 注入，以
 * `dangerouslySetInnerHTML={{ __html: ... }}` 注入 `<a>`，避免 jsxToString
 * 转义 SVG 的 `<`/`>`。原 `<option value="all" selected>` 在 JSX 中写作
 * `<option value="all" selected>`（裸属性，等价 `selected={true}`），
 * jsxToString 输出裸 `selected`，与原 HTML 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openDialog 中 layer.open({ content })
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<NewVideoDialog refreshSvg={...} />), ... })`
 * 数据加载（loadData）、按钮/筛选绑定（bindClick）、ESC 关闭仍由 openDialog
 * 的 success 回调持有，组件只负责静态结构 + 动态 SVG 插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。本面板含动态值（刷新 SVG），故用 props。
 */

/** NewVideoDialog 的属性。 */
interface NewVideoDialogProps {
    /** 刷新按钮内嵌的 SVG 图标字符串（原 this.refreshSvg，BasePlugin 实例属性）。 */
    refreshSvg: string;
}

/**
 * 渲染新作品检测面板的 JSX。
 * @param props.refreshSvg 刷新按钮内嵌的 SVG 图标字符串。
 * @returns 新作品检测面板 JSX（工具栏 + 卡片容器 + 分页容器），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 直接消费。
 */
export function NewVideoDialog({ refreshSvg }: NewVideoDialogProps) {
    return (
        <div
            className="newVideoToolBox"
            style={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
                padding: '10px'
            }}
        >
            <div
                style={{
                    marginBottom: '15px',
                    display: 'flex',
                    justifyContent: 'space-between'
                }}
            >
                <div>
                    <span id="checkNewVideoMsg"></span>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    <select
                        id="paramActressType"
                        style={{
                            textAlign: 'center',
                            height: '100%',
                            minWidth: '150px',
                            border: '1px solid #ddd',
                            marginRight: '10px'
                        }}
                    >
                        <option value="all" selected>
                            所有
                        </option>
                        <option value="uncensored">无码</option>
                        <option value="censored">有码</option>
                        <option value="">未知</option>
                    </select>
                    <a
                        className="a-normal"
                        id="reLoad"
                        dangerouslySetInnerHTML={{
                            __html: `${refreshSvg} &nbsp;&nbsp; 刷新`
                        }}
                    />
                </div>
            </div>
            <div id="actress-card-container" className="jhs-scrollbar"></div>
            <div id="actress-pagination"></div>
        </div>
    );
}
