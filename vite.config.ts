import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

// https://vitejs.dev/config/
export default defineConfig({
    css: {
        // layui-layer/layer.css 含 IE6/7 hack（*display/*zoom/_display），lightningcss
        // 严格模式会报 "Unexpected token Semicolon"；开启 errorRecovery 容错 strip
        // 这些非标准声明并打印警告（build 仍成功）。modern 浏览器无需 IE hack，
        // strip 后渲染零影响。警告无害仅视觉刷屏；esbuild minify 同样报 css-syntax-error
        // 警告且产物更大，不采用。
        lightningcss: {
            errorRecovery: true
        }
    },
    plugins: [
        react(),
        monkey({
            entry: 'src/main.tsx',
            userscript: {
                name: 'JavDB Power Tools',
                namespace: 'zerobiubiu.top',
                version: '1.9.4',
                author: 'zerobiubiu',
                copyright: '2024-2026 zerobiubiu (https://github.com/zerobiubiu) — 基于 JAV-JHS 3.3.6 (MIT) 二次开发',
                license: 'MIT',
                description:
                    'JavDB/MissAV 双站增强工具箱：收藏管理、状态标签、屏蔽过滤、跨站同步、热播/Top250榜单、新作品检测、预告片、字幕搜索、WebDav云备份、演员信息、清单管理、快捷键、截图墙、磁链聚合、以图识图等功能插件',
                homepageURL: 'https://github.com/zerobiubiu/javdb-tools',
                icon: 'https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png',
                match: ['https://javdb.com/*', 'https://missav.ws/*', 'https://missav.live/*'],
                include: ['https://javdb*.com/*', 'https://missav*.ws/*', 'https://missav*.live/*'],
                'run-at': 'document-idle',
                connect: [
                    'xunlei.com',
                    'missav.live',
                    'javdb.com',
                    'supjav.com',
                    '127.0.0.1',
                    'javstore.net',
                    'u9a9.com',
                    'u3c3.com',
                    'sukebei.nyaa.si',
                    'btsow.lol',
                    'imgur.com',
                    'api.imgur.com',
                    'lens.google.com',
                    'yandex.ru',
                    'translate-pa.googleapis.com',
                    '123av.com',
                    'fc2ppvdb.com',
                    'adult.contents.fc2.com',
                    '*'
                ],
                // @require 已全部移除：原 9 个 CDN 库中 7 库（jquery/tabulator/layer/
                // md5/toastify/localforage/viewer）已 ESM import 打包进产物（src/core/libs.ts），
                // qrcodejs 全项目未使用，parallel_GM_xmlhttpRequest 的 GreasyFork URL
                // 已失效（410 Gone），原生 GM_xmlhttpRequest 已足够（rating-net 有自带限流器）。
                grant: [
                    'GM_xmlhttpRequest',
                    'GM_openInTab',
                    'GM_setValue',
                    'GM_getValue',
                    'GM_addValueChangeListener',
                    'GM_registerMenuCommand',
                    'unsafeWindow'
                ]
            }
        })
    ]
});
