/**
 * BlacklistConfirmMessage —— 加入黑名单确认提示 React 函数组件（JSX）。
 *
 * 提取自 src/plugins/blacklist-plugin.ts 的 addBlacklist（L96-134，
 * 原 archetype/jhs.user.js L7336-7362 的 confirmMessage 拼接）：
 *   - 分类分支（currentHref.includes("/tags")）：以 tagName 渲染
 *     "是否将分类 <span ...>tagName</span> 加入到黑名单中?"，或
 *     "分类 <span ...>tagName</span> 已在黑名单中, 是否从当前页开始追加屏蔽?"
 *   - 演员分支：以 name 渲染
 *     "是否将该演员 <span ...>name</span> 加入到黑名单中?"，或
 *     "演员 <span ...>name</span> 已在黑名单中, 是否从当前页开始追加屏蔽?"
 *   - 当前页非第一页时追加
 *     "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始"。
 *
 * 保留原 HTML 结构、`<span style="color: #f40">` 内联色、`<br/>` 自闭合、
 * 文案与标点（含全角问号/逗号）原样不动。
 *
 * 当前页非第一页的判定（currentHref query 参数解析）由调用方完成后以
 * 布尔 prop 传入，组件保持纯模板（不引用站点常量）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 addBlacklist 中
 * `utils.q(position, ..., callback)` 消费时，需先用 `jsxToString` 转为
 * HTML 字符串：
 *   `utils.q(position, jsxToString(<BlacklistConfirmMessage {...} />), callback)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，
 * 经轻量 `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时
 * 依赖，不引入 react-dom/server）。属性值不做转义，与原始模板拼接行为一致。
 */

/** BlacklistConfirmMessage 的属性。 */
export interface BlacklistConfirmMessageProps {
    /** 分类名（分类分支用；演员分支不使用，可省略）。 */
    tagName?: string;
    /** 演员名（演员分支用；分类分支不使用，可省略）。 */
    name?: string;
    /** 是否已在黑名单中（决定"加入到黑名单中"或"已加入...追加屏蔽"文案）。 */
    isAlreadyBlacklisted: boolean;
    /** 是否演员分支（true=演员用 name，false=分类用 tagName）。 */
    isActress: boolean;
    /** currentHref 含 page 且非 page=1 时为 true（独立 if 的判定结果）。 */
    notFirstPageByQuery: boolean;
}

/**
 * 渲染加入黑名单确认提示的 JSX。
 * @param props.isActress 是否演员分支（决定用 name 或 tagName）
 * @param props.isAlreadyBlacklisted 是否已在黑名单中
 * @param props.tagName 分类名（分类分支用）
 * @param props.name 演员名（演员分支用）
 * @param props.notFirstPageByQuery query 参数判定当前页非第一页
 * @returns 确认提示 JSX（含 `<span>`/`<br/>`），经 jsxToString 转 HTML 字符串后供 utils.q 消费。
 */
export function BlacklistConfirmMessage({
    tagName,
    name,
    isAlreadyBlacklisted,
    isActress,
    notFirstPageByQuery
}: BlacklistConfirmMessageProps) {
    const entityName = isActress ? name : tagName;
    const prefix = isAlreadyBlacklisted
        ? isActress
            ? '演员 '
            : '分类 '
        : isActress
          ? '是否将该演员 '
          : '是否将分类 ';
    const suffix = isAlreadyBlacklisted
        ? ' 已在黑名单中, 是否从当前页开始追加屏蔽?'
        : ' 加入到黑名单中?';
    return (
        <>
            {prefix}
            <span style={{ color: '#f40' }}>{entityName}</span>
            {suffix}
            {notFirstPageByQuery && (
                <>
                    <br />
                    {' 注意: 当前页面非第一页, 屏蔽数据将从此页面开始'}
                </>
            )}
        </>
    );
}
