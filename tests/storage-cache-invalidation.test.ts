/**
 * storage-cache-invalidation 单测（doc/39）。
 *
 * 回归重点：**数据写入不得清设置缓存** —— 这是「打开新视频弹窗要等旧视频操作落库」
 * 阻塞的根因；设置写入则只清设置缓存（数据缓存保持有效）。
 */

import { describe, expect, it, vi } from 'vitest';

import { invalidateCachesFor } from '../src/core/storage/cache-invalidation';

/** 缓存失效替身：记录被调用的清理方法。 */
function createTargetStub() {
    return {
        clearCarListCache: vi.fn(),
        clearSettingCache: vi.fn(),
        clearFilterActorActressCarListCache: vi.fn()
    };
}

describe('invalidateCachesFor 数据写入（car_list / 清单）', () => {
    it('清 car_list 与屏蔽清单缓存，返回缓存名', () => {
        const target = createTargetStub();

        const cleared = invalidateCachesFor('data', target);

        expect(target.clearCarListCache).toHaveBeenCalledTimes(1);
        expect(target.clearFilterActorActressCarListCache).toHaveBeenCalledTimes(1);
        expect(cleared).toEqual(['carList', 'filterActorActressCarList']);
    });

    it('**不清设置缓存**（doc/39 根因回归）', () => {
        const target = createTargetStub();

        invalidateCachesFor('data', target);

        expect(target.clearSettingCache).not.toHaveBeenCalled();
    });
});

describe('invalidateCachesFor 设置写入', () => {
    it('只清设置缓存，返回缓存名', () => {
        const target = createTargetStub();

        const cleared = invalidateCachesFor('settings', target);

        expect(target.clearSettingCache).toHaveBeenCalledTimes(1);
        expect(cleared).toEqual(['setting']);
    });

    it('不动数据缓存（设置变更与 car_list 无关）', () => {
        const target = createTargetStub();

        invalidateCachesFor('settings', target);

        expect(target.clearCarListCache).not.toHaveBeenCalled();
        expect(target.clearFilterActorActressCarListCache).not.toHaveBeenCalled();
    });
});