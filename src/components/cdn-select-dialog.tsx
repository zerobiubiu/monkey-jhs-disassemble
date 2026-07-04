/**
 * CdnSelectDialog —— 头像 CDN 源选择弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 editActress 内 #select-cdn-btn
 * 点击回调（L354-359，原 archetype/jhs.user.js L11238 的 layer.open
 * content）：标题提示（当前源名称）+ 一组单选按钮（cdn-${index}，每个源
 * 一项，含名称与 jsdelivr 推荐标记，当前源默认 checked）+ 切换说明小字。
 *
 * 保留原 HTML 结构、id（cdn-${index}）、name（cdn-source）、内联 style（经
 * CSSProperties 对象还原为 kebab-case CSS 字符串，值原样保留）。原代码先在
 * editActress 内 `GFRIENDS_SOURCES.map(...)` 拼出 radioButtonsHtml，再拼到
 * 外层 cdnDialogContent；本组件将两步合并内部完成，sources（含 name/json
 * 字段）与 currentIndex（当前选中索引）通过 props 注入，组件内 map 生成
 * 单选按钮并按 currentIndex 标记 checked（写作 `checked={index === currentIndex}`，
 * jsxToString 输出裸 `checked` 或省略，与原 `${index === currentIndex ? "checked" : ""}`
 * 等价）。
 *
 * `<label for="cdn-${index}">` 中的 `for` 是 JSX/JS 保留字，不能直接写为
 * JSX 属性名；jsxToString 不处理 `htmlFor`→`for`（仅处理 `className`→`class`），
 * 若用 `htmlFor` 会输出 `htmlFor="..."`，浏览器不认。故用 spread
 * `{...({ for: ... } as any)}` 绕过 JSX 解析与 TS 类型检查，jsxToString 直接
 * 读 props key 输出 `for="cdn-0"`，与原 HTML 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 editActress 中 layer.open({ content })
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<CdnSelectDialog sources={...} currentIndex={...} />), ... })`
 * 确定按钮（yes 回调读取选中值、写 localStorage、clearCache、清 IndexedDB、
 * show.ok）仍由 editActress 持有，组件只负责静态结构 + 动态单选列表插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。本弹窗含动态值（源列表/当前索引），故用 props。
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
 * 渲染头像 CDN 源选择弹窗的 JSX。
 * @param props.sources CDN 源列表（含 name/json）。
 * @param props.currentIndex 当前选中的源索引。
 * @returns CDN 源选择弹窗 JSX（标题提示 + 单选按钮组 + 切换说明），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 直接消费。
 */
export function CdnSelectDialog({ sources, currentIndex }: CdnSelectDialogProps) {
    return (
        <div style={{ padding: '20px' }}>
            <p
                style={{
                    marginBottom: '15px',
                    fontWeight: 'bold',
                    color: '#333'
                }}
            >
                请选择头像数据源 (当前: {sources[currentIndex].name}):
            </p>
            {sources.map((source, index) => (
                <div key={index} style={{ marginBottom: '10px' }}>
                    <input
                        type="radio"
                        id={`cdn-${index}`}
                        name="cdn-source"
                        value={index}
                        checked={index === currentIndex}
                        style={{ marginRight: '10px' }}
                    />
                    <label {...({ for: `cdn-${index}` } as any)}>
                        {source.name} {source.json.includes('jsdelivr') ? '(推荐)' : ''}
                    </label>
                </div>
            ))}
            <p
                style={{
                    marginTop: '20px',
                    color: '#555',
                    fontSize: '12px'
                }}
            >
                切换源会清除本地缓存的数据，并在下次搜索时重新加载。
            </p>
        </div>
    );
}
