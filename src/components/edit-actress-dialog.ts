/**
 * EditActressDialog —— 编辑女优表单 HTML 字符串组件。
 *
 * 提取自 src/plugins/new-video-plugin.ts 的 editActress（L307-326，
 * 原 archetype/jhs.user.js L11207 的 layer.open content）：头像预览
 * （edit-avatar-preview 圆形图）+ 头像链接输入框（edit-actress-avatar）+
 * 搜索头像/选择 CDN 源双按钮 + 主名称输入框（edit-actress-name）+
 * 所有别名 textarea（edit-actress-allname）+ 演员类别下拉
 * （actressType，含未知/有码/无码三选项，按当前值 selected）+
 * 最新作品 textarea（edit-actress-newvideolist）+ 备注 textarea
 * （edit-remark），整体 padding:20px 表单。
 *
 * 保留原 HTML 结构、id（edit-avatar-preview/edit-actress-avatar/
 * search-avatar-btn/select-cdn-btn/edit-actress-name/edit-actress-allname/
 * actressType/edit-actress-newvideolist/edit-remark）、内联 style 原样不动；
 * \n 转义与缩进、闭合标签缺漏亦原样保留，与原 content 字符串零偏差。
 * 头像 URL（preview src 与 input value 各一处）、主名称、别名/最新作品/
 * 备注三处 textarea 初始内容、textarea 样式串、演员类别（用于三处 option
 * 的 selected 判定）通过 props 注入，以保持组件为纯模板。
 *
 * 渲染方式：本组件为普通函数，返回 HTML 字符串（模板拼接）。
 * 供 editActress 中 layer.open({ content }) 直接消费：
 *   `layer.open({ content: EditActressDialog({ ... }), ... })`
 * 头像链接 input 自动同步预览、textarea 自动增高、搜索头像/选择 CDN/
 * 保存（yes 回调读取各字段值并回写 storageManager）仍由 editActress 的
 * success/yes 回调持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup（避免引入
 * react-dom/server 导致产物膨胀）。本表单含动态值（字段值/样式/类别），故用 props。
 */

/** EditActressDialog 的属性。 */
interface EditActressDialogProps {
    /** 头像 URL（用于 edit-avatar-preview 的 src 与 edit-actress-avatar 的 value）。 */
    avatar: string;
    /** 主名称（edit-actress-name 的 value）。 */
    name: string;
    /** textarea 内联样式串（原 textareaStyle，用于别名/最新作品/备注三处 textarea）。 */
    textareaStyle: string;
    /** 所有别名 textarea 初始内容（原 allNameText，逗号分隔）。 */
    allNameText: string;
    /** 演员类别（原 actressType，用于 actressType 下拉三处 option 的 selected 判定）。 */
    actressType: string;
    /** 最新作品 textarea 初始内容（原 newVideoText，逗号分隔）。 */
    newVideoText: string;
    /** 备注 textarea 初始内容（原 remark）。 */
    remark: string;
}

/**
 * 渲染编辑女优表单的 HTML 字符串。
 * @param props.avatar 头像 URL（preview src 与 input value）。
 * @param props.name 主名称（input value）。
 * @param props.textareaStyle textarea 内联样式串。
 * @param props.allNameText 所有别名 textarea 初始内容。
 * @param props.actressType 演员类别（option selected 判定）。
 * @param props.newVideoText 最新作品 textarea 初始内容。
 * @param props.remark 备注textarea 初始内容。
 * @returns 编辑女优表单 HTML（头像/名称/别名/类别/最新作品/备注），
 *          供 layer.open({ content }) 直接消费。
 */
export function EditActressDialog({
    avatar,
    name,
    textareaStyle,
    allNameText,
    actressType,
    newVideoText,
    remark,
}: EditActressDialogProps): string {
    return `\n            <div style="padding: 20px;">\n                <div style="margin-bottom: 15px; text-align: center;">\n                    <img id="edit-avatar-preview" src="${avatar}" alt="Avatar Preview" \n                         style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; margin-bottom: 10px; border: 2px solid #ddd;">\n                    <div style="text-align: left">\n                        <label style="display: block; margin-bottom: 5px; font-weight: bold;">头像链接:</label>\n                        <input type="text" id="edit-actress-avatar" value="${avatar}" \n                               style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                       <div style="display: flex; gap: 5px; margin-top: 5px;">\n                            <button type="button" id="search-avatar-btn" \n                                style="flex-grow: 1; padding: 8px; background-color: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">\n                                搜索头像\n                            </button>\n                            <button type="button" id="select-cdn-btn" \n                                style="width: 100px; padding: 8px; background-color: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">\n                                选择 CDN 源\n                            </button>\n                        </div>\n                    </div>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">主名称:</label>\n                    <input type="text" id="edit-actress-name" value="${name}" \n                           style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">所有别名(用逗号隔开):</label>\n                    <textarea id="edit-actress-allname" style="${textareaStyle}">${allNameText}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">演员类别:</label>\n                    <select id="actressType" style="width: 100%; padding: 10px; border: 1px solid #ddd;">\n                        <option value="" ${actressType === "" ? "selected" : ""}>未知</option>\n                        <option value="censored" ${actressType === "censored" ? "selected" : ""}>有码</option>\n                        <option value="uncensored" ${actressType === "uncensored" ? "selected" : ""}>无码</option>\n                    </select>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">最新作品(用逗号隔开):</label>\n                    <textarea id="edit-actress-newvideolist" style="${textareaStyle}">${newVideoText}</textarea>\n                </div>\n                <div style="margin-bottom: 15px;">\n                    <label style="display: block; margin-bottom: 5px; font-weight: bold;">备注:</label>\n                   <textarea id="edit-remark" style="${textareaStyle}">${remark}</textarea>\n                </div>\n            </div>\n        `;
}
