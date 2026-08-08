/**
 * MissAV 番号归一化与状态标签渲染。
 *
 * 来源：archetype/missavStatusTag.user.js L475-588 + L618-823。
 * 在 missav.ws 页面缩略图上挂载状态标签（已收藏/已观看/已屏蔽/已下载）。
 */

import { STATUS_CONFIG } from './car-status-config';
import { sanitizeUrl } from '../../core/jsx-to-string';

/**
 * 将 missav.ws 页面上的番号归一化为 JHS 数据库中的标准格式。
 * 来源：missavStatusTag.user.js L577-588 normalizeCarNum。
 *
 * - hmn-095-uncensored-leak → HMN-095
 * - ebod-857 → EBOD-857
 * - fc2-ppv-4771232 → FC2-PPV-4771232
 * - 112325_01 → 112325-01
 *
 * @param raw 页面 a[alt] 的原始值
 * @returns 归一化后的番号（大写）
 */
export function normalizeCarNum(raw: string): string {
    if (!raw) return '';
    // 1) 取最后一段（去掉路径前缀）
    const filename = raw.split('/').pop() || '';
    // 2) FC2 系列特殊处理
    if (/^FC2-PPV-\d+$/i.test(filename)) return filename.toUpperCase();
    // 3) 按下划线或横线拆分，取前两段拼回
    const sep = filename.includes('_') ? '_' : '-';
    const parts = filename.split(sep);
    const code = parts.length >= 2 ? parts[0] + '-' + parts[1] : filename;
    return code.toUpperCase();
}

/**
 * 创建一个状态标签（<a> 元素，确保在 Alpine.js 事件层中可点击跳转）。
 * 来源：missavStatusTag.user.js L475-512 createBadge。
 *
 * @param status 状态值（favorite/hasWatch/filter/hasDown）
 * @param url 点击跳转的 javdb URL
 * @returns HTMLAnchorElement 或 null（status 未知时）
 */
export function createBadge(status: string, url: string): HTMLAnchorElement | null {
    const cfg = STATUS_CONFIG[status];
    if (!cfg) return null;

    const a = document.createElement('a');
    a.className = 'missav-status-tag';
    a.dataset.status = status;
    a.textContent = cfg.label;
    const safeUrl = sanitizeUrl(url || '');
    if (safeUrl && safeUrl !== '#') {
        a.href = safeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
    } else {
        a.removeAttribute('href');
    }
    a.title = '点击跳转到 javdb 详情页';
    a.style.cssText = [
        'border-radius:10px',
        'position:absolute',
        'z-index:10',
        'right:5px',
        'top:5px',
        'left:auto',
        '-webkit-font-smoothing:antialiased',
        'text-rendering:optimizelegibility',
        'font-family:"Helvetica Neue","Luxi Sans","DejaVu Sans",Tahoma,"Hiragino Sans GB","Microsoft Yahei",sans-serif',
        'cursor:pointer',
        'align-items:center',
        'display:inline-flex',
        'font-size:0.75rem',
        'height:2em',
        'justify-content:center',
        'line-height:1.5',
        'white-space:nowrap',
        'color:rgb(255,255,255)',
        'pointer-events:auto',
        `background-color:${cfg.color} !important`,
        'width:80px',
        'text-decoration:none'
    ].join(';');

    return a;
}

/**
 * 向容器中的每个缩略图挂载状态标签。
 * 来源：missavStatusTag.user.js L520-562 renderBadges。
 *
 * @param container 包含缩略图的父容器
 * @param carMap carNum → {status, url} 映射
 * @returns total 处理数（新增 + 状态变更）；matched 命中数
 */
export function renderBadges(
    container: HTMLElement,
    carMap: Map<string, { status: string; url: string }>
): { total: number; matched: number } {
    if (!container || carMap.size === 0) return { total: 0, matched: 0 };

    const items = container.querySelectorAll<HTMLElement>('.thumbnail.group');
    let total = 0;
    let matched = 0;

    for (const item of items) {
        // 查找带有 alt 属性的 <a> 标签获取番号
        const link = item.querySelector<HTMLAnchorElement>('a[alt]');
        if (!link) continue;

        const carNum = link.getAttribute('alt');
        if (!carNum) continue;

        // 归一化番号后查库
        const normalized = normalizeCarNum(carNum);
        const record = carMap.get(normalized);
        if (!record) continue;

        // 已有徽章且状态未变：跳过；状态变更：移除旧徽章后重建（doc/190）
        const existing = item.querySelector<HTMLElement>('.missav-status-tag');
        if (existing) {
            if (existing.dataset.status === record.status) continue;
            existing.remove();
        }
        total++;

        // 找到缩略图容器（.relative 元素，用来定位标签）
        const thumbDiv = item.querySelector<HTMLElement>('div.relative');
        if (!thumbDiv) continue;

        // 确保容器可定位（无条件设置，幂等；避免 getComputedStyle 强制同步布局）
        thumbDiv.style.position = 'relative';

        // 创建并挂载标签
        const badge = createBadge(record.status, record.url);
        if (badge) {
            thumbDiv.appendChild(badge);
            matched++;
        }
    }

    return { total, matched };
}

/**
 * 检测当前页面是否为视频播放页。
 * 来源：missavStatusTag.user.js L598-600 isVideoPage。
 * @returns 是否视频播放页
 */
export function isVideoPage(): boolean {
    return document.querySelector('#sprite-plyr') !== null;
}
