/**
 * MagnetHubTab —— 磁链聚合引擎标签（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/magnet-hub-plugin.tsx 的 createMagnetHub（原
 * `` $(`<div class="magnet-tab" data-engine="${engine.id}">${engine.name}</div>`) ``
 * 模板字符串）：单个引擎切换标签，data-engine 携带引擎 id 供点击事件
 * 委托读取（`$(e.target).data('engine')`）。
 *
 * 保留原类名/属性原样不动。`data-engine` 经 escapeAttr 转义 `&<>"`，
 * 引擎 id（u9a9/u3c3/Sukebei）均不含特殊字符，输出与原模板一致；
 * 标签名文本经 escapeText 转义（原模板直插，引擎名均安全，渲染等价）。
 * active 态仍由调用方在返回的 jQuery 对象上 `.addClass('active')`。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 createMagnetHub 中 `$()`
 * 消费时，需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串：
 *   `const $tab = $(jsxToString(<MagnetHubTab engineId={engine.id} engineName={engine.name} />))`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。
 */

/** MagnetHubTab 的属性。 */
export interface MagnetHubTabProps {
    /** 引擎 id（原 engine.id，写入 data-engine 供点击事件识别引擎）。 */
    engineId: string;
    /** 引擎显示名（原 engine.name，作为标签文本）。 */
    engineName: string;
}

/**
 * 渲染单个引擎标签的 JSX。
 * @param props.engineId 引擎 id
 * @param props.engineName 引擎显示名
 * @returns 标签 JSX，经 jsxToString 转 HTML 字符串后供 `$()` 创建后 `.append()` 消费。
 */
export function MagnetHubTab({ engineId, engineName }: MagnetHubTabProps) {
    return (
        <div className="magnet-tab" data-engine={engineId}>
            {engineName}
        </div>
    );
}
