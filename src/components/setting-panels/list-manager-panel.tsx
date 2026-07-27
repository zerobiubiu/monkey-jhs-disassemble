/**
 * ListManagerPanel —— 「清单管理器」设置面板（React 函数组件，JSX）。
 *
 * doc/207：由原「收藏清单关系」(vlt-panel) 升级而来，集中管理清单相关可配置项：
 * - 序号合并（listMergeEnabled / listMergePattern / listMergeExcludeNames，自 base-panel 迁入）
 * - 排序显示（listDefaultSort / listSortBy，新增）
 * - 编号整理（listReflowEnabled，自 base-panel 迁入）
 * - 对账校准（autoReconcileDelay，新增，doc/206④）
 * - 数据管理（VLT 本地数据导入/导出，保留原按钮 id 与绑定）
 *
 * 保留 panelId="vlt-panel"（沿用既有侧栏/绑定引用），仅升级标签与内容。
 * doc/205/204 落地后再增「自动收藏联动」「压实执行」分区。
 */

import { SettingButton } from '../setting/setting-button';
import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';
import { SettingSelect } from '../setting/setting-select';
import { SettingToggle } from '../setting/setting-toggle';

/** ListManagerPanel 的属性。 */
export interface ListManagerPanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
}

/**
 * 渲染清单管理器面板 JSX。
 * @returns 面板 JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function ListManagerPanel({ panelName }: ListManagerPanelProps) {
    return (
        <div
            id="vlt-panel"
            className="content-panel"
            style={{ display: panelName === 'vlt-panel' ? 'block' : 'none' }}
        >
            <SettingSection title="序号合并" icon="🗂️">
                <SettingToggle
                    id="listMergeEnabled"
                    label="启用序号清单合并"
                    tooltip="详情页清单面板中，将「文字+数字」结尾的清单（如 等待更新1/等待更新2）按前缀合并为一行；勾选时自动放入最靠前的未满清单，全满自动新建下一序号清单"
                />
                <SettingRow
                    label="合并匹配正则:"
                    tooltip="需含两个捕获组：第1组=前缀文字，第2组=末尾序号。留空使用默认规则"
                >
                    <SettingInput id="listMergePattern" placeholder="^(.+?)(\d+)$" />
                </SettingRow>
                <div style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: '13px', color: '#3d4652' }}>
                    不参与合并的清单名:
                </div>
                <div id="listMergeExcludeNamesContainer" className="filter-keyword-container">
                    <div className="tag-box"></div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                            type="text"
                            className="keyword-input"
                            placeholder="输入清单名或前缀后按回车添加"
                            style={{ flex: 1 }}
                        />
                        <a className="add-tag-btn jhs-setting-btn jhs-setting-btn--primary" style={{ flexShrink: 0 }}>
                            添加
                        </a>
                    </div>
                </div>
            </SettingSection>

            <SettingSection title="排序显示" icon="📐">
                <SettingRow
                    label="默认排序方式:"
                    tooltip="详情页清单面板打开时的默认排序（字段+方向，仍可在面板内临时切换）"
                >
                    <SettingSelect id="listDefaultSort">
                        <option value="name-desc">名称降序</option>
                        <option value="name-asc">名称升序</option>
                        <option value="count-desc">数量降序</option>
                        <option value="count-asc">数量升序</option>
                        <option value="num-desc">序号降序</option>
                        <option value="num-asc">序号升序</option>
                    </SettingSelect>
                </SettingRow>
            </SettingSection>

            <SettingSection title="编号整理" icon="⚙️">
                <SettingToggle
                    id="listReflowEnabled"
                    label="启用清单页编号整理"
                    tooltip="在 /lists/ 清单页显示「编号清单整理」面板：识别同前缀编号组、生成组内压实计划预览（当前版本只读，不执行搬运）"
                />
            </SettingSection>

            <SettingSection title="压实执行" icon="🚀">
                <SettingRow
                    label="请求间隔(毫秒):"
                    tooltip="压实搬运时每个加入/移除请求之间的间隔；越大越温和、越慢，建议 300–800"
                >
                    <SettingInput id="reflowInterval" type="number" min="100" max="5000" />
                </SettingRow>
                <SettingRow
                    label="试运行数量:"
                    tooltip="执行整理时先搬运这么多部并暂停，确认无误后再继续剩余"
                >
                    <SettingInput id="reflowTrialCount" type="number" min="1" max="100" />
                </SettingRow>
                <SettingRow
                    label="每批数量:"
                    tooltip="断点续传的检查点粒度（每搬运这么多部存一次进度，期2b 生效）"
                >
                    <SettingInput id="reflowBatchSize" type="number" min="1" max="200" />
                </SettingRow>
                <SettingRow
                    label="连续失败上限:"
                    tooltip="连续失败达到该次数后暂停并提示（期2b 自适应退避生效）"
                >
                    <SettingInput id="reflowMaxRetry" type="number" min="1" max="20" />
                </SettingRow>
            </SettingSection>

            <SettingSection title="自动收藏联动" icon="⭐">
                <SettingToggle
                    id="autoFavCleanupEnabled"
                    label="启用自动收藏/移除联动"
                    tooltip="加入「除受保护清单外」的任意清单自动收藏（想看）；从收藏改为已读星级时，自动从「除受保护清单外」的所有清单移出"
                />
                <div style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: '13px', color: '#3d4652' }}>
                    受保护清单关键词:
                </div>
                <div id="protectedListKeywordsContainer" className="filter-keyword-container">
                    <div className="tag-box"></div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                        <input
                            type="text"
                            className="keyword-input"
                            placeholder="输入关键词后按回车添加（包含匹配）"
                            style={{ flex: 1 }}
                        />
                        <a className="add-tag-btn jhs-setting-btn jhs-setting-btn--primary" style={{ flexShrink: 0 }}>
                            添加
                        </a>
                    </div>
                </div>
            </SettingSection>

            <SettingSection title="对账校准" icon="🔄">
                <SettingRow
                    label="自动对账延迟(毫秒):"
                    tooltip="详情页清单弹窗变动后，触发本地镜像自动对账的防抖延迟；过小易与服务端写入竞速产生良性校准提示，建议 600–1500"
                >
                    <SettingInput id="autoReconcileDelay" type="number" min="200" max="5000" />
                </SettingRow>
            </SettingSection>

            <SettingSection title="数据管理" icon="💾">
                <p
                    style={{
                        margin: '0 0 16px 0',
                        color: '#6c757d',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}
                >
                    管理影片与清单的关联数据（本地 IndexedDB，随 WebDav 备份）。
                    <br />
                    <strong>导入</strong>：从 JSON 文件导入数据（如 PostgreSQL 迁移数据）。
                    <br />
                    <strong>导出</strong>：将当前数据导出为 JSON 文件（备份/迁移）。
                </p>
                <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                    <SettingButton id="vlt-import-btn" color="primary">
                        导入数据
                    </SettingButton>
                    <SettingButton id="vlt-export-btn" color="success">
                        导出数据
                    </SettingButton>
                </div>
                <div
                    id="vlt-status"
                    style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}
                />
                <input
                    type="file"
                    id="vlt-file-input"
                    accept=".json,application/json"
                    style={{ display: 'none' }}
                />
            </SettingSection>

            <SettingSection title="收藏同步" icon="⬆️">
                <p
                    style={{
                        margin: '0 0 12px 0',
                        color: '#6c757d',
                        fontSize: '13px',
                        lineHeight: '1.6'
                    }}
                >
                    将「JHS 已收藏但 JavDB 无状态」的番号批量设为 JavDB「想看」（修复历史积压）。
                    会先核对 JavDB 想看/已看列表：已想看自动跳过；JavDB 已看的跳过并列出（绝不降级）。建议先备份。
                </p>
                <SettingRow
                    label="同步请求间隔(毫秒):"
                    tooltip="逐个设为想看时的请求间隔；越大越温和、越慢"
                >
                    <SettingInput id="jhsSyncInterval" type="number" min="100" max="5000" />
                </SettingRow>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
                    <SettingButton id="jhs-sync-btn" color="primary">
                        同步 JHS 收藏到 JavDB
                    </SettingButton>
                    <span id="jhs-sync-abort-wrap" style={{ display: 'none' }}>
                        <SettingButton id="jhs-sync-abort-btn" color="danger">
                            中止
                        </SettingButton>
                    </span>
                </div>
                <div
                    id="jhs-sync-status"
                    style={{
                        fontSize: '13px',
                        color: '#6c757d',
                        marginTop: '8px',
                        whiteSpace: 'pre-wrap'
                    }}
                />
            </SettingSection>
        </div>
    );
}
