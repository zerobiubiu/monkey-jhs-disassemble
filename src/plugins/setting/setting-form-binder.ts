/**
 * 设置表单绑定操作（提取自 SettingPlugin）。
 *
 * 本文件为桶模块：loadForm / saveForm 提取至 ./setting-form-load，
 * bindClick 提取至 ./setting-form-bind；此处保留 initSimpleSettingForm
 * 并 re-export 上述函数，供 SettingPlugin 统一委托。
 */
import { createElement } from 'react';

import { isJavdbSite } from '../../constants/site';
import { YES, NO } from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';

import type { SettingPlugin } from '../setting-plugin';

import { HelpDialog } from '../../components/dialogs/help-dialog';
import { StyleBlock } from '../../components/misc/style-block';

import helpDialogCssRaw from '../../styles/help-dialog.css?raw';

export { loadForm, saveForm } from './setting-form-load';
export { bindClick } from './setting-form-bind';

/** 初始化简化设置面板表单（回填值 + 绑定即时生效的 change/input 事件）。对应原 L9807-10044。 */
export async function initSimpleSettingForm(plugin: SettingPlugin): Promise<void> {
    const settings = await storageManager.getSetting();
    const ns = '.jhsQs';
    $('#containerColumns').val(settings.containerColumns || 4);
    $('#showContainerColumns').text(settings.containerColumns || 4);
    $('#containerWidth').val((settings.containerWidth || 70) - 70);
    $('#showContainerWidth').text((settings.containerWidth || 70) + '%');
    $('#dialogOpenDetail').prop(
        'checked',
        !settings.dialogOpenDetail || settings.dialogOpenDetail === YES
    );
    $('#needClosePage').prop(
        'checked',
        !settings.needClosePage || settings.needClosePage === YES
    );
    const loadMode = settings.autoPageLoadMode === 'click' ? 'click' : 'auto';
    $('#autoPageLoadMode').attr('data-value', loadMode);
    $('#autoPageLoadMode .jhs-qs-seg-btn')
        .removeClass('is-active')
        .filter(`[data-value="${loadMode}"]`)
        .addClass('is-active');
    $('#translateTitle').prop(
        'checked',
        !settings.translateTitle || settings.translateTitle === YES
    );
    $('#enableLoadActressInfo').prop(
        'checked',
        !settings.enableLoadActressInfo || settings.enableLoadActressInfo === YES
    );
    $('#enableLoadOtherSite').prop(
        'checked',
        !settings.enableLoadOtherSite || settings.enableLoadOtherSite === YES
    );
    $('#containerColumns')
        .off(`input${ns}`)
        .on(`input${ns}`, async () => {
            const columns = $('#containerColumns').val();
            $('#showContainerColumns').text(String(columns ?? ''));
            if (isJavdbSite) {
                const movieListEl = document.querySelector('.movie-list') as HTMLElement | null;
                if (movieListEl)
                    movieListEl.style.gridTemplateColumns = `repeat(${columns}, minmax(0, 1fr))`;
            }
            await storageManager.saveSettingItem('containerColumns', columns);
            plugin.applyImageMode();
        });
    $('#containerWidth')
        .off(`input${ns}`)
        .on(`input${ns}`, async (event: Event) => {
            const rangeValue = parseInt(String($(event.target).val()), 10) || 0;
            const widthPercent = rangeValue + 70 + '%';
            $('#showContainerWidth').text(widthPercent);
            if (isJavdbSite) {
                const containerEl = document.querySelector('section .container') as HTMLElement | null;
                if (containerEl) containerEl.style.minWidth = widthPercent;
            }
            storageManager.saveSettingItem('containerWidth', rangeValue + 70);
        });
    $('#dialogOpenDetail')
        .off(`change${ns}`)
        .on(`change${ns}`, () => {
            const value = $('#dialogOpenDetail').is(':checked') ? YES : NO;
            storageManager.saveSettingItem('dialogOpenDetail', value);
        });
    $('#showFilterItem').prop(
        'checked',
        !!settings.showFilterItem && settings.showFilterItem === YES
    );
    $('#showFilterActorItem').prop(
        'checked',
        !!settings.showFilterActorItem && settings.showFilterActorItem === YES
    );
    $('#showFilterKeywordItem').prop(
        'checked',
        !!settings.showFilterKeywordItem && settings.showFilterKeywordItem === YES
    );
    $('#showFavoriteItem').prop(
        'checked',
        !settings.showFavoriteItem || settings.showFavoriteItem === YES
    );
    $('#showHasWatchItem').prop(
        'checked',
        !settings.showHasWatchItem || settings.showHasWatchItem === YES
    );
    $('#showFilterItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterItem', value);
            refresh();
        });
    $('#showFilterActorItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterActorItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterActorItem', value);
            refresh();
        });
    $('#showFilterKeywordItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFilterKeywordItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFilterKeywordItem', value);
            refresh();
        });
    $('#showFavoriteItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showFavoriteItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showFavoriteItem', value);
            refresh();
        });
    $('#showHasWatchItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showHasWatchItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showHasWatchItem', value);
            refresh();
        });
    const $filterCheckboxes = $(
        '#showFilterItem, #showFilterActorItem, #showFilterKeywordItem, #showFavoriteItem, #showHasWatchItem'
    );
    const updateDisabledState = () => {
        const isChecked = $('#showAllItem').is(':checked');
        $filterCheckboxes.prop('disabled', isChecked);
        if (isChecked) {
            $filterCheckboxes.attr('data-tip', '请先关闭显示所有才可点击');
            $('#jhs-qs-filter-group').addClass('is-disabled');
        } else {
            $filterCheckboxes.removeAttr('data-tip');
            $('#jhs-qs-filter-group').removeClass('is-disabled');
        }
    };
    $('#showAllItem').prop('checked', !!settings.showAllItem && settings.showAllItem === YES);
    $('#showAllItem')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#showAllItem').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('showAllItem', value);
            updateDisabledState();
            refresh();
        });
    updateDisabledState();
    $('#needClosePage')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            await storageManager.saveSettingItem(
                'needClosePage',
                $('#needClosePage').is(':checked') ? YES : NO
            );
            refresh();
        });
    $('#autoPageLoadMode')
        .off(`click${ns}`)
        .on(`click${ns}`, '.jhs-qs-seg-btn', async (event: Event) => {
            const value =
                $(event.currentTarget).attr('data-value') === 'click' ? 'click' : 'auto';
            const $seg = $('#autoPageLoadMode');
            if ($seg.attr('data-value') === value) return;
            $seg.attr('data-value', value);
            $seg.find('.jhs-qs-seg-btn').removeClass('is-active');
            $(event.currentTarget).addClass('is-active');
            await storageManager.saveSettingItem('autoPageLoadMode', value);
            const autoPagePlugin = plugin.getBean('AutoPagePlugin');
            autoPagePlugin?.setLoadMode?.(value);
            autoPagePlugin?.showLoadAllBtn?.();
        });
    $('#translateTitle')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#translateTitle').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('translateTitle', value);
            if (value === YES) {
                await plugin.getBean('ListPagePlugin').doFilter();
            } else {
                await plugin.getBean('ListPagePlugin').revertTranslation();
                $('.translated-title').remove();
            }
        });
    $('#enableLoadActressInfo')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#enableLoadActressInfo').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadActressInfo', value);
            if (value === YES) {
                plugin.getBean('ActressInfoPlugin').loadActressInfo();
            } else {
                $('.actress-info').remove();
            }
        });
    $('#enableLoadOtherSite')
        .off(`change${ns}`)
        .on(`change${ns}`, async () => {
            const value = $('#enableLoadOtherSite').is(':checked') ? YES : NO;
            await storageManager.saveSettingItem('enableLoadOtherSite', value);
            if (value === YES) {
                plugin.getBean('OtherSitePlugin').loadOtherSite().then();
            } else {
                $('#otherSiteBox').remove();
            }
        });
    $('#moreBtn')
        .off(`click${ns}`)
        .on(`click${ns}`, () => {
            plugin.cancelSimpleSettingHide();
            $('.simple-setting, .mini-simple-setting').html('').hide();
            plugin.openSettingDialog('base-panel');
        });
    $('#helpBtn')
        .off(`click${ns}`)
        .on(`click${ns}`, () => {
            layer.open({
                type: 1,
                title: '',
                shadeClose: true,
                scrollbar: false,
                content:
                    jsxToString(createElement(StyleBlock, { css: helpDialogCssRaw })) +
                    jsxToString(createElement(HelpDialog, null)),
                area: utils.getResponsiveArea(['50%', '90%'])
            });
        });
}
