/**
 * 预览视频工具栏构建与事件绑定（提取自 preview-video-plugin.tsx handleVideo）。
 * 对应原 L3724-3835 的工具栏部分。
 *
 * 四项职责：构建工具栏 DOM、绑定画质切换点击、绑定动作按钮点击、绑定快进。
 */
import { YES, NO } from '../../constants/status';
import { VIDEO_QUALITY_LIST } from '../../constants/video-quality';

import { jsxToString } from '../../core/jsx-to-string';

import type { PreviewVideoPlugin } from '../preview-video-plugin';
import { fetchDmmPreviewVideo } from './dmm-resolver';
import { selectAvailableVideoQuality } from './quality-selector';

import { PreviewVideoActionBtn } from '../../components/preview-video/preview-video-action-btn';
import { PreviewVideoQualityBtn } from '../../components/preview-video/preview-video-quality-btn';

/** 预览视频静音状态的 localStorage 键。对应原 L3737/3742。 */
const VIDEO_MUTED_KEY = 'jhs_videoMuted';

/**
 * 在 fancybox 内 #preview-video 出现后注入底部工具栏并绑定画质/动作按钮。
 * 对应原 L3724-3835。
 *
 * 读取/切换到 DMM 画质链接，按 VIDEO_QUALITY_LIST 渲染画质按钮（高亮当前），
 * 并注入屏蔽/收藏/快进按钮，快进/屏蔽/收藏分别委托 DetailPageButtonPlugin 的
 * speedVideo/filterOne/favoriteOne；静音状态持久化到 localStorage。
 *
 * @param plugin PreviewVideoPlugin 实例（用于 getPageInfo / getBean）。
 */
export async function buildVideoToolbar(plugin: PreviewVideoPlugin): Promise<void> {
    const $video = $('#preview-video');
    if (!$video.length) {
        return;
    }
    const $videoWrap = $video.parent();
    $videoWrap.css('position', 'relative');
    const videoEl = $video[0] as HTMLVideoElement;
    const mutedStored = localStorage.getItem(VIDEO_MUTED_KEY);
    if (mutedStored) {
        videoEl.muted = mutedStored === YES;
    }
    videoEl.addEventListener('volumechange', () => {
        localStorage.setItem(VIDEO_MUTED_KEY, videoEl.muted ? YES : NO);
    });
    videoEl.play();
    const carNum = plugin.getPageInfo().carNum as string;
    const videoMap = await fetchDmmPreviewVideo(carNum);
    const $toolbar = $('<div></div>').attr('id', 'video-bottom-toolbar').css({
        display: 'flex',
        gap: '5px',
        'align-items': 'center',
        'flex-wrap': 'wrap'
    });
    const $qualityGroup = $('<div></div>').css({
        display: 'flex',
        gap: '5px',
        'align-items': 'center'
    });
    let currentQuality: string | null = null;
    if (videoMap) {
        const desiredQuality = await storageManager.getSetting('videoQuality');
        currentQuality = selectAvailableVideoQuality(Object.keys(videoMap), desiredQuality);
        const currentUrl = videoMap[currentQuality as string];
        if ($video.attr('src') !== currentUrl) {
            $video.attr('src', currentUrl);
            videoEl.load();
            videoEl.play();
        }
        VIDEO_QUALITY_LIST.forEach((opt) => {
            const src = videoMap[opt.quality];
            if (src) {
                const isActive = currentQuality === opt.quality;
                const $btn = $(
                    jsxToString(
                        <PreviewVideoQualityBtn opt={opt} src={src} isActive={isActive} />
                    )
                );
                $qualityGroup.append($btn);
            }
        });
    }
    $toolbar.append($qualityGroup);
    const $actionGroup = $('<div></div>').css({
        display: 'flex',
        gap: '5px',
        'align-items': 'center',
        'margin-left': 'auto'
    });
    const $filterBtn = $(
        jsxToString(
            <PreviewVideoActionBtn id="video-filterBtn" color="#de3333" label="屏蔽" />
        )
    );
    $actionGroup.append($filterBtn);
    const $favoriteBtn = $(
        jsxToString(
            <PreviewVideoActionBtn id="video-favoriteBtn" color="#25b1dc" label="收藏" />
        )
    );
    $actionGroup.append($favoriteBtn);
    const $speedBtn = $(
        jsxToString(<PreviewVideoActionBtn id="speed-btn" color="#76b45d" label="快进" />)
    );
    $actionGroup.append($speedBtn);
    $toolbar.append($actionGroup);
    $videoWrap.append($toolbar);
    $toolbar.on('click', '.video-control-btn', async (event: Event) => {
        const $btn = $(event.currentTarget);
        const src = $btn.data('video-src');
        if (!$btn.hasClass('active')) {
            try {
                const currentTime = videoEl.currentTime;
                $video.attr('src', src);
                videoEl.load();
                videoEl.currentTime = currentTime;
                await videoEl.play();
                $toolbar.find('.video-control-btn').removeClass('active').css({
                    'background-color': '#fff',
                    color: 'black'
                });
                $btn.addClass('active').css({
                    'background-color': '#007bff',
                    color: 'white'
                });
            } catch (err) {
                console.error('切换画质失败:', err);
            }
        }
    });
    $('#speed-btn').on('click', () => {
        plugin.getBean('DetailPageButtonPlugin').speedVideo();
    });
    utils.rightClick(document.body, '#speed-btn', (event: MouseEvent) => {
        plugin.getBean('DetailPageButtonPlugin').filterOne(event);
    });
    $('#video-filterBtn').on('click', (event: Event) => {
        plugin.getBean('DetailPageButtonPlugin').filterOne(event as MouseEvent);
    });
    $('#video-favoriteBtn').on('click', () => {
        plugin.getBean('DetailPageButtonPlugin').favoriteOne();
    });
}
