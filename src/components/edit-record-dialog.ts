/**
 * EditRecordDialog —— 编辑记录弹窗 HTML 字符串组件。
 *
 * 提取自 src/plugins/history-plugin.ts 的 editRecord（L736，
 * 原 archetype/jhs.user.js L7038 的 layer.open content）：
 * 番号（只读输入框）/演员（多行文本框）/状态（下拉选择，含"请选择"占位 +
 * 屏蔽/收藏/已观看三选项）/链接（输入框）/备注（多行文本框）构成的编辑表单。
 *
 * 保留原 HTML 结构、id（edit-carNum/edit-names/edit-status/edit-url/edit-remark）、
 * 内联 style 原样不动；\n 转义与缩进、闭合标签缺漏亦原样保留，与原
 * content 字符串零偏差。番号/演员/状态/链接/备注的当前值与状态下拉选项、
 * 输入框/文本框样式串通过 props 注入，以保持组件为纯模板（不在组件内
 * 重建样式常量或状态选项）。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 editRecord 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: EditRecordDialog({ ... }), ... })`
 * 文本框自动增高（autoResize）、保存（yes 回调读取各字段值并 updateCarInfo）
 * 仍由 editRecord 持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本表单含动态值（记录字段/状态选项），故用 props。
 */

/** EditRecordDialog 的状态下拉选项（屏蔽/收藏/已观看）。 */
export interface EditRecordStatusOption {
    /** 选项值（原 FILTER_ACTION/FAVORITE_ACTION/HAS_WATCH_ACTION）。 */
    value: string;
    /** 选项文案（原 BLOCK_TEXT/FAVORITE_TEXT/WATCHED_TEXT）。 */
    text: string;
}

/** EditRecordDialog 的属性。 */
interface EditRecordDialogProps {
    /** 当前记录番号（只读输入框 value）。 */
    carNum: string;
    /** 演员文本框初始内容（空格隔开）。 */
    names: string;
    /** 当前状态值（用于下拉选项 selected 判定）。 */
    status: string;
    /** 链接输入框 value。 */
    url: string;
    /** 备注文本框初始内容。 */
    remark: string;
    /** 输入框内联样式串（原 inputStyle）。 */
    inputStyle: string;
    /** 文本框内联样式串（原 textareaStyle）。 */
    textareaStyle: string;
    /** 状态下拉选项列表（屏蔽/收藏/已观看）。 */
    statusOptions: EditRecordStatusOption[];
}

/**
 * 渲染编辑记录弹窗的 HTML 字符串。
 * @param props.carNum 当前记录番号（只读）。
 * @param props.names 演员文本框初始内容。
 * @param props.status 当前状态值（selected 判定）。
 * @param props.url 链接输入框 value。
 * @param props.remark 备注文本框初始内容。
 * @param props.inputStyle 输入框内联样式串。
 * @param props.textareaStyle 文本框内联样式串。
 * @param props.statusOptions 状态下拉选项列表。
 * @returns 编辑记录表单 HTML（番号/演员/状态/链接/备注），供
 *          layer.open({ content }) 直接消费。
 */
export function EditRecordDialog({
    carNum,
    names,
    status,
    url,
    remark,
    inputStyle,
    textareaStyle,
    statusOptions,
}: EditRecordDialogProps): string {
    return `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">番号:</label>\n                    <input type="text" id="edit-carNum" value="${carNum}" style="${inputStyle} background-color: #f0f0f0;" readonly>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" style="${textareaStyle}">${names}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">状态:</label>\n                    <select id="edit-status" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${status === "" ? "selected" : ""}>-- 请选择 --</option>\n                        ${statusOptions.map((opt) => `\n                            <option value="${opt.value}" ${status === opt.value ? "selected" : ""}>${opt.text}</option>\n                        `).join("")}\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">链接:</label>\n                    <input type="text" id="edit-url" value="${url}" style="${inputStyle}">\n                </div>\n                \n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                    <textarea id="edit-remark" style="${textareaStyle}">${remark}</textarea>\n                </div>\n            </div>\n        `;
}
