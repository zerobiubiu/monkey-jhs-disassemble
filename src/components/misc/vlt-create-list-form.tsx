/**
 * VltCreateListForm —— 新建清单按钮 + 内联表单（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/video-lists-tag/vlt-sync.tsx 的 setupCreateListButton
 * （L1233-1240，原 `wrap.innerHTML = '...' + '...'` 字符串拼接）：触发按钮
 * （.jhs-list-create-btn，aria-expanded/aria-controls 关联表单）+ 内联表单
 * 容器（span#jhs-list-create-form，初始 `display:none`，内含视觉隐藏
 * label、清单名称输入框 #jhs-list-create-input、新建/取消按钮）。
 *
 * 保留原 id/类名/内联 style（CSSProperties 对象，jsxToString 还原为
 * kebab-case CSS 字符串，值原样保留）/属性顺序原样不动。
 * `<label for="...">` 的 `for` 是 JSX/JS 保留字，不能直接写为 JSX 属性名；
 * 使用 React 标准 `htmlFor` 属性，jsxToString 已支持 `htmlFor`→`for`
 * 映射（同 `className`→`class`），输出 `for="jhs-list-create-input"`，
 * 与原 HTML 一致（不能改为 label 包裹 input，那会改变 DOM 结构与事件
 * 绑定依赖的兄弟关系）。
 * `htmlFor` 置于 className 之后以保持原 `class` 在前、`for` 在后的属性顺序。
 * `maxLength={50}` / `autoComplete="off"` 经 jsxToString 输出小写
 * `maxlength="50"` / `autocomplete="off"`，与原 HTML 一致。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 setupCreateListButton 中
 * `wrap.innerHTML = ...` 消费时，需先用 `jsxToString`（来自
 * ../../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `wrap.innerHTML = jsxToString(<VltCreateListForm />)`
 * 表单显隐与提交事件（bindCreateListEvents/bindCreateListAvailability）
 * 仍由调用方持有，组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染新建清单按钮 + 内联表单的 JSX。
 * @returns 新建清单 UI JSX（触发按钮 + 隐藏表单容器），经 jsxToString
 *          转 HTML 字符串后供 `wrap.innerHTML = ...` 消费。
 */
export function VltCreateListForm() {
    return (
        <>
            <button
                type="button"
                className="button is-info is-small jhs-list-create-btn"
                aria-expanded="false"
                aria-controls="jhs-list-create-form"
            >
                ＋ 新建清单
            </button>
            <span
                id="jhs-list-create-form"
                className="jhs-list-create-form"
                style={{ display: 'none' }}
            >
                <label
                    className="jhs-visually-hidden"
                    htmlFor="jhs-list-create-input"
                >
                    清单名称
                </label>
                <input
                    id="jhs-list-create-input"
                    type="text"
                    className="input is-small jhs-list-create-input"
                    placeholder="清单名称"
                    maxLength={50}
                    autoComplete="off"
                />
                <button type="button" className="button is-info is-small jhs-list-create-save">
                    新建
                </button>
                <button type="button" className="button is-light is-small jhs-list-create-cancel">
                    取消
                </button>
            </span>
        </>
    );
}
