import "server-only";
import { asc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toEngagementPoint } from "@/db/mappers";
import { engagementMonthly } from "@/db/schema";
import type { EngagementSource } from "@/domain/engagement/source";

/* Implémentation Drizzle du contrat EngagementSource (B3) : un point par mois, croissant. */
export const engagementDb: EngagementSource = {
  getEngagement: async () => {
    const rows = await getDb()
      .select()
      .from(engagementMonthly)
      .orderBy(asc(engagementMonthly.month));
    return rows.map(toEngagementPoint);
  },
};
