import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { toCommunity } from "@/db/mappers";
import { communities } from "@/db/schema";
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
};
