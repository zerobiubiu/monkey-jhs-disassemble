/**
 * 收藏演员插件 FavoriteActressesPlugin —— 对应原脚本 archetype/jhs.user.js L10696-10864。
 *
 * 在影片详情页高亮已收藏的女演员链接（.female 前置节点比对 starId）；
 * 在演员主页为 #button-collect-actor / #button-uncollect-actor 及取消收藏链接
 * 绑定事件，维护 storageManager 中的收藏演员列表；并用收藏记录中的头像
 * 替换演员页 .avatar 背景图。
 *
 * 单字母局部变量（原 e/t/n/a/i/s/o/r/l/c）已语义化：
 *   favoriteActresses / starIdSet / element / $link / href / urlStarId / segments /
 *   lastSegment / isFavorite / starId / actorIdRegex / event / confirmResult / match /
 *   actorId / actressNames / $nameSection / $metaSection / firstName / avatarUrl /
 *   actressData / favoriteActressList / matchedActress / cssUrl / $avatar /
 *   avatarColumnHtml。
 * 布尔标识 _ 改由 ../constants/status 引入（YES，对应原 "yes" 默认值）；
 * 运行时挂载到 window 的 isDetailPage，以此处 window.isDetailPage 访问，
 * 保持原逻辑并满足 strict 类型检查。
 * $ / storageManager / clog 已由 ../types/globals.d.ts 声明为 any；
 * jQuery .each 回调按本仓库既有约定改写为 (_index, element) 箭头形式，规避 noImplicitThis；
 * 因 $ 为 any，jQuery 链式结果均为 any，故局部常量仅以 :string 等标注意图，不做窄化；
 * 内联 HTML 已提取为组件 src/components/favorite-actress-avatar-column.tsx
 * （FavoriteActressAvatarColumn），replaceActressAvatar 的 avatarColumnHtml
 * 改为调用组件函数。组件已转 TSX 原生 React 组件（doc/18），调用点改
 * jsxToString(<Comp />)；本文件因含 JSX 重命名为 .tsx。
 */
import { YES } from '../constants/status';

import type { PageType } from '../core/page-context';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { FavoriteActressAvatarColumn } from '../components/actress/favorite-actress-avatar-column';

/**
 * 收藏演员记录结构。
 * 对应 storageManager.getFavoriteActressList() 返回元素及 addFavoriteActressList() 入参元素。
 */
interface FavoriteActress {
    /** 演员 starId（URL /actors/<id> 末段） */
    starId: string;
    /** 首选名称（actor-section-name / section-meta 拆分后的第一项） */
    name: string;
    /** 全部别名（actor-section-name + 不含"影片"的 section-meta 拆分项合集） */
    allName: string[];
    /** 头像 URL（从 .avatar background-image 提取） */
    avatar: string;
    [key: string]: unknown;
}

export class FavoriteActressesPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L10697-10699。 */
    getName(): string {
        return 'FavoriteActressesPlugin';
    }

    /** 仅在详情页激活（doc/140）。 */
    get pageTypes(): PageType[] {
        return ['detail'];
    }

    /**
     * 主处理入口：绑定收藏/取消收藏事件，高亮详情页已收藏演员，替换演员页头像。
     * 对应原 L10700-10704。
     * 无参数；返回 Promise<void>；不主动抛出异常（子方法内部均 try-free，
     * 异常由调用方 PluginManager 统一兜底）。
     */
    async handle(): Promise<void> {
        this.bindEvent();
        await this.highlightActress();
        this.replaceActressAvatar();
    }

    /**
     * 详情页高亮已收藏女演员：读取收藏列表 → 提取 starId 集合 → 遍历 .female 前置链接，
     * 比对链接末段 starId 命中则加 highlighted 类并设 title 提示。
     * 对应原 L10705-10754。
     * 仅当 window.isDetailPage 为真、且设置项 enableFavoriteActresses === YES
     * 时执行；收藏列表为空或 starId 集合为空时短路返回。
     * 无参数；返回 Promise<void>；不抛出异常。
     */
    async highlightActress(): Promise<void> {
        if (!window.isDetailPage) {
            return;
        }
        if ((await storageManager.getSetting('enableFavoriteActresses', YES)) !== YES) {
            return;
        }
        const favoriteActresses: FavoriteActress[] = await storageManager.getFavoriteActressList() as FavoriteActress[];
        if (!favoriteActresses || favoriteActresses.length === 0) {
            return;
        }
        const starIdSet: Set<string> = new Set();
        favoriteActresses.forEach((actress) => {
            if (actress.starId) {
                starIdSet.add(String(actress.starId).trim());
            }
        });
        if (starIdSet.size !== 0) {
            $('.female')
                .prev()
                .each((_index: number, element: HTMLElement) => {
                    const $link = $(element);
                    const href: string | undefined = $link.attr('href');
                    let urlStarId: string | null = null;
                    if (href) {
                        const segments = (href.endsWith('/') ? href.slice(0, -1) : href).split('/');
                        const lastSegment: string = segments[segments.length - 1];
                        if (lastSegment) {
                            urlStarId = lastSegment.trim();
                        }
                    }
                    let isFavorite: boolean = false;
                    if (urlStarId) {
                        isFavorite = starIdSet.has(urlStarId);
                    }
                    if (isFavorite) {
                        $link.addClass('highlighted');
                        $link.attr('title', '高亮已收藏演员, 可在设置-基础配置中关闭');
                    }
                });
        }
    }

    /**
     * 从 storageManager 移除指定 starId 的收藏演员记录，成功则输出日志。
     * 对应原 L10755-10759。
     * @param starId 演员 starId（URL /actors/<id> 末段）。
     * 返回 Promise<void>；不抛出异常（失败由 storageManager 内部处理，此处仅按返回值记日志）。
     */
    async removeActorFromStorage(starId: string): Promise<void> {
        if (await storageManager.removeFavoriteActress(starId)) {
            clog.log('移除演员成功');
        }
    }

    /**
     * 绑定收藏/取消收藏事件：监听 confirm:complete（layer 确认框完成）取消收藏链接、
     * 以及 #button-collect-actor / #button-uncollect-actor 点击，维护收藏演员列表。
     * 对应原 L10760-10832。
     * 无参数；无返回值；不抛出异常（取值失败仅 clog.error 后 return）。
     */
    bindEvent(): void {
        const actorIdRegex = /\/actors\/(\w+)\/(collect|uncollect)/;
        $(document).on(
            'confirm:complete',
            'a[href*="/actors/"][href*="/uncollect"]',
            async (event: CustomEvent) => {
                const [confirmResult] = event.detail;
                if (!confirmResult) {
                    return;
                }
                const match = $(event.currentTarget).attr('href')?.match(actorIdRegex);
                const actorId: string | null = match ? match[1] : null;
                if (actorId) {
                    await this.removeActorFromStorage(actorId);
                }
            }
        );
        $('#button-collect-actor').click(async (_event: unknown) => {
            const match = $('#button-collect-actor').attr('href')?.match(actorIdRegex);
            const actorId: string | null = match ? match[1] : null;
            const actressNames: string[] = [];
            const $nameSection = $('.actor-section-name');
            if ($nameSection.length) {
                $nameSection
                    .text()
                    .trim()
                    .split(',')
                    .forEach((name: string) => {
                        actressNames.push(name.trim());
                    });
            }
            const $metaSection = $(".section-meta:not(:contains('影片'))");
            if ($metaSection.length) {
                $metaSection
                    .text()
                    .trim()
                    .split(',')
                    .forEach((name: string) => {
                        actressNames.push(name.trim());
                    });
            }
            if (!actressNames) {
                clog.error('获取演员名称失败');
                return;
            }
            const firstName: string = actressNames[0];
            if (!actorId) {
                clog.error('无法获取演员ID进行收藏操作。');
                return;
            }
            const avatarUrl: string = ($('.avatar').first().css('background-image') || '').replace(
                /^url\(["']?|["']?\)$/g,
                ''
            );
            const actressData: FavoriteActress = {
                starId: actorId,
                name: firstName,
                allName: actressNames,
                avatar: avatarUrl
            };
            if ((await storageManager.addFavoriteActressList([actressData])) === 1) {
                clog.log(`收藏演员成功: ${firstName} (ID: ${actorId})`);
            } else {
                clog.log(`收藏演员失败: ${firstName} (ID: ${actorId})`);
            }
        });
        $('#button-uncollect-actor').click(async (_event: unknown) => {
            const match = $('#button-uncollect-actor').attr('href')?.match(actorIdRegex);
            const actorId: string | null = match ? match[1] : null;
            if (actorId) {
                await this.removeActorFromStorage(actorId);
            } else {
                clog.error('无法获取演员ID进行取消收藏操作。');
            }
        });
    }

    /**
     * 演员主页头像替换：按当前页 starId 在收藏列表中查找记录，若存在 avatar 则用其
     * 替换 .avatar 背景图（节点不存在时先插入占位结构），并设置 cover/顶居中/不平铺。
     * 对应原 L10833-10863。
     * 无 starId 或无匹配记录/无 avatar 时短路返回；背景图与目标一致时跳过写入。
     * 无参数；返回 Promise<void>；不抛出异常。
     */
    async replaceActressAvatar(): Promise<void> {
        const actressId: string | null = this.getActressId();
        if (!actressId) {
            return;
        }
        const favoriteActressList: FavoriteActress[] =
            await storageManager.getFavoriteActressList() as FavoriteActress[];
        const matchedActress = favoriteActressList.find((actress) => actress.starId === actressId);
        if (matchedActress && matchedActress.avatar) {
            const cssUrl: string = `url('${matchedActress.avatar}')`;
            let $avatar = $('.avatar').first();
            if ($avatar.length === 0) {
                const avatarColumnHtml = jsxToString(<FavoriteActressAvatarColumn />);
                $('.section-columns').prepend(avatarColumnHtml);
                $avatar = $('.avatar').first();
            }
            if ($avatar.length === 0) {
                return;
            }
            if (
                $avatar.css('background-image').trim().toLowerCase() !== cssUrl.trim().toLowerCase()
            ) {
                $avatar.css('background-image', cssUrl);
                $avatar.css('background-size', 'cover');
                $avatar.css('background-position', 'top center');
                $avatar.css('background-repeat', 'no-repeat');
            }
        }
    }
}
