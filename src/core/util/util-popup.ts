/**
 * 弹窗/确认框工具（提取自 CommonUtil 中无状态部分）。
 * 依赖全局 layer、storageManager、clog。
 * 注：ESC 关闭机制（setupEscClose/_handleGlobalEscKey 等）因深度依赖实例状态
 * 保留在 CommonUtil 类上。
 */

/**
 * 在指定位置弹出确认框（原 q）。
 * @param event     触发事件，提供时按鼠标位置定位；null 时居中
 * @param content   提示内容
 * @param onConfirm 确定回调
 * @param onCancel  取消回调
 */
export function q(
    event: MouseEvent | null,
    content: string,
    onConfirm?: () => void,
    onCancel?: () => void
): void {
    let left: number;
    let top: number;
    if (event) {
        left = event.clientX - 130;
        top = event.clientY - 120;
    } else {
        left = window.innerWidth / 2 - 120;
        top = window.innerHeight / 2 - 120;
    }
    const layerIdx = layer.confirm(
        content,
        {
            offset: [top, left],
            title: '提示',
            btn: ['确定', '取消'],
            shade: 0,
            zIndex: 999999991
        },
        function () {
            if (onConfirm) {
                onConfirm();
            }
            layer.close(layerIdx);
        },
        function () {
            if (onCancel) {
                onCancel();
            }
        }
    );
}

/**
 * 默认弹层尺寸（原 getDefaultArea）。
 * @returns ["85%","90%"]
 */
export function getDefaultArea(): string[] {
    return ['85%', '90%'];
}

/**
 * 依据视口宽度返回 layer 弹层尺寸（原 getResponsiveArea）。
 * @param area 自定义 [宽,高]，仅在宽屏(>=1200)生效
 * @returns 形如 ["85%","90%"] 的尺寸数组
 */
export function getResponsiveArea(area?: string[]): string[] {
    const width = window.innerWidth;
    if (width >= 1200) {
        return area || getDefaultArea();
    } else if (width >= 768) {
        return ['70%', '90%'];
    } else {
        return ['95%', '95%'];
    }
}

/**
 * 在 iframe 子页面中关闭自身 layer 弹层（原 closePage）。
 * 依据设置 needClosePage 决定是否执行：恢复父页滚动、移除遮罩/弹层 DOM、window.close。
 */
export function closePage(): void {
    storageManager.getSetting('needClosePage', 'yes').then((setting: any) => {
        if (setting !== 'yes') {
            return;
        }
        parent.document.documentElement.style.overflow = 'auto';
        ['.layui-layer-shade', '.layui-layer-move', '.layui-layer'].forEach(
            (selector: string) => {
                const matches = parent.document.querySelectorAll(selector);
                if (matches.length > 0) {
                    const el = matches.length > 1 ? matches[matches.length - 1] : matches[0];
                    el.parentNode?.removeChild(el);
                }
            }
        );
        window.close();
    }).catch((err: unknown) => clog.error('needClosePage 设置读取失败', err));
}
