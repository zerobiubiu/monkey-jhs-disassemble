/**
 * 详情页字幕搜索与预览功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { jsxToString } from '../../core/jsx-to-string';
import { createTabulatorOptions } from '../../core/util/tabulator-factory';
import { withLoading } from '../../core/util/util-async';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import { SubtitleActionCell } from '../../components/subtitle/subtitle-action-cell';
import { SubtitleLine } from '../../components/subtitle/subtitle-line';
import { SubtitlePreviewDialog } from '../../components/subtitle/subtitle-preview-dialog';
import { SubtitleTableDialog } from '../../components/subtitle/subtitle-table-dialog';

/**
 * 搜索迅雷字幕并以 Tabulator 表格展示。对应原 L6138-6266。
 * @param carNum 番号
 */
export async function searchXunLeiSubtitle(plugin: DetailPageButtonPlugin, carNum: string): Promise<void> {
    try {
        await withLoading(async () => {
            const response = await gmHttp.get(
                `https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${carNum}`
            );
            const resp = response as { data: unknown[] };
            const subtitleList = resp.data;
            if (subtitleList && subtitleList.length !== 0) {
                layer.open({
                    type: 1,
                    title: '迅雷字幕',
                    content: jsxToString(<SubtitleTableDialog />),
                    scrollbar: false,
                    area: utils.getResponsiveArea(['60%', '70%']),
                    anim: -1,
                    success: (_layero: unknown, index: number) => {
                        new Tabulator(
                            '#xunlei-table-container',
                            createTabulatorOptions(
                                [
                                    {
                                        title: '文件名',
                                        field: 'name',
                                        headerSort: false,
                                        responsive: 0
                                    },
                                    {
                                        title: '类型',
                                        field: 'ext',
                                        headerSort: false,
                                        responsive: 0
                                    },
                                    {
                                        title: '操作',
                                        responsive: 0,
                                        headerSort: false,
                                        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
                                        formatter: (
                                            cell: any,
                                            _formatterParams: unknown,
                                            onRendered: (callback: () => void) => void
                                        ) => {
                                            const rowData = cell.getData();
                                            onRendered(() => {
                                                const previewBtn = cell
                                                    .getElement()
                                                    .querySelector('.a-primary');
                                                const downloadBtn = cell
                                                    .getElement()
                                                    .querySelector('.a-success');
                                                if (previewBtn) {
                                                    previewBtn.addEventListener(
                                                        'click',
                                                        async (_event: unknown) => {
                                                            const subUrl = rowData.url;
                                                            const subFilename =
                                                                carNum + '.' + rowData.ext;
                                                            plugin.previewSubtitle(
                                                                subUrl,
                                                                subFilename
                                                            );
                                                        }
                                                    );
                                                }
                                                if (downloadBtn) {
                                                    downloadBtn.addEventListener(
                                                        'click',
                                                        async (_event: unknown) => {
                                                            const subUrl = rowData.url;
                                                            const subFilename =
                                                                carNum + '.' + rowData.ext;
                                                            const content =
                                                                await gmHttp.get(subUrl);
                                                            utils.download(content as BlobPart, subFilename);
                                                        }
                                                    );
                                                }
                                            });
                                            return jsxToString(<SubtitleActionCell />);
                                        }
                                    }
                                ],
                                subtitleList
                            )
                        );
                        utils.setupEscClose(index);
                    }
                });
            } else {
                show.error('迅雷中找不到相关字幕!');
            }
        });
    } catch (err: unknown) {
        clog.error(err);
        show.error('字幕搜索失败: ' + (err instanceof Error ? err.message : String(err)));
    }
}

/**
 * 预览 ASS/SRT 字幕文件内容。对应原 L6397-6439。
 * @param url 字幕文件 URL
 * @param filename 字幕文件名
 */
export async function previewSubtitle(url: string, filename: string): Promise<void> {
    if (!url) {
        clog.error('未提供文件URL');
        return;
    }
    const ext = url.split('.').pop()!.toLowerCase();
    if (ext === 'ass' || ext === 'srt') {
        try {
            const subtitleContent = await gmHttp.get(url);
            let title = '字幕预览';
            if (ext === 'ass') {
                title = 'ASS字幕预览 - ' + filename;
            } else if (ext === 'srt') {
                title = 'SRT字幕预览 - ' + filename;
            }
            const lines = (subtitleContent as string).split('\n');
            let output = '';
            const numWidth = String(lines.length).length;
            lines.forEach((line: string, idx: number) => {
                const paddedNum = String(idx + 1).padStart(numWidth, ' ');
                output += jsxToString(<SubtitleLine paddedNum={paddedNum} line={line} />);
            });
            const htmlContent = output;
            layer.open({
                type: 1,
                title: title,
                area: ['80%', '80%'],
                scrollbar: false,
                content: jsxToString(<SubtitlePreviewDialog content={htmlContent} />),
                btn: ['下载', '关闭'],
                btn1: function (_index: number, _layero: unknown, _instance: unknown) {
                    utils.download(subtitleContent as BlobPart, filename);
                    return false;
                }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- layer.open 选项类型不兼容
            } as any);
        } catch (err: unknown) {
            show.error(`预览失败: ${err instanceof Error ? err.message : String(err)}`);
            clog.error('预览字幕文件出错:', err);
        }
    } else {
        show.error('仅支持预览ASS和SRT字幕文件');
    }
}
