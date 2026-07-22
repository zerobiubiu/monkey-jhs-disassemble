/**
 * 多引擎磁链聚合 MagnetHubPlugin（U9A9 / U3C3 / Sukebei）。
 */
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';

interface MagnetEngine {
    name: string;
    id: string;
    url: string;
    targetPage: string;
    parseHtml?: (this: MagnetHubPlugin, html: string, keyword: string) => MagnetResult[];
}

interface MagnetResult {
    title: string;
    magnet: string;
    size?: string;
    date?: string;
}

/** 仅允许标准 BitTorrent info-hash 磁链进入 href/剪贴板。 */
function safeMagnetUrl(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw.toLowerCase().startsWith('magnet:?')) return null;
    try {
        const parsed = new URL(raw);
        if (parsed.protocol !== 'magnet:') return null;
        const exactTopic = parsed.searchParams.get('xt') ?? '';
        const match = /^urn:btih:([a-f\d]{40}|[a-z2-7]{32}|[a-f\d]{64})$/i.exec(exactTopic);
        return match ? parsed.href : null;
    } catch {
        return null;
    }
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (error && typeof error === 'object' && 'statusText' in error) {
        const statusText = String((error as { statusText?: unknown }).statusText ?? '');
        if (statusText) return statusText;
    }
    return fallback;
}

export class MagnetHubPlugin extends BasePlugin {
    currentEngine: MagnetEngine | null = null;
    searchEngines: MagnetEngine[] = [
        {
            name: 'U9A9',
            id: 'u9a9',
            url: 'https://u9a9.com/?type=2&search={keyword}',
            targetPage: 'https://u9a9.com/?type=2&search={keyword}',
            parseHtml: this.parseU3C3
        },
        {
            name: 'U3C3',
            id: 'u3c3',
            url: 'https://u3c3.com/?search2=a8lr16lo&search={keyword}',
            targetPage: 'https://u3c3.com/?search2=a8lr16lo&search={keyword}',
            parseHtml: this.parseU3C3
        },
        {
            name: 'Sukebei',
            id: 'Sukebei',
            url: 'https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}',
            targetPage: 'https://sukebei.nyaa.si/?f=0&c=0_0&q={keyword}',
            parseHtml: this.parseSukebei
        }
    ];

    getName(): string {
        return 'MagnetHubPlugin';
    }

    async initCss(): Promise<string> {
        return `
            <style>
                .magnet-container { margin: 20px auto; width: 100%; font-family: Arial, sans-serif; }
                .magnet-tabs { display: flex; border-bottom: 1px solid #ddd; margin-bottom: 15px; justify-content: space-between; }
                .magnet-tab { padding: 5px 12px; cursor: pointer; border: 1px solid transparent; border-bottom: none; margin-right: 5px; background: #f5f5f5; border-radius: 5px 5px 0 0; }
                .magnet-tab.active { background: #fff; border-color: #ddd; border-bottom: 1px solid #fff; margin-bottom: -1px; font-weight: bold; }
                .magnet-tab:hover:not(.active) { background: #e9e9e9; }
                .magnet-results { min-height: 200px; }
                .magnet-result { padding: 15px; border-bottom: 1px solid #eee; position: relative; }
                .magnet-result:hover { background-color: #f9f9f9; }
                .magnet-title { font-weight: bold; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 80px; }
                .magnet-info { display: flex; justify-content: space-between; color: #666; font-size: 13px; }
                .magnet-copy { position: absolute; right: 15px; top: 15px; }
                .magnet-hub-btn { padding: 4px 10px; margin-left: 4px; cursor: pointer; border: 1px solid #ddd; border-radius: 3px; background: #f5f5f5; }
                .magnet-hub-btn.copied { background: #4caf50; color: #fff; }
                .magnet-loading, .magnet-error { padding: 20px; text-align: center; color: #666; }
                .magnet-error { color: #c00; }
            </style>
        `;
    }

    createMagnetHub(keyword: string): any {
        if (!featureFlags.magnetHubPlugin) {
            return $('<div class="magnet-container">磁力聚合未启用</div>');
        }
        keyword = keyword.replace('FC2-', '');
        const $container = $('<div class="magnet-container"></div>');
        const $tabs = $('<div class="magnet-tabs"></div>');
        const key = 'jhs_magnetHub_selectedEngine';
        const savedEngineId = localStorage.getItem(key);
        let defaultEngineIndex = 0;
        const $tabBox = $('<div style="display: flex;"></div>');
        this.searchEngines.forEach((engine, index) => {
            const $tab = $(
                `<div class="magnet-tab" data-engine="${engine.id}">${engine.name}</div>`
            );
            if (savedEngineId && engine.id === savedEngineId) {
                $tab.addClass('active');
                this.currentEngine = engine;
                defaultEngineIndex = index;
            } else if (index === 0 && !savedEngineId) {
                $tab.addClass('active');
                this.currentEngine = engine;
            }
            $tabBox.append($tab);
        });
        $tabs.append($tabBox);
        const engine = this.currentEngine || this.searchEngines[0];
        $tabs.append(
            `<a style="margin-right: 20px;margin-top:3px" id="targetBox" href="${engine.targetPage.replace('{keyword}', encodeURIComponent(keyword))}" target="_blank">原网页</a>`
        );
        $container.append($tabs);
        const $resultsContainer = $('<div class="magnet-results"></div>');
        $container.append($resultsContainer);
        $container.on('click', '.magnet-tab', (e: any) => {
            const engineId = $(e.target).data('engine');
            this.currentEngine =
                this.searchEngines.find((eng) => eng.id === engineId) || null;
            if (this.currentEngine) {
                $('#targetBox').attr(
                    'href',
                    this.currentEngine.targetPage.replace(
                        '{keyword}',
                        encodeURIComponent(keyword)
                    )
                );
                localStorage.setItem(key, engineId);
                $container.find('.magnet-tab').removeClass('active');
                $(e.target).addClass('active');
                this.searchEngine($resultsContainer, this.currentEngine, keyword);
            }
        });
        this.searchEngine(
            $resultsContainer,
            this.currentEngine || this.searchEngines[defaultEngineIndex],
            keyword
        );
        return $container;
    }

    searchEngine($container: any, engine: MagnetEngine, keyword: string): void {
        $container.empty().append(
            $('<div class="magnet-loading"></div>').text(
                `正在从 ${engine.name} 搜索 "${keyword}"...`
            )
        );
        const cacheKey = `${engine.name}_${keyword}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
            try {
                this.displayResults($container, JSON.parse(cached), engine.name);
                return;
            } catch {
                /* fallthrough */
            }
        }
        const url = engine.url.replace('{keyword}', encodeURIComponent(keyword));
        if (engine.parseHtml) {
            GM_xmlhttpRequest({
                method: 'GET',
                url,
                onload: (response: any) => {
                    try {
                        const results = engine.parseHtml!.call(
                            this,
                            response.responseText,
                            keyword
                        );
                        if (results.length > 0) {
                            sessionStorage.setItem(cacheKey, JSON.stringify(results));
                        }
                        this.displayResults($container, results, engine.name);
                    } catch (error: unknown) {
                        $container.empty().append(
                            $('<div class="magnet-error"></div>').text(
                                `解析 ${engine.name} 结果失败: ${getErrorMessage(error, '未知错误')}`
                            )
                        );
                    }
                },
                onerror: (error: unknown) => {
                    $container.empty().append(
                        $('<div class="magnet-error"></div>').text(
                            `从 ${engine.name} 获取数据失败: ${getErrorMessage(error, '网络错误')}`
                        )
                    );
                }
            });
        }
    }

    displayResults($container: any, results: MagnetResult[], _engineName: string): void {
        $container.empty();
        if (results.length === 0) {
            $container.append('<div class="magnet-error">没有找到相关结果</div>');
            return;
        }
        results.forEach((result) => {
            const magnet = safeMagnetUrl(result.magnet);
            if (!magnet) return;
            const $result = $('<div class="magnet-result"></div>');
            const $title = $('<div class="magnet-title"></div>').append(
                $('<a></a>').attr('href', magnet).text(String(result.title ?? ''))
            );
            const $info = $('<div class="magnet-info"></div>')
                .append($('<span></span>').text(`大小: ${result.size || '未知'}`))
                .append($('<span></span>').text(`日期: ${result.date || '未知'}`));
            const $copy = $('<div class="magnet-copy"></div>').append(
                $('<button class="magnet-hub-btn copy-btn" type="button">复制链接</button>').attr(
                    'data-magnet',
                    magnet
                )
            );
            $result.append($title, $info, $copy);
            $container.append($result);
        });
        $container.on('click', '.copy-btn', function (this: any) {
            const $btn = $(this);
            const magnet = $btn.data('magnet');
            const showCopied = () => {
                const originalText = $btn.text();
                $btn.addClass('copied').text('已复制');
                setTimeout(() => {
                    $btn.removeClass('copied').text(originalText);
                }, 2000);
            };
            if (navigator.clipboard) {
                navigator.clipboard.writeText(magnet).then(showCopied).catch(() => {
                    utils.copyToClipboard('磁链', magnet);
                    showCopied();
                });
            } else {
                utils.copyToClipboard('磁链', magnet);
                showCopied();
            }
        });
    }

    parseU3C3(html: string, keyword: string): MagnetResult[] {
        const $dom = utils.htmlTo$dom(html);
        const results: MagnetResult[] = [];
        $dom.find('.torrent-list tbody tr').each((_i: number, el: any) => {
            const $el = $(el);
            if ($el.text().includes('置顶')) return;
            const title =
                $el.find('td:nth-child(2) a').attr('title') ||
                $el.find('td:nth-child(2) a').text().trim();
            if (!title.toLowerCase().includes(keyword.toLowerCase())) return;
            const magnet = $el.find("td:nth-child(3) a[href^='magnet:']").attr('href');
            const size = $el.find('td:nth-child(4)').text().trim();
            const date = $el.find('td:nth-child(5)').text().trim();
            if (magnet) {
                results.push({ title, magnet, size, date });
            }
        });
        return results;
    }

    parseSukebei(html: string, keyword: string): MagnetResult[] {
        return this.parseU3C3(html, keyword);
    }
}
