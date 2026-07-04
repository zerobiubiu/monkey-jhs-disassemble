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
    callback: (event: KeyboardEvent) => void;
    keyupCallback?: ((event: KeyboardEvent) => void) | null;
}

class Hotkey {
    static isMac: boolean = navigator.platform.indexOf('Mac') === 0;
    static registerHotKeyMap: Map<string, HotkeyEntry> = new Map();

    static handleKeydown: (event: KeyboardEvent) => void = (event) => {
        for (const [, entry] of Hotkey.registerHotKeyMap) {
            const hotkeyString = entry.hotkeyString;
            const callback = entry.callback;
            if (Hotkey.judgeHotkey(hotkeyString, event)) {
                callback(event);
            }
        }
    };

    static handleKeyup: (event: KeyboardEvent) => void = (event) => {
        for (const [, entry] of Hotkey.registerHotKeyMap) {
            const hotkeyString = entry.hotkeyString;
            const keyupCallback = entry.keyupCallback;
            if (keyupCallback && Hotkey.judgeHotkey(hotkeyString, event)) {
                keyupCallback(event);
            }
        }
    };

    private constructor() {
        if (new.target === Hotkey) {
            throw new Error('HotkeyManager cannot be instantiated.');
        }
    }

    static registerHotkey(
        hotkeyStr: string | string[],
        keydownCallback: (event: KeyboardEvent) => void,
        keyupCallback: ((event: KeyboardEvent) => void) | null = null
    ) {
        if (Array.isArray(hotkeyStr)) {
            const ids: string[] = [];
            hotkeyStr.forEach((item) => {
                if (!Hotkey.isHotkeyFormat(item)) {
                    throw new Error('快捷键格式错误');
                }
                const id = Hotkey.recordHotkey(item, keydownCallback, keyupCallback);
                ids.push(id);
            });
            return ids;
        }
        if (!Hotkey.isHotkeyFormat(hotkeyStr)) {
            throw new Error('快捷键格式错误');
        }
        return Hotkey.recordHotkey(hotkeyStr, keydownCallback, keyupCallback);
    }

    static recordHotkey(
        hotkeyStr: string,
        keydownCallback: (event: KeyboardEvent) => void,
        keyupCallback: ((event: KeyboardEvent) => void) | null
    ) {
        const id = Math.random().toString(36).substr(2);
        Hotkey.registerHotKeyMap.set(id, {
            hotkeyString: hotkeyStr,
            callback: keydownCallback,
            keyupCallback: keyupCallback
        });
        return id;
    }

    static unregisterHotkey(id: string) {
        if (Hotkey.registerHotKeyMap.has(id)) {
            Hotkey.registerHotKeyMap.delete(id);
        }
    }

    static isHotkeyFormat(hotkeyStr: string) {
        return hotkeyStr
            .toLowerCase()
            .split('+')
            .map((item) => item.trim())
            .every((item) => ['ctrl', 'shift', 'alt'].includes(item) || item.length === 1);
    }

    static judgeHotkey(hotkeyStr: string, event: KeyboardEvent) {
        const parts = hotkeyStr
            .toLowerCase()
            .split('+')
            .map((item) => item.trim());
        const withCtrl = parts.includes('ctrl');
        const withShift = parts.includes('shift');
        const withAlt = parts.includes('alt');
        const mainKey = parts.find((item) => item !== 'ctrl' && item !== 'shift' && item !== 'alt');
        return (
            (Hotkey.isMac ? event.metaKey : event.ctrlKey) === withCtrl &&
            event.shiftKey === withShift &&
            event.altKey === withAlt &&
            event.key.toLowerCase() === mainKey
        );
    }
}

export { Hotkey };
