/**
 * Tabulator 表格工厂（提取自 dpb-subtitle / history-plugin / blacklist-plugin 的重复配置）。
 *
 * 提供中文语言包常量与基础配置工厂，减少各插件中 Tabulator 初始化的重复代码。
 */

/** Tabulator 中文语言包（zh-cn）。 */
export const TABULATOR_ZH_CN = {
    pagination: {
        first: '首页',
        first_title: '首页',
        last: '尾页',
        last_title: '尾页',
        prev: '上一页',
        prev_title: '上一页',
        next: '下一页',
        next_title: '下一页',
        all: '所有',
        page_size: '每页行数'
    }
};

/**
 * 创建 Tabulator 基础配置对象。
 * @param columns 列定义数组
 * @param data 可选的初始数据
 * @returns Tabulator 配置对象（含 fitColumns / 中文语言包 / 响应式折叠等通用设置）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
export function createTabulatorOptions(columns: any[], data?: unknown[]): Record<string, unknown> {
    const options: Record<string, unknown> = {
        layout: 'fitColumns',
        placeholder: '暂无数据',
        virtualDom: true,
        responsiveLayout: 'collapse',
        responsiveLayoutCollapse: true,
        columnDefaults: {
            headerHozAlign: 'center',
            hozAlign: 'center'
        },
        columns,
        locale: 'zh-cn',
        langs: { 'zh-cn': TABULATOR_ZH_CN }
    };
    if (data) {
        options.data = data;
    }
    return options;
}
