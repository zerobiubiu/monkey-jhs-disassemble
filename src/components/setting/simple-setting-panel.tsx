/**
 * SimpleSettingPanel —— 悬浮快捷设置面板（React 函数组件，JSX）。
 *
 * 分组布局 + 行式开关，经 jsxToString 注入 `.simple-setting` / `.mini-simple-setting`。
 * 表单 id 与 setting-plugin.initSimpleSettingForm 绑定保持一致。
 */

import type { ReactNode } from 'react';

/** SimpleSettingPanel 的属性。 */
export interface SimpleSettingPanelProps {
    /** 是否 JavDb 站点（决定「加载女优信息」是否渲染）。 */
    isJavdbSite: boolean;
}

/** 单行：标签 + 控件 */
function Row({
    label,
    tip,
    children,
    stacked
}: {
    label: string;
    tip?: string;
    children: ReactNode;
    stacked?: boolean;
}) {
    return (
        <div className={stacked ? 'jhs-qs-row jhs-qs-row-stacked' : 'jhs-qs-row'}>
            <div className="jhs-qs-label">
                {tip ? (
                    <span className="jhs-qs-tip" data-tip={tip}>
                        ?
                    </span>
                ) : null}
                <span>{label}</span>
            </div>
            <div className="jhs-qs-control">{children}</div>
        </div>
    );
}

/**
 * 渲染悬浮快捷设置面板。
 */
export function SimpleSettingPanel({ isJavdbSite }: SimpleSettingPanelProps) {
    return (
        <div className="jhs-qs-panel">
            <div className="jhs-qs-header">
                <span className="jhs-qs-title">快捷设置</span>
                <span className="jhs-qs-sub">改动即时生效</span>
            </div>

            <div className="jhs-qs-body jhs-scrollbar">
                <div className="jhs-qs-section">
                    <div className="jhs-qs-section-title">列表显示</div>
                    <Row
                        label="显示所有已鉴定"
                        tip="开启后忽略下方分项，强制显示全部已鉴定内容"
                    >
                        <input type="checkbox" id="showAllItem" className="mini-switch" />
                    </Row>
                    <div className="jhs-qs-subcard" id="jhs-qs-filter-group">
                        <Row label="屏蔽单番号">
                            <input type="checkbox" id="showFilterItem" className="mini-switch" />
                        </Row>
                        <Row label="屏蔽演员">
                            <input
                                type="checkbox"
                                id="showFilterActorItem"
                                className="mini-switch"
                            />
                        </Row>
                        <Row label="屏蔽关键词">
                            <input
                                type="checkbox"
                                id="showFilterKeywordItem"
                                className="mini-switch"
                            />
                        </Row>
                        <Row label="收藏">
                            <input type="checkbox" id="showFavoriteItem" className="mini-switch" />
                        </Row>
                        <Row label="已观看">
                            <input type="checkbox" id="showHasWatchItem" className="mini-switch" />
                        </Row>
                    </div>
                </div>

                <div className="jhs-qs-section">
                    <div className="jhs-qs-section-title">浏览行为</div>
                    <Row label="弹窗打开详情" tip="点击封面：弹窗打开，或新窗口打开">
                        <input type="checkbox" id="dialogOpenDetail" className="mini-switch" />
                    </Row>
                    <Row label="鉴定后关闭页面">
                        <input type="checkbox" id="needClosePage" className="mini-switch" />
                    </Row>
                    <Row
                        label="触底加载"
                        tip="瀑布流常开。自动=滑到底自动加载下一页；点按钮=滑到底后点「点击加载下一页」。右下角「加载全部」始终可用"
                    >
                        <div
                            id="autoPageLoadMode"
                            className="jhs-qs-seg"
                            role="group"
                            aria-label="触底加载方式"
                        >
                            <button
                                type="button"
                                className="jhs-qs-seg-btn"
                                data-value="auto"
                            >
                                自动
                            </button>
                            <button
                                type="button"
                                className="jhs-qs-seg-btn"
                                data-value="click"
                            >
                                点按钮
                            </button>
                        </div>
                    </Row>
                </div>

                <div className="jhs-qs-section">
                    <div className="jhs-qs-section-title">功能</div>
                    <Row label="标题翻译">
                        <input type="checkbox" id="translateTitle" className="mini-switch" />
                    </Row>
                    {isJavdbSite ? (
                        <Row label="加载女优信息" tip="详情页展示年龄、三围等信息">
                            <input
                                type="checkbox"
                                id="enableLoadActressInfo"
                                className="mini-switch"
                            />
                        </Row>
                    ) : null}
                    <Row label="第三方视频资源" tip="详情页 missAv / SupJav 等检测">
                        <input type="checkbox" id="enableLoadOtherSite" className="mini-switch" />
                    </Row>
                </div>

                <div className="jhs-qs-section">
                    <div className="jhs-qs-section-title">页面布局</div>
                    <Row label="列数" stacked>
                        <div className="jhs-qs-range">
                            <input
                                type="range"
                                id="containerColumns"
                                min="2"
                                max="10"
                                step="1"
                            />
                            <span id="showContainerColumns" className="jhs-qs-range-val" />
                        </div>
                    </Row>
                    <Row label="宽度" stacked>
                        <div className="jhs-qs-range">
                            <input type="range" id="containerWidth" min="0" max="30" step="1" />
                            <span id="showContainerWidth" className="jhs-qs-range-val" />
                        </div>
                    </Row>
                </div>
            </div>

            <div className="jhs-qs-footer">
                <button type="button" id="helpBtn" className="jhs-qs-btn jhs-qs-btn-ghost">
                    常见问题
                </button>
                <button type="button" id="moreBtn" className="jhs-qs-btn jhs-qs-btn-primary">
                    更多设置
                </button>
            </div>
        </div>
    );
}
