/**
 * FilterPanel —— 屏蔽配置面板（React 函数组件，JSX）。
 *
 * 视频标题屏蔽词输入与标签容器（tag-box 由 JS 动态填充），基于 setting/
 * 原子组件构建。
 */

import { SettingSection } from '../setting/setting-section';

/** FilterPanel 的属性。 */
export interface FilterPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染屏蔽配置面板的 JSX。
 * @returns filter-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function FilterPanel({ panelName }: FilterPanelProps) {
    return (
        <div
            id="filter-panel"
            className="content-panel"
            style={{
                display: panelName === 'filter-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="屏蔽关键词" icon="🚫">
                <div id="filterKeywordContainer" className="filter-keyword-container">
                    <div className="tag-box"></div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                            type="text"
                            className="keyword-input"
                            placeholder="输入关键词后按回车添加"
                            style={{ flex: 1 }}
                        />
                        <a className="add-tag-btn jhs-setting-btn jhs-setting-btn--primary" style={{ flexShrink: 0 }}>
                            添加
                        </a>
                    </div>
                </div>
            </SettingSection>
        </div>
    );
}
