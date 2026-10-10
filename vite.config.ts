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
                version: '1.48.6',
                                author: 'zerobiubiu',
                copyright: '2024-2026 zerobiubiu (https://github.com/zerobiubiu) — 基于 JAV-JHS 3.3.6 (MIT) 二次开发',
                license: 'MIT',
                description:
                    'JavDB/MissAV 双站增强工具箱：收藏管理、状态标签、屏蔽过滤、跨站同步、热播/Top250榜单、新作品检测、预告片、字幕搜索、WebDav/Git云备份、演员信息、清单管理、截图墙、磁链聚合、以图识图等功能插件',
                homepageURL: 'https://github.com/zerobiubiu/monkey-jhs-disassemble',
                icon: 'https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png',
                match: ['https://javdb.com/*', 'https://missav.ws/*', 'https://missav.live/*', 'https://missav.ai/*'],
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
                // @require 由下方 build.externalGlobals 自动生成：7 库（jquery/tabulator/
                // layer/md5/toastify/localforage/viewer）JS 不打包，改从 CDN 运行时注入
                //（见 doc/239，反转 doc/24 的 ESM 打包方案）。qrcodejs 全项目未使用，
                // parallel_GM_xmlhttpRequest 的 GreasyFork URL 已失效（410 Gone），均不引入。
                // 库 CSS（layer/toastify/viewer/tabulator）仍由 src/core/libs.ts 打包进产物。
                grant: [
                    'GM_xmlhttpRequest',
                    'GM_openInTab',
                    'GM_setValue',
                    'GM_getValue',
                    'GM_addValueChangeListener',
                    'GM_registerMenuCommand',
                    'GM_info',
                    'unsafeWindow'
                ]
            },
            build: {
                // 7 库 JS 不打包：映射模块名 → [CDN 全局变量名, @require URL]
                //（externalGlobals 自动把 URL 写入 userscript 头部 @require）。
                // 版本与原始 archetype/jhs.user.js 一致；tabulator-tables 6.5.2 /
                // viewerjs 1.11.8 为 doc/241 升级，jquery 4.0.0 为 doc/242 升级
                //（layer 兼容已 jsdom 实测 + 回归测试锁定）。
                // 注意：Tabulator 的 CDN 全局本身就是完整版（含全部模块），
                // libs.ts 须用默认导入（命名导入会生成 Tabulator.TabulatorFull 访问）。
                externalGlobals: {
                    jquery: ['$', 'https://cdn.jsdelivr.net/npm/jquery@4.0.0/dist/jquery.min.js'],
                    'tabulator-tables': [
                        'Tabulator',
                        'https://cdn.jsdelivr.net/npm/tabulator-tables@6.5.2/dist/js/tabulator.min.js'
                    ],
                    'layui-layer': ['layer', 'https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js'],
                    'blueimp-md5': ['md5', 'https://cdn.jsdelivr.net/npm/blueimp-md5@2.19.0/js/md5.min.js'],
                    'toastify-js': ['Toastify', 'https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js'],
                    localforage: ['localforage', 'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js'],
                    viewerjs: ['Viewer', 'https://cdn.jsdelivr.net/npm/viewerjs@1.11.8/dist/viewer.min.js']
                }
            }
        })
    ]
});
