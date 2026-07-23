/**
 * 新作品检测插件 NewVideoPlugin —— 对应原脚本 archetype/jhs.user.js L11035-11465。
 *
 * 弹出"新作品检测"对话框，按女优类型（全部/无码/有码/未知）过滤收藏女优列表，
 * 以卡片网格展示（头像、名称、别名、上次检测/最后发行时间、停更提示、备注、
 * 最新作品数量角标、无码/有码彩带），支持分页、编辑女优信息、取消收藏，
 * 以及通过 Gfriends 仓库搜索/选择头像、切换头像 CDN 源。
 *
 * 已提取模块：
 *   - new-video/actress-card-renderer.tsx：renderActressCards + renderPagination + FavoriteActressRecord
 *   - new-video/avatar-search.tsx：searchAvatar
 *   - new-video/edit-actress.tsx：editActress
 *
 * 站点类别常量 A/D 改由 ../constants/site 引入（UNCENSORED / CENSORED）；
 * Gfriends CDN 源清单与键名改由 ../resources/gfriends 引入；
 * Gfriends 运行时能力改由 ../core/gfriends 正式导入。
 * $ / layer / utils / storageManager / show / clog / gmHttp / loading 已由
 * ../types/globals.d.ts 声明。
 */
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';
import { renderActressCards, renderPagination } from './new-video/actress-card-renderer';
import type { FavoriteActressRecord } from './new-video/actress-card-renderer';
import { searchAvatar } from './new-video/avatar-search';
import { editActress as editActressDialog } from './new-video/edit-actress';

import { NewVideoDialog } from '../components/dialogs/new-video-dialog';
import { NewVideoDialogTitle } from '../components/misc/new-video-dialog-title';

import newVideoCssRaw from '../styles/new-video-plugin.css?raw';

/** 收藏女优记录结构（re-export 供外部模块引用）。 */
export type { FavoriteActressRecord } from './new-video/actress-card-renderer';

export class NewVideoPlugin extends BasePlugin {
    /** 当前分页页码（从 1 开始） */
    currentPage: number = 1;
    /** 每页卡片数 */
    pageSize: number = 30;

    /** 返回插件名，供 PluginManager 注册去重。对应原 L11041-11043。 */
    getName(): string {
        return 'NewVideoPlugin';
    }

    /**
     * 注入卡片网格 / 分页 / 按钮等内联样式（原 L11044-11046 的 <style>）。
     */
    async initCss(): Promise<string> {
        return newVideoCssRaw;
    }

    /**
     * 主处理入口：刷新新作品计数。对应原 L11047-11049。
     */
    async handle(): Promise<void> {
        await this.showNewVideoCount();
    }

    /**
     * 统计收藏女优的新作品总数并写入 #newVideoCount。
     * 对应原 L11050-11062。
     */
    async showNewVideoCount(): Promise<void> {
        const totalCount: number = ((await storageManager.getFavoriteActressList()) as FavoriteActressRecord[]).reduce(
            (total: number, actress: FavoriteActressRecord) => {
                return total + (actress.newVideoList?.length ?? 0);
            },
            0
        );
        $('#newVideoCount').text(`${totalCount}`);
    }

    /**
     * 重置按钮提示（占位实现，暂无逻辑）。对应原 L11063。
     */
    async resetBtnTip(): Promise<void> {}

    /**
     * 打开"新作品检测"对话框并初始化数据加载与事件绑定。
     * 对应原 L11064-11079。
     */
    async openDialog(): Promise<void> {
        const dialogContent: string = jsxToString(<NewVideoDialog refreshSvg={this.refreshSvg} />);
        layer.open({
            type: 1,
            title: jsxToString(<NewVideoDialogTitle />),
            content: dialogContent,
            scrollbar: false,
            area: utils.getResponsiveArea(['80%', '90%']),
            anim: -1,
            success: async (_layerEl: HTMLElement, layerIndex: number) => {
                this.loadData();
                this.bindClick();
                utils.setupEscClose(layerIndex);
            }
        });
    }

    /**
     * 绑定刷新按钮与类型筛选下拉的交互。对应原 L11080-11088。
     */
    bindClick(): void {
        $('#reLoad').on('click', (_event: Event) => {
            this.loadData();
            $('#checkNewVideoMsg').text('');
        });
        $('#paramActressType').on('change', (_event: Event) => {
            this.loadData();
        });
    }

    /**
     * 重置页码并重新渲染卡片。对应原 L11089-11092。
     */
    loadData(): void {
        this.currentPage = 1;
        this.renderActressCards().then();
    }

    /**
     * 渲染收藏女优卡片网格。委托 new-video/actress-card-renderer.tsx。
     * 对应原 L11093-11195。
     */
    async renderActressCards(): Promise<void> {
        await renderActressCards(this);
    }

    /**
     * 打开编辑女优弹窗。委托 new-video/edit-actress.tsx。
     * 对应原 L11196-11321。
     * @param actress 待编辑的收藏女优记录。
     */
    async editActress(actress: FavoriteActressRecord): Promise<void> {
        await editActressDialog(this, actress);
    }

    /**
     * 渲染分页条。委托 new-video/actress-card-renderer.tsx。
     * 对应原 L11322-11366。
     */
    renderPagination(totalCount: number, totalPages: number): void {
        renderPagination(this, totalCount, totalPages);
    }

    /**
     * 调用 Gfriends 仓库按女优名称搜索头像。委托 new-video/avatar-search.tsx。
     * 对应原 L11367-11464。
     */
    async searchAvatar(): Promise<void> {
        await searchAvatar();
    }
}
