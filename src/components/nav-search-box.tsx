/**
 * NavSearchBox —— 导航栏自定义检索框（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/nav-bar-plugin.ts 的 hookSearch（L91-93）：原字符串注入
 * `#navbar-menu-hero` 之后，含搜索类型下拉（影片/演员/系列/片商/導演/番号/清单）、
 * 关键词输入、进阶检索链接、检索按钮。由 `$("#navbar-menu-hero").after(html)` 消费。
 *
 * 保留原 `<div class="navbar-menu" id="search-box">` 结构、所有 id/类名/内联 style、
 * option value、placeholder 原样不动。`<input>` 自闭合（void element）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 hookSearch 中 `.after()` 消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `$("#navbar-menu-hero").after(jsxToString(<NavSearchBox />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/**
 * 渲染导航栏自定义检索框的 JSX。
 * @returns search-box JSX，经 jsxToString 转 HTML 字符串后供 `.after()` 消费。
 */
export function NavSearchBox() {
    return (
        <div className="navbar-menu" id="search-box">
            <div
                className="navbar-start"
                style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
            >
                <select
                    id="search-type"
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        backgroundColor: '#333',
                        color: '#eee',
                        fontSize: '14px',
                        outline: 'none'
                    }}
                >
                    <option value="all">影片</option>
                    <option value="actor">演員</option>
                    <option value="series">系列</option>
                    <option value="maker">片商</option>
                    <option value="director">導演</option>
                    <option value="code">番號</option>
                    <option value="list">清單</option>
                </select>
                <input
                    id="search-keyword"
                    type="text"
                    placeholder="輸入影片番號，演員名等關鍵字進行檢索"
                    style={{
                        padding: '8px 12px',
                        border: '1px solid #555',
                        borderRadius: '4px',
                        flexGrow: '1',
                        fontSize: '14px',
                        backgroundColor: '#333',
                        color: '#eee',
                        outline: 'none'
                    }}
                />
                <a
                    href="/advanced_search?noFold=1"
                    title="進階檢索"
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#444',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        color: '#ddd',
                        fontSize: '14px',
                        border: '1px solid #555'
                    }}
                >
                    <span>...</span>
                </a>
                {/* 识图入口（与 jhs.3.3.6.027 一致，位于进阶检索与检索按钮之间） */}
                <a
                    id="search-img-btn"
                    title="以图识图"
                    style={{
                        padding: '6px 16px',
                        backgroundColor: '#444',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: '1px solid #555'
                    }}
                >
                    识图
                </a>
                <a
                    id="search-btn"
                    style={{
                        padding: '6px 16px',
                        backgroundColor: '#444',
                        color: '#fff',
                        borderRadius: '4px',
                        textDecoration: 'none',
                        fontWeight: '500',
                        cursor: 'pointer',
                        border: '1px solid #555'
                    }}
                >
                    检索
                </a>
            </div>
        </div>
    );
}
