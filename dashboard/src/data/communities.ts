import "server-only";
import { selectSource } from "@/data/select-source";
import type { CommunitiesSource } from "@/domain/communities/source";
import { communitiesDb } from "@/data/communities.db";
import { communitiesMock } from "@/data/communities.mock";

/* FAÇADE des communautés (lecture seule) : DATA_SOURCE choisit fixtures ou Postgres. */
const source = (): CommunitiesSource =>
  selectSource("communautés", communitiesMock, communitiesDb);

export const listCommunities: CommunitiesSource["listCommunities"] = () =>
  source().listCommunities();
export const getCommunity: CommunitiesSource["getCommunity"] = (id) =>
  source().getCommunity(id);
