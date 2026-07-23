/**
 * PreloadPanel —— 预加载配置面板（React 函数组件，JSX）。
 *
 * 预加载开关、状态徽标、防抖/并发/缓存有效期、站点选择、缓存状态，
 * 基于 setting/ 原子组件构建（分区 + 统一行网格）。
 */

import { SettingCheckbox } from '../setting/setting-checkbox';
import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';
import { SettingToggle } from '../setting/setting-toggle';

/** PreloadPanel 的属性。 */
export interface PreloadPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染预加载配置面板的 JSX。
 * @returns preload-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function PreloadPanel({ panelName }: PreloadPanelProps) {
    return (
        <div
            id="preload-panel"
            className="content-panel"
            style={{
                display: panelName === 'preload-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="预加载行为" icon="⚡">
                <SettingToggle
                    id="enablePreload"
                    label="列表页预加载"
                    tooltip="在视频流（列表页/清单详情页/搜索页）后台预加载 missav 等站点搜索结果并缓存，打开详情页时按钮零延迟变绿。关闭后不预加载、不显示状态徽标与筛选栏（详情页按钮仍受「外部网站功能」总开关控制）"
                />
                <SettingToggle
                    id="enablePreloadStatus"
                    label="显示状态徽标与筛选栏"
                    tooltip="在每个卡片标题下方显示预加载状态（排队中/请求中/成功匹配/匹配失败），并在筛选栏实时计数、可点击过滤。关闭后仍后台预加载缓存，但不显示 UI"
                />
                <SettingRow
                    label="预加载防抖延迟 (毫秒)"
                    tooltip="列表页瀑布流追加新卡片后，等待多久再开始批量入队预加载。过小可能与页面渲染抢资源；过大则新卡片状态延迟出现。缺省 300"
                >
                    <SettingInput id="preloadDebounce" type="number" min="0" max="5000" step="50" />
                </SettingRow>
                <SettingRow
                    label="预加载并发数 (1-10)"
                    tooltip="同时向 missav 等站点发起预加载请求的数量。1=串行最稳（默认，降低 Cloudflare 拦截风险）；2～5 可明显加快列表预加载；过高易被拦截并触发本轮跳过该站点。建议从 2 试起"
                >
                    <SettingInput id="preloadConcurrency" type="number" min="1" max="10" step="1" />
                </SettingRow>
                <SettingRow
                    label="预加载缓存有效期 (天)"
                    tooltip="命中缓存超过此天数后视为过期，下次打开列表页会重新预加载。0=永不过期（缺省）。建议 7-30 天平衡新鲜度与请求量"
                >
                    <SettingInput id="preloadCacheTTL" type="number" min="0" max="365" step="1" />
                </SettingRow>
            </SettingSection>

            <SettingSection title="预加载站点" icon="🌍">
                <SettingRow label="预加载站点:">
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <SettingCheckbox id="preload-enable-missAvBtn" label="MissAv" />
                        <SettingCheckbox id="preload-enable-supJavBtn" label="SupJav" />
                    </div>
                </SettingRow>
                <p
                    style={{
                        fontSize: '12px',
                        color: '#6c757d',
                        margin: '8px 0 0'
                    }}
                >
                    SupJav 全站 Cloudflare 拦截严重，列表页预加载已跳过（仅详情页显示黄色搜索页链接），MissAv 为主要预加载源。
                </p>
            </SettingSection>

            <SettingSection title="缓存状态" icon="📦">
                <SettingRow label="预加载缓存状态:">
                    <div
                        id="preload-cache-stats"
                        style={{
                            fontSize: '13px',
                            color: '#495057',
                            lineHeight: '1.8'
                        }}
                    >
                        加载中...
                    </div>
                </SettingRow>
                <p
                    style={{
                        fontSize: '12px',
                        color: '#6c757d',
                        margin: '8px 0 0'
                    }}
                >
                    此缓存即「缓存管理」面板的「第三方站点缓存」（jhs_other_site），清理请前往该面板。总开关「外部网站功能」位于快捷设置面板。
                </p>
            </SettingSection>
        </div>
    );
}
