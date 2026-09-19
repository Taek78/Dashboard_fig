"use server";

import { revalidatePath } from "next/cache";
import { markAlertsSeen, setAlertPrefs } from "@/data/alerts";
import { getCurrentUser } from "@/data/session";
import { alertScopeFor } from "@/domain/auth/roles";
import { alertPrefsSchema, alertReadKindSchema } from "@/domain/alerts/schemas";
import type { ActionResult } from "@/lib/action-result";

/*
 * Server Actions des alertes, pour le compte connecté SEULEMENT (l'identifiant
 * vient de la session, jamais du formulaire) :
 * - markSectionSeen : la section a été ouverte, son compteur non lu repart
 *   de zéro (dernière visite = maintenant) ; ignoré pour un fil que le rôle
 *   ne voit pas ;
 * - saveAlertPrefs : les cases « Activer les notifications commandes » et
 *   « … messages » de « Mon profil ».
 */
export async function markSectionSeen(kind: string): Promise<void> {
  const user = await getCurrentUser();
  const parsed = alertReadKindSchema.safeParse(kind);
  if (!parsed.success || !alertScopeFor(user.role)[parsed.data]) return;
  await markAlertsSeen(user.id, parsed.data, new Date());
}

export async function saveAlertPrefs(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  const parsed = alertPrefsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: "Préférences illisibles." };
  }
  try {
    await setAlertPrefs(user.id, parsed.data);
    revalidatePath("/profil");
    return { status: "success", message: "Préférences enregistrées." };
  } catch (error) {
    console.error("[saveAlertPrefs]", { userId: user.id }, error);
    return {
      status: "error",
      message: "Impossible d'enregistrer. Réessayez dans un instant.",
    };
  }
}
