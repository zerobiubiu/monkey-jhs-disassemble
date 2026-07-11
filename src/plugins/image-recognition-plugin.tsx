/**
 * 以图识图 ImageRecognitionPlugin（Google / Lens / Yandex）。
 */
import { featureFlags } from '../core/feature-flags';
import { BasePlugin } from './base-plugin';

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
        return `
            <style>
                #upload-area {
                    border: 2px dashed #85af68; border-radius: 8px; padding: 40px;
                    text-align: center; margin-bottom: 20px; transition: all 0.3s;
                    background-color: #f9f9f9;
                }
                #upload-area:hover { border-color: #76b947; background-color: #f0f0f0; }
                #upload-area.highlight { border-color: #2196F3; background-color: #e3f2fd; }
                #select-image-btn {
                    background-color: #4CAF50; color: white; border: none;
                    padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 16px;
                }
                #handle-btn, #cancel-btn {
                    padding: 8px 16px; border-radius: 4px; cursor: pointer;
                    font-size: 14px; border: none;
                }
                #handle-btn { background-color: #2196F3; color: white; }
                #cancel-btn { background-color: #f44336; color: white; }
                .search-img-site-btns-container {
                    display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px;
                }
                .search-img-site-btn {
                    display: flex; align-items: center; padding: 8px 12px;
                    background-color: #f5f5f5; border-radius: 4px; text-decoration: none;
                    color: #333; font-size: 14px; border: 1px solid #ddd;
                }
                .search-img-site-btn img { width: 16px; height: 16px; margin-right: 6px; }
            </style>
        `;
    }

    open(onOpenFun?: () => void): void {
        if (!featureFlags.imageRecognitionPlugin) return;
        layer.open({
            type: 1,
            title: '以图识图',
            content: `
            <div style="padding: 20px">
                <div id="upload-area">
                    <div style="color: #555;margin-bottom: 15px;">
                        <p>拖拽图片到此处 或 点击按钮选择图片</p>
                        <p>也可以直接 Ctrl+V 粘贴图片 / 图片URL</p>
                    </div>
                    <button id="select-image-btn">选择图片</button>
                    <input type="file" style="display: none" id="image-file" accept="image/*">
                </div>
                <div id="preview-area" style="margin-bottom: 20px; text-align: center; display: none;">
                    <img id="preview-image" alt="" src="" style="max-width: 100%; max-height: 300px; border-radius: 4px;">
                    <div style="margin-top: 15px; display: flex; justify-content: center; gap: 10px;" id="action-btns">
                        <button id="handle-btn">搜索图片</button>
                        <button id="cancel-btn">取消</button>
                    </div>
                    <div id="search-results" style="display: none;">
                        <p style="margin: 20px auto">请选择识图网站：<a id="openAll" style="cursor: pointer">全部打开</a></p>
                        <div class="search-img-site-btns-container" id="search-img-site-btns-container"></div>
                    </div>
                </div>
            </div>
            `,
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
            .on('dragover', (e: any) => {
                e.preventDefault();
                $uploadArea.addClass('highlight');
            })
            .on('dragleave', () => $uploadArea.removeClass('highlight'))
            .on('drop', (e: any) => {
                e.preventDefault();
                $uploadArea.removeClass('highlight');
                const files = e.originalEvent?.dataTransfer?.files;
                if (files?.[0]) this.handleImageFile(files[0]);
            });
        $selectBtn.on('click', () => $fileInput.trigger('click'));
        $fileInput.on('change', (e: any) => {
            if (e.target.files?.[0]) this.handleImageFile(e.target.files[0]);
        });
        $(document).on('paste.searchImg', async (e: any) => {
            const items = e.originalEvent?.clipboardData?.items;
            if (!items) return;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') !== -1) {
                    const file = items[i].getAsFile();
                    if (file) this.handleImageFile(file);
                    return;
                }
            }
            const text = e.originalEvent?.clipboardData?.getData('text');
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
        reader.onload = (e: any) => {
            const dataUrl = e.target.result as string;
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
            const resp: any = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://api.imgur.com/3/image',
                    headers: {
                        Authorization: 'Client-ID d70305e7c3ac5c6',
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({ image: base64, type: 'base64' }),
                    onload: (r: any) => {
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
            console.error(e);
            show.error('图片上传失败: ' + e);
        } finally {
            this.isUploading = false;
        }
    }

    renderSiteButtons($container: any): void {
        $container.empty();
        if (!this.currentImageUrl || this.currentImageUrl.startsWith('data:')) {
            $container.append('<p style="color:#c00">图片尚未获得公网 URL，请重试搜索</p>');
            return;
        }
        this.siteList.forEach((site) => {
            const href = site.url.replace(
                '{placeholder}',
                encodeURIComponent(this.currentImageUrl!)
            );
            $container.append(`
                <a class="search-img-site-btn" href="${href}" target="_blank">
                    <img src="${site.ico}" alt=""><span>${site.name}</span>
                </a>
            `);
        });
    }
}
