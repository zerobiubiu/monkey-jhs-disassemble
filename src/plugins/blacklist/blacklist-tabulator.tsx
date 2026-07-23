/**
 * 演员黑名单 Tabulator 表格配置（提取自 blacklist-plugin.tsx 的 loadTableData）。
 *
 * 含列定义 + 各列 formatter + paginationCounter + 本地分页。基础配置
 * （layout / placeholder / virtualDom / responsiveLayout / columnDefaults /
 * locale + zh-cn 语言包）由 createTabulatorOptions 统一提供，中文语言包来自
 * TABULATOR_ZH_CN，消除原内联 locale 对象重复。
 *
 * 无循环值导入：本模块仅以 `import type` 依赖 BlacklistPlugin（运行期擦除）。
 */
import { ACTOR, ACTRESS, CENSORED, UNCENSORED, isJavdbSite } from '../../constants/site';

import { jsxToString } from '../../core/jsx-to-string';
import { createTabulatorOptions } from '../../core/util/tabulator-factory';

import type { BlacklistPlugin } from '../blacklist-plugin';

import { BlacklistActionCell } from '../../components/blacklist/blacklist-action-cell';
import { BlacklistNameCell } from '../../components/blacklist/blacklist-name-cell';
import { BlacklistPaginationCounter } from '../../components/blacklist/blacklist-pagination-counter';
import { BlacklistStatusCell } from '../../components/blacklist/blacklist-status-cell';
import { BlacklistUrlTypeCell } from '../../components/blacklist/blacklist-url-type-cell';

/**
 * 构建黑名单 Tabulator 配置对象（本地分页 + 列定义 + 操作列删除/关键词按钮）。
 * 对应原 L7574-7786 的内联配置；locale/langs 改由 createTabulatorOptions 注入。
 *
 * @param plugin BlacklistPlugin 实例（paginationCounter 读 currentCarCount，
 *               状态列读 checkBlacklist_ruleTime，操作列回调 reloadTable）
 * @param data 表格初始行数据（getTableData 返回值）
 * @returns Tabulator 配置对象（传给 `new Tabulator('#table-container', ...)`）
 */
export function buildBlacklistTableOptions(
    plugin: BlacklistPlugin,
    data: unknown[]
): Record<string, unknown> {
    const columns = [
        {
            title: '演员',
            field: 'name',
            sorter: 'string',
            minWidth: 100,
            responsive: 0,
            headerSort: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const rowData = cell.getData();
                return jsxToString(<BlacklistNameCell url={rowData.url} name={rowData.name} />);
            }
        },
        {
            title: '性别角色',
            field: 'role',
            sorter: 'string',
            width: 120,
            responsive: 5,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const role = cell.getData().role;
                let roleText = role;
                if (role === ACTOR) {
                    roleText = '男演员';
                } else if (role === ACTRESS) {
                    roleText = '女演员';
                }
                return roleText;
            }
        },
        {
            title: '影视类别',
            field: 'movieType',
            sorter: 'string',
            width: 120,
            responsive: 5,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const movieType = cell.getData().movieType;
                let movieTypeText = movieType;
                if (movieType === CENSORED) {
                    movieTypeText = '有码';
                } else if (movieType === UNCENSORED) {
                    movieTypeText = '无码';
                }
                return movieTypeText;
            }
        },
        {
            title: '屏蔽类型',
            field: 'url',
            sorter: 'string',
            minWidth: 120,
            responsive: 4,
            visible: isJavdbSite,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                const hasTag = cell.getData().url.includes('t=');
                return jsxToString(<BlacklistUrlTypeCell hasTag={hasTag} />);
            }
        },
        {
            title: '番号数量',
            field: 'count',
            sorter: 'number',
            width: 170,
            responsive: 1
        },
        {
            title: '创建时间',
            field: 'createTime',
            sorter: 'string',
            width: 170,
            responsive: 5
        },
        {
            title: '最后发行时间',
            field: 'lastPublishTime',
            sorter: 'string',
            width: 170,
            responsive: 1
        },
        {
            title: '状态',
            field: 'isUnCheck',
            sorter: 'string',
            width: 120,
            responsive: 1,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, _onRendered: unknown) => {
                let tipText = '';
                let statusText = '正常检测';
                if (cell.getData().isUnCheck) {
                    tipText = `停更${plugin.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`;
                    statusText = '停止检测';
                }
                return jsxToString(<BlacklistStatusCell tipText={tipText} statusText={statusText} />);
            }
        },
        {
            title: '操作',
            sorter: 'string',
            cssClass: 'action-cell-dropdown',
            minWidth: 150,
            responsive: 0,
            headerSort: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Tabulator 无类型声明
            formatter: (cell: any, _formatterParams: unknown, onRendered: (callback: () => void) => void) => {
                const rowData = cell.getData();
                onRendered(() => {
                    const deleteBtn = cell.getElement().querySelector('.delete-btn');
                    if (deleteBtn != null) {
                        deleteBtn.addEventListener('click', (event: MouseEvent) => {
                            const name = rowData.name;
                            const starId = rowData.starId;
                            if (name) {
                                if (starId) {
                                    utils.q(
                                        event,
                                        `是否移除对 ${name} 的屏蔽?`,
                                        async () => {
                                            await storageManager.removeBlacklistCarList(starId);
                                            await storageManager.deleteBlacklistItem(starId);
                                            show.info('操作成功');
                                            plugin.reloadTable().then();
                                        }
                                    );
                                } else {
                                    show.error('获取starId失败');
                                }
                            } else {
                                show.error('获取名称失败');
                            }
                        });
                    }
                    const keywordBtn = cell.getElement().querySelector('.keyword-btn');
                    if (keywordBtn != null) {
                        keywordBtn.addEventListener('click', () => {
                            const prefixCounts: Record<string, number> = rowData.carList.reduce(
                                (acc: Record<string, number>, carItem: { carNum: string }) => {
                                    const prefix = carItem.carNum.split('-')[0] + '-';
                                    acc[prefix] = (acc[prefix] || 0) + 1;
                                    return acc;
                                },
                                {}
                            );
                            const sortedPrefixes = Object.entries(prefixCounts)
                                .map(([prefix, count]: [string, number]) => ({
                                    prefix,
                                    count
                                }))
                                .sort((a: { count: number }, b: { count: number }) => b.count - a.count);
                            console.log(sortedPrefixes);
                        });
                    }
                });
                return jsxToString(<BlacklistActionCell />);
            }
        }
    ];
    return {
        ...createTabulatorOptions(columns, data),
        pagination: true,
        paginationMode: 'local',
        paginationSize: 20,
        paginationSizeSelector: [20, 50, 100, 1000, 99999],
        paginationCounter: (
            _pageSize: unknown,
            _pageNo: unknown,
            _maxPage: unknown,
            actorCount: number,
            _pages: unknown
        ) =>
            jsxToString(
                <BlacklistPaginationCounter
                    actorCount={actorCount}
                    currentCarCount={plugin.currentCarCount}
                />
            ),
        index: 'starId',
        initialSort: [
            {
                column: 'createTime',
                dir: 'desc'
            }
        ]
    };
}
