/**
 * BlacklistConfirmMessage —— 加入黑名单确认提示 HTML 字符串组件。
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
 * 原代码两个"非第一页"判定为两个独立 if（query 参数判定 + JavBus 分页段
 * 判定），两者皆成立时会追加两次相同 br 注意，属原脚本行为；组件以两个
 * 独立 prop（notFirstPageByQuery / notFirstPageByJavbus）各自决定是否追加，
 * 保持与原脚本零偏差。判定逻辑（currentHref/isJavbusSite 解析）仍由调用方
 * 完成后以布尔 prop 传入，组件保持纯模板（不引用站点常量）。
 *
 * 渲染方式：普通函数返回 HTML 字符串，供 addBlacklist 中
 * `utils.q(position, BlacklistConfirmMessage({...}), callback)` 消费。
 *
 * 统一规定（doc/06-component-html-string.md）：HTML→组件转换一律返回
 * HTML 字符串，不用 JSX、不用 renderToStaticMarkup。属性值不做转义，
 * 与原始模板拼接行为一致。
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
    /** currentHref 含 page 且非 page=1 时为 true（第一个独立 if 的判定结果）。 */
    notFirstPageByQuery: boolean;
    /** JavBus 站且分页段 >1 时为 true（第二个独立 if 的判定结果）。 */
    notFirstPageByJavbus: boolean;
}

/**
 * 渲染加入黑名单确认提示的 HTML 字符串。
 * @param props.isActress 是否演员分支（决定用 name 或 tagName）
 * @param props.isAlreadyBlacklisted 是否已在黑名单中
 * @param props.tagName 分类名（分类分支用）
 * @param props.name 演员名（演员分支用）
 * @param props.notFirstPageByQuery query 参数判定当前页非第一页
 * @param props.notFirstPageByJavbus JavBus 分页段判定当前页非第一页
 * @returns 确认提示 HTML（含 `<span>`/`<br/>`），供 utils.q 消费。
 */
export function BlacklistConfirmMessage({
    tagName,
    name,
    isAlreadyBlacklisted,
    isActress,
    notFirstPageByQuery,
    notFirstPageByJavbus,
}: BlacklistConfirmMessageProps): string {
    let message: string;
    if (isActress) {
        if (isAlreadyBlacklisted) {
            message = `演员 <span style="color: #f40">${name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
        } else {
            message = `是否将该演员 <span style="color: #f40">${name}</span> 加入到黑名单中?`;
        }
    } else {
        if (isAlreadyBlacklisted) {
            message = `分类 <span style="color: #f40">${tagName}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`;
        } else {
            message = `是否将分类 <span style="color: #f40">${tagName}</span> 加入到黑名单中?`;
        }
    }
    if (notFirstPageByQuery) {
        message +=
            "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
    }
    if (notFirstPageByJavbus) {
        message +=
            "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始";
    }
    return message;
}
