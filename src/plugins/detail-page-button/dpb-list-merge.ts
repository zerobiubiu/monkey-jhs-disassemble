/**
 * 详情页清单面板「序号清单合并」纯逻辑模块。
 *
 * 职责（无 DOM 副作用，便于单测）：
 * - 解析清单名末尾序号（`*d` 规则，如「等待更新2」→ base=等待更新 / num=2）
 * - 按 base 将清单条目归组（D1：单个序号清单也按 base 展示，overflow 行为统一）
 * - 计算加入路由目标（按序号升序，优先未满 501 的清单）
 * - 计算下一清单名、组合并勾选态（checked / indeterminate）
 * - 读取并解析用户配置（启用开关 / 自定义正则 / 排除清单名）
 *
 * 说明：JavDB 清单上限为 501（与 dpb-list-panel `updateListPanelEntryState`
 * 的 `count >= 501` 判满逻辑一致），满员时站点会禁用对应 checkbox。
 */

/** 默认合并匹配正则：前缀文字 + 末尾连续数字。 */
export const DEFAULT_LIST_MERGE_PATTERN = '^(.+?)(\\d+)$';

/** JavDB 单个清单的影片上限（满员阈值）。 */
export const LIST_FULL_THRESHOLD = 501;

/** 序号清单合并的运行时配置。 */
export interface ListMergeConfig {
    /** 是否启用合并（设置项 listMergeEnabled，默认开启）。 */
    enabled: boolean;
    /** 编译后的匹配正则；无效或未配置时为 null（回退默认规则）。 */
    pattern: RegExp;
    /** 不参与合并的清单名集合（D5，含完整名或 base，均小写归一）。 */
    excludeNames: Set<string>;
}

/** 清单名解析结果；不匹配合并规则时为 null。 */
export interface ParsedListName {
    /** 去掉末尾序号后的前缀文字。 */
    base: string;
    /** 末尾序号（整数，裸名成员为 0）。 */
    num: number;
}

/** 归组后的单个成员清单元数据（从已构建的展示条目读取）。 */
export interface ListMember {
    /** JavDB 清单 ID（路由时按此定位原生 checkbox）。 */
    listId: string;
    /** 清单原始全名（如「等待更新1」），用于合并行明细展示。 */
    name: string;
    /** 末尾序号；裸名（无数字）成员为 0，排序最优先。 */
    num: number;
    /** 清单内影片总数；未知时为 null。 */
    count: number | null;
    /** 当前影片是否已在该清单中。 */
    checked: boolean;
    /** 原生 checkbox 是否被禁用（满员或不可用）。 */
    disabled: boolean;
}

/** 一个合并组：共享 base 的若干成员清单。 */
export interface ListGroup {
    /** 组前缀文字（合并行展示名）。 */
    base: string;
    /** 组成员（未排序；消费方按需排序）。 */
    members: ListMember[];
}

/**
 * 解析清单名末尾序号。
 * @param name 清单名
 * @param pattern 匹配正则（需含两个捕获组：base 与 num）
 * @returns 解析结果；不匹配、base 为空或 base 全数字时返回 null（视为不可合并）
 */
export function parseListName(name: string, pattern: RegExp): ParsedListName | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const matched = pattern.exec(trimmed);
    if (!matched) return null;
    const base = (matched[1] ?? '').trim();
    const numRaw = matched[2] ?? '';
    if (!base || !numRaw) return null;
    // base 全数字（如纯数字清单名「2024」拆出 base=「2」）不参与合并
    if (!/[^\d]/.test(base)) return null;
    const num = Number(numRaw);
    if (!Number.isFinite(num)) return null;
    return { base, num };
}

/**
 * 安全编译合并正则；失败时回退默认规则，保证功能不因用户误配而崩溃。
 * @param source 用户配置的正则字符串（可空）
 * @returns 编译后的正则
 */
export function compileMergePattern(source: string | undefined | null): RegExp {
    const text = (source ?? '').trim() || DEFAULT_LIST_MERGE_PATTERN;
    try {
        return new RegExp(text);
    } catch {
        return new RegExp(DEFAULT_LIST_MERGE_PATTERN);
    }
}

/**
 * 判断清单名是否被排除合并（D5）。
 * 完整名或 base 命中排除集合即排除（均小写归一比较）。
 * @param fullName 清单完整名
 * @param base 解析出的 base（可为 null）
 * @param config 合并配置
 * @returns 是否排除
 */
export function isMergeExcluded(
    fullName: string,
    base: string | null,
    config: ListMergeConfig
): boolean {
    if (config.excludeNames.size === 0) return false;
    if (config.excludeNames.has(fullName.trim().toLowerCase())) return true;
    if (base && config.excludeNames.has(base.trim().toLowerCase())) return true;
    return false;
}

/**
 * 从设置对象构建运行时合并配置。
 * 供 loadForm/saveForm 之外的运行时路径复用（纯解析，不读存储）。
 * @param settings storageManager.getSetting() 返回的设置对象
 * @returns 合并配置
 */
export function buildMergeConfig(settings: {
    listMergeEnabled?: string;
    listMergePattern?: string;
    listMergeExcludeNames?: string[] | string;
}): ListMergeConfig {
    // 默认开启：仅当显式设为 'no' 时关闭
    const enabled = settings.listMergeEnabled !== 'no';
    const pattern = compileMergePattern(settings.listMergePattern);
    const rawNames = settings.listMergeExcludeNames;
    const nameList = Array.isArray(rawNames)
        ? rawNames
        : typeof rawNames === 'string'
          ? rawNames.split(',')
          : [];
    const excludeNames = new Set(
        nameList.map((n) => String(n).trim().toLowerCase()).filter(Boolean)
    );
    return { enabled, pattern, excludeNames };
}

/**
 * 判定成员清单是否已满（不可再加入）。
 * 满员条件：总数达到 501，或被禁用且当前影片未在其中。
 * @param member 成员元数据
 * @returns 是否已满
 */
export function isMemberFull(member: ListMember): boolean {
    if (member.count !== null && member.count >= LIST_FULL_THRESHOLD) return true;
    if (member.disabled && !member.checked) return true;
    return false;
}

/**
 * 按序号升序排序成员（裸名 num=0 最靠前；同序号按 listId 稳定）。
 * @param members 成员列表
 * @returns 排序后的新数组
 */
export function sortMembersByNum(members: ListMember[]): ListMember[] {
    return [...members].sort((a, b) => {
        if (a.num !== b.num) return a.num - b.num;
        return a.listId < b.listId ? -1 : a.listId > b.listId ? 1 : 0;
    });
}

/**
 * 选取加入目标：按序号升序取第一个「未满、可用、当前影片未在其中」的成员。
 * @param members 成员列表（内部排序，不改原数组）
 * @returns 目标成员；全满/全不可用时返回 null（触发自动新建清单）
 */
export function pickTargetMember(members: ListMember[]): ListMember | null {
    for (const member of sortMembersByNum(members)) {
        if (member.checked) continue;
        if (isMemberFull(member)) continue;
        return member;
    }
    return null;
}

/**
 * 计算组的下一清单名（用于全满时自动新建）。
 * 规则：base + (现有最大序号 + 1)。
 * @param group 合并组
 * @returns 新清单名，如「等待更新3」
 */
export function nextListName(group: ListGroup): string {
    const maxNum = group.members.reduce((max, m) => Math.max(max, m.num), 0);
    return `${group.base}${maxNum + 1}`;
}

/** 组合并勾选态统计结果。 */
export interface GroupCheckState {
    /** 当前影片是否在组内任一清单中（合并行 checked）。 */
    checked: boolean;
    /** 是否处于部分含片的半选态（D4 indeterminate）。 */
    indeterminate: boolean;
    /** 当前影片所在的成员清单列表。 */
    containing: ListMember[];
}

/**
 * 计算组合并勾选态。
 * checked = 任一成员含片；indeterminate = 含片数介于 1 与「可用成员数」之间。
 * @param group 合并组
 * @returns 勾选态统计
 */
export function computeGroupCheckState(group: ListGroup): GroupCheckState {
    const containing = group.members.filter((m) => m.checked);
    const checked = containing.length > 0;
    const indeterminate = checked && containing.length < group.members.length;
    return { checked, indeterminate, containing };
}

/** 条目归组结果。 */
export interface GroupEntriesResult {
    /** 合并组列表（按 base 自然序）。 */
    groups: ListGroup[];
    /** 未参与合并的单条条目索引（指向入参数组）。 */
    singleIndexes: number[];
}

/**
 * 将清单条目按 base 归组。
 *
 * 规则：
 * 1. 名字匹配正则且 base 合法、未被排除 → 归入 base 组（num≥1）。
 * 2. 不匹配的条目，若其完整名恰等于某组 base → 作为裸名成员（num=0）吸收进该组。
 * 3. 其余不匹配条目 → 保持单条。
 *
 * @param items 条目数组，每项提供 name/listId/count/checked/disabled
 * @param config 合并配置
 * @returns 归组结果
 */
export function groupEntries(
    items: Array<{
        name: string;
        listId: string;
        count: number | null;
        checked: boolean;
        disabled: boolean;
    }>,
    config: ListMergeConfig
): GroupEntriesResult {
    const groupMap = new Map<string, ListGroup>();
    const singleIndexes: number[] = [];

    if (!config.enabled) {
        return { groups: [], singleIndexes: items.map((_, i) => i) };
    }

    // 第一遍：可合并条目入组
    const pendingSingles: number[] = [];
    items.forEach((item, index) => {
        const parsed = parseListName(item.name, config.pattern);
        if (!parsed || isMergeExcluded(item.name, parsed.base, config)) {
            pendingSingles.push(index);
            return;
        }
        let group = groupMap.get(parsed.base);
        if (!group) {
            group = { base: parsed.base, members: [] };
            groupMap.set(parsed.base, group);
        }
        group.members.push({
            listId: item.listId,
            name: item.name,
            num: parsed.num,
            count: item.count,
            checked: item.checked,
            disabled: item.disabled
        });
    });

    // 第二遍：裸名（完整名 == 某组 base）吸收为 num=0 成员，其余保持单条
    for (const index of pendingSingles) {
        const item = items[index];
        const group = groupMap.get(item.name.trim());
        if (group && !isMergeExcluded(item.name, null, config)) {
            group.members.push({
                listId: item.listId,
                name: item.name,
                num: 0,
                count: item.count,
                checked: item.checked,
                disabled: item.disabled
            });
        } else {
            singleIndexes.push(index);
        }
    }

    const collator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
    const groups = Array.from(groupMap.values()).sort((a, b) =>
        collator.compare(a.base, b.base)
    );
    singleIndexes.sort((a, b) => a - b);
    return { groups, singleIndexes };
}
