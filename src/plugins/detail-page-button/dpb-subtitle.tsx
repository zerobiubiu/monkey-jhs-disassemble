/**
 * 详情页字幕搜索与预览功能模块。
 * 从 detail-page-button-plugin.tsx 提取，逻辑与原实现一致。
 */
import { jsxToString } from '../../core/jsx-to-string';

import type { DetailPageButtonPlugin } from '../detail-page-button-plugin';

import { SubtitleActionCell } from '../../components/subtitle/subtitle-action-cell';
import { SubtitleLine } from '../../components/subtitle/subtitle-line';
import { SubtitlePreviewDialog } from '../../components/subtitle/subtitle-preview-dialog';
import { SubtitleTableDialog } from '../../components/subtitle/subtitle-table-dialog';

/**
 * 搜索迅雷字幕并以 Tabulator 表格展示。对应原 L6138-6266。
 * @param carNum 番号
 */
export function searchXunLeiSubtitle(plugin: DetailPageButtonPlugin, carNum: any): void {
    const loadingHandle = loading();
    gmHttp
        .get(`https://api-shoulei-ssl.xunlei.com/oracle/subtitle?gcid=&cid=&name=${carNum}`)
        .then((response: any) => {
            const subtitleList = response.data;
            if (subtitleList && subtitleList.length !== 0) {
                layer.open({
                    type: 1,
                    title: '迅雷字幕',
                    content: jsxToString(<SubtitleTableDialog />),
                    scrollbar: false,
                    area: utils.getResponsiveArea(['60%', '70%']),
                    anim: -1,
                    success: (_layero: any, index: any) => {
                        new Tabulator('#xunlei-table-container', {
                            layout: 'fitColumns',
                            placeholder: '暂无数据',
                            virtualDom: true,
                            data: subtitleList,
                            responsiveLayout: 'collapse',
                            responsiveLayoutCollapse: true,
                            columnDefaults: {
                                headerHozAlign: 'center',
                                hozAlign: 'center'
                            },
                            columns: [
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
                                    formatter: (
                                        cell: any,
                                        _formatterParams: any,
                                        onRendered: any
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
                                                    async (_event: any) => {
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
                                                    async (_event: any) => {
                                                        const subUrl = rowData.url;
                                                        const subFilename =
                                                            carNum + '.' + rowData.ext;
                                                        const content =
                                                            await gmHttp.get(subUrl);
                                                        utils.download(content, subFilename);
                                                    }
                                                );
                                            }
                                        });
                                        return jsxToString(<SubtitleActionCell />);
                                    }
                                }
                            ],
                            locale: 'zh-cn',
                            langs: {
                                'zh-cn': {
                                    pagination: {
                                        first: '首页',
                                        first_title: '首页',
                                        last: '尾页',
                                        last_title: '尾页',
                                        prev: '上一页',
                                        prev_title: '上一页',
                                        next: '下一页',
                                        next_title: '下一页',
                                        all: '所有',
                                        page_size: '每页行数'
                                    }
                                }
                            }
                        });
                        utils.setupEscClose(index);
                    }
                });
            } else {
                show.error('迅雷中找不到相关字幕!');
            }
        })
        .catch((err: any) => {
            clog.error(err);
            show.error('字幕搜索失败: ' + (err instanceof Error ? err.message : String(err)));
        })
        .finally(() => {
            loadingHandle.close();
        });
}

/**
 * 预览 ASS/SRT 字幕文件内容。对应原 L6397-6439。
 * @param url 字幕文件 URL
 * @param filename 字幕文件名
 */
export async function previewSubtitle(url: any, filename: any): Promise<void> {
    if (!url) {
        clog.error('未提供文件URL');
        return;
    }
    const ext = url.split('.').pop().toLowerCase();
    if (ext === 'ass' || ext === 'srt') {
        try {
            const subtitleContent = await gmHttp.get(url);
            let title = '字幕预览';
            if (ext === 'ass') {
                title = 'ASS字幕预览 - ' + filename;
            } else if (ext === 'srt') {
                title = 'SRT字幕预览 - ' + filename;
            }
            const lines = subtitleContent.split('\n');
            let output = '';
            const numWidth = String(lines.length).length;
            lines.forEach((line: any, idx: number) => {
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
                btn1: function (_index: any, _layero: any, _instance: any) {
                    utils.download(subtitleContent, filename);
                    return false;
                }
            });
        } catch (err: any) {
            show.error(`预览失败: ${err.message}`);
            clog.error('预览字幕文件出错:', err);
        }
    } else {
        show.error('仅支持预览ASS和SRT字幕文件');
    }
}
