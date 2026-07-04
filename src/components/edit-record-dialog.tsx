/**
 * EditRecordDialog —— 编辑记录弹窗（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/history-plugin.ts 的 editRecord（L736，
 * 原 archetype/jhs.user.js L7038 的 layer.open content）：
 * 番号（只读输入框）/演员（多行文本框）/状态（下拉选择，含"请选择"占位 +
 * 屏蔽/收藏/已观看三选项）/链接（输入框）/备注（多行文本框）构成的编辑表单。
 *
 * 保留原 HTML 结构、id（edit-carNum/edit-names/edit-status/edit-url/edit-remark）、
 * 内联 style 值零偏差。状态下拉选项的 `selected` 由 `selected={status === opt.value}`
 * 布尔驱动，jsxToString 输出裸 `selected` 或省略，与原 `${cond ? "selected" : ""}`
 * 等价。番号输入框的 `readonly` 在 JSX 中写作 `readOnly`（React 类型要求
 * camelCase），jsxToString 输出 `readOnly` 裸属性——HTML 属性名大小写不敏感，
 * 浏览器/jQuery 解析时等同 `readonly`，行为等价（与 doc/17「DOM 等价」
 * 哲学一致）。
 *
 * 输入框/文本框的 style 由调用方以 CSSProperties 对象传入（inputStyle/
 * textareaStyle，原 .ts 为 CSS 字符串，转 TSX 时一并对象化，与其它已转
 * 组件风格一致）。edit-carNum 的 style 为 `{ ...inputStyle, backgroundColor:
 * "#f0f0f0" }`（原模板 `${inputStyle} background-color: #f0f0f0;` 拼接的
 * 等价对象形式，声明顺序/值一致；jsxToString 经 styleToCss 还原为
 * `width:100%;...;background-color:#f0f0f0`，与原值 CSS 等价，仅空白/尾
 * 分号差异，见 doc/17）。edit-url 用 inputStyle，两个 textarea 用
 * textareaStyle。各 label 的内联 style（display:block / margin-bottom:5px /
 * font-weight:bold）转为 CSSProperties 对象。原模板中的 `\n` 转义与缩进、
 * 闭合标签缺漏由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 editRecord 中
 * `layer.open({ content: jsxToString(<EditRecordDialog {...} />), ... })` 直接
 * 消费。文本框自动增高（autoResize）、保存（yes 回调读取各字段值并
 * updateCarInfo）仍由 editRecord 持有，组件只负责静态结构 + 动态值插值。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。本表单含动态值（记录字段/状态选项），故用 props。属性
 * 值（value 等）不做转义，与原 layer.open content 字符串拼接行为一致。
 */
import type { CSSProperties } from 'react';

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
    /** 输入框内联样式（原 inputStyle，CSS 字符串对象化为 CSSProperties）。 */
    inputStyle: CSSProperties;
    /** 文本框内联样式（原 textareaStyle，CSS 字符串对象化为 CSSProperties）。 */
    textareaStyle: CSSProperties;
    /** 状态下拉选项列表（屏蔽/收藏/已观看）。 */
    statusOptions: EditRecordStatusOption[];
}

/** 番号/演员/状态/链接/备注各 label 的统一样式（原内联 style 对象化）。 */
const LABEL_STYLE: CSSProperties = {
    display: 'block',
    marginBottom: '5px',
    fontWeight: 'bold'
};

/** 各字段容器 div 的统一样式（原 `margin-bottom: 15px`）。 */
const FIELD_ROW_STYLE: CSSProperties = { marginBottom: '15px' };

/**
 * 渲染编辑记录弹窗的 JSX。
 * @param props.carNum 当前记录番号（只读）。
 * @param props.names 演员文本框初始内容。
 * @param props.status 当前状态值（selected 判定）。
 * @param props.url 链接输入框 value。
 * @param props.remark 备注文本框初始内容。
 * @param props.inputStyle 输入框内联样式。
 * @param props.textareaStyle 文本框内联样式。
 * @param props.statusOptions 状态下拉选项列表。
 * @returns 编辑记录表单 React 元素（番号/演员/状态/链接/备注），经 jsxToString
 *          转 HTML 字符串后供 layer.open({ content }) 直接消费。
 */
export function EditRecordDialog({
    carNum,
    names,
    status,
    url,
    remark,
    inputStyle,
    textareaStyle,
    statusOptions
}: EditRecordDialogProps) {
    return (
        <div style={{ padding: '20px' }}>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>番号:</label>
                <input
                    type="text"
                    id="edit-carNum"
                    value={carNum}
                    style={{ ...inputStyle, backgroundColor: '#f0f0f0' }}
                    readOnly
                />
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>演员 (用空格隔开):</label>
                <textarea id="edit-names" style={textareaStyle}>
                    {names}
                </textarea>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>状态:</label>
                <select
                    id="edit-status"
                    style={{
                        width: '100%',
                        padding: '10px',
                        border: '1px solid #ddd'
                    }}
                >
                    <option value="" selected={status === ''}>
                        -- 请选择 --
                    </option>
                    {statusOptions.map((opt) => (
                        <option key={opt.value} value={opt.value} selected={status === opt.value}>
                            {opt.text}
                        </option>
                    ))}
                </select>
            </div>
            <div style={FIELD_ROW_STYLE}>
                <label style={LABEL_STYLE}>链接:</label>
                <input type="text" id="edit-url" value={url} style={inputStyle} />
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
