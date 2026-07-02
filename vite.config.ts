import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import monkey from "vite-plugin-monkey";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        monkey({
            entry: "src/main.tsx",
            userscript: {
                name: "鉴黄师",
                namespace: "zerobiubiu.top",
                version: "1.0.0",
                author: "zerobiubiu",
                license: "MIT",
                description:
                    "Jav-鉴黄师 收藏、屏蔽; 屏蔽标签、屏蔽演员、同步收藏演员、新作品检测; 免VIP查看热播、Top250排行榜、Fc2ppv、可查看所有评论信息、相关清单; 支持云盘备份; 以图识图; 字幕搜索; JavDb|JavBus",
                homepageURL: "https://github.com/zerobiubiu/javdb-tools",
                icon: "https://cdn.jsdelivr.net/gh/zerobiubiu/Figure-bed/b507c13a-9f4e-41b5-bbbb-129d0a21f97d.png",
                match: ["https://javdb.com/*"],
                include: ["https://javdb*.com/*"],
                runAt: "document-idle",
                connect: [
                    "xunlei.com",
                    "missav.live",
                    "javdb.com",
                    "supjav.com",
                    "127.0.0.1",
                    "*",
                ],
                require: [
                    "https://update.greasyfork.org/scripts/540597/1613170/parallel_GM_xmlhttpRequest.js",
                    "https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js",
                    "https://cdn.jsdelivr.net/npm/tabulator-tables@6.3.1/dist/js/tabulator.min.js",
                    "https://cdn.jsdelivr.net/npm/layui-layer@1.0.9/dist/layer.min.js",
                    "https://cdn.jsdelivr.net/npm/blueimp-md5@2.19.0/js/md5.min.js",
                    "https://cdn.jsdelivr.net/npm/toastify-js@1.12.0/src/toastify.min.js",
                    "https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js",
                    "https://cdn.jsdelivr.net/npm/viewerjs@1.11.1/dist/viewer.min.js",
                    "https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js",
                ],
                grant: [
                    "GM_xmlhttpRequest",
                    "GM_openInTab",
                    "GM_setValue",
                    "GM_addValueChangeListener",
                    "unsafeWindow",
                ],
            },
        }),
    ],
});
