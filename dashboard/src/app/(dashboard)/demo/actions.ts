"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import {
  DemoDataMissingError,
  insertDemoMessage,
  insertDemoOrder,
} from "@/db/demo";
import { getCurrentUser } from "@/data/session";
import { MESSAGE_SUBJECT_LABELS } from "@/domain/messages/subject";
import type { ActionResult } from "@/lib/action-result";
import { canUseDemoTools } from "@/lib/demo-tools";

/*
 * Simulation d'une nouvelle commande ou d'un nouveau message, pour tester les
 * alertes en direct (son, notification, compteurs du menu). DÉVELOPPEMENT
 * SEULEMENT : refusé en production et pour les rôles autres qu'admin et
 * gestionnaire (canUseDemoTools), quelle que soit la façon d'appeler l'action.
 * À RETIRER avant la livraison au client (docs/backlog.md).
 */
const REFUSED: ActionResult = {
  status: "error",
  message: "Simulation indisponible (développement seulement).",
};

/** Varie le client, les produits et le texte d'une simulation à l'autre. */
const seed = () => Math.floor(Date.now() / 1000);

export async function simulateOrder(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canUseDemoTools(user.role)) return REFUSED;
  try {
    const reference = await insertDemoOrder(getDb(), new Date(), seed());
    revalidatePath("/", "layout");
    return { status: "success", message: `Commande ${reference} simulée.` };
  } catch (error) {
    return failure(error);
  }
}

export async function simulateMessage(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canUseDemoTools(user.role)) return REFUSED;
  try {
    const { subject } = await insertDemoMessage(getDb(), seed());
    revalidatePath("/", "layout");
    return {
      status: "success",
      message: `Message « ${MESSAGE_SUBJECT_LABELS[subject]} » simulé.`,
    };
  } catch (error) {
    return failure(error);
  }
}

function failure(error: unknown): ActionResult {
  if (error instanceof DemoDataMissingError) {
    return { status: "error", message: error.message };
  }
  console.error("[demo]", error);
  return { status: "error", message: "La simulation a échoué." };
}
