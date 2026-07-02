/**
 * 详情页插件 DetailPagePlugin —— 对应原脚本 archetype/jhs.user.js L3332-3368。
 *
 * 在影片详情页为 `.video-meta-panel` 内的外链追加 `target="_blank"`，
 * 并绑定 fancybox 缩略图开关的点击持久化（localStorage）与默认值恢复逻辑。
 *
 * 单字母局部变量（原 e）已语义化：href / event / thumbsVisible / storedValue。
 * `window.isDetailPage` 为运行时由启动序列挂载到 window 的全局（非 src/constants 常量），
 * 此处以 `(window as any).isDetailPage` 访问，保持原逻辑并满足 strict 类型检查。
 * jQuery `.each` 回调按本仓库 base-plugin 既有约定改写为 (index, element) 箭头形式，
 * 规避 noImplicitThis；其余控制流与原脚本一致。
 */
import { BasePlugin } from "./base-plugin";

export class DetailPagePlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L3333-3335。 */
    getName(): string {
        return "DetailPagePlugin";
    }

    /** 构造函数：仅调用父类构造，保留原 L3336-3338 结构。 */
    constructor() {
        super();
    }

    /**
     * 详情页主处理：为元信息面板内外链追加新标签打开，并初始化 fancybox 缩略图开关。
     * 对应原 L3339-3354。
     *
     * 仅当运行时 `window.isDetailPage` 为真时执行；与父类声明一致为 async，
     * 体内无 await，调用方（PluginManager）已 `await plugin.handle()`，行为与原同步实现等价。
     * 无参数，返回 Promise<void>，不会抛出异常。
     */
    async handle(): Promise<void> {
        if ((window as any).isDetailPage) {
            $(".video-meta-panel a").each((_index: number, element: any) => {
                const href: string | undefined = $(element).attr("href");
                if (
                    href &&
                    (href.startsWith("http://") ||
                        href.startsWith("https://") ||
                        href.startsWith("/"))
                ) {
                    $(element).attr("target", "_blank");
                }
            });
            this.handleFancyBox();
        }
    }

    /**
     * 绑定 fancybox 缩略图按钮点击持久化，并按 localStorage 恢复默认开关。
     * 对应原 L3355-3367。
     *
     * 点击 `.fancybox-button--thumbs` 时，将当前缩略图可见性写入 localStorage
     * 并同步到 `unsafeWindow.$.fancybox.defaults.thumbs.autoStart`；
     * 初始化时若 fancybox 已加载，则从 localStorage 读取并恢复默认值。
     * 无参数，无返回值，不会抛出异常。
     */
    handleFancyBox(): void {
        document.addEventListener("click", (event) => {
            if ((event.target as Element).closest(".fancybox-button--thumbs")) {
                const thumbsVisible: boolean =
                    !$(".fancybox-thumbs").is(":hidden");
                localStorage.setItem(
                    "jhs_fancyboxThumbs",
                    thumbsVisible.toString(),
                );
                unsafeWindow.$.fancybox.defaults.thumbs.autoStart =
                    thumbsVisible;
            }
        });
        if (unsafeWindow.$.fancybox !== undefined) {
            const storedValue: string | null =
                localStorage.getItem("jhs_fancyboxThumbs");
            unsafeWindow.$.fancybox.defaults.thumbs.autoStart =
                storedValue === "true";
        }
    }
}
