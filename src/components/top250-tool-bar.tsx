/**
 * Top250ToolBar —— Top250 榜单分类/年份/中字切换工具栏（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/top250-plugin.ts 的 toolBar（L241-246）：原模板拼接
 * `<div class="button-group">` 内含两组 conditionBox：分类按钮（全部/有码/无码/
 * 欧美/Fc2 + 含中字磁链/无字幕/重置）与年份按钮（当前年→2008），由
 * `this.contentBox.append(html)` 消费。年份按钮由调用方循环调用
 * Top250YearButton 拼接后以 yearButtonsHtml prop 注入。
 *
 * 保留原 HTML 结构、类名（buttons has-addons）、内联 style（padding:18px 18px
 * !important 写值里、margin-bottom:0!important 写值里、margin-left:50px）、
 * href（含 & 用表达式保留，避免 JSX 实体解码）、data-cnsub-value 原样不动；
 * handleType / typeValue / hasCnsub / yearButtonsHtml 通过 prop 注入。
 * yearButtonsHtml 为预拼接 HTML 字符串，经 dangerouslySetInnerHTML 注入
 * （jsxToString 支持，原样输出 __html）。两个 conditionBox 的重复 id 保留原样。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 toolBar 中
 * `this.contentBox.append()` 消费时，需先用 `jsxToString`（来自
 * ../core/jsx-to-string，轻量 JSX→HTML 字符串渲染器，不引入
 * react-dom/server）转为 HTML 字符串：
 *   `this.contentBox.append(jsxToString(<Top250ToolBar {...props} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */

/** Top250ToolBar 的属性。 */
export interface Top250ToolBarProps {
    /** 当前分类类型（"all"/"video_type"/"year"）。 */
    handleType: string;
    /** 当前分类值（"0".."3" 或年份字符串）。 */
    typeValue: string;
    /** 中字过滤值（"1"含中字/"0"无字幕/""重置）。 */
    hasCnsub: string;
    /** 预拼接的年份按钮 HTML（由调用方循环 Top250YearButton 生成）。 */
    yearButtonsHtml: string;
}

/**
 * 渲染 Top250 分类/年份/中字切换工具栏的 JSX。
 * @returns button-group JSX，经 jsxToString 转 HTML 字符串后供 `.append()` 消费。
 */
export function Top250ToolBar({
    handleType,
    typeValue,
    hasCnsub,
    yearButtonsHtml
}: Top250ToolBarProps) {
    return (
        <div className="button-group">
            <div
                className="buttons has-addons"
                id="conditionBox"
                style={{ marginBottom: '0!important' }}
            >
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${handleType === 'all' ? 'is-info' : ''}`}
                    href={`/advanced_search?handleTop=1&handleType=all&type_value=&has_cnsub=${hasCnsub}`}
                >
                    全部
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${typeValue === '0' ? 'is-info' : ''}`}
                    href={`/advanced_search?handleTop=1&handleType=video_type&type_value=0&has_cnsub=${hasCnsub}`}
                >
                    有码
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${typeValue === '1' ? 'is-info' : ''}`}
                    href={`/advanced_search?handleTop=1&handleType=video_type&type_value=1&has_cnsub=${hasCnsub}`}
                >
                    无码
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${typeValue === '2' ? 'is-info' : ''}`}
                    href={`/advanced_search?handleTop=1&handleType=video_type&type_value=2&has_cnsub=${hasCnsub}`}
                >
                    欧美
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${typeValue === '3' ? 'is-info' : ''}`}
                    href={`/advanced_search?handleTop=1&handleType=video_type&type_value=3&has_cnsub=${hasCnsub}`}
                >
                    Fc2
                </a>{' '}
                <a
                    style={{
                        padding: '18px 18px !important',
                        marginLeft: '50px'
                    }}
                    className={`button is-small ${hasCnsub === '1' ? 'is-info' : ''}`}
                    data-cnsub-value="1"
                >
                    含中字磁鏈
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className={`button is-small ${hasCnsub === '0' ? 'is-info' : ''}`}
                    data-cnsub-value="0"
                >
                    无字幕
                </a>{' '}
                <a
                    style={{ padding: '18px 18px !important' }}
                    className="button is-small"
                    data-cnsub-value=""
                >
                    重置
                </a>
            </div>
            <div
                className="buttons has-addons"
                id="conditionBox"
                dangerouslySetInnerHTML={{ __html: yearButtonsHtml }}
            />
        </div>
    );
}
