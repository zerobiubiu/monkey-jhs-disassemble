/**
 * PreviewVideoActionBtn —— 预览视频操作按钮（屏蔽/收藏/快进）（React 函数组件，JSX）。
 */

/** PreviewVideoActionBtn 的属性。 */
export interface PreviewVideoActionBtnProps {
    /** 按钮 id（如 "video-filterBtn"）。 */
    id: string;
    /** 背景色（如 "#de3333"）。 */
    color: string;
    /** 按钮文案（如 "屏蔽"/"收藏"/"快进"）。 */
    label: string;
}

/**
 * 渲染预览视频操作按钮的 JSX。
 */
export function PreviewVideoActionBtn({ id, color, label }: PreviewVideoActionBtnProps) {
    return (
        <button
            className="menu-btn"
            id={id}
            style={{
                minWidth: '120px',
                backgroundColor: color
            }}
        >
            {label}
        </button>
    );
}
