/**
 * 以图识图 ImageRecognitionPlugin（Google / Lens / Yandex）。
 *
 * 内联 HTML 字面量已全部组件化（doc/16-jsx-to-string.md 零 HTML 字符串
 * 硬编码要求）：renderSiteButtons 的站点按钮模板 → ImageRecognitionSiteButton，
 * 公网 URL 缺失提示 → ImageRecognitionHint，均经 jsxToString 转 HTML 字符串
 * 后供 `$container.append()` 消费。initCss 原返回的 `<style>` 字符串已提取
 * 为 src/styles/image-recognition-plugin.css（?raw 导入）：utils.insertStyle
 * 对不含 `<style>` 的文本自动包裹注入 head，注入目标与原实现同为 head
 * （全局作用域），渲染等价。
 */
import { featureFlags } from '../core/feature-flags';
import { jsxToString } from '../core/jsx-to-string';

import { BasePlugin } from './base-plugin';

import { ImageRecognitionDialog } from '../components/image-recognition/image-recognition-dialog';
import { ImageRecognitionHint } from '../components/image-recognition/image-recognition-hint';
import { ImageRecognitionSiteButton } from '../components/image-recognition/image-recognition-site-button';

import imageRecognitionCssRaw from '../styles/image-recognition-plugin.css?raw';

interface SearchSite {
    name: string;
    url: string;
    ico: string;
}

export class ImageRecognitionPlugin extends BasePlugin {
    siteList: SearchSite[] = [
        {
            name: 'Google旧版',
            url: 'https://www.google.com/searchbyimage?image_url={placeholder}&client=firefox-b-d',
            ico: 'https://www.google.com/favicon.ico'
        },
        {
            name: 'Google',
            url: 'https://lens.google.com/uploadbyurl?url={placeholder}',
            ico: 'https://www.google.com/favicon.ico'
        },
        {
            name: 'Yandex',
            url: 'https://yandex.ru/images/search?rpt=imageview&url={placeholder}',
            ico: 'https://yandex.ru/favicon.ico'
        }
    ];
    isUploading = false;
    currentImageUrl: string | null = null;

    getName(): string {
        return 'ImageRecognitionPlugin';
    }

    async initCss(): Promise<string> {
        return imageRecognitionCssRaw;
    }

    open(onOpenFun?: () => void): void {
        if (!featureFlags.imageRecognitionPlugin) return;
        layer.open({
            type: 1,
            title: '以图识图',
            content: jsxToString(<ImageRecognitionDialog />),
            area: utils.isMobile() ? utils.getResponsiveArea() : ['40%', '80%'],
            success: async () => {
                this.initEventListeners();
                onOpenFun?.();
            },
            end: () => {
                $(document).off('paste.searchImg');
            }
        });
    }

    initEventListeners(): void {
        const $uploadArea = $('#upload-area');
        const $fileInput = $('#image-file');
        const $selectBtn = $('#select-image-btn');
        const $previewArea = $('#preview-area');
        const $previewImage = $('#preview-image');
        const $searchImage = $('#handle-btn');
        const $cancelBtn = $('#cancel-btn');
        const $searchResults = $('#search-results');
        const $siteBtnsContainer = $('#search-img-site-btns-container');

        $uploadArea
            .on('dragover', (e: Event) => {
                e.preventDefault();
                $uploadArea.addClass('highlight');
            })
            .on('dragleave', () => $uploadArea.removeClass('highlight'))
            .on('drop', (e: Event) => {
                e.preventDefault();
                $uploadArea.removeClass('highlight');
                // jQuery wraps native events; originalEvent is always present on jQuery event objects
                const jqDropEvent = e as unknown as { originalEvent?: DragEvent };
                const files = jqDropEvent.originalEvent?.dataTransfer?.files;
                if (files?.[0]) this.handleImageFile(files[0]);
            });
        $selectBtn.on('click', () => $fileInput.trigger('click'));
        $fileInput.on('change', (e: Event) => {
            const files = (e.target as HTMLInputElement).files;
            if (files?.[0]) this.handleImageFile(files[0]);
        });
        $(document).on('paste.searchImg', async (e: Event) => {
            // jQuery wraps native events; originalEvent is always present on jQuery event objects
            const jqPasteEvent = e as unknown as { originalEvent?: ClipboardEvent };
            const clipData = jqPasteEvent.originalEvent?.clipboardData;
            const items = clipData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) this.handleImageFile(file);
                    return;
                }
            }
            const text = clipData?.getData('text');
            if (text && /^https?:\/\//.test(text)) {
                this.currentImageUrl = text;
                $previewImage.attr('src', text);
                $uploadArea.hide();
                $previewArea.show();
            }
        });
        $searchImage.on('click', async () => {
            if (!this.currentImageUrl) {
                show.error('请先选择图片');
                return;
            }
            await this.searchByImage(this.currentImageUrl);
            $searchResults.show();
            this.renderSiteButtons($siteBtnsContainer);
        });
        $cancelBtn.on('click', () => {
            this.currentImageUrl = null;
            $previewArea.hide();
            $uploadArea.show();
            $searchResults.hide();
            $fileInput.val('');
        });
        $('#openAll').on('click', () => {
            this.siteList.forEach((site) => {
                if (this.currentImageUrl) {
                    window.open(
                        site.url.replace('{placeholder}', encodeURIComponent(this.currentImageUrl!)),
                        '_blank'
                    );
                }
            });
        });
    }

    handleImageFile(file: File): void {
        const reader = new FileReader();
        reader.onload = (e: ProgressEvent<FileReader>) => {
            const dataUrl = e.target!.result as string;
            this.currentImageUrl = dataUrl;
            $('#preview-image').attr('src', dataUrl);
            $('#upload-area').hide();
            $('#preview-area').show();
            // 自动搜索（base64 需先上传）
            this.searchByImage(dataUrl).then(() => {
                $('#search-results').show();
                this.renderSiteButtons($('#search-img-site-btns-container'));
            });
        };
        reader.readAsDataURL(file);
    }

    async searchByImage(imageSrc: string): Promise<void> {
        if (this.isUploading) return;
        // 已是公网 URL 直接用
        if (/^https?:\/\//.test(imageSrc) && !imageSrc.startsWith('data:')) {
            this.currentImageUrl = imageSrc;
            return;
        }
        this.isUploading = true;
        try {
            // Imgur 匿名上传
            const base64 = imageSrc.replace(/^data:image\/\w+;base64,/, '');
            const resp = await new Promise<{ data?: { link?: string } }>((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.imgur.com/3/image',
                    headers: {
                        Authorization: 'Client-ID d70305e7c3ac5c6',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ image: base64, type: 'base64' }),
                    onload: (r: { responseText: string }) => {
                        try {
                            resolve(JSON.parse(r.responseText));
                        } catch (err) {
                            reject(err);
                        }
                    },
                    onerror: reject
                });
            });
            if (resp?.data?.link) {
                this.currentImageUrl = resp.data.link;
            } else {
                show.error('图片上传失败');
            }
        } catch (e) {
            clog.error(e);
            show.error('图片上传失败: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            this.isUploading = false;
        }
    }

    renderSiteButtons($container: JQuery): void {
        $container.empty();
        if (!this.currentImageUrl || this.currentImageUrl.startsWith('data:')) {
            $container.append(jsxToString(<ImageRecognitionHint />));
            return;
        }
        this.siteList.forEach((site) => {
            const href = site.url.replace(
                '{placeholder}',
                encodeURIComponent(this.currentImageUrl!)
            );
            $container.append(
                jsxToString(
                    <ImageRecognitionSiteButton href={href} icon={site.ico} name={site.name} />
                )
            );
        });
    }
}
