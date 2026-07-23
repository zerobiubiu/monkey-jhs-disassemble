/**
 * 新增清单功能 —— 展开面板下「➕ 新增清单」UI + 创建 + 自动关联。
 *
 * 实现已拆分至：
 * - vlt-create-list-ui.tsx — setupCreateListButton + 事件绑定 + 可用性同步
 * - vlt-create-list-api.ts — createList GM_xmlhttpRequest POST + finishCreateList
 *
 * 本文件仅做 re-export，保持 vlt-sync.tsx 的导入路径不变。
 */

export { setupCreateListButton } from './vlt-create-list-ui';
