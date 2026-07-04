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
                name: '鉴黄师（test）',
                namespace: 'zerobiubiu.top',
                version: '1.0.0',
                author: 'zerobiubiu',
                license: 'MIT',
                description:
                    'Jav-鉴黄师 收藏、屏蔽; 屏蔽标签、屏蔽演员、同步收藏演员、新作品检测; 免VIP查看热播、Top250排行榜、Fc2ppv、可查看所有评论信息、相关清单; 支持云盘备份; 以图识图; 字幕搜索; JavDb|JavBus',
                homepageURL: 'https://github.com/zerobiubiu/javdb-tools',
                icon: 'https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png',
                match: ['https://javdb.com/*'],
                include: ['https://javdb*.com/*'],
                'run-at': 'document-idle',
                connect: ['xunlei.com', 'missav.live', 'javdb.com', 'supjav.com', '127.0.0.1', '*'],
                // 仅保留非 npm 的 GreasyFork 脚本；其余 7 库（jquery/tabulator/layer/
                // md5/toastify/localforage/viewer）已 ESM import 打包进产物（src/core/libs.ts），
                // qrcodejs 全项目未使用，直接移除。
                require: [
                    'https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js'
                ],
                grant: [
                    'GM_xmlhttpRequest',
                    'GM_openInTab',
                    'GM_setValue',
                    'GM_addValueChangeListener',
                    'unsafeWindow'
                ]
            }
        })
    ]
});
