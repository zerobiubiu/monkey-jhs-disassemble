/**
 * SettingDialog —— 完整设置弹层（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/setting-plugin.ts 的 openSettingDialog（L288，
 * 原 archetype/jhs.user.js L9642 的 layer.open content）：
 * 左侧栏（backup/base/filter/domain/hotkey/cache 六菜单项）+ 右侧
 * 六面板（数据备份 / 基础配置 / 外部网站 / 快捷键 / 屏蔽配置 / 清理缓存）+
 * 底部保存/清理按钮。
 *
 * 保留原 HTML 结构、id、类名（含条件 active/do-hide）、内联 style 值（含
 * linear-gradient 渐变 hr、flex 布局）、data-tip/data-panel/data-default-hotkey、
 * `<option>`/`<input>`/`<select>`/`<hr/>`/`<br/>`/`<pre>` 原样不动。
 * 当前激活面板（panelName）、JavDb 站点标识（isJavdbSite）、屏蔽/收藏/
 * 已观看文案（blockText/favoriteText/watchedText）通过 props 注入。
 *
 * cacheItemsHtml / qualityOptionsHtml 为预拼接 HTML 字符串（由调用方循环
 * jsxToString(<CacheItemHtml/>)/jsxToString(<VideoQualityOption/>) 拼接），
 * 以 `dangerouslySetInnerHTML={{ __html }}` 注入对应容器（grid div / select），
 * jsxToString 取 __html 作原始 inner HTML 不转义（doc/19 已为此扩展），
 * 与原模板 `${cacheItemsHtml}` / `${qualityOptionsHtml}` 插值一致。
 *
 * 原模板中的 `\n` 转义与缩进、HTML 注释（`\x3c!-- --\x3e`）由 jsxToString
 * 紧凑输出丢失，HTML 注释转为 JSX 注释语法（jsxToString 不渲染注释，
 * 与原 HTML 注释 DOM 等价——注释内无功能性内容）。❓ emoji 与文案间的空格
 * 以 `{" "}` 显式保留。对 DOM 构建/CSS 渲染无影响。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 openSettingDialog 中
 * `layer.open({ content })` 消费时，需先用 `jsxToString` 转为 HTML 字符串：
 *   `layer.open({ content: jsxToString(<SettingDialog {...props} />), ... })`
 * 事件绑定（loadForm/bindClick/saveForm）仍由 openSettingDialog 持有。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义（data-tip/title 等按本工程约定不转义，
 * 与原 jQuery `layer.open({ content: htmlString })` 行为一致）。
 */

/** SettingDialog 的属性。 */
export interface SettingDialogProps {
    /** 当前激活面板名（默认 backup-panel），控制侧栏 active 类与各面板 display。 */
    panelName: string;
    /** 缓存项 HTML（预拼接，含清理/查看按钮），注入 cache-panel 网格。 */
    cacheItemsHtml: string;
    /** 画质选项 HTML（预拼接 option 串），注入 videoQuality 下拉。 */
    qualityOptionsHtml: string;
    /** 是否 JavDb 站点（控制高亮演员/分类标签项的 do-hide 类）。 */
    isJavdbSite: boolean;
    /** 屏蔽文案（原 BLOCK_TEXT），用于快捷键面板 filterHotKey 标签。 */
    blockText: string;
    /** 收藏文案（原 FAVORITE_TEXT），用于快捷键面板 favoriteHotKey 标签。 */
    favoriteText: string;
    /** 已观看文案（原 WATCHED_TEXT），用于快捷键面板 hasWatchHotKey 标签。 */
    watchedText: string;
}

/** hr 分隔线内联样式（渐变背景，原模板中重复多次）。 */
const HR_STYLE = {
    border: 0,
    height: '1px',
    margin: '20px 0',
    backgroundImage:
        'linear-gradient(to right, rgba(0,0,0,0), rgba(159,137,137,0.75), rgba(0,0,0,0))'
} as const;

/**
 * 渲染完整设置弹层的 JSX。
 * @param props.panelName 当前激活面板名
 * @param props.cacheItemsHtml 缓存项预拼接 HTML
 * @param props.qualityOptionsHtml 画质选项预拼接 HTML
 * @param props.isJavdbSite 是否 JavDb 站点
 * @param props.blockText 屏蔽文案
 * @param props.favoriteText 收藏文案
 * @param props.watchedText 已观看文案
 * @returns 设置弹层 JSX（侧栏 + 六面板 + 底部按钮），经 jsxToString 转 HTML
 *          字符串后供 layer.open 消费。
 */
export function SettingDialog({
    panelName,
    cacheItemsHtml,
    qualityOptionsHtml,
    isJavdbSite,
    blockText,
    favoriteText,
    watchedText
}: SettingDialogProps) {
    return (
        <div style={{ display: 'flex', height: '100%' }}>
            <div
                style={{
                    width: '170px',
                    flexShrink: 0,
                    padding: '12px 0',
                    background: '#fbfcfd',
                    borderRight: '1px solid #e2e8f0',
                    overflowY: 'auto'
                }}
            >
                <div
                    className={`side-menu-item ${panelName === 'backup-panel' ? 'active' : ''}`}
                    data-panel="backup-panel"
                >
                    💾 数据备份
                </div>
                <div
                    className={`side-menu-item ${panelName === 'base-panel' ? 'active' : ''}`}
                    data-panel="base-panel"
                >
                    ⚙️ 基础配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'filter-panel' ? 'active' : ''}`}
                    data-panel="filter-panel"
                >
                    🚫 屏蔽配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'domain-panel' ? 'active' : ''}`}
                    data-panel="domain-panel"
                    title="第三方视频资源域名配置"
                >
                    🌐 外部网站
                </div>
                <div
                    className={`side-menu-item ${panelName === 'hotkey-panel' ? 'active' : ''}`}
                    data-panel="hotkey-panel"
                >
                    ⌨️ 快捷键配置
                </div>
                <div
                    className={`side-menu-item ${panelName === 'cache-panel' ? 'active' : ''}`}
                    data-panel="cache-panel"
                >
                    🧹 缓存管理
                </div>
                <div
                    className={`side-menu-item ${panelName === 'vlt-panel' ? 'active' : ''}`}
                    data-panel="vlt-panel"
                >
                    📋 收藏清单关系
                </div>
                <div
                    className={`side-menu-item ${panelName === 'missav-panel' ? 'active' : ''}`}
                    data-panel="missav-panel"
                >
                    🎬 MissAV 同步
                </div>
            </div>

            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}
            >
                <div
                    style={{
                        flex: 1,
                        margin: '0 10px',
                        paddingBottom: '20px',
                        overflow: 'hidden'
                    }}
                >
                    {/* 备份面板 */}
                    <div
                        id="backup-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'backup-panel' ? 'block' : 'none'
                        }}
                    >
                        <div style={{ marginBottom: '16px', display: 'flex', gap: '10px' }}>
                            <a
                                id="importBtn"
                                className="menu-btn"
                                style={{ backgroundColor: '#d25a88' }}
                            >
                                <span>📥 导入数据</span>
                            </a>
                            <a
                                id="exportBtn"
                                className="menu-btn"
                                style={{ backgroundColor: '#85d0a3' }}
                            >
                                <span>📤 导出数据</span>
                            </a>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">WebDav备份</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <a
                                    id="webdavBackupListBtn"
                                    className="menu-btn"
                                    style={{ backgroundColor: '#5d87c2' }}
                                >
                                    <span>查看备份</span>
                                </a>
                                <a
                                    id="webdavBackupBtn"
                                    className="menu-btn"
                                    style={{ backgroundColor: '#64bb69' }}
                                >
                                    <span>备份数据</span>
                                </a>
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">服务地址:</span>
                            <div className="form-content">
                                <input id="webDavUrl" />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">用户名:</span>
                            <div className="form-content">
                                <input id="webDavUsername" />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">密码:</span>
                            <div className="form-content">
                                <input id="webDavPassword" />
                            </div>
                        </div>
                        <div
                            style={{
                                fontSize: '13px',
                                fontWeight: '600',
                                color: '#5d87c2',
                                margin: '16px 0 8px 4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            ⏰ 自动备份
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">启用自动备份</span>
                            <div className="form-content">
                                <label
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <input
                                        id="enableAutoBackup"
                                        type="checkbox"
                                        style={{ margin: 0 }}
                                    />
                                    <span style={{ fontSize: '13px', color: '#64748b' }}>
                                        开启后按频率自动备份到 WebDav
                                    </span>
                                </label>
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">备份频率:</span>
                            <div className="form-content">
                                <select id="autoBackupFrequency">
                                    <option value="daily">每天第一次打开（推荐）</option>
                                    <option value="everyOpen">每次打开</option>
                                    <option value="disabled">不自动备份</option>
                                </select>
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">本机凭证:</span>
                            <div className="form-content">
                                <input
                                    id="credentialIdDisplay"
                                    readOnly
                                    style={{
                                        width: '100%',
                                        color: '#94a3b8',
                                        fontSize: '11px',
                                        fontFamily: 'monospace'
                                    }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 基础设置面板 */}
                    <div
                        id="base-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'base-panel' ? 'block' : 'none'
                        }}
                    >
                        <div className="setting-item">
                            <span className="setting-label">打开待鉴定|已收藏 窗口数:</span>
                            <div className="form-content">
                                <input
                                    type="number"
                                    id="waitCheckCount"
                                    min="1"
                                    max="20"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">已鉴定标签展示位置:</span>
                            <div className="form-content">
                                <select id="tagPosition">
                                    <option value="rightTop">右上</option>
                                    <option value="leftTop">左上</option>
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span
                                className="setting-label"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '5px'
                                }}
                            >
                                鉴定补录演员信息{' '}
                                <span data-tip="在列表页进行鉴定是获取不到演员名称的, 开启后, 额外解析详情页补录演员名称, 因发请求解析费时, 会被以往慢1秒左右">
                                    ❓
                                </span>
                            </span>
                            <div className="form-content">
                                <input
                                    type="checkbox"
                                    id="enableSaveActressCarInfo"
                                    className="mini-switch"
                                />
                            </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div className="setting-item">
                            <span className="setting-label">预览视频默认画质:</span>
                            <div className="form-content">
                                <select
                                    id="videoQuality"
                                    dangerouslySetInnerHTML={{
                                        __html: qualityOptionsHtml
                                    }}
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">评论区条数:</span>
                            <div className="form-content">
                                <select id="reviewCount">
                                    <option value="10">10条</option>
                                    <option value="20">20条</option>
                                    <option value="30">30条</option>
                                    <option value="40">40条</option>
                                    <option value="50">50条</option>
                                </select>
                            </div>
                        </div>

                        <div className={`setting-item ${isJavdbSite ? '' : 'do-hide'}`}>
                            <span className="setting-label">
                                高亮已收藏演员{' '}
                                <span data-tip="详情页, 对已收藏的演员进行边框高亮提醒">❓</span>
                            </span>
                            <div className="form-content">
                                <input
                                    type="checkbox"
                                    id="enableFavoriteActresses"
                                    className="mini-switch"
                                />
                            </div>
                        </div>

                        <div className={`setting-item ${isJavdbSite ? '' : 'do-hide'}`}>
                            <span id="highlightedTagLabel" className="setting-label">
                                分类标签|高亮演员-边框样式:
                            </span>
                            <div
                                className="form-content"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >
                                <input type="number" id="highlightedTagNumber" min="0" max="20" />
                                <input type="color" id="highlightedTagColor" />
                            </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div className="setting-item">
                            <span className="setting-label">请求超时时间(毫秒):</span>
                            <div className="form-content">
                                <input
                                    type="number"
                                    id="httpTimeout"
                                    min="1000"
                                    max="10000"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">请求失败重试次数:</span>
                            <div className="form-content">
                                <input
                                    type="number"
                                    id="httpRetryCount"
                                    min="0"
                                    max="10"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div className="setting-item">
                            <span className="setting-label">启用控制台日志:</span>
                            <div className="form-content">
                                <select id="enableClog">
                                    <option value="no">禁用</option>
                                    <option value="yes">开启</option>
                                </select>
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">日志最大行数:</span>
                            <div className="form-content">
                                <input
                                    type="number"
                                    id="clogMsgCount"
                                    min="100"
                                    max="3000"
                                    style={{ width: '100%' }}
                                />
                            </div>
                        </div>
                    </div>

                    <div
                        id="domain-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'domain-panel' ? 'block' : 'none'
                        }}
                    >
                        <div className="setting-item">
                            <span className="setting-label">域名 - MissAv:</span>
                            <div className="form-content">
                                <input id="missAvUrl" />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">域名 - SupJav:</span>
                            <div className="form-content">
                                <input id="supJavUrl" />
                            </div>
                        </div>
                    </div>

                    {/* 快捷键 */}
                    <div
                        id="hotkey-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'hotkey-panel' ? 'block' : 'none'
                        }}
                    >
                        <p style={{ color: '#666', fontSize: '0.9em' }}>修改后, 刷新页面生效</p>
                        <div className="setting-item">
                            <span className="setting-label">{blockText}:</span>
                            <div className="form-content">
                                <input
                                    id="filterHotKey"
                                    placeholder="录入快捷键"
                                    data-default-hotkey="a"
                                />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">{favoriteText}:</span>
                            <div className="form-content">
                                <input
                                    id="favoriteHotKey"
                                    placeholder="录入快捷键"
                                    data-default-hotkey="s"
                                />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">{watchedText}:</span>
                            <div className="form-content">
                                <input id="hasWatchHotKey" placeholder="录入快捷键" />
                            </div>
                        </div>
                        <div className="setting-item">
                            <span className="setting-label">⏩ 快进:</span>
                            <div className="form-content">
                                <input
                                    id="speedVideoHotKey"
                                    placeholder="录入快捷键"
                                    data-default-hotkey="z"
                                />
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">▲ 折叠:</span>
                            <div className="form-content">
                                <input id="foldCategoryHotKey" placeholder="录入快捷键" />
                            </div>
                        </div>

                        <div className="setting-item">
                            <span className="setting-label">💻 控制台:</span>
                            <div className="form-content">
                                <input id="clogHotKey" placeholder="录入快捷键" />
                            </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div className="setting-item">
                            <span className="setting-label">
                                <span data-tip="列表页,鼠标放置图片上时可使用快捷键">❓</span>{' '}
                                对视频列表页启用快捷键:
                            </span>
                            <div className="form-content">
                                <input
                                    type="checkbox"
                                    id="enableImageHotKey"
                                    className="mini-switch"
                                />
                            </div>
                        </div>
                    </div>

                    {/* 屏蔽设置面板 */}
                    <div
                        id="filter-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'filter-panel' ? 'block' : 'none'
                        }}
                    >
                        <div className="setting-item">
                            <span className="setting-label">
                                启用划词屏蔽{' '}
                                <span data-tip="视频详情页中, 标题或评论区选中文字, 按右键可快捷加入屏蔽词">
                                    ❓
                                </span>
                            </span>
                            <div style={{ display: 'flex' }}>
                                <input
                                    type="checkbox"
                                    id="enableTitleSelectFilter"
                                    className="mini-switch"
                                />
                            </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div id="reviewKeywordContainer">
                            <div className="setting-item">
                                <span className="setting-label">评论区屏蔽词:</span>
                                <div style={{ display: 'flex' }}>
                                    <input
                                        type="text"
                                        className="keyword-input"
                                        placeholder="添加屏蔽词"
                                    />
                                    <button className="add-tag-btn">添加</button>
                                </div>
                            </div>
                            <div className="tag-box"> </div>
                        </div>

                        <hr style={HR_STYLE} />

                        <div id="filterKeywordContainer">
                            <div className="setting-item">
                                <span className="setting-label">视频标题屏蔽词:</span>
                                <div style={{ display: 'flex' }}>
                                    <input
                                        type="text"
                                        className="keyword-input"
                                        placeholder="添加屏蔽词"
                                    />
                                    <button className="add-tag-btn">添加</button>
                                </div>
                            </div>
                            <div className="tag-box"> </div>
                        </div>
                    </div>

                    <div
                        id="cache-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'cache-panel' ? 'block' : 'none'
                        }}
                    >
                        <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '4px'
                            }}
                        >
                            <h1
                                style={{
                                    fontSize: '18px',
                                    fontWeight: 'bold',
                                    margin: '0'
                                }}
                            >
                                缓存管理
                            </h1>
                            <span
                                id="cache-total-size"
                                style={{
                                    fontSize: '13px',
                                    color: '#999'
                                }}
                            />
                        </div>
                        <p
                            style={{
                                color: '#999',
                                fontSize: '12px',
                                margin: '0 0 16px 0'
                            }}
                        >
                            以下操作不会对核心数据造成影响，可安全清理
                        </p>
                        <div
                            style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(2, 1fr)',
                                gap: '15px',
                                marginTop: '20px'
                            }}
                            dangerouslySetInnerHTML={{
                                __html: cacheItemsHtml
                            }}
                        />
                        <div
                            id="cache-data-display"
                            style={{
                                marginTop: '20px',
                                display: 'none'
                            }}
                        >
                            <pre
                                style={{
                                    background: '#f5f5f5',
                                    padding: '10px',
                                    borderRadius: '5px',
                                    maxHeight: '400px',
                                    overflow: 'auto'
                                }}
                            />
                        </div>
                    </div>
                    {/* 收藏清单关系面板 */}
                    <div
                        id="vlt-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'vlt-panel' ? 'block' : 'none',
                            padding: '15px'
                        }}
                    >
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                            收藏清单关系
                        </h3>
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
                            <a
                                id="vlt-import-btn"
                                className="menu-btn"
                                style={{ backgroundColor: '#0d6efd', cursor: 'pointer' }}
                            >
                                <span>导入数据</span>
                            </a>{' '}
                            <a
                                id="vlt-export-btn"
                                className="menu-btn"
                                style={{ backgroundColor: '#198754', cursor: 'pointer' }}
                            >
                                <span>导出数据</span>
                            </a>
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
                    </div>
                    {/* MissAV 同步面板 */}
                    <div
                        id="missav-panel"
                        className="content-panel"
                        style={{
                            display: panelName === 'missav-panel' ? 'block' : 'none',
                            padding: '15px'
                        }}
                    >
                        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333' }}>
                            MissAV 状态标签同步
                        </h3>
                        <p
                            style={{
                                margin: '0 0 16px 0',
                                color: '#6c757d',
                                fontSize: '13px',
                                lineHeight: '1.6'
                            }}
                        >
                            在 MissAV 站点显示 JHS 鉴定状态标签（已收藏/已观看/已屏蔽/已下载）。
                            <br />
                            数据通过油猴 GM 存储跨域同步，无需后端服务器。
                            <br />
                            <strong>立即同步</strong>：读取当前 car_list 并推送到 GM 存储。
                            <br />
                            <strong>导入</strong>：从后端服务器导出的 JSON 导入历史数据。
                            <br />
                            <strong>导出</strong>：将 MissAV 本地 IndexedDB 数据导出为 JSON（可走
                            WebDav 备份）。
                        </p>
                        <div style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                            <a
                                id="missav-sync-btn"
                                className="menu-btn"
                                style={{ backgroundColor: '#25b1dc', cursor: 'pointer' }}
                            >
                                <span>立即同步</span>
                            </a>{' '}
                            <a
                                id="missav-import-btn"
                                className="menu-btn"
                                style={{ backgroundColor: '#0d6efd', cursor: 'pointer' }}
                            >
                                <span>导入数据</span>
                            </a>{' '}
                            <a
                                id="missav-export-btn"
                                className="menu-btn"
                                style={{ backgroundColor: '#198754', cursor: 'pointer' }}
                            >
                                <span>导出数据</span>
                            </a>
                        </div>
                        <div
                            id="missav-status"
                            style={{ fontSize: '13px', color: '#6c757d', marginTop: '8px' }}
                        />
                        <input
                            type="file"
                            id="missav-file-input"
                            accept=".json,application/json"
                            style={{ display: 'none' }}
                        />
                    </div>
                </div>
                <div
                    style={{
                        flexShrink: 0,
                        padding: '14px 20px',
                        textAlign: 'right',
                        borderTop: '1px solid #e2e8f0',
                        background: '#fbfcfd',
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: '10px',
                        alignItems: 'center'
                    }}
                >
                    <button id="saveBtn">💾 保存设置</button>
                    <button id="clean-all" style={{ display: 'none' }}>
                        ♾️ 清理全部缓存
                    </button>
                </div>
            </div>
        </div>
    );
}
