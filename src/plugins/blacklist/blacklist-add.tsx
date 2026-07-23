/**
 * 演员黑名单添加（提取自 blacklist-plugin.tsx 的 addBlacklist）。
 *
 * 将当前演员/分类加入黑名单，并递归抓取其全部番号写入鉴定记录。
 * 含确认弹窗、navigator.locks 互斥、loading 状态与错误/成功提示。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 BlacklistPlugin（运行期擦除）。
 */
import { currentHref } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';

import type { ActressInfo } from '../base-plugin';
import type { BlacklistPlugin } from '../blacklist-plugin';

import { BlacklistConfirmMessage } from '../../components/blacklist/blacklist-confirm-message';

/**
 * 将当前演员/分类加入黑名单，并递归抓取其全部番号。
 * 对应原 L7327-7439。
 *
 * @param plugin BlacklistPlugin 实例（读取 getActressPageInfo/filterActorVideo，写入 loadObj/lastPageLink/nextPageLink）
 * @param event 触发点击的 jQuery 事件（取 clientX/clientY 定位确认弹窗）
 */
export async function addBlacklist(plugin: BlacklistPlugin, event: MouseEvent): Promise<void> {
    const position = {
        clientX: event.clientX,
        clientY: event.clientY + 80
    };
    const isAlreadyBlacklisted = $('#addBlacklistBtn span').text().includes('已加入');
    let blacklistInfo: ActressInfo;
    let isActress: boolean;
    let tagName: string = '';
    if (currentHref.includes('/tags')) {
        const tagUrl = new URL(currentHref);
        tagUrl.searchParams.delete('page');
        tagName = $('#jhs-check-tag').text().trim();
        blacklistInfo = {
            starId: 'no-' + tagName,
            name: '虚拟演员-' + tagName,
            allName: ['虚拟演员'],
            role: '虚拟演员',
            movieType: tagName,
            blacklistUrl: tagUrl.toString()
        };
        isActress = false;
    } else {
        blacklistInfo = plugin.getActressPageInfo();
        isActress = true;
    }
    const { starId, name, allName, role, movieType, blacklistUrl } = blacklistInfo;
    const notFirstPageByQuery = currentHref.includes('page') && !currentHref.includes('page=1');
    const confirmMessage = jsxToString(
        <BlacklistConfirmMessage
            tagName={tagName}
            name={name}
            isAlreadyBlacklisted={isAlreadyBlacklisted}
            isActress={isActress}
            notFirstPageByQuery={notFirstPageByQuery}
        />
    );
    utils.q(position as unknown as MouseEvent, confirmMessage, async () => {
        navigator.locks
            .request(
                'checkNewActressActorFilterCar',
                {
                    ifAvailable: true
                },
                async (lock: unknown) => {
                    clog.debug('获取锁', lock);
                    if (lock) {
                        plugin.loadObj = loading();
                        try {
                            await storageManager.addBlacklistItem({
                                starId: starId ?? undefined,
                                name,
                                allName,
                                role,
                                movieType,
                                url: blacklistUrl ?? undefined
                            });
                            await plugin.filterActorVideo(name, starId);
                            const okShow = show.ok(
                                `屏蔽结束,是否跳转到最后一页: ${plugin.lastPageLink}`,
                                {
                                    duration: -1,
                                    close: true,
                                    onClick: () => {
                                        okShow.closeShow?.();
                                        window.location.href = plugin.lastPageLink!;
                                    }
                                }
                            );
                        } catch (error: unknown) {
                            clog.error(error);
                            const errorShow = show.error(
                                '发生错误, 是否填转到解析失败的那一页? (点击并跳转)',
                                {
                                    duration: -1,
                                    close: true,
                                    onClick: () => {
                                        errorShow.closeShow?.();
                                        window.location.href = plugin.nextPageLink!;
                                    }
                                }
                            );
                        } finally {
                            plugin.loadObj!.close();
                        }
                    } else {
                        show.error('当前有定时任务在后台执行中, 无法发起此操作');
                    }
                }
            )
            .catch((lockError: unknown) => {
                clog.error('锁任务出现错误:', lockError);
            });
    });
}
