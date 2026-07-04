/**
 * 标题关键词屏蔽插件 FilterTitleKeywordPlugin —— 对应原脚本 archetype/jhs.user.js L7286-7322。
 *
 * 在影片详情页/Fc2 页面为标题元素绑定右键菜单：选中文本后右键即可将该关键词
 * 加入标题屏蔽列表并刷新页面。仅在设置项 enableTitleSelectFilter === YES 时启用。
 *
 * 单字母局部变量（原 e/t/n）已语义化：selector / event / selectedText / position。
 * 站点标志 r 改由 ../constants/site 引入（isJavdbSite）；
 * 布尔标识 _ 改由 ../constants/status 引入（YES）。
 * 运行时挂载到 window 的 isDetailPage / isFc2Page / refresh，
 * 此处以 (window as any). 访问，保持原逻辑并满足 strict 类型检查。
 * utils / storageManager 已由 ../types/globals.d.ts 声明为 any。
 */
import { isJavdbSite } from '../constants/site';
import { YES } from '../constants/status';
import { BasePlugin } from './base-plugin';

export class FilterTitleKeywordPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L7287-7289。 */
    getName(): string {
        return 'FilterTitleKeywordPlugin';
    }

    /**
     * 标题关键词屏蔽主处理：依站点选择标题选择器并绑定右键屏蔽菜单。
     * 对应原 L7290-7321。
     *
     * 仅当 window.isDetailPage 或 window.isFc2Page 为真、且设置项
     * enableTitleSelectFilter === YES 时执行；右键标题选中文本后弹出确认框，
     * 确认则保存关键词并刷新页面。无参数，返回 Promise<void>，不会抛出异常。
     */
    async handle(): Promise<void> {
        if (!(window as any).isDetailPage && !(window as any).isFc2Page) {
            return;
        }
        if ((await storageManager.getSetting('enableTitleSelectFilter', YES)) !== YES) {
            return;
        }
        let selector: string | undefined;
        if (isJavdbSite) {
            selector = '.title strong, .current-title';
        }
        utils.rightClick(document.body, selector, (event: MouseEvent) => {
            const selectedText: string = window.getSelection()?.toString() ?? '';
            if (selectedText) {
                event.preventDefault();
                const position = {
                    clientX: event.clientX,
                    clientY: event.clientY + 80
                };
                utils.q(position, `是否屏蔽标题关键词 ${selectedText}?`, async () => {
                    await storageManager.saveTitleFilterKeyword(selectedText);
                    (window as any).refresh();
                    utils.closePage();
                });
            }
        });
    }
}
