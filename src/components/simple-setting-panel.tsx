/**
 * SimpleSettingPanel —— 悬浮简化设置面板（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 simpleSetting（L330-332）：原方法返回
 * 巨型模板字符串（含显示已鉴定内容开关组、显示所有、弹窗方式、鉴定后关闭、瀑布流、
 * 标题翻译、悬浮大图、加载女优信息（isJavdbSite 条件）、第三方资源、
 * 长缩略图、更高画质预览、竖图模式、页面列数/宽度 range、底部常见问题/更多设置按钮）。
 * 由 `$(".simple-setting").html(this.simpleSetting())` 消费。
 *
 * 保留原 HTML 结构、id/类名/内联 style、`<hr>` 分隔线、data-tip、`<br/>`、
 * isJavdbSite 条件块原样不动；isJavdbSite 通过 prop 注入。
 * 原模板中的 `\n` 转义与缩进由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS
 * 渲染无影响。❓ emoji 与后续文案间的空格以 `{" "}` 显式保留（原 `❓ </span>`
 * 折叠为单空格，DOM 等价）。`<span>屏蔽单番号: </span>` 等含尾空格的文案以
 * 显式字符串表达式 `{"..."}` 保留。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 simpleSetting 中 `.html()` 消费时，
 * 需先用 `jsxToString` 转为 HTML 字符串：
 *   `$(".simple-setting").html(jsxToString(<SimpleSettingPanel isJavdbSite={isJavdbSite} />)).show()`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义，与原始 jQuery `.html(htmlString)` 行为一致。
 */

/** SimpleSettingPanel 的属性。 */
export interface SimpleSettingPanelProps {
    /** 是否 JavDb 站点（决定"加载女优信息"块是否渲染）。 */
    isJavdbSite: boolean;
}

/** hr 分隔线内联样式（渐变背景，原模板中重复 6 次）。 */
const HR_STYLE = {
    border: 0,
    height: '1px',
    margin: '10px 0',
    backgroundImage:
        'linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0))'
} as const;

/** 单番号/演员/关键词/收藏/已观看 标签 span 的内联样式。 */
const LABEL_SPAN_STYLE = {
    display: 'inline-block',
    width: '80px',
    fontSize: '13px',
    fontWeight: 'bold',
    textAlign: 'left'
} as const;

/**
 * 渲染悬浮简化设置面板的 JSX。
 * @param props.isJavdbSite 是否 JavDb 站点
 * @returns 简化设置面板 JSX，经 jsxToString 转 HTML 字符串后供 `.html()` 消费。
 */
export function SimpleSettingPanel({ isJavdbSite }: SimpleSettingPanelProps) {
    return (
        <div
            className="jhs-scrollbar"
            style={{
                marginTop: '20px',
                maxHeight: '90vh',
                overflowY: 'auto'
            }}
        >
            <div style={{ margin: '0 10px' }}>
                <div className="setting-item">
                    <span className="setting-label">显示已鉴定内容:</span>
                    <div
                        className="form-content"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <span style={LABEL_SPAN_STYLE}>{'屏蔽单番号: '}</span>
                        <input type="checkbox" id="showFilterItem" className="mini-switch" />
                        <br />
                        <span style={LABEL_SPAN_STYLE}>{'屏蔽演员: '}</span>
                        <input type="checkbox" id="showFilterActorItem" className="mini-switch" />
                        <br />
                        <span style={LABEL_SPAN_STYLE}>{'屏蔽关键词: '}</span>
                        <input type="checkbox" id="showFilterKeywordItem" className="mini-switch" />
                        <br />
                        <span style={LABEL_SPAN_STYLE}>{'收藏: '}</span>
                        <input type="checkbox" id="showFavoriteItem" className="mini-switch" />
                        <br />
                        <span style={LABEL_SPAN_STYLE}>{'已观看: '}</span>
                        <input type="checkbox" id="showHasWatchItem" className="mini-switch" />
                        <br />
                    </div>
                </div>
                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="快速显示所有已鉴定内容,减少对以上开关的频繁操作">❓</span>{' '}
                        显示所有:
                    </span>
                    <div
                        className="form-content"
                        style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'flex-end'
                        }}
                    >
                        <input type="checkbox" id="showAllItem" className="mini-switch" />
                    </div>
                </div>

                <hr style={HR_STYLE} />

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="点击封面的打开方式,弹窗|新窗口">❓</span> 弹窗方式打开页面:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="dialogOpenDetail" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">鉴定后立即关闭页面:</span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="needClosePage" className="mini-switch" />
                    </div>
                </div>

                <hr style={HR_STYLE} />

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="使用瀑布流模式, 排序方式将调整为默认">❓</span> 瀑布流模式:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="autoPage" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">启用标题翻译:</span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="translateTitle" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">启用悬浮大图:</span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="hoverBigImg" className="mini-switch" />
                    </div>
                </div>


                <hr style={HR_STYLE} />

                {isJavdbSite && (
                    <div className="setting-item">
                        <span className="setting-label">
                            <span data-tip="详情页是否展示女优年龄、三围等信息">❓</span>{' '}
                            加载女优信息:
                        </span>
                        <div className="form-content" style={{ textAlign: 'right' }}>
                            <input
                                type="checkbox"
                                id="enableLoadActressInfo"
                                className="mini-switch"
                            />
                        </div>
                    </div>
                )}

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="详情页第三方资源检测,如missAv,SupJav">❓</span>{' '}
                        加载第三方视频资源:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="enableLoadOtherSite" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="详情页图片区首列位置加载长缩略图">❓</span> 加载长缩略图:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="enableLoadScreenShot" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="详情页解析更多更高画质的预览视频">❓</span>{' '}
                        更高画质预览视频:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input
                            type="checkbox"
                            id="enableLoadPreviewVideo"
                            className="mini-switch"
                        />
                    </div>
                </div>

                <hr style={HR_STYLE} />

                <div className="setting-item">
                    <span className="setting-label">
                        <span data-tip="列数6以上,建议开启竖图">❓</span> 竖图模式:
                    </span>
                    <div className="form-content" style={{ textAlign: 'right' }}>
                        <input type="checkbox" id="enableVerticalModel" className="mini-switch" />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">
                        页面列数: <span id="showContainerColumns" />
                    </span>
                    <div className="form-content">
                        <input
                            type="range"
                            id="containerColumns"
                            min="2"
                            max="10"
                            step="1"
                            style={{ padding: '5px 0' }}
                        />
                    </div>
                </div>

                <div className="setting-item">
                    <span className="setting-label">
                        页面宽度: <span id="showContainerWidth" />
                    </span>
                    <div className="form-content">
                        <input
                            type="range"
                            id="containerWidth"
                            min="0"
                            max="30"
                            step="1"
                            style={{ padding: '5px 0' }}
                        />
                    </div>
                </div>
            </div>
            <div
                style={{
                    padding: '0 20px 15px',
                    textAlign: 'right',
                    borderTop: '1px solid #eee'
                }}
            >
                <button id="helpBtn" style={{ float: 'left' }}>
                    常见问题
                </button>
                <button id="moreBtn">更多设置</button>
            </div>
        </div>
    );
}
