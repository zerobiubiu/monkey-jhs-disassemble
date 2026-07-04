/**
 * 快捷键管理器（原 ie）
 *
 * 静态工具类，不可实例化。提供快捷键注册 / 注销 / 格式校验 / 命中判定。
 * document 的 keydown / keyup 监听仍由 legacy 在原位置绑定，以保持执行顺序。
 * 原脚本用 `const ie = class e {}` + `i(ie, "field", ...)` 私有字段赋值机制，
 * 此处改写为 class field 语法，行为等价。
 */

interface HotkeyEntry {
    hotkeyString: string;
    callback: (e: KeyboardEvent) => void;
    keyupCallback?: ((e: KeyboardEvent) => void) | null;
}

class Hotkey {
    static isMac: boolean = navigator.platform.indexOf('Mac') === 0;
    static registerHotKeyMap: Map<string, HotkeyEntry> = new Map();

    static handleKeydown: (e: KeyboardEvent) => void = (e) => {
        for (const [, entry] of Hotkey.registerHotKeyMap) {
            const hotkeyString = entry.hotkeyString;
            const callback = entry.callback;
            if (Hotkey.judgeHotkey(hotkeyString, e)) {
                callback(e);
            }
        }
    };

    static handleKeyup: (e: KeyboardEvent) => void = (e) => {
        for (const [, entry] of Hotkey.registerHotKeyMap) {
            const hotkeyString = entry.hotkeyString;
            const keyupCallback = entry.keyupCallback;
            if (keyupCallback && Hotkey.judgeHotkey(hotkeyString, e)) {
                keyupCallback(e);
            }
        }
    };

    private constructor() {
        if (new.target === Hotkey) {
            throw new Error('HotkeyManager cannot be instantiated.');
        }
    }

    static registerHotkey(
        e: string | string[],
        t: (e: KeyboardEvent) => void,
        n: ((e: KeyboardEvent) => void) | null = null
    ) {
        if (Array.isArray(e)) {
            const ids: string[] = [];
            e.forEach((item) => {
                if (!Hotkey.isHotkeyFormat(item)) {
                    throw new Error('快捷键格式错误');
                }
                const id = Hotkey.recordHotkey(item, t, n);
                ids.push(id);
            });
            return ids;
        }
        if (!Hotkey.isHotkeyFormat(e)) {
            throw new Error('快捷键格式错误');
        }
        return Hotkey.recordHotkey(e, t, n);
    }

    static recordHotkey(
        e: string,
        t: (e: KeyboardEvent) => void,
        n: ((e: KeyboardEvent) => void) | null
    ) {
        const id = Math.random().toString(36).substr(2);
        Hotkey.registerHotKeyMap.set(id, {
            hotkeyString: e,
            callback: t,
            keyupCallback: n
        });
        return id;
    }

    static unregisterHotkey(e: string) {
        if (Hotkey.registerHotKeyMap.has(e)) {
            Hotkey.registerHotKeyMap.delete(e);
        }
    }

    static isHotkeyFormat(e: string) {
        return e
            .toLowerCase()
            .split('+')
            .map((item) => item.trim())
            .every((item) => ['ctrl', 'shift', 'alt'].includes(item) || item.length === 1);
    }

    static judgeHotkey(e: string, t: KeyboardEvent) {
        const parts = e
            .toLowerCase()
            .split('+')
            .map((item) => item.trim());
        const withCtrl = parts.includes('ctrl');
        const withShift = parts.includes('shift');
        const withAlt = parts.includes('alt');
        const mainKey = parts.find((item) => item !== 'ctrl' && item !== 'shift' && item !== 'alt');
        return (
            (Hotkey.isMac ? t.metaKey : t.ctrlKey) === withCtrl &&
            t.shiftKey === withShift &&
            t.altKey === withAlt &&
            t.key.toLowerCase() === mainKey
        );
    }
}

export { Hotkey };
