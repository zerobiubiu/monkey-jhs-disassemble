/**
 * 画质选择工具函数（提取自 preview-video-plugin.tsx）。
 * 从可用画质集合中选择最接近期望的画质。对应原 L3369-3384。
 */
import { VIDEO_QUALITY_LIST } from '../../constants/video-quality';

/**
 * 从可用画质集合中选择最接近期望的画质。对应原 L3369-3384。
 *
 * 优先返回期望画质；若不可用，按 VIDEO_QUALITY_LIST 降序找首个可用；
 * 仍无匹配则回退到首个可用画质；集合为空返回 null。
 *
 * @param available 可用画质列表（通常为 Object.keys(videoMap)）。
 * @param desired   用户期望画质（storageManager.getSetting("videoQuality")）。
 * @returns         命中的画质字符串；无任何可用画质时为 null。
 */
export const selectAvailableVideoQuality = (available: string[], desired: string): string | null => {
    if (!available || available.length === 0) {
        return null;
    }
    const availableSet = new Set(available);
    if (availableSet.has(desired)) {
        return desired;
    }
    const descending = VIDEO_QUALITY_LIST.map((opt) => opt.quality).reverse();
    for (const quality of descending) {
        if (availableSet.has(quality)) {
            return quality;
        }
    }
    return available[0];
};
