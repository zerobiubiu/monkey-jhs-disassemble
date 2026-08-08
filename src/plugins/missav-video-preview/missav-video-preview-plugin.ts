/**
 * MissAV 视频流 iframe 详情弹窗插件 MissavVideoPreviewPlugin。
 *
 * 在 MissAV 所有页面捕获阶段拦截视频卡片（.thumbnail.group）的普通左键单击，
 * 阻止浏览器默认跳转并以 layer iframe 弹窗（type: 2）打开完整详情页 URL，
 * 支持站内预览详情而无需离开当前页（交互对齐 javdb 的 openPage 机制）。
 *
 * - 弹窗尺寸 = min(1023, 视口宽 - 40)px × 100%高：<1024px 触发站点
 *   响应式隐藏右侧推荐栏（doc/228 Camoufox 实测 1023px 仍隐藏、1024px 起显示），
 *   无需额外 CSS
 * - 中键 / 右键 / 修饰键（Ctrl/Cmd/Shift/Alt）点击放行浏览器原生行为（新标签）
 * - 无独立 CSS、无设置项、无 pageTypes 覆写：isMissavSite 站点注册即激活
 * - iframe 视频页底部推荐区（同款卡片）点击同样弹窗（嵌套 layer，与 javdb 一致）
 *
 * 模块依赖：mv-selectors（卡片选择器 / 详情 URL 提取 / 普通左键判定）。
 */
import { TaskSupervisor } from '../../core/task-supervisor';

import { BasePlugin } from '../base-plugin';
import { CARD_SEL, findDetailUrl, isPlainLeftClick } from './mv-selectors';

/**
 * 当前文档顶部固定条选择器（div.fixed.z-max，56px 高）。
 *
 * Camoufox 实测其 z-index 为 2147483647（CSS 整数最大值），而 layer 弹窗默认
 * 仅 19891014——弹窗打开时顶部条会盖在弹窗上方。弹窗打开期间隐藏该元素、
 * 关闭时恢复（layer 的 end 回调在所有关闭路径触发）。
 *
 * 列表页与 iframe 视频页的顶部条为同一 class（doc/231 实测：body > div:nth-child(2)
 * 与 body > div:nth-child(3) 均指向此 class），本选择器在两种文档中都能命中。
 */
const TOP_BAR_SEL = 'div.fixed.z-max.w-full.bg-gradient-to-b.from-darkest';

/**
 * MissAV 视频流 iframe 详情弹窗插件。
 */
export class MissavVideoPreviewPlugin extends BasePlugin {
    /** 统一生命周期管理器：事件监听器注册与清理。 */
    private supervisor = new TaskSupervisor();

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "MissavVideoPreviewPlugin"
     */
    getName(): string {
        return 'MissavVideoPreviewPlugin';
    }

    /**
     * 本插件无独立 CSS，不注入任何样式。
     *
     * @returns 空字符串
     */
    async initCss(): Promise<string> {
        return '';
    }

    /**
     * 主处理：注册 document 捕获阶段 click 监听，拦截视频卡片普通左键单击，
     * 以 layer iframe 弹窗（type: 2）打开完整详情页 URL。
     *
     * 触发条件：点击目标命中卡片选择器 + 普通左键单击 + 卡片内存在详情链接。
     * 捕获阶段 stopPropagation 阻断站点 Alpine 的 document 级 click 委托
     * （clickPreview 不触发，避免站点预览空 iframe 弹层，doc/228 实测）。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        this.supervisor.addEventListener(
            document,
            'click',
            (evt: Event) => {
                // TaskSupervisor 的 listener 签名是 Event，click 事件断言为 MouseEvent
                const e = evt as MouseEvent;
                const target = e.target as Element | null;
                const card = target?.closest<HTMLElement>(CARD_SEL);
                if (!card || !isPlainLeftClick(e)) return;
                // 放行状态徽章（.missav-status-tag，target=_blank 跳转 javdb）的原生行为，避免被弹窗拦截吞掉
                if (target?.closest('.missav-status-tag')) return;
                const url = findDetailUrl(card);
                if (!url) return;
                e.preventDefault();
                e.stopPropagation();
                const width = Math.min(1023, window.innerWidth - 40);
                // 当前文档顶部条 z-index 2147483647 高于 layer 弹窗（19891014），弹窗打开期间
                // 隐藏之（关闭时通过 layer end 回调恢复）。列表页弹窗隐藏列表页顶部条，
                // iframe 视频页内二级弹窗隐藏 iframe 文档顶部条（doc/231 实测两处同 class）。
                const topBar = document.querySelector<HTMLElement>(TOP_BAR_SEL);
                const topBarPrevDisplay = topBar ? topBar.style.display : '';
                if (topBar) {
                    topBar.style.display = 'none';
                }
                layer.open({
                    type: 2,
                    content: url,
                    scrollbar: false,
                    area: [`${width}px`, '100%'],
                    // 无过渡动画（对齐 javdb openPage 的 isOutAnim:false + anim:-1）：
                    // 过渡动画浪费性能且无作用，直接弹出（用户要求）
                    isOutAnim: false,
                    anim: -1,
                    end: () => {
                        if (topBar) topBar.style.display = topBarPrevDisplay;
                    }
                });
            },
            { capture: true }
        );
    }

    /**
     * 销毁插件：中止所有注册的事件监听器。
     */
    destroy(): void {
        this.supervisor.abort();
    }
}