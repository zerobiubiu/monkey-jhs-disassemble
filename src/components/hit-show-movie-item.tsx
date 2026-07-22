/**
 * HitShowMovieItem —— 热播榜单单个影片卡片（React 函数组件，JSX）。
 *
 * 为 HitShowPlugin.markDataListHtml 提供：每个影片产出 `<div class="item">` 包裹
 * 封面图（替换 CDN 域名）、番号+标题、评分占位（#score_<id>）、发布日期、磁链标签
 * （含中字/含磁链/无磁链/今日新種）。调用方遍历 movies 调用本组件拼接后
 * 由 `.html(html)` 消费。
 *
 * 保留原 HTML 结构、类名（含 `cover ` 尾空格）、内联 style、三元嵌套
 * （has_cnsub / magnets_count / new_magnets）原样不动；movie 通过 prop 注入。
 * 封面 cover_url 的 CDN 域名替换使用 _updateImgServer（域名无关正则，
 * 匹配任意 host 下的 /rhe951l4q 路径 → c0.jdbstatic.com），与新版
 * jhs.3.3.6.027 行为一致，兼容 CDN 域名轮换。磁链标签的三元 HTML 改为 JSX 条件渲染
 * （`cond ? <span/> : <span/>`），输出等价；两个三元之间以 `{" "}` 保留原
 * 模板 `\n` 折叠后的单空格（DOM 等价）。`<img>` 自闭合（void element）。
 * `<strong>{number}</strong> {origin_title}` 同行保留空格。
 *
 * 渲染方式：本组件返回 JSX（React 元素）。供 markDataListHtml 循环消费时，
 * 需先用 `jsxToString`（来自 ../core/jsx-to-string，轻量 JSX→HTML
 * 字符串渲染器，不引入 react-dom/server）转为 HTML 字符串，再拼接：
 *   `movies.map(m => jsxToString(<HitShowMovieItem movie={m} />)).join("")`
 *
 * 统一规定（doc/16-jsx-to-string.md）：HTML→组件转换返回 JSX，经轻量
 * `jsxToString` 渲染为 HTML 字符串（仅类型依赖 react，零运行时依赖，不引入
 * react-dom/server）。属性值不做转义。
 */
import { _updateImgServer } from '../constants/api';


/** HitShowMovieItem 的属性（movie 为原始影片对象，字段为 any）。 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface HitShowMovieItemProps {
    /** 热播影片对象（含 id/cover_url/origin_title/number/release_date/has_cnsub/magnets_count/new_magnets）。 */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    movie: any;
}

/**
 * 渲染单个热播影片卡片的 JSX。
 * @param props.movie 影片对象
 * @returns item 卡片 JSX，经 jsxToString 转 HTML 字符串后供拼接 `.html()` 消费。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function HitShowMovieItem({ movie }: HitShowMovieItemProps) {
    return (
        <div className="item" id={movie.id}>
            <a href={`/v/${movie.id}`} className="box" title={movie.origin_title}>
                <div className="cover ">
                    <img
                        loading="lazy"
                        src={_updateImgServer(movie.cover_url || '')}
                        alt=""
                    />
                </div>
                <div className="video-title">
                    <strong>{movie.number}</strong> {movie.origin_title}
                </div>
                <div className="score" id={`score_${movie.id}`}></div>
                <div className="meta">{movie.release_date}</div>
                <div className="tags has-addons">
                    {movie.has_cnsub ? (
                        <span className="tag is-warning">含中字磁鏈</span>
                    ) : movie.magnets_count > 0 ? (
                        <span className="tag is-success">含磁鏈</span>
                    ) : (
                        <span className="tag is-info">无磁鏈</span>
                    )}{' '}
                    {movie.new_magnets ? <span className="tag is-info">今日新種</span> : null}
                </div>
            </a>
        </div>
    );
}
