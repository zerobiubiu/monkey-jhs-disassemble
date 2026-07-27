/**
 * BasePanel —— 基础配置面板（React 函数组件，JSX）。
 *
 * 窗口数、标签位置、展示方式、演员补录、画质、评论区、高亮、超时/重试、
 * 日志配置，基于 setting/ 原子组件构建（分区 + 统一行网格）。
 */

import { SettingColorRow } from '../setting/setting-color-row';
import { SettingInput } from '../setting/setting-input';
import { SettingRow } from '../setting/setting-row';
import { SettingSection } from '../setting/setting-section';
import { SettingSelect } from '../setting/setting-select';
import { SettingToggle } from '../setting/setting-toggle';

/** BasePanel 的属性。 */
export interface BasePanelProps {
    /** 当前激活面板名，控制面板 display。 */
    panelName: string;
    /** 画质选项 HTML（预拼接 option 串），注入 videoQuality 下拉。 */
    qualityOptionsHtml: string;
    /** 是否 JavDb 站点（控制高亮演员/分类标签项的 do-hide 类）。 */
    isJavdbSite: boolean;
}

/**
 * 渲染基础配置面板的 JSX。
 * @returns base-panel JSX，经 jsxToString 转 HTML 字符串后供 SettingDialog 消费。
 */
export function BasePanel({ panelName, qualityOptionsHtml, isJavdbSite }: BasePanelProps) {
    return (
        <div
            id="base-panel"
            className="content-panel"
            style={{
                display: panelName === 'base-panel' ? 'block' : 'none'
            }}
        >
            <SettingSection title="展示配置" icon="🎛️">
                <SettingRow label="打开待鉴定|已收藏 窗口数:">
                    <SettingInput id="waitCheckCount" type="number" min="1" max="20" />
                </SettingRow>
                <SettingRow label="已鉴定标签展示位置:">
                    <SettingSelect id="tagPosition">
                        <option value="rightTop">右上</option>
                        <option value="leftTop">左上</option>
                    </SettingSelect>
                </SettingRow>
                <SettingRow
                    label="已鉴定内容展示方式"
                    tooltip="hide=直接隐藏；visibility=透明占位保留布局"
                >
                    <SettingSelect id="movieShowType">
                        <option value="hide">隐藏 (hide)</option>
                        <option value="visibility">透明占位 (visibility)</option>
                    </SettingSelect>
                </SettingRow>
                <SettingToggle
                    id="enableSaveActressCarInfo"
                    label="鉴定补录演员信息"
                    tooltip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右"
                />
            </SettingSection>

            <SettingSection title="清单收藏合并" icon="🗂️">
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
                <SettingRow
                    label="不参与合并的清单名:"
                    tooltip="逗号分隔；填完整清单名或前缀均可（如 Top10 或 Top），命中后该清单按原名单独显示"
                >
                    <SettingInput id="listMergeExcludeNames" placeholder="逗号分隔，如：Top10, 2024" />
                </SettingRow>
                <SettingToggle
                    id="listReflowEnabled"
                    label="启用清单页编号整理"
                    tooltip="在 /lists/ 清单页显示「编号清单整理」面板：识别同前缀编号组、生成组内压实计划预览（当前版本只读，不执行搬运）"
                />
            </SettingSection>

            <SettingSection title="播放与评论" icon="🎬">
                <SettingRow label="预览视频默认画质:">
                    <SettingSelect
                        id="videoQuality"
                        dangerouslySetInnerHTML={{
                            __html: qualityOptionsHtml
                        }}
                    />
                </SettingRow>
                <SettingRow label="评论区条数:">
                    <SettingSelect id="reviewCount">
                        <option value="10">10条</option>
                        <option value="20">20条</option>
                        <option value="30">30条</option>
                        <option value="40">40条</option>
                        <option value="50">50条</option>
                    </SettingSelect>
                </SettingRow>
                <SettingToggle
                    id="enableFavoriteActresses"
                    label="高亮已收藏演员"
                    tooltip="详情页, 对已收藏的演员进行边框高亮提醒"
                    className={isJavdbSite ? '' : 'do-hide'}
                />
                <SettingColorRow
                    numberId="highlightedTagNumber"
                    colorId="highlightedTagColor"
                    labelId="highlightedTagLabel"
                    label="分类标签|高亮演员-边框样式:"
                    className={isJavdbSite ? '' : 'do-hide'}
                />
            </SettingSection>

            <SettingSection title="网络请求" icon="🌐">
                <SettingRow label="请求超时时间(毫秒):">
                    <SettingInput id="httpTimeout" type="number" min="1000" max="10000" />
                </SettingRow>
                <SettingRow label="请求失败重试次数:">
                    <SettingInput id="httpRetryCount" type="number" min="0" max="10" />
                </SettingRow>
            </SettingSection>

            <SettingSection title="日志" icon="📝">
                <SettingRow label="启用控制台日志:">
                    <SettingSelect id="enableClog">
                        <option value="no">禁用</option>
                        <option value="yes">开启</option>
                    </SettingSelect>
                </SettingRow>
                <SettingRow label="日志最大行数:">
                    <SettingInput id="clogMsgCount" type="number" min="100" max="3000" />
                </SettingRow>
            </SettingSection>
        </div>
    );
}
