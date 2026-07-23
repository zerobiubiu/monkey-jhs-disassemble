/**
 * 关键词标签管理操作（提取自 SettingPlugin）。
 *
 * 包含关键词标签的创建（addLabelTag）与从输入框读取关键词添加标签
 * （addKeyword）。对应原 archetype/jhs.user.js 屏蔽词标签管理逻辑。
 */
import { createElement } from 'react';

import { isJavdbSite } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';

import { KeywordLabel } from '../../components/misc/keyword-label';

/** 在关键词容器内添加一个关键词标签（带删除按钮）。 */
export function addLabelTag(containerSelector: string, keyword: string): void {
    const $tagBox = $(`${containerSelector} .tag-box`);
    let $label: JQuery;
    const bgColor = '#cbd5e1';
    let textColor = '#333';
    if (/^[a-z]{2,}-/i.test(keyword) && isJavdbSite) {
        textColor = '#3477ad';
        $label = $(
            jsxToString(
                createElement(KeywordLabel, {
                    keyword,
                    bgColor,
                    textColor,
                    variant: 'link',
                    href: `/video_codes/${keyword.replace('-', '')}`
                })
            )
        );
    } else {
        $label = $(
            jsxToString(
                createElement(KeywordLabel, {
                    keyword,
                    bgColor,
                    textColor,
                    variant: 'div'
                })
            )
        );
    }
    $label.find('.keyword-remove').click((event: MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();
        const $removeBtn = $(event.currentTarget);
        const removeKeyword = ($removeBtn
            .closest('.keyword-label')
            .attr('data-keyword') ?? '')
            .split(' ')[0];
        utils.q(event, `是否移除屏蔽词  ${removeKeyword}?`, async () => {
            $removeBtn.parent().remove();
        });
    });
    $tagBox.append($label);
}

/** 从输入框读取关键词并添加为标签。 */
export function addKeyword(containerSelector: string): void {
    const $input = $(`${containerSelector} .keyword-input`);
    const keyword = String($input.val() ?? '').trim();
    if (keyword) {
        addLabelTag(containerSelector, keyword);
        $input.val('');
    }
}
