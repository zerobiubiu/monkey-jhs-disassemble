/**
 * 多引擎磁链聚合 MagnetHubPlugin（U9A9 / U3C3 / Sukebei）。
 *
 * 内联 HTML 字面量已全部组件化（doc/16-jsx-to-string.md 零 HTML 字符串
 * 硬编码要求）：
 * - 骨架容器（container/tabs/results）→ MagnetHubContainers 三组件；
 * - 引擎标签 → MagnetHubTab；「原网页」链接 → MagnetHubTargetLink；
 * - 加载/错误/无结果状态 → MagnetHubLoading / MagnetHubError；
 * - 结果卡片 → 既有 MagnetResultCard（前轮提取，未改动）。
 * 均经 jsxToString 转 HTML 字符串后供 jQuery `$()` / `.html()` / `.append()`
 * 消费。initCss 原返回的 `<style>` 字符串已提取为 src/styles/magnet-hub-plugin.css
 * （?raw 导入）：utils.insertStyle 对不含 `<style>` 的文本自动包裹注入 head，
 * 注入目标与原实现同为 head（全局作用域），渲染等价。
 */
import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import {
    MagnetHubContainer,
    MagnetHubResults,
    MagnetHubTabs
} from '../components/magnet-hub/magnet-hub-containers';
import { MagnetHubError, MagnetHubLoading } from '../components/magnet-hub/magnet-hub-status';
import { MagnetHubTab } from '../components/magnet-hub/magnet-hub-tab';
import { MagnetHubTargetLink } from '../components/magnet-hub/magnet-hub-target-link';
import { MagnetResultCard } from '../components/magnet-hub/magnet-result-card';

import magnetHubCssRaw from '../styles/magnet-hub-plugin.css?raw';

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

export class MagnetHubPlugin extends BasePlugin {
    currentEngine: MagnetEngine | null = null;
    private _searchSeq = 0;
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
        return magnetHubCssRaw;
    }

    createMagnetHub(keyword: string): any {
        if (!featureFlags.magnetHubPlugin) {
            return $(
                jsxToString(<MagnetHubError message="磁力聚合未启用" />)
            );
        }
        keyword = keyword.replace('FC2-', '');
        const $container = $(jsxToString(<MagnetHubContainer />));
        const $tabs = $(jsxToString(<MagnetHubTabs />));
        const key = 'jhs_magnetHub_selectedEngine';
        const savedEngineId = localStorage.getItem(key);
        let defaultEngineIndex = 0;
        const $tabBox = $(document.createElement('div')).css('display', 'flex');
        this.searchEngines.forEach((engine, index) => {
            const $tab = $(
                jsxToString(<MagnetHubTab engineId={engine.id} engineName={engine.name} />)
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
            jsxToString(
                <MagnetHubTargetLink
                    href={engine.targetPage.replace('{keyword}', encodeURIComponent(keyword))}
                />
            )
        );
        $container.append($tabs);
        const $resultsContainer = $(jsxToString(<MagnetHubResults />));
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
        const seq = ++this._searchSeq;
        $container.html(
            jsxToString(<MagnetHubLoading engineName={engine.name} keyword={keyword} />)
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
                timeout: 15000,
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
                        if (seq !== this._searchSeq) return;
                        this.displayResults($container, results, engine.name);
                    } catch (e: any) {
                        $container.html(
                            jsxToString(
                                <MagnetHubError
                                    message={`解析 ${engine.name} 结果失败: ${e.message}`}
                                />
                            )
                        );
                    }
                },
                onerror: (error: any) => {
                    if (seq !== this._searchSeq) return;
                    $container.html(
                        jsxToString(
                            <MagnetHubError
                                message={`从 ${engine.name} 获取数据失败: ${error.statusText || '网络错误'}`}
                            />
                        )
                    );
                },
                ontimeout: () => {
                    if (seq !== this._searchSeq) return;
                    $container.html(
                        jsxToString(
                            <MagnetHubError message={`从 ${engine.name} 获取数据超时`} />
                        )
                    );
                }
            });
        }
    }

    displayResults($container: any, results: MagnetResult[], _engineName: string): void {
        $container.empty();
        if (results.length === 0) {
            $container.append(jsxToString(<MagnetHubError message="没有找到相关结果" />));
            return;
        }
        results.forEach((result) => {
            const $result = $(
                jsxToString(
                    <MagnetResultCard
                        magnet={result.magnet}
                        title={result.title}
                        size={result.size || '未知'}
                        date={result.date || '未知'}
                    />
                )
            );
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
