/**
 * ImageRecognitionDialog —— 以图识图弹窗内容（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/image-recognition-plugin.tsx 的 open（L76-98，原
 * layer.open({ content: `...` }) 模板字符串）：外层 padding 容器内含
 * 上传区（#upload-area：说明文案 + #select-image-btn + 隐藏 #image-file
 * 文件输入）与预览区（#preview-area：#preview-image 预览图 +
 * #action-btns（#handle-btn 搜索 / #cancel-btn 取消）+ #search-results
 * 识图网站选择区（#openAll 全部打开 + #search-img-site-btns-container
 * 站点按钮容器，初始为空，由 initEventListeners 动态填充））。
 *
 * 保留原 id/类名/内联 style 原样不动（style 以 CSSProperties 对象书写，
 * jsxToString 还原为 kebab-case CSS 字符串，值原样保留）；预览区与搜索
 * 结果区初始 `display:none`，由调用方 jQuery 事件逻辑切换显隐。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 open 中 layer.open
 * ({ content }) 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，
 * 轻量 JSX→HTML 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<ImageRecognitionDialog />), ... })`
 * 所有事件绑定（initEventListeners 内的拖拽/粘贴/选择/搜索/取消逻辑）
 * 仍由调用方持有，组件只负责静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/**
 * 渲染以图识图弹窗内容的 JSX。
 * @returns 弹窗内容 JSX（上传区 + 预览区 + 识图网站选择区），经 jsxToString
 *          转 HTML 字符串后供 layer.open({ content }) 直接消费。
 */
export function ImageRecognitionDialog() {
    return (
        <div style={{ padding: '20px' }}>
            <div id="upload-area">
                <div style={{ color: '#555', marginBottom: '15px' }}>
                    <p>拖拽图片到此处 或 点击按钮选择图片</p>
                    <p>也可以直接 Ctrl+V 粘贴图片 / 图片URL</p>
                </div>
                <button id="select-image-btn">选择图片</button>
                <input type="file" style={{ display: 'none' }} id="image-file" accept="image/*" />
            </div>
            <div
                id="preview-area"
                style={{ marginBottom: '20px', textAlign: 'center', display: 'none' }}
            >
                <img
                    id="preview-image"
                    alt=""
                    src=""
                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px' }}
                />
                <div
                    style={{
                        marginTop: '15px',
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '10px'
                    }}
                    id="action-btns"
                >
                    <button id="handle-btn">搜索图片</button>
                    <button id="cancel-btn">取消</button>
                </div>
                <div id="search-results" style={{ display: 'none' }}>
                    <p style={{ margin: '20px auto' }}>
                        请选择识图网站：<a id="openAll" style={{ cursor: 'pointer' }}>全部打开</a>
                    </p>
                    <div
                        className="search-img-site-btns-container"
                        id="search-img-site-btns-container"
                    ></div>
                </div>
            </div>
        </div>
    );
}
