/**
 * 头像搜索与选择（提取自 new-video-plugin.tsx searchAvatar）。
 * 对应原 L11367-11464。
 *
 * 调用 Gfriends 仓库按女优名称搜索头像，弹出图片选择网格（含尺寸标签、
 * 加载/出错处理），选中后回填编辑弹窗的头像链接与预览。
 */
import { loadGfriends } from '../../core/gfriends';
import { jsxToString } from '../../core/jsx-to-string';

import { AvatarSelectDialog } from '../../components/dialogs/avatar-select-dialog';
import { StyleBlock } from '../../components/misc/style-block';

import avatarSelectDialogCssRaw from '../../styles/avatar-select-dialog.css?raw';

/**
 * 调用 Gfriends 仓库按女优名称搜索头像，弹出图片选择网格（含尺寸标签、
 * 加载/出错处理），选中后回填编辑弹窗的头像链接与预览。
 * 对应原 L11367-11464。无参数；返回 Promise<void>；不抛出异常
 *（搜索失败/无结果/链接全失效均仅 show.error 后返回）。
 */
export async function searchAvatar(): Promise<void> {
    const $nameInput = $('#edit-actress-name');
    const $allNameInput = $('#edit-actress-allname');
    const nameText: string = $nameInput.val().trim();
    const searchNames: string[] = $allNameInput
        .val()
        .trim()
        .split(/[\uff0c,]/)
        .map((name: string) => name.trim())
        .filter((name: string) => name.length > 0);
    if (nameText) {
        searchNames.unshift(nameText);
    }
    if (searchNames.length === 0) {
        show.error('请先填写女优主名称或别名进行搜索。');
        return;
    }
    const loader = (
        loading as (message: string) => {
            close: () => void;
        }
    )('正在搜索头像...');
    let avatarUrls: string[] = [];
    try {
        avatarUrls = await loadGfriends(searchNames);
    } catch (error: unknown) {
        show.error(`头像数据加载或搜索失败: ${error instanceof Error ? error.message : String(error)}`);
        return;
    } finally {
        loader.close();
    }
    if (avatarUrls.length === 0) {
        show.error(`未找到与 '${searchNames.join('、')}' 相关的头像。请检查名称。`);
        return;
    }
    // content = 原 searchAvatar 的 r 模板：<style> 块（avatar-select-dialog.css）
    // + HTML（AvatarSelectDialog），与原 content 字符级一致。
    const dialogContent: string =
        jsxToString(<StyleBlock css={avatarSelectDialogCssRaw} />) +
        jsxToString(<AvatarSelectDialog avatarUrls={avatarUrls} />);
    let errorCount: number = 0;
    layer.open({
        type: 1,
        title: `选择女优头像 (${avatarUrls.length} 张)`,
        area: utils.getResponsiveArea(['900px', '85%']),
        content: dialogContent,
        btn: ['关闭'],
        success: (layerEl: HTMLElement, layerIndex: number) => {
            const $layer = $(layerEl);
            const $images = $layer.find('.gfriends-selectable-img');
            const $prompt = $layer.find('#gfriends-prompt');
            $images.each((_index: number, element: HTMLImageElement) => {
                const $img = $(element);
                const wrapperId = String($img.data('wrapper-id') ?? '');
                const $wrapper = $layer.find(`#${wrapperId}`);
                const $sizeTag = $layer.find(
                    `.gfriends-size-tag[data-size-for="${wrapperId}"]`
                );
                $img.on('load', () => {
                    const width: number = element.naturalWidth;
                    const height: number = element.naturalHeight;
                    $sizeTag.text(`${width} x ${height}`);
                });
                $img.on('error', () => {
                    $wrapper.remove();
                    errorCount++;
                    const remaining: number = avatarUrls.length - errorCount;
                    $prompt.text(
                        `点击图片即可选择（已移除 ${errorCount} 张错误图片，剩余 ${remaining} 张）`
                    );
                    if (remaining === 0) {
                        show.error('所有搜索到的头像链接均已失效，无法选择。');
                        layer.close(layerIndex);
                    }
                });
                if (element.complete) {
                    if (element.naturalWidth > 0) {
                        $img.trigger('load');
                    } else {
                        $img.trigger('error');
                    }
                }
            });
            $images.on('click', (event: Event) => {
                const $img = $(event.currentTarget);
                const url = String($img.data('url') ?? '');
                $('#edit-actress-avatar').val(url);
                $('#edit-avatar-preview').attr('src', url);
                $images.removeClass('is-selected');
                $img.addClass('is-selected');
                setTimeout(() => {
                    layer.close(layerIndex);
                }, 150);
            });
            utils.setupEscClose(layerIndex);
        }
    });
}
