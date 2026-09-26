/**
 * CachePanel —— 缓存管理面板（React 函数组件，JSX）。
 *
 * 缓存统计、清理网格（cacheItemsHtml 注入）、数据展示区，基于 setting/
 * 原子组件构建（分区容器包裹动态内容）。
 */

import { SettingSection } from '../setting/setting-section';

/** CachePanel 的属性。 */
export interface CachePanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
    /** 缓存项 HTML（预拼接，含清理/查看按钮），注入 cache-panel 网格。 */
    cacheItemsHtml: string;
}

/**
 * 渲染缓存管理面板的 JSX。
 * @returns cache-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function CachePanel({ panelName, cacheItemsHtml }: CachePanelProps) {
    return (
        <div
            id="cache-panel"
            className="content-panel" role="tabpanel" aria-labelledby="tab-cache-panel" 
            style={{
                display: panelName === 'cache-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="缓存管理" icon="🧹">
                <div
                    style={{
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: '12px',
                        marginBottom: '12px'
                    }}
                >
                    <span
                        id="cache-total-size"
                        style={{
                            fontSize: '13px',
                            color: '#999'
                        }}
                    />
                    {/* 批量清理属于本面板的动作，放在本面板内——不放底栏，
                        以免与全局的「保存设置」抢同一个栅位（doc/249）。 */}
                    {/* 用裸 .jhs-btn（非 --compact）：--compact 带 flex:1，会把按钮拉满整行 */}
                    <button id="clean-all" type="button" className="jhs-btn jhs-btn--danger">
                        <span aria-hidden="true">🧨</span> 清理全部缓存
                    </button>
                </div>
                <p
                    style={{
                        color: '#999',
                        fontSize: '12px',
                        margin: '0 0 16px 0'
                    }}
                >
                    以下操作不会对核心数据造成影响，可安全清理
                </p>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(2, 1fr)',
                        gap: '15px'
                    }}
                    dangerouslySetInnerHTML={{
                        __html: cacheItemsHtml
                    }}
                />
                <div
                    id="cache-data-display"
                    style={{
                        marginTop: '20px',
                        display: 'none'
                    }}
                >
                    <pre
                        style={{
                            background: '#f5f5f5',
                            padding: '10px',
                            borderRadius: '5px',
                            maxHeight: '400px',
                            overflow: 'auto'
                        }}
                    />
                </div>
            </SettingSection>
        </div>
    );
}
