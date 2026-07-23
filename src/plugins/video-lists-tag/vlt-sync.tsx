/**
 * 同步逻辑模块 —— 公共 API 入口（re-export barrel）。
 *
 * 实际实现已拆分至：
 * - vlt-helpers.ts — 纯 DOM/数据工具函数 + 共享常量/类型
 * - vlt-checkbox.ts — handleCheckboxChange + 自动收藏 + 等待更新清单移出
 * - vlt-server.ts — 服务端变更管线（JavDB API + 恢复日志 + 权威校验）
 * - vlt-create-list.tsx — 新增清单 UI + 创建 + 自动关联
 * - vlt-list-mgmt.ts — /users/lists 删除/改名 + 详情页 checkbox DOM 更新
 *
 * 本文件仅做 re-export，保持 vlt-plugin.ts / dpb-rating.tsx 的导入路径不变。
 */

export { getMovieInfo, getListInfo } from './vlt-helpers';
export type { MovieInfo, ListInfo } from './vlt-helpers';

export { handleCheckboxChange, autoRemoveFromPendingUpdateOnWatch } from './vlt-checkbox';

export { setupCheckboxListener } from './vlt-server';

export { setupCreateListButton } from './vlt-create-list';

export {
    setupListManagementListener,
    removeDetailPageCheckbox,
    updateDetailPageCheckboxLabel
} from './vlt-list-mgmt';
