/**
 * 全局加载动画（原 unsafeWindow.loading）
 *
 * 创建全屏 loading 遮罩并返回 close 句柄。
 * 样式由 `src/styles/loading.css` 提供（legacy 在原位置注入，保持执行顺序）。
 */

export interface LoadingHandle {
    close: () => void;
}

export function createLoading(): LoadingHandle {
    const container = document.createElement('div');
    container.className = 'loading-container';
    const animation = document.createElement('div');
    animation.className = 'loading-animation';
    container.appendChild(animation);
    document.body.appendChild(container);
    return {
        close: () => {
            if (container && container.parentNode) {
                container.parentNode.removeChild(container);
            }
        },
    };
}
