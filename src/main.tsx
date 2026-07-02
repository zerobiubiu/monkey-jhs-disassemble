// 鉴黄师 用户脚本入口
//
// 由 archetype/jhs.user.js（单文件 11000+ 行混淆脚本）拆分重构而来。
// 当前阶段：整体逻辑已原样迁入 src/legacy/jhs.ts，入口仅负责触发其执行，
// 以保证打包产物在功能逻辑与执行效果上与原始脚本一致。
// 后续将逐步把 legacy 拆分为 styles / constants / resources / core / plugins / components。
//
// 详见 doc/ 目录下的迁移文档。

import "./legacy/jhs";
