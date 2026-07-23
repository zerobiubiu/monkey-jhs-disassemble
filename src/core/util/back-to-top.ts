/**
 * 回到顶部按钮工厂（提取自 list-waterfall-plugin 的 createBackToTopBtn / updateBackToTopBtn）。
 *
 * 创建固定右下角的回到顶部按钮，滚动超过阈值时淡入显示，点击平滑回顶。
 * 使用 requestAnimationFrame 节流滚动监听，避免卡顿。
 */

import { scrollTopIconHtml } from '../../components/misc/scroll-top-icon';

/** createBackToTopButton 的选项。 */
export interface BackToTopOptions {
    /** 按钮 DOM id，默认 "jdb-wf-back-to-top"。 */
    selector?: string;
    /** 显示阈值（滚动像素），默认 300。 */
    threshold?: number;
}

/**
 * 创建回到顶部按钮并绑定滚动显隐 + 点击回顶事件。
 * @param options 可选配置
 * @returns 清理函数（移除按钮与滚动监听）
 */
export function createBackToTopButton(options?: BackToTopOptions): () => void {
    const id = options?.selector ?? 'jdb-wf-back-to-top';
    const threshold = options?.threshold ?? 300;

    // 复用已有按钮（如 SettingPlugin 的 #jhs-back-to-top）
    if (document.getElementById('jhs-back-to-top') || document.getElementById(id)) {
        return () => {};
    }

    const btn = document.createElement('div');
    btn.id = id;
    btn.title = '回到顶部';
    btn.innerHTML = scrollTopIconHtml();
    document.body.appendChild(btn);

    let ticking = false;

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(() => {
            if (window.scrollY > threshold) {
                btn.classList.add('show');
            } else {
                btn.classList.remove('show');
            }
            ticking = false;
        });
    };

    const onClick = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', onClick);

    return () => {
        window.removeEventListener('scroll', onScroll);
        btn.removeEventListener('click', onClick);
        btn.remove();
    };
}
