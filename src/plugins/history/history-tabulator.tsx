/**
 * 鉴定记录 Tabulator 表格配置（提取自 history-plugin.tsx 的 loadTableData）。
 *
 * 含列定义 + 各列 formatter + paginationCounter + 远程分页 ajaxRequestFunc。
 * 基础配置（layout / placeholder / virtualDom / responsiveLayout / columnDefaults /
 * locale + zh-cn 语言包）由 createTabulatorOptions 统一提供，中文语言包来自
 * TABULATOR_ZH_CN，消除原内联 locale 对象重复。
 *
 * 来源/状态列 formatter 原用 HistorySourceCell / HistoryStatusCell（二者字节级相同），
 * 合并 A2 后统一改用共享组件 ColoredTextCell（text/color 属性一致）。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 HistoryPlugin（运行期擦除）。
 */
import {
    BLOCK_COLOR,
    BLOCK_TEXT,
    FAVORITE_COLOR,
    FAVORITE_TEXT,
    WATCHED_COLOR,
    WATCHED_TEXT
} from '../../constants/status';

import { jsxToString } from '../../core/jsx-to-string';
import { createTabulatorOptions } from '../../core/util/tabulator-factory';

import type { HistoryPlugin } from '../history-plugin';

import { HistoryActionButtons } from '../../components/history/history-action-buttons';
import { TableLinkParam } from '../../components/misc/table-link-param';
import { ColoredTextCell } from '../../components/shared/colored-text-cell';

/**
 * 构建鉴定记录 Tabulator 配置对象（远程分页/排序 + 列定义 + 行选择）。
 * 对应原 L6753-6975 的内联配置；locale/langs 改由 createTabulatorOptions 注入。
 *
 * @param plugin HistoryPlugin 实例（ajaxRequestFunc 回调 getDataList，操作列回调 editRecord）
 * @returns Tabulator 配置对象（传给 `new Tabulator('#table-container', ...)`）
 */
export function buildHistoryTableOptions(plugin: HistoryPlugin): Record<string, unknown> {
    const columns = [
        {
            formatter: 'rowSelection',
            titleFormatter: 'rowSelection',
            hozAlign: 'center',
            headerSort: false,
            responsive: 0,
            width: 40,
            titleFormatterParams: {
                rowRange: 'active'
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            cellClick: (_event: unknown, cell: any) => {
                cell.getRow().toggleSelect();
            }
        },
        {
            title: '番号',
            field: 'carNum',
            width: 120,
            sorter: 'string',
            responsive: 0,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const carNum = cell.getData().carNum;
                const dashIndex = carNum.indexOf('-');
                if (dashIndex === -1) {
                    return carNum;
                }
                return (
                    jsxToString(<TableLinkParam text={carNum.substring(0, dashIndex + 1)} />) +
                    carNum.substring(dashIndex + 1)
                );
            }
        },
        {
            title: '演员',
            field: 'names',
            minWidth: 200,
            sorter: 'string',
            responsive: 5,
            headerSort: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) =>
                (cell.getData().names || '')
                    .split(' ')
                    .filter((part: string) => part.trim() !== '')
                    .map((part: string) => jsxToString(<TableLinkParam text={part} />))
                    .join(' ')
        },
        {
            title: '创建时间',
            field: 'createDate',
            width: 170,
            sorter: 'string',
            responsive: 4
        },
        {
            title: '修改时间',
            field: 'updateDate',
            width: 170,
            sorter: 'string',
            responsive: 4
        },
        {
            title: '发行时间',
            field: 'publishTime',
            width: 170,
            sorter: 'string',
            responsive: 4
        },
        {
            title: '来源',
            field: 'url',
            width: 80,
            sorter: 'string',
            responsive: 5,
            hozAlign: 'left',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const url = cell.getData().url;
                if (url) {
                    if (url.includes('javdb')) {
                        return jsxToString(<ColoredTextCell text="Javdb" color="#d34f9e" />);
                    } else {
                        return jsxToString(<ColoredTextCell text={url} color="#050505" />);
                    }
                } else {
                    return '';
                }
            }
        },
        {
            title: '状态',
            field: 'status',
            width: 100,
            sorter: 'string',
            responsive: 1,
            headerSort: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const status = cell.getData().status;
                let color = '';
                let text = '';
                switch (status) {
                    case 'filter':
                        color = BLOCK_COLOR;
                        text = BLOCK_TEXT;
                        break;
                    case 'favorite':
                        color = FAVORITE_COLOR;
                        text = FAVORITE_TEXT;
                        break;
                    case 'hasWatch':
                        color = WATCHED_COLOR;
                        text = WATCHED_TEXT;
                        break;
                    default:
                        text = status;
                }
                return jsxToString(<ColoredTextCell text={text} color={color} />);
            }
        },
        {
            title: '备注',
            field: 'remark',
            width: 100,
            sorter: 'string',
            responsive: 6
        },
        {
            title: '操作',
            sorter: 'string',
            minWidth: 150,
            cssClass: 'action-cell-dropdown',
            responsive: 0,
            headerSort: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, onRendered: (callback: () => void) => void) => {
                const data = cell.getData();
                onRendered(() => {
                    const editBtn = cell.getElement().querySelector('.history-editBtn');
                    if (editBtn != null) {
                        editBtn.addEventListener('click', () => {
                            plugin.editRecord(data);
                        });
                    }
                });
                return jsxToString(
                    <HistoryActionButtons
                        carNum={data.carNum}
                        url={data.url || ''}
                        watchedColor={WATCHED_COLOR}
                        watchedText={WATCHED_TEXT}
                        favoriteColor={FAVORITE_COLOR}
                        favoriteText={FAVORITE_TEXT}
                        blockColor={BLOCK_COLOR}
                        blockText={BLOCK_TEXT}
                    />
                );
            }
        }
    ];
    return {
        ...createTabulatorOptions(columns),
        pagination: true,
        paginationMode: 'remote',
        sortMode: 'remote',
        ajaxURL: 'queryRealm',
        dataLoader: false,
        ajaxRequestFunc: async (
            _url: unknown,
            _config: unknown,
            params: { page: number; size: number; sort: Array<{ field: string; dir: string }> }
        ) => {
            const page = params.page;
            const size = params.size;
            const sort = params.sort;
            return await plugin.getDataList(page, size, sort);
        },
        dataReceiveParams: {
            last_page: 'maxPage',
            last_row: 'totalCount',
            data: 'dataList'
        },
        paginationSize: 50,
        paginationSizeSelector: [50, 100, 1000, 99999],
        paginationCounter: (
            _pageNumber: unknown,
            _pageSize: unknown,
            _totalPages: unknown,
            recordCount: number,
            _data: unknown
        ) => `共 ${recordCount} 条记录`,
        selectableRowsPersistence: false,
        index: 'carNum',
        initialSort: [
            {
                column: 'updateDate',
                dir: 'desc'
            }
        ]
    };
}
