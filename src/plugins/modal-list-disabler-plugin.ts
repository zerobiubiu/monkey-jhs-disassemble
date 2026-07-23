/**
 * 清单模态框禁用插件 ModalListDisablerPlugin —— 集成自
 * archetype/modalListDisabler.user.js
 * （原脚本整体 L1-85，独立油猴脚本 `JavDB 清单模态框禁用指定列表` v1.0）。
 *
 * 功能：监听「保存到清单」模态框（#modal-save-list）出现后，自动禁用指定编号
 * 的清单项（默认 501）。仅当复选框处于未选中态（!checked）时才禁用，已选中态
 * 不干预，保留用户取消勾选的能力。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本无 GM_* API、无 CSS、无数据源、
 * 无网络请求，纯 DOM + MutationObserver，直接迁移。
 *
 * === 与 jhs 主项目的兼容性（天然兼容，正向协同） ===
 * jhs 的 DetailPageButtonPlugin 用 CSS `#modal-save-list { display:none !important }`
 * 永久隐藏模态框（DOM 保留供 Stimulus ajax 操作），并用 ListPanel（清单平铺面板）
 * 替代模态框 UI。_initListPanel 的 sync 函数用 `cloneNode(true)` 从模态框
 * listContainer 克隆清单到平铺面板，且 MutationObserver 监听 `disabled` 属性变化
 * （attributeFilter: ['checked', 'disabled']）。
 *
 * 本插件在模态框 DOM 内禁用复选框（设 input.disabled=true）→ 触发 jhs 的
 * attributeFilter → sync 克隆（cloneNode(true) 复制 disabled 属性）→ 平铺面板
 * 中的对应复选框也自动禁用。**正向协同，不冲突**。
 *
 * 控制流保留要点：
 * 1. TARGET_LIST_ID=501 目标清单编号（匹配 label 中 `(数字)` 格式）
 * 2. disableTargetItem 遍历容器子元素，匹配编号，仅未选中态才禁用
 * 3. tryDisable 查找容器并执行禁用
 * 4. MutationObserver 监听 body subtree（模态框动态插入 + 内容异步加载）
 */
import { TaskSupervisor } from '../core/task-supervisor';
import { BasePlugin } from './base-plugin';

/** 日志前缀。 */
const LOG_PREFIX = '[modalListDisabler]';

/** 目标清单编号（匹配 label 中 `(数字)` 格式的编号）。 */
const TARGET_LIST_ID = 501;

/** 模态框容器选择器。 */
const CONTAINER_SELECTOR =
    '#modal-save-list > div.modal-card.fixed-height-600 > section > div > div:nth-child(1)';

/**
 * 清单模态框禁用插件主类。
 *
 * 原脚本对应行号：L1-85（整体）。原脚本用 IIFE 闭包承载 observer，
 * 此处转为类私有字段。
 */
export class ModalListDisablerPlugin extends BasePlugin {
    /** 任务生命周期管理器。 */
    private supervisor = new TaskSupervisor();

    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "ModalListDisablerPlugin"
     */
    getName(): string {
        return 'ModalListDisablerPlugin';
    }

    /**
     * 注入插件 CSS。原脚本无 CSS（无 GM_addStyle），返回空串。
     *
     * @returns 空字符串（无样式）
     */
    async initCss(): Promise<string> {
        return '';
    }

    /**
     * 主处理：页面初始尝试 + MutationObserver 监听。对应原 L70-85。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        // 页面初始尝试（模态框可能在脚本执行前已存在）
        this.tryDisable();

        // MutationObserver：模态框动态插入 + 内容异步加载
        this.supervisor.observe(document.body, () => {
            this.tryDisable();
        }, { childList: true, subtree: true });
    }

    /**
     * 销毁插件，中止所有异步任务。
     */
    destroy(): void {
        this.supervisor.abort();
    }

    /**
     * 遍历容器子元素，对未选中状态的目标复选框执行禁用。对应原 L34-52。
     * 仅当复选框处于未选中态（!checked）时才禁用，已选中态不干预，
     * 保留用户取消勾选的能力。
     *
     * @param container 清单列表容器
     * @returns 是否找到并处理了目标项
     */
    private disableTargetItem(container: Element): boolean {
        let found = false;
        for (const child of Array.from(container.children)) {
            const span = child.querySelector('label > span');
            if (!span) continue;
            const match = span.innerHTML.match(/\((\d+)\)/);
            if (match && parseInt(match[1], 10) === TARGET_LIST_ID) {
                const input = child.querySelector(
                    'label > input'
                ) as HTMLInputElement | null;
                // 仅未选中态才禁用：阻止用户勾选目标清单
                if (input && !input.disabled && !input.checked) {
                    input.disabled = true;
                    console.log(`${LOG_PREFIX} 已禁用清单 #${TARGET_LIST_ID}`);
                }
                found = true;
            }
        }
        return found;
    }

    /**
     * 尝试查找容器并执行禁用逻辑。对应原 L57-63。
     *
     * @returns 是否成功找到容器并执行
     */
    private tryDisable(): boolean {
        const container = document.querySelector(CONTAINER_SELECTOR);
        if (!container) return false;
        return this.disableTargetItem(container);
    }
}
