/**
 * 编辑女优弹窗（提取自 new-video-plugin.tsx editActress）。
 * 对应原 L11196-11321。
 *
 * 职责：预填头像/名称/别名/类别/最新作品/备注，支持搜索头像、
 * 切换 CDN 源、自动调整 textarea 高度，保存时回写 storageManager。
 */
import type { CSSProperties } from 'react';
import { GFRIENDS_SOURCES, GFRIENDS_CDN_INDEX_KEY, FILETREE_DATA_KEY } from '../../resources/gfriends';
import { clearCache, getCurrentCdnSource } from '../../core/gfriends';
import { jsxToString } from '../../core/jsx-to-string';
import type { FavoriteActress } from '../../core/storage-manager';

import type { NewVideoPlugin } from '../new-video-plugin';
import type { FavoriteActressRecord } from './actress-card-renderer';

import { EditActressDialog } from '../../components/dialogs/edit-actress-dialog';
import { CdnSelectDialog } from '../../components/dialogs/cdn-select-dialog';

/**
 * 打开编辑女优弹窗：预填头像/名称/别名/类别/最新作品/备注，支持搜索头像、
 * 切换 CDN 源、自动调整 textarea 高度，保存时回写 storageManager。
 * 对应原 L11196-11321。
 * @param plugin NewVideoPlugin 实例。
 * @param actress 待编辑的收藏女优记录。
 */
export async function editActress(plugin: NewVideoPlugin, actress: FavoriteActressRecord): Promise<void> {
    const name: string = actress.name;
    const avatar: string = actress.avatar;
    const remark: string = actress.remark || '';
    const allNameText: string = Array.isArray(actress.allName)
        ? actress.allName.join('，')
        : '';
    const newVideoText: string = Array.isArray(actress.newVideoList)
        ? actress.newVideoList.join('，')
        : '';
    const starId: string = actress.starId;
    const textareaStyle: CSSProperties = {
        width: '100%',
        padding: '8px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        minHeight: '60px',
        overflowY: 'hidden'
    };
    const actressType: string = actress.actressType || '';
    const dialogContent: string = jsxToString(
        <EditActressDialog
            avatar={avatar}
            name={name}
            textareaStyle={textareaStyle}
            allNameText={allNameText}
            actressType={actressType}
            newVideoText={newVideoText}
            remark={remark}
        />
    );
    layer.open({
        type: 1,
        title: `编辑女优: ${name} (${starId})`,
        area: ['500px', '750px'],
        content: dialogContent,
        btn: ['保存', '取消'],
        success: (_layerEl: HTMLElement, layerIndex: number) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- jQuery object used with .css() and [0].scrollHeight
            const autoHeight = ($textarea: any) => {
                $textarea.css('height', 'auto');
                $textarea.css('height', $textarea[0].scrollHeight + 15 + 'px');
            };
            $('#edit-actress-avatar').on('input', (event: Event) => {
                const val: string = $(event.currentTarget).val();
                $('#edit-avatar-preview').attr('src', val);
            });
            const $allNameArea = $('#edit-actress-allname');
            $allNameArea.on('input', (event: Event) => {
                autoHeight($(event.currentTarget));
            });
            autoHeight($allNameArea);
            const $newVideoArea = $('#edit-actress-newvideolist');
            $newVideoArea.on('input', (event: Event) => {
                autoHeight($(event.currentTarget));
            });
            autoHeight($newVideoArea);
            $('#search-avatar-btn').on('click', async () => {
                await plugin.searchAvatar();
            });
            $('#select-cdn-btn').on('click', async () => {
                const currentIndex: number = getCurrentCdnSource().index;
                const cdnDialogContent: string = jsxToString(
                    <CdnSelectDialog sources={GFRIENDS_SOURCES} currentIndex={currentIndex} />
                );
                layer.open({
                    type: 1,
                    title: '选择 CDN 源',
                    area: ['400px', 'auto'],
                    content: cdnDialogContent,
                    btn: ['确定', '取消'],
                    success: (_cdnLayerEl: HTMLElement, cdnLayerIndex: number) => {
                        utils.setupEscClose(cdnLayerIndex);
                    },
                    yes: async (cdnLayerIndex: number) => {
                        const selectedValue = String($('input[name="cdn-source"]:checked').val() ?? '');
                        const selectedIndex: number = parseInt(selectedValue, 10);
                        if (selectedIndex !== currentIndex) {
                            localStorage.setItem(
                                GFRIENDS_CDN_INDEX_KEY,
                                selectedIndex.toString()
                            );
                            clearCache();
                            try {
                                await window.filetreeDb.set(FILETREE_DATA_KEY, null);
                            } catch (error: unknown) {
                                clog.error('清除 IndexedDB 缓存失败:', error);
                            }
                            show.ok(`CDN 源已切换为: ${GFRIENDS_SOURCES[selectedIndex].name}`);
                            layer.close(cdnLayerIndex);
                        } else {
                            layer.close(cdnLayerIndex);
                        }
                    }
                });
            });
            utils.setupEscClose(layerIndex);
        },
        yes: async (layerIndex: number) => {
            const avatar: string = String($('#edit-actress-avatar').val() ?? '').trim();
            const name: string = String($('#edit-actress-name').val() ?? '').trim();
            const allNameText: string = String($('#edit-actress-allname').val() ?? '').trim();
            const newVideoText: string = String($('#edit-actress-newvideolist').val() ?? '').trim();
            const remark: string = String($('#edit-remark').val() ?? '').trim();
            const actressType: string = String($('#actressType').val() ?? '');
            if (!name) {
                show.error('主名称不能为空');
                return false;
            }
            const allNameArray: string[] = allNameText
                .split(/[\uff0c,]/)
                .map((part) => part.trim())
                .filter((part) => part.length > 0);
            const newVideoArray: string[] = newVideoText
                .split(/[\uff0c,]/)
                .map((part) => part.trim())
                .filter((part) => part.length > 0);
            actress.avatar = avatar;
            actress.name = name;
            actress.allName = allNameArray;
            actress.newVideoList = newVideoArray;
            actress.actressType = actressType;
            actress.remark = remark;
            if (await storageManager.updateFavoriteActress(actress as unknown as FavoriteActress)) {
                show.error('修改失败');
            } else {
                plugin.renderActressCards().then();
                show.ok(`女优 ${name} 信息已更新`);
                layer.close(layerIndex);
            }
        }
    });
}
