/**
 * RatingBar —— 详情页星星评分组件 React 组件（示范，孤立可用，不被 main.tsx 引入）。
 *
 * 提取自 src/plugins/detail-page-button-plugin.ts：
 *   - _buildRatingBar 的 bar.innerHTML（L595-609）—— 纯结构，无内联样式
 *   - _syncRatingBar 的状态类映射（L825-875）：is-active/is-disabled/is-busy/is-preview
 *   - _setRatingBusy 的 .is-busy 切换（L881-884）
 *
 * 保留原 HTML 结构与 CSS 类名（jhs-rating-bar / jhs-stars / jhs-star /
 * jhs-rating-actions / jhs-fav-btn / jhs-read-btn）与 data-score 属性。
 * 原模板不含内联样式，视觉样式由插件 _injectRatingStyles 注入的 CSS 契约提供
 * （.jhs-rating-bar 等），本组件仅产出 DOM/类名契约，忠实于原 innerHTML。
 *
 * 交互复现：hover 预览（is-preview）以内部状态实现；点击星星/已读/收藏触发回调，
 * 并以内部状态等价复现原 setTimeout 加 is-popping 触发 jhs-star-pop 动画的逻辑。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。
 * 如需供 jQuery 字符串消费，可用
 *   `renderToStaticMarkup(<RatingBar {...props} />)`（来自 react-dom/server）。
 */
import { useState } from "react";
import type { PointerEvent } from "react";

/** 评分状态判别联合：want（想看）/ watched（已观看 N 星）/ none（未评价）。 */
export type RatingState =
    | { kind: "want" }
    | { kind: "watched"; score: number }
    | { kind: "none" };

export interface RatingBarProps {
    /** 当前评价状态，决定星星/按钮高亮。 */
    state: RatingState;
    /** 操作进行中（对应 .jhs-rating-bar.is-busy，禁用交互）。 */
    busy?: boolean;
    /** 点击第 N 星（1-5）→ 已观看 + N 星。 */
    onStarClick?: (score: number) => void;
    /** 点击「已读」→ 已观看 + 0 星。 */
    onReadClick?: () => void;
    /** 点击「收藏」→ 想看。 */
    onFavClick?: () => void;
}

/** 正在播放 pop 动画的元素标识（对应 is-popping）。 */
type Popping =
    | { kind: "star"; score: number }
    | { kind: "read" }
    | { kind: "fav" }
    | null;

const FAV_TITLE = "设为想看（收藏）";
const READ_TITLE = "设为已观看（0星）";
const POP_DURATION_MS = 300;

/** 拼接 className，过滤 false/undefined/空串。 */
function cx(...parts: Array<string | false | undefined>): string {
    return parts.filter(Boolean).join(" ");
}

/**
 * 渲染星星评分组件。状态映射（对应 _syncRatingBar）：
 * - want：星星禁用全灰（.jhs-stars.is-disabled），收藏高亮（.jhs-fav-btn.is-active）
 * - watched：前 N 星高亮（.jhs-star.is-active），score===0 时已读高亮（.jhs-read-btn.is-active）
 * - none：全部不高亮
 * hover 时按指针所在星数临时高亮（.jhs-star.is-preview）。
 */
export function RatingBar({
    state,
    busy = false,
    onStarClick,
    onReadClick,
    onFavClick,
}: RatingBarProps) {
    const [preview, setPreview] = useState<number | null>(null);
    const [popping, setPopping] = useState<Popping>(null);

    const watchedScore = state.kind === "watched" ? state.score : 0;
    const activeScore = preview ?? watchedScore;
    const starsDisabled = state.kind === "want";
    const readActive = state.kind === "watched" && state.score === 0;
    const favActive = state.kind === "want";

    /** 设置某元素 is-popping，POP_DURATION_MS 后清除（复现原 setTimeout 逻辑）。 */
    const triggerPopping = (p: Popping): void => {
        setPopping(p);
        window.setTimeout(() => setPopping(null), POP_DURATION_MS);
    };

    /** pointerover 事件委托：定位到具体 .jhs-star 并按其 data-score 预览。 */
    const handleStarsPointerOver = (e: PointerEvent<HTMLDivElement>): void => {
        const target = (e.target as HTMLElement).closest(
            ".jhs-star",
        ) as HTMLElement | null;
        if (!target) return;
        setPreview(Number(target.dataset.score));
    };

    return (
        <div className={cx("jhs-rating-bar", busy && "is-busy")}>
            <div
                className={cx("jhs-stars", starsDisabled && "is-disabled")}
                data-score={0}
                onPointerOver={handleStarsPointerOver}
                onPointerLeave={() => setPreview(null)}
            >
                {[1, 2, 3, 4, 5].map((n) => (
                    <span
                        key={n}
                        data-score={n}
                        className={cx(
                            "jhs-star",
                            n <= activeScore && "is-active",
                            preview !== null && n <= preview && "is-preview",
                            popping?.kind === "star" &&
                                popping.score === n &&
                                "is-popping",
                        )}
                        onClick={(e) => {
                            e.preventDefault();
                            triggerPopping({ kind: "star", score: n });
                            onStarClick?.(n);
                        }}
                    >
                        ★
                    </span>
                ))}
            </div>
            <div className="jhs-rating-actions">
                <button
                    type="button"
                    className={cx(
                        "jhs-fav-btn",
                        favActive && "is-active",
                        popping?.kind === "fav" && "is-popping",
                    )}
                    title={FAV_TITLE}
                    onClick={(e) => {
                        e.preventDefault();
                        triggerPopping({ kind: "fav" });
                        onFavClick?.();
                    }}
                >
                    ♥ 收藏
                </button>
                <button
                    type="button"
                    className={cx(
                        "jhs-read-btn",
                        readActive && "is-active",
                        popping?.kind === "read" && "is-popping",
                    )}
                    title={READ_TITLE}
                    onClick={(e) => {
                        e.preventDefault();
                        triggerPopping({ kind: "read" });
                        onReadClick?.();
                    }}
                >
                    已读
                </button>
            </div>
        </div>
    );
}
