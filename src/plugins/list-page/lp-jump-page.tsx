/**
 * 列表页跳页控件功能模块。
 * 从 list-page-plugin.tsx 提取，逻辑与原实现一致。
 *
 * 含 addJumpPageControl：在分页栏挂载"跳转到指定页"控件
 * （#jumpPageInput input + 跳转 button，由 JumpPageControl 组件渲染）。
 */
import { currentHref } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';

import { JumpPageControl } from '../../components/misc/jump-page-control';

/** 在分页栏挂载"跳转到指定页"控件。对应原 L9024-9068。 */
export function addJumpPageControl(): void {
    const controlId = 'gemini-jump-page-control';
    if ($('#' + controlId).length > 0) {
        return;
    }
    if ($('.pagination-link.is-current').length === 0) {
        return;
    }
    const currentPage = utils.getUrlParam(currentHref, 'page') || 1;
    const $li = $(
        jsxToString(<JumpPageControl controlId={controlId} value={Number(currentPage) + 1} />)
    );
    $('.pagination-list').append($li);
    const $pageInput = $li.find('#jumpPageInput');
    const $jumpBtn = $li.find('button');
    const jumpToPage = () => {
        const pageNum = parseInt(String($pageInput.val()), 10);
        if (isNaN(pageNum) || pageNum < 1) {
            $pageInput.focus();
            return;
        }
        const url = new URL(window.location.href);
        url.searchParams.set('page', pageNum.toString());
        window.location.href = url.toString();
    };
    $jumpBtn.on('click', jumpToPage);
    $pageInput.on('keypress', (event: { which: number; preventDefault(): void }) => {
        if (event.which === 13) {
            jumpToPage();
            event.preventDefault();
        }
    });
}
