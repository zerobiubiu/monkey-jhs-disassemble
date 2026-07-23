/**
 * Fc2123avMovieInfo —— 123Av FC2 详情弹窗电影信息块（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-by-123av-plugin.tsx 的 loadData（L316-323 的
 * `$('.movie-info-container').html(...)` 模板字符串）：
 *   - movie-title > strong 标题（回退 carNum）
 *   - 番号行（回退 carNum）
 *   - 发布日行（回退空串）
 *   - 海报图（info.poster 存在时条件渲染，max-width:320px）
 *   - movie-actors 主演行（演员 tag 列表由 actresses prop 注入并 map 生成
 *     span.tag，空数组回退「未知」）
 *   - #data-releaseDate 隐藏 div（saveAction 时读取发布日期）
 *
 * 保留原 class/id/内联 style 原样不动。海报条件渲染替代原
 * `${info.poster ? ... : ''}` 三元插值，输出等价；标题等文本经
 * jsxToString escapeText 转义（原模板为裸插值，jQuery .html() 解析后
 * DOM 文本一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 loadData 中
 * `$('.movie-info-container').html(...)` 消费：
 *   `$('.movie-info-container').html(jsxToString(<Fc2123avMovieInfo info={info} carNum={carNum} actresses={actors} />))`
 * 演员 tag 列表由组件内 actresses map 生成（原 loadData 的 actorsHtml
 * 模板拼接已内聚到组件）。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString`（src/core/jsx-to-string，仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）渲染为 HTML 字符串。
 */
import type { CSSProperties } from 'react';

/** 123Av 影片信息对象（get123AvVideoInfo 返回值，本组件消费字段）。 */
export interface Fc2123avVideoInfo {
    /** 标题（回退 carNum）。 */
    title?: string;
    /** 番号（回退 carNum）。 */
    id?: string;
    /** 发布日期（回退空串）。 */
    releaseDate?: string;
    /** 海报图 URL（存在时渲染海报块）。 */
    poster?: string;
}

/** Fc2123avMovieInfo 的属性。 */
export interface Fc2123avMovieInfoProps {
    /** 影片信息对象（get123AvVideoInfo 返回值）。 */
    info: Fc2123avVideoInfo;
    /** 番号（title/id 缺失时的回退值）。 */
    carNum: string;
    /** 演员名列表（原 actorsHtml 模板拼接的源数据，由组件 map 生成 tag）。 */
    actresses: string[];
}

/** 海报容器内联样式：顶部 8px 间距。 */
const posterWrapStyle: CSSProperties = { marginTop: '8px' };

/** 海报图内联样式：最大宽度 320px。 */
const posterImgStyle: CSSProperties = { maxWidth: '320px' };

/** 主演行内联样式：顶部 8px 间距。 */
const actorsStyle: CSSProperties = { marginTop: '8px' };

/** 演员 tag 内联样式：2px 外边距（原 loadData actorsHtml 模板）。 */
const actressTagStyle: CSSProperties = { margin: '2px' };

/** #data-releaseDate 隐藏 div 内联样式。 */
const hiddenStyle: CSSProperties = { display: 'none' };

/**
 * 渲染 123Av 电影信息块的 JSX。
 * @param props.info 影片信息对象
 * @param props.carNum 番号回退值
 * @param props.actresses 演员名列表
 * @returns movie-info-container 内容 JSX，经 jsxToString 转 HTML 字符串后供
 *          `$('.movie-info-container').html(...)` 消费。
 */
export function Fc2123avMovieInfo({ info, carNum, actresses }: Fc2123avMovieInfoProps) {
    return (
        <>
            <div className="movie-title">
                <strong>{info.title || carNum}</strong>
            </div>
            <div>番号: {info.id || carNum}</div>
            <div>发布日: {info.releaseDate || ''}</div>
            {info.poster ? (
                <div style={posterWrapStyle}>
                    <img src={info.poster} style={posterImgStyle} />
                </div>
            ) : (
                ''
            )}
            <div className="movie-actors" style={actorsStyle}>
                <strong>主演: </strong>
                {actresses.length > 0
                    ? actresses.map((actress) => (
                          <span className="tag" style={actressTagStyle}>
                              {actress}
                          </span>
                      ))
                    : '未知'}
            </div>
            <div id="data-releaseDate" style={hiddenStyle}>
                {info.releaseDate || ''}
            </div>
        </>
    );
}
