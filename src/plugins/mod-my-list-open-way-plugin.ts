/**
 * 修改我的清单打开方式插件 ModMyListOpenWayPlugin —— 集成自
 * archetype/modMyListOpenWay.user.js
 * （原脚本整体 L1-37，独立油猴脚本 `修改我的清单打开方式` v1.0）。
 *
 * 功能：修改 Javdb "我的清单" 页面的打开方式——让清单链接在新标签页打开
 * （target="_blank"），并把链接从查询字符串格式（/users/lists?id=xxx）改为
 * RESTful 格式（/lists/xxx）。首页（page<2）隐藏第一项"所有清单"入口。
 *
 * 集成方式：作为 BasePlugin 子类注册到 PluginManager，仅在 javdb 站点注册
 * （main.tsx 的 `if (isJavdbSite)` 块）。原脚本无 GM_* API、无 CSS、无数据源、
 * 无网络请求，纯 DOM 操作，直接迁移。
 *
 * 原脚本 `@include https://javdb*.com/users/lists*` 限定 URL 路径，本项目所有
 * 插件注册在 `if (isJavdbSite)` 块（不区分路径），故在 handle() 内加
 * `if (!location.pathname.includes('/users/lists')) return;` 守卫等价实现。
 *
 * 控制流保留要点：
 * 1. last = 路径最后一段（区分 /users/lists 首页 vs /lists/{id} 详情页）
 * 2. isListsPage = last === 'lists'（清单列表页）
 * 3. page = URL 查询参数 page 的数字值，缺省为 1
 * 4. 首页（isListsPage && page<2）隐藏第一项"所有清单"入口，循环从下标 1 开始
 * 5. 每个清单链接设 target="_blank"，清单列表页改 href 为 /lists/{id}
 */
import { BasePlugin } from './base-plugin';

/**
 * 修改我的清单打开方式插件主类。
 *
 * 原脚本对应行号：L1-37（整体）。
 */
export class ModMyListOpenWayPlugin extends BasePlugin {
    /**
     * 返回插件名，供 PluginManager 注册去重。
     *
     * @returns "ModMyListOpenWayPlugin"
     */
    getName(): string {
        return 'ModMyListOpenWayPlugin';
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
     * 主处理：修改"我的清单"页面链接的打开方式。对应原脚本 IIFE L13-36。
     *
     * 原脚本 `@include https://javdb*.com/users/lists*` 限定 URL 路径，本项目在
     * handle() 内以 `if (!location.pathname.includes('/users/lists')) return;`
     * 等价实现。
     *
     * @returns Promise<void>；无显式抛出
     */
    async handle(): Promise<void> {
        if (!location.pathname.includes('/users/lists')) return;

        // at(-1) 是 ES2022 特性，tsconfig lib 仅 ES2020；用 [length-1] 等价替代，语义零偏差
        const segments = location.pathname.split('/').filter(Boolean);
        const last = segments[segments.length - 1];
        const ul = document.querySelector<HTMLUListElement>('#lists > ul');
        if (!ul) return;
        const lis = ul.children;

        const isListsPage = last === 'lists';
        const page = Number(new URLSearchParams(location.search).get('page')) || 1;

        // 第一项是"所有清单"入口，仅在首页隐藏
        if (isListsPage && page < 2) {
            (lis[0] as HTMLElement).style.display = 'none';
        }

        for (let i = isListsPage && page < 2 ? 1 : 0; i < lis.length; i++) {
            const a = lis[i].querySelector<HTMLAnchorElement>('div.column.is-10 > a');
            if (!a) continue;
            a.target = '_blank';

            if (isListsPage) {
                const id = new URL(a.href).searchParams.get('id');
                a.href = `/lists/${id}`;
            }
        }
    }
}
