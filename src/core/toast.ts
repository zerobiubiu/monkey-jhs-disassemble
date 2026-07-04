/**
 * Toast 通知模块（提取自 archetype/jhs.user.js L2075-2144）
 *
 * 基于全局 Toastify（由 userscript @require 引入，类型声明见
 * src/types/globals.d.ts，此处为 any）。提供 createToast 工厂与 show
 * 快捷 API。原 IIFE 中的 window/unsafeWindow 挂载由 legacy 启动逻辑
 * 负责，本模块仅导出对象。
 */

/**
 * 创建并立即显示一个 Toastify toast 实例。
 *
 * 用途：构造 toast 选项（含 info/success/error 三套渐变样式），调用
 * 全局 Toastify 创建实例并 showToast，同时挂载 closeShow 快捷移除方法。
 *
 * 参数多态说明（保留原始控制流，类型擦除后运行时行为与原脚本一致）：
 * - position：为对象时作为完整选项；否则作为 gravity（"top"|"bottom"|"center"）。
 * - duration：为对象时作为完整选项；为字符串时作为水平 position（"left"|"right"|"center"）。
 * - onClick：当 position/duration 均非对象时，作为兜底选项对象。
 *
 * @param message   toast 文本内容
 * @param type      样式类型：'info' | 'success' | 'error'
 * @param position  gravity 或完整选项对象（多态）
 * @param duration  水平 position 字符串或选项对象（多态）
 * @param onClick   兜底选项对象
 * @returns Toastify 实例（any），已调用 showToast，并附加 closeShow 方法
 */
export const createToast = (
    message: string,
    type: 'info' | 'success' | 'error',
    position: any,
    duration: any,
    onClick: any
): any => {
    let userOptions: any;
    if (typeof position == 'object') {
        userOptions = position;
    } else {
        userOptions = typeof duration == 'object' ? duration : onClick || {};
        userOptions.gravity = position || 'top';
        userOptions.position = typeof duration == 'string' ? duration : 'center';
    }
    if (!userOptions.gravity || userOptions.gravity === 'center') {
        userOptions.offset = {
            y: 'calc(50vh - 150px)'
        };
    }
    const infoFrom = '#60A5FA';
    const infoTo = '#93C5FD';
    const successFrom = '#10B981';
    const successTo = '#6EE7B7';
    const errorFrom = '#EF4444';
    const errorTo = '#FCA5A5';
    const baseStyle = {
        borderRadius: '12px',
        color: 'white',
        padding: '12px 16px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        minWidth: '150px',
        textAlign: 'center',
        zIndex: 999999999
    };
    const toastOptions = {
        text: message,
        duration: 1000,
        close: false,
        gravity: 'top',
        position: 'center',
        style: {
            info: {
                ...baseStyle,
                background: `linear-gradient(to right, ${infoFrom}, ${infoTo})`
            },
            success: {
                ...baseStyle,
                background: `linear-gradient(to right, ${successFrom}, ${successTo})`
            },
            error: {
                ...baseStyle,
                background: `linear-gradient(to right, ${errorFrom}, ${errorTo})`
            }
        }[type],
        stopOnFocus: true,
        oldestFirst: false,
        ...userOptions
    };
    if (toastOptions.duration === -1) {
        toastOptions.close = true;
    }
    const toast = Toastify(toastOptions);
    toast.showToast();
    toast.closeShow = () => {
        toast.toastElement.remove();
    };
    return toast;
};

/**
 * Toast 快捷 API（对应原 unsafeWindow.show / window.show）。
 *
 * 三个方法分别使用 success/error/info 样式，转发到 createToast。
 * 保留原始多态参数：position 默认 "center"，duration/onClick 可省略。
 */
export const show = {
    /**
     * 显示 success 样式 toast。
     * @param message  文本
     * @param position gravity 或选项对象，默认 "center"
     * @param duration 水平 position 或选项对象
     * @param onClick  兜底选项对象
     */
    ok: (message: string, position: any = 'center', duration?: any, onClick?: any) =>
        createToast(message, 'success', position, duration, onClick),
    /**
     * 显示 error 样式 toast。参数同 ok。
     */
    error: (message: string, position: any = 'center', duration?: any, onClick?: any) =>
        createToast(message, 'error', position, duration, onClick),
    /**
     * 显示 info 样式 toast。参数同 ok。
     */
    info: (message: string, position: any = 'center', duration?: any, onClick?: any) =>
        createToast(message, 'info', position, duration, onClick)
};
