/**
 * 剪贴板工具（提取自 CommonUtil）。
 * 依赖全局 show、clog。
 */

/**
 * 复制文本到剪贴板并提示（原 copyToClipboard）。
 * @param label 提示用的标签名
 * @param text  待复制文本
 */
export function copyToClipboard(label: string, text: string): void {
    navigator.clipboard
        .writeText(text)
        .then(() => show.info(`${label}已复制到剪切板, ${text}`))
        .catch((err) => clog.error('复制失败: ', err));
}
