/**
 * 清单页「编号清单整理（组内压实）」共享类型（doc/202，期1 只读）。
 *
 * 压实规则（用户约定）：
 * - 不保留清单内影片顺序（规划可最小化搬运）。
 * - 同 base 仅序号不同的多个清单中重复出现的影片，组内只保留一份（顺带审计收藏错误）。
 * - 不同 base 的清单归属全部保留——压实只在单个 base 组内横向搬运。
 */

/** 发现阶段产出：/users/lists 中的单个清单。 */
export interface DiscoveredList {
    listId: string;
    /** 清单原始全名（已去「(数量)」后缀）。 */
    name: string;
    /** /users/lists 显示的影片数量；解析失败为 null。 */
    count: number | null;
}

/** 编号组内的一个成员清单（含序号）。 */
export interface ReflowList {
    listId: string;
    name: string;
    /** 末尾序号；裸名（完整名 == base）成员为 0，压实优先级最高。 */
    num: number;
    count: number | null;
}

/** 编号组发现结果。 */
export interface ReflowGroup {
    /** 组前缀文字。 */
    base: string;
    /** 成员清单（按序号升序）。 */
    members: ReflowList[];
}

/** 规划器输入：某成员清单及其影片集合（枚举阶段产出）。 */
export interface PlannerListInput {
    listId: string;
    num: number;
    name: string;
    /** 清单内影片 ID（页序；顺序不参与规划）。 */
    videoIds: string[];
}

/** 各清单的目标数量行。 */
export interface PlanTargetRow {
    listId: string;
    num: number;
    name: string;
    /** 当前影片数（去重后）。 */
    current: number;
    /** 压实目标影片数。 */
    target: number;
}

/** 单条搬运动作（一部影片）。 */
export interface ReflowMove {
    videoId: string;
    /** 需从中移除的清单 ID（当前所在但非目标）。 */
    removeFrom: string[];
    /** 需加入的目标清单 ID；影片已在目标清单则为 null。 */
    addTo: string | null;
}

/** 压实规划结果（期1 预览消费）。 */
export interface CompactionPlan {
    base: string;
    /** 组内去重后影片总数。 */
    totalUnique: number;
    /** 在组内多个清单中出现的影片数（收藏错误审计）。 */
    duplicateCount: number;
    /** 重复影片 ID 列表。 */
    duplicates: string[];
    /** 各清单目标分布。 */
    targets: PlanTargetRow[];
    /** 搬运明细。 */
    moves: ReflowMove[];
    /** 加入动作数。 */
    addCount: number;
    /** 移除动作数。 */
    removeCount: number;
    /** 组总容量不足、无法安置的影片（需期2 自动新建清单消化）。 */
    overflow: string[];
}
