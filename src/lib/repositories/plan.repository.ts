import { StorageKeys } from "@/lib/db/keys";
import { getStorage } from "@/lib/db/storage";
import type { DailyPlan } from "@/types";

export const planRepository = {
  async getByDate(dateKey: string): Promise<DailyPlan | null> {
    return getStorage().get<DailyPlan>(StorageKeys.dailyPlan(dateKey));
  },

  async save(plan: DailyPlan): Promise<DailyPlan> {
    await getStorage().set(StorageKeys.dailyPlan(plan.date), plan);
    return plan;
  },
};
