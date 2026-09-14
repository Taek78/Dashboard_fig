import "server-only";
import { selectSource } from "@/data/select-source";
import type { EngagementSource } from "@/domain/engagement/source";
import { engagementDb } from "@/data/engagement.db";
import { engagementMock } from "@/data/engagement.mock";

/* FAÇADE des statistiques d'usage : seul module importé par le front. */
const source = (): EngagementSource =>
  selectSource("usage", engagementMock, engagementDb);

export const getEngagement: EngagementSource["getEngagement"] = () =>
  source().getEngagement();
