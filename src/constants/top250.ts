/** 原站高级检索表单和增强榜单共用的实际承载路径。 */
export const TOP250_HOST_PATH = '/search_advanced';

/** 入口和切换筛选时从第一页开始；翻页则保留当前查询，只修改 page。 */
export function top250Href(
    handleType: 'all' | 'video_type' | 'year' = 'all',
    typeValue: string | number = '',
    hasCnsub?: string
): string {
    const query = new URLSearchParams({ handleTop: '1', handleType, type_value: String(typeValue) });
    if (hasCnsub !== undefined) query.set('has_cnsub', hasCnsub);
    return `${TOP250_HOST_PATH}?${query}`;
}
