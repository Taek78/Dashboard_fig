import "server-only";
import { count, eq, isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCommunity } from "@/db/mappers";
import { communities, customers } from "@/db/schema";
import { sortCommunities } from "@/domain/communities/rules";
import type { CommunitiesSource } from "@/domain/communities/source";

/* Implémentation Drizzle du contrat CommunitiesSource (lecture seule) : table `communities`. */
export const communitiesDb: CommunitiesSource = {
  listCommunities: async () => {
    const rows = await getDb().select().from(communities);
    return sortCommunities(rows.map(toCommunity));
  },

  getCommunity: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(communities)
      .where(eq(communities.id, id))
      .limit(1);
    return row ? toCommunity(row) : null;
  },

  // Membres par communauté (index customers_community_idx) : ce dont le taux
  // de remise se déduit ; une communauté sans membre n'a pas de ligne (0).
  getMemberCounts: async () => {
    const rows = await getDb()
      .select({ id: customers.communityId, members: count() })
      .from(customers)
      .where(isNotNull(customers.communityId))
      .groupBy(customers.communityId);
    return new Map(rows.map((r) => [String(r.id), r.members]));
  },
};
