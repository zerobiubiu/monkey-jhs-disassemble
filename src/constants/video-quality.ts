/**
 * 视频画质选项（原 L）
 *
 * 用于详情页预览视频画质选择，对应原脚本顶层的 L 数组。
 */

export interface VideoQualityOption {
    id: string;
    quality: string;
    text: string;
    canSelect: boolean;
}

export const VIDEO_QUALITY_LIST: VideoQualityOption[] = [
    {
        id: 'video-mhb',
        quality: 'dmb_w',
        text: '旧视频源-中画质宽版 (404p)',
        canSelect: false,
    },
    {
        id: 'video-mhb',
        quality: 'sm_s',
        text: '旧视频源-低画质 (240p)',
        canSelect: false,
    },
    {
        id: 'video-mhb',
        quality: 'dm_s',
        text: '旧视频源-中画质 (360p)',
        canSelect: false,
    },
    {
        id: 'video-mhb',
        quality: 'dmb_s',
        text: '旧视频源-中画质 (480p)',
        canSelect: false,
    },
    {
        id: 'video-mhb',
        quality: 'mhb_w',
        text: '旧视频源-高画质宽版 (404p)',
        canSelect: false,
    },
    {
        id: 'video-mmb',
        quality: 'mmb',
        text: '中画质 (432p)',
        canSelect: true,
    },
    {
        id: 'video-mhb',
        quality: 'mhb',
        text: '高画质 (576p)',
        canSelect: true,
    },
    {
        id: 'video-hmb',
        quality: 'hmb',
        text: 'HD (720p)',
        canSelect: true,
    },
    {
        id: 'video-hhb',
        quality: 'hhb',
        text: 'FullHD (1080p)',
        canSelect: true,
    },
    {
        id: 'video-hhbs',
        quality: 'hhbs',
        text: 'FullHD (1080p60fps)',
        canSelect: true,
    },
    {
        id: 'video-4k',
        quality: '4k',
        text: '4K (2160p)',
        canSelect: true,
    },
    {
        id: 'video-4ks',
        quality: '4ks',
        text: '4K (2160p60fps)',
        canSelect: true,
    },
];
