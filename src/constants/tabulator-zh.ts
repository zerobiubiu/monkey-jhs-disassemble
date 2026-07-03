/**
 * Tabulator 表格中文（zh-cn）语言包
 *
 * 从 archetype/jhs.user.js 中多处重复内联的 `langs["zh-cn"]` 对象提取而来。
 * 原脚本在以下位置以相同字面量重复出现该语言包（取 DetailPageButtonPlugin 处为代表）：
 *   - archetype/jhs.user.js L6234-6250（DetailPageButtonPlugin.searchXunLeiSubtitle）
 *   - archetype/jhs.user.js L6940-6956（HistoryPlugin.loadTableData）
 *   - archetype/jhs.user.js L7766-7782（BlacklistPlugin.loadTableData）
 *   - archetype/jhs.user.js L10530-10546（SettingPlugin.openFileListDialog）
 * 对应 src/plugins/*.ts 同名插件的 locale/langs 配置块亦为同一对象。
 *
 * 说明：src/legacy/jhs.ts 不含此语言包（仅 L644 引用 tabulator CSS），
 * 任务描述所提 L309-381 的 `function e` 实为 tooltip 定位工具，与此无关。
 *
 * 用法：`new Tabulator(el, { locale: "zh-cn", langs: { "zh-cn": TABULATOR_ZH_CN } })`
 */

/** Tabulator 分页控件文案字段（zh-cn） */
export interface TabulatorPaginationLocale {
    /** 首页按钮显示文本 */
    first: string;
    /** 首页按钮 title 提示 */
    first_title: string;
    /** 尾页按钮显示文本 */
    last: string;
    /** 尾页按钮 title 提示 */
    last_title: string;
    /** 上一页按钮显示文本 */
    prev: string;
    /** 上一页按钮 title 提示 */
    prev_title: string;
    /** 下一页按钮显示文本 */
    next: string;
    /** 下一页按钮 title 提示 */
    next_title: string;
    /** “显示全部”按钮文本 */
    all: string;
    /** 每页行数选择器标签 */
    page_size: string;
}

/** Tabulator zh-cn 语言包对象（对应 `langs["zh-cn"]` 的值） */
export interface TabulatorZhCnLocale {
    /** 分页相关文案 */
    pagination: TabulatorPaginationLocale;
}

/**
 * Tabulator 中文（zh-cn）语言包常量
 *
 * 作为 `langs["zh-cn"]` 的值传入 Tabulator 构造选项，
 * 替代原脚本各处重复内联的同一对象。
 */
export const TABULATOR_ZH_CN: TabulatorZhCnLocale = {
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
        page_size: '每页行数',
    },
};
