/**
 * FoldCategoryToolbar —— 折叠分类工具条（React 函数组件，JSX）。
 */
import type { CSSProperties } from 'react';

/** FoldCategoryToolbar 的属性。 */
export interface FoldCategoryToolbarProps {
    /** 已选分类文本（原 selectedTagsText，多个标签空格分隔）。 */
    selectedTagsText: string;
}

/**
 * 渲染折叠分类工具条的 JSX。
 */
export function FoldCategoryToolbar({ selectedTagsText }: FoldCategoryToolbarProps) {
    const containerStyle: CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        flexGrow: 1,
        justifyContent: 'flex-end'
    };
    const anchorStyle: CSSProperties = {
        backgroundColor: '#d23e60 !important'
    };
    const iconStyle: CSSProperties = { marginLeft: '10px' };
    return (
        <div style={containerStyle}>
            <div>
                已选分类: <span id="jhs-check-tag">{selectedTagsText}</span>
            </div>
            <a className="jhs-toolbar-menu-btn  main-tab-btn" id="foldCategoryBtn" style={anchorStyle}>
                <span></span>
                <i style={iconStyle}></i>
            </a>
        </div>
    );
}
