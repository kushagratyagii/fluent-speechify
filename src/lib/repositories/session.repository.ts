import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { ExerciseSession } from "@/types";
import { toDateKey } from "@/utils/date";

/**
 * Sessions live in one array rather than one key per row. The volume is small
 * (a few hundred rows per user) and it keeps the read path to a single fetch,
 * which maps cleanly onto a future `select * from exercise_sessions` call.
 */
export const sessionRepository = {
  async list(): Promise<ExerciseSession[]> {
    const accountId = await requireCurrentAccountId();
    const rows = await getStorage().get<ExerciseSession[]>(StorageKeys.sessions(accountId));
    return rows ?? [];
  },

  async listByDate(dateKey: string): Promise<ExerciseSession[]> {
    const rows = await this.list();
    return rows.filter((s) => toDateKey(new Date(s.endedAt)) === dateKey);
  },

  async create(session: ExerciseSession): Promise<ExerciseSession> {
    const accountId = await requireCurrentAccountId();
    const rows = await this.list();
    rows.push(session);
    await getStorage().set(StorageKeys.sessions(accountId), rows);
    return session;
  },

  async clear(): Promise<void> {
    const accountId = await requireCurrentAccountId();
    await getStorage().remove(StorageKeys.sessions(accountId));
  },
};
