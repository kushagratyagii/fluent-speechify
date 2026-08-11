import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import { requireCurrentAccountId } from "@/lib/repositories/account.repository";
import type { DailyPlan } from "@/types";

export const planRepository = {
  async getByDate(dateKey: string): Promise<DailyPlan | null> {
    const accountId = await requireCurrentAccountId();
    return getStorage().get<DailyPlan>(StorageKeys.dailyPlan(accountId, dateKey));
  },

  async save(plan: DailyPlan): Promise<DailyPlan> {
    const accountId = await requireCurrentAccountId();
    await getStorage().set(StorageKeys.dailyPlan(accountId, plan.date), plan);
    return plan;
  },
};
