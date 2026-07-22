/**
 * ActressInfoDetailSegment —— 影片详情页演员信息标签段（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/actress-info-plugin.ts 的 handleDetailPage（L119-121，
 * 原 archetype/jhs.user.js L4194-4198 的 segment）：有信息版（panel-block
 * actress-info，含生日/年龄 + 身高/体重 + 三围/罩杯三组 info-tag 链接）与
 * 无信息版（panel-block actress-info，仅含指向维基搜索页的演员名链接）。
 *
 * 保留原 HTML 结构、类名（panel-block actress-info / info-tag）、内联 style
 * 值（margin-left:5px，经 CSSProperties 对象还原为 margin-left:5px，值原样
 * 保留）、target="_blank" 零偏差。info 是否存在决定有/无信息版分支，与原
 * 三元一致；演员名/维基详情/URL 前缀等动态值由 props 注入。原模板中的 `\n`
 * 转义与缩进、尾随空格由 jsxToString 紧凑输出丢失，对 DOM 构建/CSS 渲染
 * 无影响（无信息版原 `<div>...</div> ` 尾随空格丢失，块级尾空白无影响）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleDetailPage 中
 * `.after(html)` 拼接消费：
 *   `html += jsxToString(<ActressInfoDetailSegment actressName={...} info={...} wikiApiUrl={...} />)`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。动态文本与属性由 jsxToString 统一转义（doc/129）。
 */

/** 演员维基百科详情（searchInfo 返回结构，对应原 L4304-4324 返回的对象字面量）。 */
export interface ActressWikiInfo {
    /** 生日（如 "1993年4月15日"）。 */
    birthday: string;
    /** 年龄（如 "30岁"；现年齢单元格为空时为空串）。 */
    age: string;
    /** 身高（如 "165cm"）。 */
    height: string;
    /** 体重（如 "50 kg"；为 "― kg" 占位时归一为空串）。 */
    weight: string;
    /** 三围文本（去除 cm 后的原始文本）。 */
    threeSizeText: string;
    /** 罩杯尺寸。 */
    braSize: string;
    /** 维基百科页面 URL。 */
    url: string;
}

/** 只允许跳转到日文维基 HTTPS 页面，拒绝缓存中被篡改的脚本/外站 URL。 */
export function safeWikipediaUrl(value: string): string | null {
    try {
        const parsed = new URL(value, 'https://ja.wikipedia.org');
        if (
            parsed.protocol !== 'https:' ||
            parsed.hostname !== 'ja.wikipedia.org' ||
            parsed.port ||
            parsed.username ||
            parsed.password
        ) {
            return null;
        }
        return parsed.href;
    } catch {
        return null;
    }
}

/** ActressInfoDetailSegment 的属性。 */
interface ActressInfoDetailSegmentProps {
    /** 演员名（渲染到 <strong> 文本，无信息版拼接进维基搜索 href）。 */
    actressName: string;
    /** 维基详情；非空渲染有信息版（三组 info-tag），null/undefined 渲染无信息版。 */
    info: ActressWikiInfo | null | undefined;
    /** 维基 API URL 前缀（对应插件实例字段 apiUrl），无信息版拼接演员名得到搜索页 href。 */
    wikiApiUrl: string;
}

/**
 * 渲染影片详情页演员信息标签段的 JSX。
 * @param props.actressName 演员名
 * @param props.info 维基详情（null/undefined 时渲染无信息版）
 * @param props.wikiApiUrl 维基 API URL 前缀（无信息版拼接 href）
 * @returns panel-block actress-info 段 React 元素，经 jsxToString 转 HTML 字符串
 *          后供 handleDetailPage `.after()` 拼接。
 */
export function ActressInfoDetailSegment({
    actressName,
    info,
    wikiApiUrl
}: ActressInfoDetailSegmentProps) {
    // user-select:all 由插件侧 featureFlags.actressUserSelectAll 控制是否启用；
    // 组件默认开启（与新版一致）；关 flag 时插件传入 plainName=true 即可回退。
    const nameNode = (
        <strong style={{ marginRight: '5px' }}>
            <span style={{ userSelect: 'all' }}>{actressName}</span>:
        </strong>
    );
    if (info) {
        const infoContent = (
            <>
                <span className="info-tag">
                    {info.birthday} {info.age}
                </span>
                <span className="info-tag">
                    {info.height} {info.weight}
                </span>
                <span className="info-tag">
                    {info.threeSizeText} {info.braSize}
                </span>
            </>
        );
        const safeInfoUrl = safeWikipediaUrl(info.url);
        return (
            <div className="panel-block actress-info">
                {nameNode}
                {safeInfoUrl ? (
                    <a
                        href={safeInfoUrl}
                        style={{ marginLeft: '5px' }}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {infoContent}
                    </a>
                ) : (
                    <span style={{ marginLeft: '5px' }}>{infoContent}</span>
                )}
            </div>
        );
    }
    const fallbackUrl = safeWikipediaUrl(wikiApiUrl + encodeURIComponent(actressName));
    return (
        <div className="panel-block actress-info">
            {fallbackUrl ? (
                <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                    {nameNode}
                </a>
            ) : (
                nameNode
            )}
            <span style={{ marginLeft: '5px', color: '#999' }}>暂无此演员信息</span>
        </div>
    );
}
