/**
 * 磁链高亮过滤插件 HighlightMagnetPlugin —— 对应原脚本 archetype/jhs.user.js L3927-4015。
 *
 * 在影片详情页对磁链列表做“高画质优先”过滤：识别名称中含 4k/-c/-u/-uc（JavBus
 * 分支还识别第二链接“字幕”标记）的条目，标红 4k 行、为高画质行加 high-quality 类，
 * 并在存在高画质行时隐藏其余行；无高画质行时给过滤开关加 do-hide 类。
 *
 * 单字母局部变量（原 e/t/n/i/s/o/r/l/a）已语义化：
 *   nameEls / highQualityMarkers / hasHighQuality / nameEl / nameText / isHighQuality /
 *   rowEls / rowEl / firstCell / firstLink / secondLink / linkText。
 * 站点标志 r/l 改由 ../constants/site 引入（isJavdbSite / isJavbusSite）。
 * 运行时挂载到 window 的 isDetailPage，以此处 (window as any).isDetailPage 访问，
 * 保持原逻辑并满足 strict 类型检查。
 * $ / utils 已由 ../types/globals.d.ts 声明为 any；jQuery .each 回调按本仓库既有
 * 约定改写为 (_index, element) 箭头形式，规避 noImplicitThis。
 */
import { isJavdbSite, isJavbusSite } from "../constants/site";
import { BasePlugin } from "./base-plugin";

export class HighlightMagnetPlugin extends BasePlugin {
    /** 返回插件名，供 PluginManager 注册去重。对应原 L3928-3930。 */
    getName(): string {
        return "HighlightMagnetPlugin";
    }

    /**
     * 磁链过滤入口：依次执行 JavDb 与 JavBus 两条处理分支。
     * 对应原 L3931-3934。
     * 无参数，无返回值，不会抛出异常（各分支内部自行短路）。
     */
    doFilterMagnet(): void {
        this.handleDb();
        this.handleBus();
    }

    /**
     * JavDb 磁链高亮过滤：扫描 #magnets-content .name，标红 4k、标记高画质行，
     * 存在高画质行时隐藏其余，否则给过滤开关加 do-hide。
     * 对应原 L3935-3963。
     * 仅当 isJavdbSite 为真且存在 .name 元素时执行；无参数，无返回值。
     */
    handleDb(): void {
        if (!isJavdbSite) {
            return;
        }
        const nameEls = $("#magnets-content .name");
        if (nameEls.length === 0) {
            return;
        }
        const highQualityMarkers: string[] = ["4k", "-c", "-u", "-uc"];
        let hasHighQuality = false;
        nameEls.each((_index: number, element: any) => {
            const nameEl = $(element);
            const nameText: string = nameEl.text().toLowerCase();
            const isHighQuality: boolean = highQualityMarkers.some((marker) =>
                nameText.includes(marker),
            );
            nameEl.parent().parent().parent().addClass("magnet-row");
            if (nameText.includes("4k")) {
                nameEl.css("color", "#f40");
            }
            if (isHighQuality) {
                hasHighQuality = true;
                nameEl.parent().parent().parent().addClass("high-quality");
            }
        });
        if (hasHighQuality) {
            $("#magnets-content .magnet-row").not(".high-quality").hide();
        } else {
            $("#enable-magnets-filter").addClass("do-hide");
        }
    }

    /**
     * JavBus 磁链高亮过滤：等 #magnet-table 出现后扫描各行，标红 4k、标记高画质行
     * （含第二链接“字幕”标记），存在高画质行时隐藏其余，否则给过滤开关加 do-hide。
     * 对应原 L3964-4002。
     * 仅当 isJavbusSite 且 window.isDetailPage 为真时执行；通过 utils.loopDetector
     * 轮询表格出现后回调。无参数，无返回值。
     */
    handleBus(): void {
        if (isJavbusSite && (window as any).isDetailPage) {
            utils.loopDetector(
                () => $("#magnet-table td a").length > 0,
                () => {
                    const rowEls = $("#magnet-table tr");
                    const highQualityMarkers: string[] = [
                        "4k",
                        "-c",
                        "-u",
                        "-uc",
                    ];
                    let hasHighQuality = false;
                    rowEls.each((_index: number, element: any) => {
                        const rowEl = $(element);
                        const firstCell = rowEl.find("td:first-child");
                        const firstLink = firstCell.find("a:first-child");
                        const secondLink = firstCell.find("a:nth-child(2)");
                        const linkText: string = firstLink
                            .text()
                            .toLowerCase();
                        if (linkText.includes("4k")) {
                            firstLink.css("color", "#f40");
                        }
                        if (
                            highQualityMarkers.some((marker) =>
                                linkText.includes(marker),
                            ) ||
                            (secondLink.length &&
                                secondLink.text().includes("字幕"))
                        ) {
                            hasHighQuality = true;
                            rowEl.addClass("high-quality");
                        }
                    });
                    if (hasHighQuality) {
                        rowEls.each((_index: number, element: any) => {
                            const rowEl = $(element);
                            if (!rowEl.hasClass("high-quality")) {
                                rowEl.hide();
                            }
                        });
                    } else {
                        $("#enable-magnets-filter").addClass("do-hide");
                    }
                },
            );
        }
    }

    /**
     * 显示全部磁链行：撤销 handleDb/handleBus 的隐藏，按站点恢复 JavDb .item 与
     * JavBus tr 的显示。对应原 L4003-4014。
     * 无参数，无返回值，不会抛出异常。
     */
    showAll(): void {
        if (isJavdbSite) {
            $("#magnets-content .item")
                .toArray()
                .forEach((element: any) => $(element).show());
        }
        if (isJavbusSite) {
            $("#magnet-table tr")
                .toArray()
                .forEach((element: any) => $(element).show());
        }
    }
}
