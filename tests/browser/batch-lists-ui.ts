/**
 * 隔离视觉预览：使用真实清单组件、控制器和 CSS，网站/日志执行器仅用内存替身。
 * 启动：bun run tests/browser/batch-lists-ui.ts
 * 预览：http://127.0.0.1:4178/，失败态追加 ?scenario=failed，加载失败追加 ?scenario=load-error。
 * 不读取用户账户、GM 存储或浏览器配置；关闭进程即可结束。
 */
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');
const fixture = `
import { openBatchListDialog, runBatchListProgress } from '../../src/plugins/list-page/batch-lists/dialog';
import { recoverBatchListJobs } from '../../src/plugins/list-page/batch-lists/service';
import { LpBatchToolbar } from '../../src/components/list-page/lp-batch-bar';
import { jsxToString } from '../../src/core/jsx-to-string';
import { createElement } from 'react';
window.clog = { error: (...args) => console.error(...args) };
const items = Array.from({length: 5}, (_, i) => ({ carNum: 'DEMO-' + (i+1), url: '/v/demo' + i, videoId: 'demo' + i }));
document.getElementById('open').addEventListener('click', () => openBatchListDialog(items));
document.getElementById('recover').addEventListener('click', () => runBatchListProgress((notify, signal) => recoverBatchListJobs(notify, false, signal)));
document.getElementById('toolbar').innerHTML = jsxToString(createElement(LpBatchToolbar, {count:5,busy:false}));
document.getElementById('toolbar').addEventListener('click', event => { if(event.target.closest('[data-act="lists"]')) openBatchListDialog(items); });
openBatchListDialog(items);
`;
const progressCode = `
let running = false;
export const isBatchListExecutionRunning = async () => running;
export const emptyBatchListProgress = () => ({ total:0,done:0,succeeded:0,failed:0,pending:0,phase:'lists',current:'',ratingTotal:0,ratingDone:0,ratingFailed:0 });
async function execute(items, lists, checked, notify, recovered=false, signal, rating) {
    running = true;
    const p = { ...emptyBatchListProgress(), total:items.length, pending:items.length, concurrency:Math.min(2,items.length), ratingTotal:rating ? items.length : 0 };
    const pause = () => {
        const {promise, resolve} = Promise.withResolvers();
        setTimeout(resolve, 900);
        return promise;
    };
    let next = 0;
    notify({...p});
    try {
        await Promise.all(Array.from({length:p.concurrency}, async () => {
            while(next < items.length && !signal?.aborted) {
                const index = next++;
                const item = items[index];
                if(rating) {
                    p.current=item.carNum+'：确认评价'; notify({...p});
                    await pause(); p.ratingDone++; notify({...p});
                    if(signal?.aborted) return;
                }
                p.current=item.carNum+' → '+lists.map(list => list.name).join('、')+'（'+(checked ? '加入' : '移出')+'）';
                notify({...p}); await pause(); p.done++;
                if(!recovered && new URLSearchParams(location.search).get('scenario')==='failed' && index===2) p.failed++;
                else {p.succeeded++;p.pending--;}
                notify({...p});
            }
        }));
        p.phase='done'; p.stopped=signal?.aborted===true;
        p.current=p.stopped ? '已停止，未完成记录保留，等待手动继续'
            : p.pending ? '未完成视频已保留，将自动校验并继续执行' : '所选视频的评价与清单已确认完成';
        notify({...p}); return p;
    } finally { running = false; }
}
export async function startBatchListJob(items,lists,checked,notify,signal,rating) { return execute(items,lists,checked,notify,false,signal,rating); }
export async function recoverBatchListJobs(notify,force=false,signal) {
    const items=Array.from({length:5},(_,i)=>({carNum:'DEMO-'+(i+1)}));
    return execute(items,[{name:'值得复盘'},{name:'等待更新'}],true,notify,true,signal,{kind:'favorite',score:0});
}
`;
const build = await Bun.build({
    entrypoints: [import.meta.path],
    target: 'browser',
    write: false,
    plugins: [{ name: 'batch-list-isolated-preview', setup(builder) {
        builder.onLoad({ filter: /tests[\\/]browser[\\/]batch-lists-ui\.ts$/ }, () => ({ contents: fixture, loader: 'ts', resolveDir: root }));
        builder.onLoad({ filter: /batch-lists[\\/]service\.ts$/ }, () => ({ contents: progressCode, loader: 'ts' }));
        builder.onLoad({ filter: /batch-lists[\\/]journal\.ts$/ }, () => ({ contents: 'export const readBatchListJobs = () => []; export const isBatchListJobPending = () => false;', loader: 'ts' }));
        builder.onLoad({ filter: /batch-lists[\\/]site\.ts$/ }, () => ({ contents: `export async function fetchBatchListChoices() {
            if(new URLSearchParams(location.search).get('scenario')==='load-error') throw new Error('模拟未登录：请先登录网站后重试');
            return [
                {id:'1',name:'值得复盘',url:'/lists/1'},
                {id:'group:等待更新',name:'等待更新',url:'/lists/2',group:{base:'等待更新',pattern:'^(.+?)(\\\\d+)$',excludeNames:[]},members:[{id:'2',name:'等待更新1',num:1},{id:'5',name:'等待更新2',num:2},{id:'6',name:'等待更新3',num:3}]},
                {id:'3',name:'超长清单名：用于核对窄屏换行与搜索可用性'.repeat(4),url:'/lists/3'},
                {id:'4',name:'导演与系列收藏',url:'/lists/4'}
            ];
        }`, loader: 'ts' }));
        builder.onResolve({ filter: /\.css\?raw$/ }, (args) => ({ path: resolve(args.resolveDir, args.path.replace(/\?raw$/, '')), namespace: 'raw-style' }));
        builder.onLoad({ filter: /.*/, namespace: 'raw-style' }, async (args) => ({ contents: await Bun.file(args.path).text(), loader: 'text' }));
    } }]
});
if (!build.success) throw new Error(build.logs.map(String).join('\n'));
const script = await build.outputs[0].text();
const css = await Promise.all(['design-tokens.css', 'a-normal-buttons.css', 'rating-bar.css', 'list-page/lp-batch.css'].map(async (name) => {
    const file = Bun.file(resolve(root, 'src/styles', name));
    return await file.exists() ? await file.text() : '';
}));
const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 4178,
    fetch(request) {
        const url = new URL(request.url);
        if (url.pathname === '/fixture.js') return new Response(script, { headers: { 'Content-Type': 'text/javascript; charset=utf-8' } });
        return new Response(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>批量清单 · 隔离预览</title><style>${css.join('\n')}body{margin:24px;font-family:Arial,sans-serif;color:#363636;background:#f8fafc}main{max-width:980px;margin:0 auto}h1{font-size:20px}p{font-size:13px}button{font:inherit}.fixture-cards{display:flex;flex-wrap:wrap;gap:16px;margin-top:24px}.fixture-cards div{padding:24px;border:1px solid #e2e8f0;background:white}#open,#recover{margin:8px}</style></head><body><main><h1>视频流 · 批量清单隔离预览</h1><p>所有条目均为模拟数据；不会请求网站或读写用户数据。</p><button id="open" class="a-primary">打开批量视频清单</button><button id="recover" class="a-normal">预览中断恢复</button><div class="fixture-cards">${Array.from({ length: 5 }, (_, index) => `<div>已选视频 DEMO-${index + 1}</div>`).join('')}</div></main><div id="toolbar" class="jhs-lp-batch-layer"></div><script type="module" src="/fixture.js"></script></body></html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
});
console.log('批量清单隔离预览：' + server.url);
