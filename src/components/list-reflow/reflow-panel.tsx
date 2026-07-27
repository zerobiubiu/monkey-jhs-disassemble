/**
 * ReflowPanel —— 清单页「编号清单整理」面板外壳（React 函数组件，JSX）。
 *
 * 仅产出稳定外壳与 data-reflow-* 挂载点；识别按钮、成员行、计划预览、执行按钮等
 * 动态内容由 lr-panel.ts / lr-plan.ts / lr-execute.ts 命令式写入（与 dpb 清单面板模式一致）。
 * 视觉样式由 list-reflow.css 提供。
 *
 * 期1 只读预览；期2a 增「执行整理/中止」写入入口；
 * 期2b 增「续传/撤销」韧性入口；期2c 增进度条 + 汇总报告区。
 */

/**
 * 渲染编号清单整理面板外壳。
 * @returns 面板 JSX，经 jsxToString 转 HTML 字符串后注入清单页。
 */
export function ReflowPanel() {
    return (
        <div className="jhs-reflow-panel">
            <div className="jhs-reflow-panel__header">
                <span className="jhs-reflow-panel__title">🗂️ 编号清单整理</span>
                <span className="jhs-reflow-panel__status" data-reflow-status>
                    待识别
                </span>
            </div>
            <div className="jhs-reflow-panel__lists" data-reflow-lists hidden></div>
            <div className="jhs-reflow-panel__plan" data-reflow-plan hidden></div>
            {/* 期2c：进度条 */}
            <div className="jhs-reflow-panel__progress" data-reflow-progress hidden>
                <div className="jhs-reflow-panel__progress-bar">
                    <div className="jhs-reflow-panel__progress-fill" data-reflow-progress-fill />
                </div>
                <span className="jhs-reflow-panel__progress-text" data-reflow-progress-text />
            </div>
            <div className="jhs-reflow-panel__actions">
                <button type="button" className="jhs-reflow-panel__identify" data-reflow-identify>
                    识别编号组
                </button>
                <button
                    type="button"
                    className="jhs-reflow-panel__plan-btn"
                    data-reflow-plan-btn
                    hidden
                >
                    生成整理计划
                </button>
                <button
                    type="button"
                    className="jhs-reflow-panel__exec-btn"
                    data-reflow-exec-btn
                    hidden
                >
                    执行整理
                </button>
                <button
                    type="button"
                    className="jhs-reflow-panel__abort-btn"
                    data-reflow-abort-btn
                    hidden
                >
                    中止
                </button>
                {/* 期2b：续传按钮 */}
                <button
                    type="button"
                    className="jhs-reflow-panel__resume-btn"
                    data-reflow-resume-btn
                    hidden
                >
                    继续上次整理
                </button>
                {/* 期2b：撤销按钮 */}
                <button
                    type="button"
                    className="jhs-reflow-panel__undo-btn"
                    data-reflow-undo-btn
                    hidden
                >
                    撤销本次整理
                </button>
            </div>
            {/* 期2c：汇总报告区 */}
            <div className="jhs-reflow-panel__report" data-reflow-report hidden></div>
        </div>
    );
}
