/** 备份恢复依赖的最小存储契约，生产 localforage 与测试替身共用。 */
export interface BackupRestoreStore {
    keys(): Promise<string[]>;
    getItem(key: string): Promise<unknown>;
    setItem(key: string, value: unknown): Promise<unknown>;
    removeItem(key: string): Promise<unknown>;
}
