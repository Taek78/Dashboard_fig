import { engagementFixtures } from "@/domain/engagement/fixtures";
import type { EngagementSource } from "@/domain/engagement/source";

/* Implémentation FIXTURES du contrat EngagementSource : lecture seule, copie à la sortie. */
export const ENGAGEMENT_MOCK_LATENCY_MS = 200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const engagementMock: EngagementSource = {
  getEngagement: async () => {
    await sleep(ENGAGEMENT_MOCK_LATENCY_MS);
    return structuredClone([...engagementFixtures]);
  },
};
