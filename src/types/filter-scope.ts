/** 同一套筛选组件在不同视频区域使用时，各自独立的 DOM 范围和挂载点。 */
export interface FilterScope {
    root: ParentNode;
    itemSelector: string;
    mount: HTMLElement;
}
