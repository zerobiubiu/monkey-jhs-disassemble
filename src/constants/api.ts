/**
 * API 配置常量与请求函数
 *
 * 与原始脚本 archetype/jhs.user.js L1081-1180 顶层常量 U/O/R/V/K/W/q 一一对应。
 * legacy 通过 `import { ... as 原字母 }` 别名引入，保持内部引用不变。
 *
 * 说明：R/V/K/W 在原脚本中均为 async 请求函数（非纯配置对象），
 * 本模块保留其函数形态并语义化命名为 fetchXxx；q 内的请求头部分额外抽出为
 * DEFAULT_REQUEST_HEADERS 供复用，q 的请求逻辑保留为 fetchTopMovies。
 */

// ============ 基础配置 ============

/** API 基础地址（原 U） */
export const API_BASE: string = 'https://jdforrepam.com/api';

// ============ 签名生成（原 O） ============

/** localStorage 中存放签名时间戳的键（原 e） */
const SIGNATURE_TIME_KEY = 'jhs_review_ts';
/** localStorage 中存放签名值的键（原 t） */
const SIGNATURE_VALUE_KEY = 'jhs_review_sign';
/** 签名有效窗口（秒），窗口内复用缓存 */
const SIGNATURE_TTL_SECONDS = 20;
/** 签名命名空间片段（原 a 中的中段） */
const SIGNATURE_NAMESPACE = 'lpw6vgqzsp';
/** 签名盐（原硬编码） */
const SIGNATURE_SALT =
    '71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa';

/**
 * 生成或复用 jdSignature（原 O）
 *
 * 以秒级时间戳拼 `.<ns>.<md5(ts+salt)>` 生成签名；
 * 20 秒内复用 localStorage 缓存，避免频繁重算 md5。
 *
 * @returns 当前的 jdSignature 字符串
 */
export function reBuildSignature(): string {
    const now = Math.floor(Date.now() / 1000);
    const cachedTs = Number(localStorage.getItem(SIGNATURE_TIME_KEY) || 0);
    if (now - cachedTs <= SIGNATURE_TTL_SECONDS) {
        return localStorage.getItem(SIGNATURE_VALUE_KEY) as string;
    }
    const sig = `${now}.${SIGNATURE_NAMESPACE}.${md5(`${now}${SIGNATURE_SALT}`)}`;
    localStorage.setItem(SIGNATURE_TIME_KEY, String(now));
    localStorage.setItem(SIGNATURE_VALUE_KEY, sig);
    return sig;
}

// ============ 响应类型 ============

/** 电影详情（原 V 返回结构） */
export interface MovieDetail {
    movieId: any;
    actors: any;
    duration: any;
    title: any;
    carNum: any;
    score: any;
    releaseDate: any;
    watchedCount: any;
    imgList: string[];
}

/** 相关合集项（原 K 返回结构） */
export interface RelatedCollection {
    relatedId: any;
    name: any;
    movieCount: any;
    collectionCount: any;
    viewCount: any;
    createTime: any;
}

/** 默认请求头（原 q 内 headers 对象） */
export interface RequestHeaders {
    'user-agent': string;
    'accept-language': string;
    host: string;
    authorization: string;
    jdsignature: string;
}

// ============ 请求函数 ============

/**
 * 获取电影评论列表（原 R）
 *
 * @param movieId 电影 ID（原 e）
 * @param page 页码，默认 1（原 t）
 * @param limit 每页条数，默认 20（原 n）
 * @returns 评论数组（gmHttp 返回的 data.reviews）
 */
export async function fetchMovieReviews(
    movieId: string | number,
    page: number = 1,
    limit: number = 20
): Promise<any> {
    const url = `${API_BASE}/v1/movies/${movieId}/reviews`;
    const headers = { jdSignature: await reBuildSignature() };
    return (
        await gmHttp.get(
            url,
            {
                page,
                sort_by: 'hotly',
                limit
            },
            headers
        )
    ).data.reviews;
}

/**
 * 获取电影详情（原 V）
 *
 * @param movieId 电影 ID（原 e）
 * @returns 结构化的电影详情
 */
export async function fetchMovieDetail(movieId: string | number): Promise<MovieDetail> {
    const url = `${API_BASE}/v4/movies/${movieId}`;
    const headers = { jdSignature: await reBuildSignature() };
    const resp = await gmHttp.get(url, null, headers);
    if (!resp.data) {
        show.error('获取视频详情失败: ' + resp.message);
        throw new Error(resp.message);
    }
    const movie = resp.data.movie;
    const imgList: string[] = [];
    movie.preview_images.forEach((img: any) => {
        imgList.push(
            img.large_url.replace('https://tp-iu.cmastd.com/rhe951l4q', 'https://c0.jdbstatic.com')
        );
    });
    return {
        movieId: movie.id,
        actors: movie.actors,
        duration: movie.duration,
        title: movie.origin_title,
        carNum: movie.number,
        score: movie.score,
        releaseDate: movie.release_date,
        watchedCount: movie.watched_count,
        imgList
    };
}

/**
 * 获取相关合集列表（原 K）
 *
 * @param movieId 电影 ID（原 e）
 * @param page 页码，默认 1（原 t）
 * @param limit 每页条数，默认 20（原 n）
 * @returns 相关合集数组
 */
export async function fetchRelatedCollections(
    movieId: string | number,
    page: number = 1,
    limit: number = 20
): Promise<RelatedCollection[]> {
    const url = `${API_BASE}/v1/lists/related?movie_id=${movieId}&page=${page}&limit=${limit}`;
    const headers = { jdSignature: await reBuildSignature() };
    const resp = await gmHttp.get(url, null, headers);
    const list: RelatedCollection[] = [];
    resp.data.lists.forEach((item: any) => {
        list.push({
            relatedId: item.id,
            name: item.name,
            movieCount: item.movies_count,
            collectionCount: item.collections_count,
            viewCount: item.views_count,
            createTime: utils.formatDate(item.created_at)
        });
    });
    return list;
}

/**
 * 获取播放排行（原 W）
 *
 * @param period 时间段，默认 'daily'（原 e）
 * @param filterBy 过滤方式，默认 'high_score'（原 t）
 * @returns 电影数组（gmHttp 返回的 data.movies）
 */
export async function fetchPlaybackRanking(
    period: string = 'daily',
    filterBy: string = 'high_score'
): Promise<any> {
    const url = `${API_BASE}/v1/rankings/playback?period=${period}&filter_by=${filterBy}`;
    const headers = { jdSignature: await reBuildSignature() };
    return (await gmHttp.get(url, null, headers)).data.movies;
}

// ============ 默认请求头与 Top 排行（原 q） ============

/** localStorage 中 app 授权令牌的键 */
const APP_AUTH_KEY = 'jhs_appAuthorization';

/**
 * 构建默认请求头（原 q 内的 headers 部分）
 *
 * 因含动态字段（authorization 取 localStorage、jdsignature 由 reBuildSignature 生成），
 * 无法做成纯静态常量，故以 async builder 函数形式导出。host 固定为 jdforrepam.com。
 *
 * @returns 完整的请求头对象
 */
export async function DEFAULT_REQUEST_HEADERS(): Promise<RequestHeaders> {
    return {
        'user-agent': 'Dart/3.5 (dart:io)',
        'accept-language': 'zh-TW',
        host: 'jdforrepam.com',
        authorization: 'Bearer ' + (localStorage.getItem(APP_AUTH_KEY) as string),
        jdsignature: await reBuildSignature()
    };
}

/**
 * 获取 movies/top 排行（原 q 函数体）
 *
 * @param type 类型，默认 'all'（原 e）
 * @param typeValue 类型值，默认 ''（原 t）
 * @param page 页码，默认 1（原 n）
 * @param limit 每页条数，默认 40（原 a）
 * @returns gmHttp 返回的原始响应
 */
export async function fetchTopMovies(
    type: string = 'all',
    typeValue: string = '',
    page: number = 1,
    limit: number = 40
): Promise<any> {
    const url = `${API_BASE}/v1/movies/top?start_rank=1&type=${type}&type_value=${typeValue}&ignore_watched=false&page=${page}&limit=${limit}`;
    const headers = await DEFAULT_REQUEST_HEADERS();
    return await gmHttp.get(url, null, headers);
}
