/**
 * 清单页编号清单整理插件 ListReflowPlugin（doc/202，期1 只读）。
 *
 * 在 /lists/{id} 清单详情页注入「编号清单整理」面板：识别同 base 编号组、
 * 展示各清单数量/满员、生成组内压实计划预览（不写数据）。分组规则复用
 * doc/200 合并配置（listMergePattern / listMergeExcludeNames），开关为
 * listReflowEnabled（默认开启）。压实执行（写入）为期2 内容。
 *
 * 模块拆分（src/plugins/list-reflow/）：
 * - lr-types.ts — 共享类型
 * - lr-planner.ts — 纯压实规划器（可单测）
 * - lr-data.ts — /users/lists 组发现 + /lists/{id} 影片枚举（只读 fetch）
 * - lr-plan.ts — 计划预览渲染
 * - lr-panel.ts — 面板挂载与交互
 */
import type { PageType, SiteType } from '../../core/page-context';

import { BasePlugin } from '../base-plugin';
import { buildMergeConfig } from '../detail-page-button/dpb-list-merge';
import type { ListMergeConfig } from '../detail-page-button/dpb-list-merge';
import { getCurrentListId } from './lr-data';
import { initReflowPanel } from './lr-panel';

import listReflowCss from '../../styles/list-reflow/list-reflow.css?raw';

export class ListReflowPlugin extends BasePlugin {
    /** 运行时合并配置（handle 时从设置加载，复用合并分组规则）。 */
    _reflowConfig: ListMergeConfig | null = null;

    /** 返回插件名，供 PluginManager 注册去重。 */
    getName(): string {
        return 'ListReflowPlugin';
    }

    /** 仅在列表页激活（/lists/{id} 由 handle 进一步守卫）。 */
    get pageTypes(): PageType[] {
        return ['list'];
    }

    /** 仅 JavDB 站点（MissAV 无 /lists/ 清单页）。 */
    get sites(): SiteType[] {
        return ['javdb'];
    }

    /** 注入整理面板样式（仅列表页）。 */
    async initCss(): Promise<string> {
        return listReflowCss;
    }

    /** 主处理：仅 /lists/{id} 且开关开启时挂载面板。 */
    async handle(): Promise<void> {
        if (!getCurrentListId()) return;
        const settings = await storageManager.getSetting();
        if (settings.listReflowEnabled === 'no') return;
        this._reflowConfig = buildMergeConfig(settings);
        initReflowPanel(this._reflowConfig);
    }
}
