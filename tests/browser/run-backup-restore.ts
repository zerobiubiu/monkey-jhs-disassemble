/** 一次性 Chrome 真实存储验收：隔离配置目录，结束或超时均关闭浏览器并清理测试资产。 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const executable = process.env.JHS_TEST_BROWSER || (process.platform === 'win32'
    ? path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')
    : Bun.which('chromium') || Bun.which('google-chrome'));
if (!executable || !await Bun.file(executable).exists()) throw new Error('未找到已有 Chrome/Chromium；请用 JHS_TEST_BROWSER 指定路径，本脚本不安装浏览器');
const directory = await mkdtemp(path.join(tmpdir(), 'jhs-restore-acceptance-'));
let browser: ReturnType<typeof spawn> | undefined;
let socket: WebSocket | undefined;
let exited: Promise<unknown> | undefined;
let sequence = 0;
const pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();
function send<T = Record<string, unknown>>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const id = ++sequence;
        pending.set(id, { resolve: (value) => resolve(value as T), reject });
        socket!.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
}
const safetyTimer = setTimeout(() => {
    browser?.kill();
    for (const item of pending.values()) item.reject(new Error('隔离浏览器验证超时'));
}, 60000);
try {
    const built = await Bun.build({
        entrypoints: [path.join(import.meta.dir, 'backup-restore.ts')], outdir: directory, target: 'browser',
        plugins: [{ name: '测试仅拦截刷新', setup(build) {
            build.onLoad({ filter: /(?:data-import-export|webdav-operations)\.ts$/ }, async ({ path }) => ({
                contents: (await Bun.file(path).text()).replace(/\b(?:window\.)?location\.reload\(\)/g, 'globalThis.__testReload()'), loader: 'ts'
            }));
        } }]
    });
    if (!built.success) throw new Error(built.logs.join('\n'));
    await writeFile(path.join(directory, 'probe.html'), '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><body><script type="module" src="./backup-restore.js"></script></body></html>');
    const profile = path.join(directory, 'profile');
    browser = spawn(executable, [
        '--headless', '--disable-gpu', '--disable-extensions', '--no-first-run', '--no-default-browser-check',
        '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--allow-file-access-from-files',
        `--user-data-dir=${profile}`, 'about:blank'
    ], { stdio: 'ignore' });
    exited = new Promise((resolve) => browser!.once('exit', resolve));
    let marker: string | undefined;
    for (let i = 0; i < 150; i++) {
        try { marker = await readFile(path.join(profile, 'DevToolsActivePort'), 'utf8'); break; }
        catch { await sleep(100); }
    }
    if (!marker) throw new Error('测试浏览器没有提供调试端点');
    const [port, endpoint] = marker.trim().split(/\r?\n/);
    socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
    await new Promise((resolve, reject) => {
        socket!.addEventListener('open', resolve, { once: true });
        socket!.addEventListener('error', reject, { once: true });
    });
    socket.addEventListener('message', (event) => {
        const data = JSON.parse(String(event.data));
        const item = pending.get(data.id);
        if (!item) return;
        pending.delete(data.id);
        if (data.error) item.reject(new Error(JSON.stringify(data.error))); else item.resolve(data.result);
    });
    const { targetId } = await send<{ targetId: string }>('Target.createTarget', { url: pathToFileURL(path.join(directory, 'probe.html')).href });
    const { sessionId } = await send<{ sessionId: string }>('Target.attachToTarget', { targetId, flatten: true });
    let result: { passed: boolean; error?: string; cases?: unknown[] } | undefined;
    for (let i = 0; i < 400; i++) {
        const evaluated = await send<{ result: { value?: typeof result } }>('Runtime.evaluate', { expression: 'globalThis.__restoreResult', returnByValue: true }, sessionId);
        result = evaluated.result.value;
        if (result) break;
        await sleep(100);
    }
    if (!result) throw new Error('验收页没有完成，未把超时当作通过');
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) throw new Error(result.error || '真实 IndexedDB 恢复验证失败');
} finally {
    if (socket?.readyState === WebSocket.OPEN) {
        await Promise.race([send('Browser.close').catch(() => {}), sleep(2000)]);
        socket.close();
    }
    if (exited) await Promise.race([exited, sleep(3000)]);
    if (browser && browser.exitCode === null) browser.kill();
    clearTimeout(safetyTimer);
    await rm(directory, { recursive: true, force: true });
    console.log('隔离浏览器及临时配置已清理');
}
