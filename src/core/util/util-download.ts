/**
 * 文件下载工具（提取自 CommonUtil）。
 * 依赖全局 show（toast 提示）。
 */

/** 文件扩展名 → MIME 映射（原 mimeTypes） */
export const MIME_TYPES: Record<string, string> = {
    txt: 'text/plain',
    html: 'text/html',
    css: 'text/css',
    csv: 'text/csv',
    json: 'application/json',
    xml: 'application/xml',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
    rar: 'application/x-rar-compressed',
    '7z': 'application/x-7z-compressed',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    mp4: 'video/mp4',
    webm: 'video/webm',
    ogg: 'audio/ogg'
};

/**
 * 下载 Blob/ArrayBuffer/ArrayBufferView/data-URL/字符串为指定文件名（原 download）。
 * @param data     数据源（Blob / ArrayBuffer / TypedArray / data:URL 字符串 / 普通字符串）
 * @param filename 下载文件名（用于推断 MIME 与 a.download）
 */
export function download(data: BlobPart, filename: string): void {
    show.info('开始请求下载...');
    const ext = filename.split('.').pop()!.toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    let blob: Blob;
    if (data instanceof Blob) {
        blob = data;
    } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
        // TS6: ArrayBuffer.isView 类型谓词收窄为 ArrayBufferView<ArrayBufferLike>，
        // 与 BlobPart 不兼容；运行时原行为即直接交给 Blob 构造，故断言为 BlobPart。
        blob = new Blob([data as unknown as BlobPart], { type: mimeType });
    } else if (typeof data === 'string' && data.startsWith('data:')) {
        const raw = atob(data.split(',')[1]);
        const buf = new ArrayBuffer(raw.length);
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < raw.length; i++) {
            bytes[i] = raw.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: mimeType });
    } else {
        blob = new Blob([data], { type: mimeType });
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    }, 100);
}
