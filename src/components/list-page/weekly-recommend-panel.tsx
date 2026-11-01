/** 首页推荐入口与非模态浮层；推荐内容由控制器移动原生节点填入。 */
export function WeeklyRecommendPanel() {
    return (
        <>
            <button type="button" className="jhs-lp-batch-side-btn jhs-weekly-recommend-toggle jhs-weekly-recommend-entry"
                aria-controls="jhs-weekly-recommend-panel" aria-expanded="false" aria-haspopup="dialog">
                每周推荐
            </button>
            <div id="jhs-weekly-recommend-panel" className="jhs-weekly-recommend-panel"
                role="dialog" aria-modal="false" aria-labelledby="jhs-weekly-recommend-title" hidden>
                <header className="jhs-weekly-recommend-header">
                    <div id="jhs-weekly-recommend-title" />
                    <button type="button" className="button jhs-weekly-recommend-close"
                        aria-label="关闭每周推荐">关闭</button>
                </header>
                <div className="jhs-weekly-recommend-content jhs-scrollbar">
                    <div className="jhs-weekly-recommend-filters" />
                </div>
            </div>
        </>
    );
}
