/**
 * EditActressDialog —— 编辑女优表单（React 函数组件，JSX）。
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
 * actressType/edit-actress-newvideolist/edit-remark）、内联 style（经
 * CSSProperties 对象还原为 kebab-case CSS 字符串，值原样保留）。
 * 头像 URL（preview src 与 input value 各一处）、主名称、别名/最新作品/
 * 备注三处 textarea 初始内容、textarea 样式（CSSProperties 对象，原 .ts 为
 * CSS 字符串，转 TSX 时一并对象化，与其它已转组件风格一致）、演员类别
 * （用于三处 option 的 selected 判定，写作 `selected={actressType === "..."}`）
 * 通过 props 注入，以保持组件为纯模板。各 label 的内联 style（display:block /
 * margin-bottom:5px / font-weight:bold）转为 CSSProperties 常量 LABEL_STYLE，
 * 字段容器 div 的 margin-bottom:15px 转为 FIELD_ROW_STYLE。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 editActress 中 layer.open({ content })
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<EditActressDialog {...props} />), ... })`
 * 头像链接 input 自动同步预览、textarea 自动增高、搜索头像/选择 CDN/
 * 保存（yes 回调读取各字段值并回写 storageManager）仍由 editActress 的
 * success/yes 回调持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。本表单含动态值（字段值/样式/类别），故用 props。属性
 * 值（value 等）不做转义，与原 layer.open content 字符串拼接行为一致。
 */
import type { CSSProperties } from "react";

/** EditActressDialog 的属性。 */
interface EditActressDialogProps {
    /** 头像 URL（用于 edit-avatar-preview 的 src 与 edit-actress-avatar 的 value）。 */
    avatar: string;
    /** 主名称（edit-actress-name 的 value）。 */
    name: string;
    /** textarea 内联样式（原 textareaStyle CSS 字符串，对象化为 CSSProperties）。 */
    textareaStyle: CSSProperties;
    /** 所有别名 textarea 初始内容（原 allNameText，逗号分隔）。 */
    allNameText: string;
    /** 演员类别（原 actressType，用于 actressType 下拉三处 option 的 selected 判定）。 */
    actressType: string;
    /** 最新作品 textarea 初始内容（原 newVideoText，逗号分隔）。 */
    newVideoText: string;
    /** 备注 textarea 初始内容（原 remark）。 */
    remark: string;
}

/** 各 label 的统一样式（原内联 style 对象化）。 */
const LABEL_STYLE: CSSProperties = {
    display: "block",
    marginBottom: "5px",
    fontWeight: "bold",
};

/** 各字段容器 div 的统一样式（原 `margin-bottom: 15px`）。 */
const FIELD_ROW_STYLE: CSSProperties = { marginBottom: "15px" };

/**
 * 渲染编辑女优表单的 JSX。
 * @param props.avatar 头像 URL（preview src 与 input value）。
 * @param props.name 主名称（input value）。
 * @param props.textareaStyle textarea 内联样式（CSSProperties）。
 * @param props.allNameText 所有别名 textarea 初始内容。
 * @param props.actressType 演员类别（option selected 判定）。
 * @param props.newVideoText 最新作品 textarea 初始内容。
 * @param props.remark 备注textarea 初始内容。
 * @returns 编辑女优表单 JSX（头像/名称/别名/类别/最新作品/备注），
 *          经 jsxToString 转 HTML 字符串后供 layer.open({ content }) 直接消费。
 */
export function EditActressDialog({
    avatar,
    name,
    textareaStyle,
    allNameText,
    actressType,
    newVideoText,
    remark,
}: EditActressDialogProps) {
    return (
        <div style={{ padding: "20px" }}>
            <div style={{ marginBottom: "15px", textAlign: "center" }}>
                <img
                    id="edit-avatar-preview"
                    src={avatar}
                    alt="Avatar Preview"
                    style={{
                        width: "100px",
                        height: "100px",
                        borderRadius: "50%",
                        objectFit: "cover",
                        marginBottom: "10px",
                        border: "2px solid #ddd",
                    }}
                />
                <div style={{ textAlign: "left" }}>
                    <label style={LABEL_STYLE}>头像链接:</label>
                    <input
                        type="text"
                        id="edit-actress-avatar"
                        value={avatar}
                        style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #ccc",
                            borderRadius: "4px",
                        }}
                    />
                    <div style={{ display: "flex", gap: "5px", marginTop: "5px" }}>
                        <button
                            type="button"
                            id="search-avatar-btn"
                            style={{
                                flexGrow: 1,
                                padding: "8px",
                                backgroundColor: "#007bff",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                            }}
                        >
                            搜索头像
                        </button>
                        <button
                            type="button"
                            id="select-cdn-btn"
                            style={{
                                width: "100px",
                                padding: "8px",
                                backgroundColor: "#6c757d",
                                color: "white",
                                border: "none",
                                borderRadius: "4px",
                                cursor: "pointer",
                                fontSize: "12px",
                            }}
                        >
                            选择 CDN 源
                        </button>
                    </div>
                </div>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>主名称:</label>
                <input
                    type="text"
                    id="edit-actress-name"
                    value={name}
                    style={{
                        width: "100%",
                        padding: "8px",
                        border: "1px solid #ccc",
                        borderRadius: "4px",
                    }}
                />
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>所有别名(用逗号隔开):</label>
                <textarea id="edit-actress-allname" style={textareaStyle}>
                    {allNameText}
                </textarea>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>演员类别:</label>
                <select
                    id="actressType"
                    style={{
                        width: "100%",
                        padding: "10px",
                        border: "1px solid #ddd",
                    }}
                >
                    <option value="" selected={actressType === ""}>
                        未知
                    </option>
                    <option
                        value="censored"
                        selected={actressType === "censored"}
                    >
                        有码
                    </option>
                    <option
                        value="uncensored"
                        selected={actressType === "uncensored"}
                    >
                        无码
                    </option>
                </select>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>最新作品(用逗号隔开):</label>
                <textarea id="edit-actress-newvideolist" style={textareaStyle}>
                    {newVideoText}
                </textarea>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>备注:</label>
                <textarea id="edit-remark" style={textareaStyle}>
                    {remark}
                </textarea>
            </div>
        </div>
    );
}
