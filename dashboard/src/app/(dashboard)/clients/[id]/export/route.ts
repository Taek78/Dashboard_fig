import { getCustomerExportData } from "@/data/privacy";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser } from "@/data/session";
import { canHandlePrivacyRequest } from "@/domain/auth/roles";
import { customerIdSchema } from "@/domain/customers/schemas";
import {
  buildCustomerExport,
  customerExportFileName,
} from "@/domain/privacy/export";

/*
 * GET /clients/[id]/export : téléchargement des données d'un client (RGPD,
 * droit d'accès et portabilité), fichier JSON. Route Handler plutôt que Server
 * Action : un lien <a download> suffit, sans JavaScript ni fichier en mémoire
 * dans le navigateur.
 * Même discipline qu'une action : session (redirection sans session) → rôle
 * (administrateur seul, refus journalisé) → zod → relecture → journal. Jamais
 * mis en cache (no-store) : ces données ne doivent rester dans aucun cache
 * intermédiaire.
 */
const NO_STORE = { "Cache-Control": "no-store" } as const;

/*
 * Une navigation lancée depuis un autre site (lien piégé ouvert par un
 * administrateur connecté) ne déclenche pas d'export : elle ne lirait rien,
 * mais fausserait le journal. Les navigateurs posent Sec-Fetch-Site ; sans
 * l'en-tête (outil en ligne de commande), session et rôle décident seuls.
 */
function isCrossSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  return site !== null && site !== "same-origin" && site !== "none";
}

export async function GET(
  request: Request,
  ctx: RouteContext<"/clients/[id]/export">,
) {
  const user = await getCurrentUser();
  const crossSite = isCrossSite(request);
  if (!canHandlePrivacyRequest(user.role) || crossSite) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: crossSite
        ? "exportCustomerData:cross-site"
        : "exportCustomerData",
    });
    return new Response(
      "Seul un administrateur peut exporter les données d'un client.",
      { status: 403, headers: NO_STORE },
    );
  }

  const parsed = customerIdSchema.safeParse((await ctx.params).id);
  const data = parsed.success ? await getCustomerExportData(parsed.data) : null;
  if (!parsed.success || !data) {
    return new Response("Client introuvable.", {
      status: 404,
      headers: NO_STORE,
    });
  }

  const now = new Date();
  const body = buildCustomerExport(
    data.customer,
    data.orders,
    data.events,
    data.messages,
    now,
  );
  logSecurity({
    type: "customer_exported",
    userId: user.id,
    customerId: data.customer.id,
  });
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      ...NO_STORE,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${customerExportFileName(data.customer.id, now)}"`,
    },
  });
}
