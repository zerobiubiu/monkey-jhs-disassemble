/**
 * 通用工具类 CommonUtil（提取自 archetype/jhs.user.js L1181-1773 的 class J）
 *
 * 单例工具集合，承载 DOM 操作 / 弹窗 / 日期格式化 / 文件下载 / 剪贴板 / Cookie /
 * 排序 / 重试等通用能力。原脚本通过 `J.instance ||= this` 实现单例，外部以
 * `utils.*` 形式调用其方法。
 *
 * 重构说明（JS→TS，行为等价）：
 * - 构造函数内 `i(this,"field",val)` 私有字段赋值 → class field 语法
 * - 单字母变量语义化：e/t/n/a/i/s/o/r/l/c/d/h/g/p → url/title/event/...
 * - 全局 `$`/`layer`/`GM_openInTab`/`show`/`clog`/`storageManager`/`md5`
 *   由 src/types/globals.d.ts 声明为 any，本模块直接使用
 * - `reBuildSignature` 原调用模块级函数 O()（archetype L1082-1093）；因本任务
 *   仅新建本文件，将签名生成逻辑内联于此以保持自包含，运行时行为与 O() 一致
 * - 内联 CSS/HTML 字符串、控制流原样保留
 * - DOM 事件标注 MouseEvent / KeyboardEvent，元素参数用 any 简化
 */

/** addCookie 选项（原 addCookie 第二参数 t 的解构字段） */
interface AddCookieOptions {
    maxAge?: number;
    path?: string;
    domain?: string;
    secure?: boolean;
    sameSite?: string;
}

/** genericSort 单条排序配置（原 genericSort 内 config s） */
interface SortConfig {
    key: string | ((item: any) => any) | null;
    order?: string;
}

/** time 计时器条目（原 time 内 Map value） */
interface TimerEntry {
    startTime: number;
    unit: string;
    precision: number;
}

export class CommonUtil {
    /** 原单例引用 */
    static instance: CommonUtil | undefined;

    /** 循环探测器句柄表（原 intervalContainer） */
    intervalContainer: Record<string, ReturnType<typeof setInterval>> = {};
    /** 文件扩展名 → MIME 映射（原 mimeTypes） */
    mimeTypes: Record<string, string> = {
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
    /** time 计时器表（原 timers） */
    timers: Map<string, TimerEntry> = new Map();
    /**
     * 注入 <style> 到 head（原 insertStyle）。
     * @param css CSS 文本，不含 <style> 标签时自动包裹
     */
    insertStyle = (css: string): void => {
        if (css) {
            if (css.indexOf('<style>') === -1) {
                css = '<style>' + css + '</style>';
            }
            $('head').append(css);
        }
    };
    /** 已打开 layer 的索引栈，用于 ESC 关闭（原 layerIndexStack） */
    layerIndexStack: number[] = [];
    /** 全局 ESC keydown 处理器绑定引用（原动态赋值 _boundHandler） */
    _boundHandler: ((event: KeyboardEvent) => void) | null = null;

    /**
     * 单例构造：初始化字段并保证全局唯一实例。
     * @returns 当前唯一 CommonUtil 实例
     */
    constructor() {
        CommonUtil.instance ||= this;
        return CommonUtil.instance!;
    }

    /**
     * 动态注入 CSS/JS 资源到 documentElement（原 importResource）。
     * @param url 资源地址；含 "css" 走 link[rel=stylesheet]，否则走 script
     */
    importResource(url: string): void {
        let el: HTMLElement;
        if (url.indexOf('css') >= 0) {
            const link = document.createElement('link');
            link.setAttribute('rel', 'stylesheet');
            link.href = url;
            el = link;
        } else {
            const script = document.createElement('script');
            script.setAttribute('type', 'text/javascript');
            script.src = url;
            el = script;
        }
        document.documentElement.appendChild(el);
    }

    /**
     * 打开页面：Ctrl/Cmd+点击在新标签打开，否则用 layer iframe 弹层打开（原 openPage）。
     * @param url        目标地址
     * @param title      弹层标题
     * @param shadeClose 是否点击遮罩关闭，默认 true
     * @param event      触发事件（含 ctrlKey/metaKey 判定新标签打开）
     */
    openPage(url: string, title: string, shadeClose?: boolean, event?: MouseEvent): void {
        shadeClose = shadeClose ?? true;
        if (event && (event.ctrlKey || event.metaKey)) {
            GM_openInTab(url.includes('http') ? url : window.location.origin + url, {
                insert: 0
            });
            return;
        }
        let content = url;
        if (!url.includes('/actors/') && !url.includes('/star/')) {
            content = url.includes('?') ? `${url}&hideNav=1` : `${url}?hideNav=1`;
        }
        layer.open({
            type: 2,
            title,
            content,
            scrollbar: false,
            shadeClose,
            area: this.getResponsiveArea(['85%', '90%']),
            isOutAnim: false,
            anim: -1,
            success: (_layerEl: any, layerIdx: number) => {
                this.setupEscClose(layerIdx);
            }
        });
    }

    /**
     * 全局 ESC 关闭最上层 layer（原 _handleGlobalEscKey）。
     * 若最上层为图片预览器（.viewer-container）则不关闭，交由预览器处理。
     * @param event keydown 事件（含 key/keyCode）
     */
    _handleGlobalEscKey(event: KeyboardEvent): void {
        if (event.key !== 'Escape' && event.keyCode !== 27) {
            return;
        }
        if (this.layerIndexStack.length === 0) {
            return;
        }
        const layerIdx = this.layerIndexStack[this.layerIndexStack.length - 1];
        const layerEl = $(`#layui-layer${layerIdx}`);
        let hasViewer = false;
        if (layerEl.find('.viewer-container').length > 0) {
            hasViewer = true;
        } else {
            const iframeEl = layerEl.find(`#layui-layer-iframe${layerIdx}`)[0];
            if (iframeEl && iframeEl.contentDocument) {
                try {
                    if ($(iframeEl.contentDocument).find('.viewer-container').length > 0) {
                        hasViewer = true;
                    }
                } catch {
                    clog.warn('无法检查跨域 iframe 内的 .viewer-container');
                }
            }
        }
        if (!hasViewer) {
            this.layerIndexStack.pop();
            layer.close(layerIdx);
        }
    }

    /**
     * 为指定 layer 索引注册 ESC 关闭监听（原 setupEscClose）。
     * 绑定 document 与 iframe 内 document 的 keydown，幂等（data-esc-bound 标记）。
     * @param layerIdx layer.open 返回的索引
     */
    setupEscClose(layerIdx: number): void {
        if (!this._boundHandler) {
            this._boundHandler = this._handleGlobalEscKey.bind(this);
            $(document).off('keydown.globalLayerEsc');
            $(document).on('keydown.globalLayerEsc', this._boundHandler);
        }
        if (this.layerIndexStack.indexOf(layerIdx) === -1) {
            this.layerIndexStack.push(layerIdx);
        }
        const iframeEl = $(`#layui-layer-iframe${layerIdx}`);
        const eventNamespace = `keydown.layerEsc${layerIdx}`;
        try {
            const doc = iframeEl[0]?.contentDocument;
            if (doc) {
                if (iframeEl.attr('data-esc-bound') === 'yes') {
                    return;
                }
                $(doc).off(eventNamespace);
                $(doc).on(eventNamespace, this._boundHandler);
                iframeEl.attr('data-esc-bound', 'yes');
            }
        } catch (err) {
            clog.error('iframe监听失败 (跨域或未加载完毕):', err);
        }
    }

    /**
     * 在 iframe 子页面中关闭自身 layer 弹层（原 closePage）。
     * 依据设置 needClosePage 决定是否执行：恢复父页滚动、移除遮罩/弹层 DOM、window.close。
     */
    closePage(): void {
        storageManager.getSetting('needClosePage', 'yes').then((setting: any) => {
            if (setting !== 'yes') {
                return;
            }
            parent.document.documentElement.style.overflow = 'auto';
            ['.layui-layer-shade', '.layui-layer-move', '.layui-layer'].forEach(
                (selector: string) => {
                    const matches = parent.document.querySelectorAll(selector);
                    if (matches.length > 0) {
                        const el = matches.length > 1 ? matches[matches.length - 1] : matches[0];
                        el.parentNode!.removeChild(el);
                    }
                }
            );
            window.close();
        });
    }

    /**
     * 轮询探测器：每隔 intervalMs 检查 checkFn，命中或超时后回调（原 loopDetector）。
     * @param checkFn       命中条件，返回 true 即完成
     * @param onSuccess     完成回调
     * @param intervalMs    轮询间隔，默认 20ms
     * @param timeoutMs     超时阈值，默认 10000ms
     * @param callOnTimeout 超时是否触发 onSuccess，默认 true
     */
    loopDetector(
        checkFn: () => boolean,
        onSuccess: () => void,
        intervalMs: number = 20,
        timeoutMs: number = 10000,
        callOnTimeout: boolean = true
    ): void {
        const token = String(Math.random());
        const startTime = new Date().getTime();
        const finish = (triggered: boolean) => {
            clearInterval(this.intervalContainer[token]);
            if (triggered && onSuccess) {
                onSuccess();
            }
            delete this.intervalContainer[token];
        };
        this.intervalContainer[token] = setInterval(() => {
            const elapsed = new Date().getTime() - startTime;
            if (checkFn()) {
                finish(true);
            } else if (elapsed >= timeoutMs) {
                finish(callOnTimeout);
            }
        }, intervalMs);
    }

    /**
     * 委托式右键菜单：在 container 上监听 contextmenu，命中 targetSelector 才回调（原 rightClick）。
     * @param container      容器选择器或 HTMLElement，无效时回退 document.body
     * @param targetSelector 命中目标选择器（必填）
     * @param handler        命中回调 (event, target)
     */
    rightClick(
        container: string | HTMLElement,
        targetSelector: string,
        handler: (event: MouseEvent, target: any) => void
    ): void {
        let el: any;
        if (typeof container === 'string') {
            el = document.querySelector(container);
        } else if (container instanceof HTMLElement) {
            el = container;
        }
        if (!el) {
            console.warn('rightClick(), 容器无效或未提供，将使用 document.body 进行全局委托。');
            el = document.body;
        }
        if (typeof targetSelector === 'string' && targetSelector.trim() !== '') {
            el.addEventListener('contextmenu', (event: MouseEvent) => {
                const target = (event.target as HTMLElement).closest(targetSelector);
                if (target) {
                    handler(event, target);
                }
            });
        } else {
            console.error('rightClick(), 必须提供有效的 targetSelector。');
        }
    }

    /**
     * 在指定位置弹出确认框（原 q）。
     * @param event     触发事件，提供时按鼠标位置定位；null 时居中
     * @param content   提示内容
     * @param onConfirm 确定回调
     * @param onCancel  取消回调
     */
    q(
        event: MouseEvent | null,
        content: string,
        onConfirm?: () => void,
        onCancel?: () => void
    ): void {
        let left: number;
        let top: number;
        if (event) {
            left = event.clientX - 130;
            top = event.clientY - 120;
        } else {
            left = window.innerWidth / 2 - 120;
            top = window.innerHeight / 2 - 120;
        }
        let layerIdx = layer.confirm(
            content,
            {
                offset: [top, left],
                title: '提示',
                btn: ['确定', '取消'],
                shade: 0,
                zIndex: 999999991
            },
            function () {
                if (onConfirm) {
                    onConfirm();
                }
                layer.close(layerIdx);
            },
            function () {
                if (onCancel) {
                    onCancel();
                }
            }
        );
    }

    /**
     * 取当前时间格式化字符串（原 getNowStr）。
     * @param dateSep   日期分隔符，默认 "-"
     * @param timeSep   时间分隔符，默认 ":"
     * @param timestamp 毫秒时间戳；提供则格式化该时间，否则当前时间
     * @returns "YYYY-MM-DD HH:mm:ss" 形式字符串
     */
    getNowStr(
        dateSep: string = '-',
        timeSep: string = ':',
        timestamp: number | null = null
    ): string {
        const date = timestamp ? new Date(timestamp) : new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${[year, month, day].join(dateSep)} ${[hours, minutes, seconds].join(timeSep)}`;
    }

    /**
     * 格式化日期为字符串（原 formatDate）。
     * @param input   Date 对象或日期字符串
     * @param dateSep 日期分隔符，默认 "-"
     * @param timeSep 时间分隔符，默认 ":"
     * @returns "YYYY-MM-DD HH:mm:ss" 形式字符串
     * @throws 输入非 Date/字符串或字符串无法解析时抛 Error
     */
    formatDate(input: Date | string, dateSep: string = '-', timeSep: string = ':'): string {
        let date: Date;
        if (input instanceof Date) {
            date = input;
        } else {
            if (typeof input !== 'string') {
                throw new Error('Invalid date input: must be Date object or date string');
            }
            date = new Date(input);
            if (isNaN(date.getTime())) {
                throw new Error('Invalid date string');
            }
        }
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${[year, month, day].join(dateSep)} ${[hours, minutes, seconds].join(timeSep)}`;
    }

    /**
     * 计算两个时间相差的整小时数（原 getHourDifference）。
     * @param start 起始时间
     * @param end   结束时间
     * @returns 向下取整的小时差
     */
    getHourDifference(start: Date, end: Date): number {
        const startMs = start.getTime();
        const endMs = end.getTime();
        const hours = Math.abs(endMs - startMs) / 3600000;
        return Math.floor(hours);
    }

    /**
     * 判断给定时间距现在是否不足指定小时数（原 isUnnecessaryCheck，用于"无需检查"判定）。
     * @param timeStr           可被 new Date 解析的时间字符串
     * @param checkIntervalTime 检查间隔（小时），字符串或数字
     * @returns true 表示仍在间隔内、无需检查
     * @throws 未传入 checkIntervalTime 抛 Error
     */
    isUnnecessaryCheck(timeStr: string, checkIntervalTime: string | number): boolean {
        if (!checkIntervalTime) {
            throw new Error('未传入checkIntervalTime');
        }
        const hours = parseInt(String(checkIntervalTime), 10);
        return this.getHourDifference(new Date(timeStr), new Date()) < hours;
    }

    /**
     * 下载 Blob/ArrayBuffer/ArrayBufferView/data-URL/字符串为指定文件名（原 download）。
     * @param data     数据源（Blob / ArrayBuffer / TypedArray / data:URL 字符串 / 普通字符串）
     * @param filename 下载文件名（用于推断 MIME 与 a.download）
     */
    download(data: any, filename: string): void {
        show.info('开始请求下载...');
        const ext = filename.split('.').pop()!.toLowerCase();
        const mimeType = this.mimeTypes[ext] || 'application/octet-stream';
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

    /**
     * 平滑滚动到顶部（原 smoothScrollToTop）。
     * @param duration 动画时长，默认 500ms
     * @returns 滚动完成的 Promise
     */
    smoothScrollToTop(duration: number = 500): Promise<void> {
        return new Promise<void>((resolve) => {
            const startTime = performance.now();
            const startY = window.pageYOffset;
            window.requestAnimationFrame(function step(now: number) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased =
                    progress < 0.5
                        ? progress * 4 * progress * progress
                        : 1 - Math.pow(progress * -2 + 2, 3) / 2;
                window.scrollTo(0, startY * (1 - eased));
                if (progress < 1) {
                    window.requestAnimationFrame(step);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 生成简易唯一 ID（原 simpleId）：crypto.randomUUID() 去掉首个 "-"。
     * @returns 无连字符的 UUID 字符串
     */
    simpleId(): string {
        return crypto.randomUUID().replace('-', '');
    }

    /**
     * 判断字符串是否为合法 URL（原 isUrl）。
     * @param str 待检测字符串
     * @returns 可被 new URL 解析则 true
     */
    isUrl(str: string): boolean {
        try {
            new URL(str);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * 在当前地址上设置/更新查询参数并 pushState（原 setHrefParam）。
     * @param key   参数名
     * @param value 参数值
     */
    setHrefParam(key: string, value: string): void {
        const url = new URL(window.location.href);
        url.searchParams.set(key, value);
        window.history.pushState({}, '', url.toString());
    }

    /**
     * 从 URL 字符串中提取指定查询参数（原 getUrlParam）。
     * @param url   含查询串的 URL
     * @param param 参数名
     * @returns 解析值：布尔 / 数字 / 字符串；无查询或无匹配返回 null/空串
     */
    getUrlParam(url: string, param: string): string | number | boolean | null {
        const query = url.split('?')[1];
        if (!query) {
            return null;
        }
        const regex = new RegExp(`(?:^|&)${param}=([^&]*)`);
        const match = query.match(regex);
        let value = '';
        if (match && match[1]) {
            value = decodeURIComponent(match[1].replace(/\+/g, ' '));
        }
        if (value) {
            if (value === 'true' || value === 'false') {
                return value.toLowerCase() === 'true';
            } else if (typeof value !== 'string' || value.trim() === '' || isNaN(Number(value))) {
                return value;
            } else {
                return Number(value);
            }
        } else {
            return value;
        }
    }

    /**
     * 重建并返回站点签名（原 reBuildSignature，内联自模块级函数 O() L1082-1093）。
     * 20 秒内复用 localStorage 缓存的签名，过期则基于时间戳与 md5 重新生成。
     * @returns 签名字符串（缓存未命中时可能为 null）
     */
    reBuildSignature(): string | null {
        const tsKey = 'jhs_review_ts';
        const signKey = 'jhs_review_sign';
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec - (Number(localStorage.getItem(tsKey)) || 0) <= 20) {
            return localStorage.getItem(signKey);
        }
        const sign = `${nowSec}.lpw6vgqzsp.${md5(`${nowSec}71cf27bb3c0bcdf207b64abecddc970098c7421ee7203b9cdae54478478a199e7d5a6e1a57691123c1a931c057842fb73ba3b3c83bcd69c17ccf174081e3d8aa`)}`;
        localStorage.setItem(tsKey, String(nowSec));
        localStorage.setItem(signKey, sign);
        return sign;
    }

    /**
     * 依据视口宽度返回 layer 弹层尺寸（原 getResponsiveArea）。
     * @param area 自定义 [宽,高]，仅在宽屏(>=1200)生效
     * @returns 形如 ["85%","90%"] 的尺寸数组
     */
    getResponsiveArea(area?: string[]): string[] {
        const width = window.innerWidth;
        if (width >= 1200) {
            return area || this.getDefaultArea();
        } else if (width >= 768) {
            return ['70%', '90%'];
        } else {
            return ['95%', '95%'];
        }
    }

    /**
     * 默认弹层尺寸（原 getDefaultArea）。
     * @returns ["85%","90%"]
     */
    getDefaultArea(): string[] {
        return ['85%', '90%'];
    }

    /**
     * 判断是否移动端 UA（原 isMobile）。
     * @returns 命中任一移动端关键字则 true
     */
    isMobile(): boolean {
        const ua = navigator.userAgent.toLowerCase();
        return [
            'iphone',
            'ipod',
            'ipad',
            'android',
            'blackberry',
            'windows phone',
            'nokia',
            'webos',
            'opera mini',
            'mobile',
            'mobi',
            'tablet'
        ].some((keyword) => ua.includes(keyword));
    }

    /**
     * 复制文本到剪贴板并提示（原 copyToClipboard）。
     * @param label 提示用的标签名
     * @param text  待复制文本
     */
    copyToClipboard(label: string, text: string): void {
        navigator.clipboard
            .writeText(text)
            .then(() => show.info(`${label}已复制到剪切板, ${text}`))
            .catch((err) => console.error('复制失败: ', err));
    }

    /**
     * 将 HTML 字符串解析为 jQuery 包装的文档（原 htmlTo$dom）。
     * @param html HTML 字符串
     * @returns $(DOMParser 解析的 Document)，类型 any
     */
    htmlTo$dom(html: string): any {
        const parser = new DOMParser();
        return $(parser.parseFromString(html, 'text/html'));
    }

    /**
     * 批量写入 cookie（原 addCookie）：按 ";" 拆分多组键值，附加 max-age/path 等。
     * @param cookieStr 形如 "k1=v1; k2=v2" 的 cookie 字符串
     * @param options   maxAge/path/domain/secure/sameSite 选项
     */
    addCookie(cookieStr: string, options: AddCookieOptions = {}): void {
        const {
            maxAge = 604800,
            path = '/',
            domain = '',
            secure = false,
            sameSite = 'Lax'
        } = options;
        cookieStr.split(';').forEach((pair: string) => {
            const trimmed = pair.trim();
            if (trimmed) {
                const parts = trimmed.split('=');
                if (parts.length >= 2 && parts[0].trim()) {
                    const segments: string[] = [`${parts[0].trim()}=${parts.slice(1).join('=')}`];
                    if (maxAge > 0) {
                        segments.push(`max-age=${maxAge}`);
                    }
                    segments.push(`path=${path}`);
                    if (domain) {
                        segments.push(`domain=${domain}`);
                    }
                    if (secure) {
                        segments.push('Secure');
                    }
                    if (sameSite) {
                        segments.push(`SameSite=${sameSite}`);
                    }
                    console.log("document.cookie = '" + segments.join('; ') + "'");
                    document.cookie = segments.join('; ');
                }
            }
        });
    }

    /**
     * 判断元素是否隐藏（原 isHidden）：jQuery 或 DOM 元素，零尺寸或 display:none 视为隐藏。
     * @param el jQuery 对象或 HTMLElement
     * @returns 隐藏则 true
     */
    isHidden(el: any): boolean {
        const node = el.jquery ? el[0] : el;
        return (
            !node ||
            (node.offsetWidth <= 0 && node.offsetHeight <= 0) ||
            window.getComputedStyle(node).display === 'none'
        );
    }

    /**
     * 计时器：首次调用以 label 开始计时，二次调用返回耗时字符串（原 time）。
     * @param label     计时标签，默认 "default"
     * @param unit      单位 "s" 秒 / 其他毫秒，默认 "s"
     * @param precision 小数精度，默认 2
     * @returns 二次调用返回 "{label}: {x}秒/毫秒"；首次调用返回 undefined
     */
    time(label: string = 'default', unit: string = 's', precision: number = 2): string | undefined {
        if (this.timers.has(label)) {
            const entry = this.timers.get(label)!;
            const elapsed = performance.now() - entry.startTime;
            let formatted: string;
            let unitLabel: string;
            if (entry.unit === 's') {
                formatted = (elapsed / 1000).toFixed(entry.precision);
                unitLabel = '秒';
            } else {
                formatted = elapsed.toFixed(entry.precision);
                unitLabel = '毫秒';
            }
            this.timers.delete(label);
            return `${label}: ${formatted}${unitLabel}`;
        }
        this.timers.set(label, {
            startTime: performance.now(),
            unit,
            precision
        });
    }

    /**
     * 延时等待（原 sleep）。
     * @param ms 毫秒，默认 1000
     * @returns 超时后 resolve 的 Promise
     */
    sleep(ms: number = 1000): Promise<void> {
        return new Promise<void>((resolve) => setTimeout(resolve, ms));
    }

    /**
     * 通用多键排序（原 genericSort）：支持函数/字符串 key、升降序、日期识别。
     * @param data        待排序数组
     * @param sortConfigs 排序配置数组（key + order）
     * @param nullsFirst  空值处理开关，默认 true（保留原控制流）
     * @returns 排序后的新数组（不修改原数组）
     */
    genericSort(data: any[], sortConfigs: SortConfig[], nullsFirst: boolean = true): any[] {
        if (!Array.isArray(data) || data.length === 0) {
            return [];
        }
        if (!Array.isArray(sortConfigs) || sortConfigs.length === 0) {
            return [...data];
        }
        const items = [...data];
        const coerceDate = (value: any): any => {
            if (value instanceof Date) {
                return value;
            }
            if (typeof value === 'string') {
                const parsed = new Date(value);
                if (!isNaN(parsed.getTime())) {
                    return parsed;
                }
            }
            return value;
        };
        return items.sort((itemA: any, itemB: any) => {
            for (const config of sortConfigs) {
                const { key, order = 'asc' } = config;
                let valA: any = itemA;
                let valB: any = itemB;
                if (key != null) {
                    if (typeof key === 'function') {
                        valA = key(itemA);
                        valB = key(itemB);
                    } else {
                        valA = itemA && typeof itemA === 'object' ? itemA[key] : undefined;
                        valB = itemB && typeof itemB === 'object' ? itemB[key] : undefined;
                    }
                }
                const coercedA = coerceDate(valA);
                const coercedB = coerceDate(valB);
                let cmp = 0;
                const aIsNull = valA == null;
                const bIsNull = valB == null;
                if (aIsNull && bIsNull) {
                    return 0;
                }
                if (aIsNull) {
                    if (nullsFirst) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
                if (bIsNull) {
                    if (nullsFirst) {
                        return 1;
                    } else {
                        return -1;
                    }
                }
                cmp =
                    coercedA instanceof Date && coercedB instanceof Date
                        ? coercedA.getTime() - coercedB.getTime()
                        : typeof valA === 'number' && typeof valB === 'number'
                          ? valA - valB
                          : typeof valA === 'string' && typeof valB === 'string'
                            ? valA.localeCompare(valB)
                            : String(valA).localeCompare(String(valB));
                if (order === 'desc') {
                    cmp *= -1;
                }
                if (cmp !== 0) {
                    return cmp;
                }
            }
            return 0;
        });
    }

    /**
     * 带重试的异步执行（原 retry）：遇 "Just a moment"/"重定向"/"404 not found" 立即抛出，
     * 其余错误重试至 maxRetries 次。
     * @param fn         待执行函数（可返回值或 Promise）
     * @param maxRetries 最大重试次数，默认 3
     * @returns 成功则返回 fn 的结果；最终失败则抛出
     * @throws 命中致命错误或达到最大重试次数时抛出原错误
     */
    async retry<T>(fn: () => T | Promise<T>, maxRetries: number = 3): Promise<T | undefined> {
        let attempt = 0;
        while (attempt < maxRetries) {
            try {
                const result = await fn();
                if (attempt > 0) {
                    clog.debug(`[重试] 请求成功，共发起 ${attempt + 1} 次。`);
                }
                return result;
            } catch (err) {
                const msg = String(err);
                if (
                    msg.includes('Just a moment') ||
                    msg.includes('重定向') ||
                    msg.toLowerCase().includes('404 not found')
                ) {
                    throw err;
                }
                attempt++;
                if (attempt === maxRetries) {
                    clog.debug(`[重试] 达到最大重试次数 (${maxRetries})，最终失败：`, err);
                    throw err;
                }
                clog.debug(`[重试] 请求失败，准备第 ${attempt + 1} 次重试, 错误信息: ${msg}`);
            }
        }
    }
}
