/**
 * Fc2MovieDetail —— FC2 详情弹窗电影信息块（React 函数组件，JSX）。
 *
 * 提取自 src/plugins/fc2-plugin.tsx 的 handleMovieDetail（L247-270 的
 * `$('.movie-info-container').html(...)` 模板字符串）：
 *   - h3.movie-title > strong.current-title 标题（回退「无标题」）
 *   - 第一行 movie-meta：番号 / 年份 / 评分 / 时长（各自回退「未知」「无」）
 *   - 第二行 movie-meta：站点跳转（fc2ppvdb / fc2电子市场，href 由 carNum
 *     去 `FC2-` 前缀拼接）
 *   - movie-actors > actor-list：主演列表（actor-tag 链接由 actors 数组
 *     map 生成；空数组回退「暂无演员信息」no-data span）
 *   - movie-gallery > image-list：剧照（fancybox 链接由 imgList map 生成，
 *     data-caption 序号 = idx+1；空列表回退「暂无剧照」no-data div）
 *   - #data-releaseDate 隐藏 div（saveCar 时读取发布日期）
 *
 * 保留原 class/id/内联 style 原样不动。演员/剧照子块以条件渲染替代原
 * `actorsHtml` / `imagesHtml` 字符串拼接，输出等价；演员名/标题等文本经
 * jsxToString escapeText 转义（原模板为裸插值，转义后对含 `&<>` 的标题
 * 更安全，jQuery .html() 解析后 DOM 文本一致）。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 handleMovieDetail 中
 * `$('.movie-info-container').html(...)` 消费：
 *   `$('.movie-info-container').html(jsxToString(<Fc2MovieDetail detail={detail} />))`
 * #data-actress 回填（女優名拼接）仍由 handleMovieDetail 持有，组件只负责
 * 静态结构。
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString`（src/core/jsx-to-string，仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）渲染为 HTML 字符串。
 */
import type { CSSProperties } from 'react';

/** 演员条目（原 detail.actors 数组元素）。 */
export interface Fc2MovieActor {
    /** 演员页路径 id（原 actor.id，拼入 /actors/<id> 链接）。 */
    id: string | number;
    /** 演员名（原 actor.name）。 */
    name: string;
}

/** 电影详情对象（fetchMovieDetail 返回值，本组件消费字段）。 */
export interface Fc2MovieDetailData {
    /** 标题（回退「无标题」）。 */
    title?: string;
    /** 番号（回退「未知」，去 FC2- 前缀后拼站点链接）。 */
    carNum?: string;
    /** 发行日期（回退「未知」）。 */
    releaseDate?: string;
    /** 评分（回退「无」）。 */
    score?: string | number;
    /** 时长（分钟，渲染为 `<duration> m`）。 */
    duration?: string | number;
}

/** Fc2MovieDetail 的属性。 */
export interface Fc2MovieDetailProps {
    /** 电影详情对象（fetchMovieDetail 返回值）。 */
    detail: Fc2MovieDetailData;
    /** 演员列表（原 `detail.actors || []`，由调用方传入）。 */
    actors: Fc2MovieActor[];
    /** 剧照 URL 列表（原 `detail.imgList || []`，由调用方传入）。 */
    imgList: string[];
}

/** 剧照容器内联样式：顶部 10px 间距。 */
const galleryStyle: CSSProperties = { marginTop: '10px' };

/** fc2电子市场链接内联样式：左侧 5px 间距。 */
const fc2MarketStyle: CSSProperties = { marginLeft: '5px' };

/** #data-releaseDate 隐藏 div 内联样式。 */
const hiddenStyle: CSSProperties = { display: 'none' };

/**
 * 渲染 FC2 电影信息块的 JSX。
 * @param props.detail 电影详情对象（title/carNum/releaseDate/score/duration）
 * @param props.actors 演员列表
 * @param props.imgList 剧照 URL 列表
 * @returns movie-info-container 内容 JSX，经 jsxToString 转 HTML 字符串后供
 *          `$('.movie-info-container').html(...)` 消费。
 */
export function Fc2MovieDetail({ detail, actors, imgList }: Fc2MovieDetailProps) {
    const carNumWithoutPrefix = (detail.carNum || '').replace('FC2-', '');
    return (
        <>
            <h3 className="movie-title">
                <strong className="current-title">{detail.title || '无标题'}</strong>
            </h3>
            <div className="movie-meta">
                <span>
                    <strong>番号: </strong>
                    {detail.carNum || '未知'}
                </span>
                <span>
                    <strong>年份: </strong>
                    {detail.releaseDate || '未知'}
                </span>
                <span>
                    <strong>评分: </strong>
                    {detail.score || '无'}
                </span>
                <span>
                    <strong>时长: </strong>
                    {detail.duration + ' m' || '无'}
                </span>
            </div>
            <div className="movie-meta">
                <span>
                    <strong>站点: </strong>
                    <a
                        href={`https://fc2ppvdb.com/articles/${carNumWithoutPrefix}`}
                        target="_blank"
                    >
                        fc2ppvdb
                    </a>
                    <a
                        style={fc2MarketStyle}
                        href={`https://adult.contents.fc2.com/article/${carNumWithoutPrefix}/`}
                        target="_blank"
                    >
                        fc2电子市场
                    </a>
                </span>
            </div>
            <div className="movie-actors">
                <div className="actor-list">
                    <strong>主演: </strong>
                    {actors.length > 0 ? (
                        actors.map((actor) => (
                            <span className="actor-tag">
                                <a href={`/actors/${actor.id}`} target="_blank">
                                    {actor.name}
                                </a>
                            </span>
                        ))
                    ) : (
                        <span className="no-data">暂无演员信息</span>
                    )}
                </div>
            </div>
            <div className="movie-gallery" style={galleryStyle}>
                <strong>剧照: </strong>
                <div className="image-list">
                    {Array.isArray(imgList) && imgList.length > 0 ? (
                        imgList.map((img: string, idx: number) => (
                            <a
                                href={img}
                                data-fancybox="movie-gallery"
                                data-caption={`剧照 ${idx + 1}`}
                            >
                                <img src={img} className="movie-image-thumb" alt="" />
                            </a>
                        ))
                    ) : (
                        <div className="no-data">暂无剧照</div>
                    )}
                </div>
            </div>
            <div id="data-releaseDate" style={hiddenStyle}>
                {detail.releaseDate || ''}
            </div>
        </>
    );
}
