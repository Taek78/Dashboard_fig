"use client";

import {
  BadgeCheck,
  Ban,
  BellOff,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-react";
import { startTransition, useActionState, useId, useState } from "react";
import {
  changeOrderStatus,
  type StatusChangeResult,
} from "@/app/(dashboard)/commandes/[id]/actions";
import { CancellationFields } from "@/components/orders/cancellation-fields";
import {
  STATUS_ICON_TONE,
  STATUS_ICONS,
  STATUS_SELECT_TONE,
} from "@/components/orders/order-status-badge";
import { Button } from "@/components/ui/button";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUSES,
  type OrderStatus,
} from "@/domain/orders/status";
import { idleActionResult } from "@/lib/action-result";
import { NotificationDeliveryBadge } from "@/components/orders/notification-delivery-badge";
import { cn } from "@/lib/utils";

/*
 * Liste déroulante du statut d'une commande (client : useActionState), sur
 * les cartes et la fiche. Décision du client (2026-09-17) : plus de règle
 * d'étape, les quatre statuts sont toujours proposés (livrée directement,
 * retour en préparation, reprise d'une annulée) et la valeur affichée est le
 * statut courant. À côté, l'icône du statut choisi dans sa couleur, et la
 * liste prend la même couleur (ambre = en préparation, bleu = expédiée,
 * vert = livrée, rouge = annulée) ; le libellé reste toujours écrit, la
 * couleur n'est jamais le seul signal.
 *
 * Choisir un statut l'écrit aussitôt (un geste, une écriture, comme
 * l'affectation) : le FormData est composé ici et l'action lancée dans une
 * transition, sans dépendre de l'état du DOM. Sauf « Annulée », qui ouvre
 * d'abord le motif à communiquer au client : l'annulation ne part qu'avec
 * « Confirmer l'annulation » (envoi du formulaire, motif compris) et
 * « Retour » remet la liste sur le statut courant. L'action revérifie rôle,
 * statut relu et motif ; après un succès, la page se re-rend avec le nouveau
 * statut (la liste suit la prop sans remonter le hook : le message reste
 * affiché) et la notification a été déposée pour le client s'il l'a
 * autorisée. La région role="status" est rendue dès le premier rendu, même
 * vide : un lecteur d'écran n'annonce que les changements d'une région live
 * déjà dans le DOM.
 *
 * Case « Notifier le client » (demande du 2026-09-17) : décochée, aucune
 * notification n'est déposée, même si le client les a autorisées. Elle part
 * avec chaque écriture : « 1 » ou « 0 » dans le FormData composé ; dans
 * l'envoi du formulaire d'annulation, une case décochée n'est pas envoyée, ce
 * que le schéma lit comme « 0 ». Cochée par défaut, SAUF si la commande est
 * déjà passée une fois par « livrée » (`wasDelivered`, historique relu avec
 * la commande) : elle se décoche alors d'elle-même, y compris à l'instant où
 * la commande devient livrée. Si le client n'a pas autorisé les
 * notifications d'état (`notifyAllowed`), la case est désactivée, décochée,
 * et son libellé le dit ; la base refuserait de toute façon le dépôt.
 *
 * Après une écriture, deux lignes courtes, jamais une phrase qui s'allonge :
 * la confirmation (vert), puis « Client notifié » avec un badge de validation
 * (vert, d'après `notified` renvoyé par l'action) ou « Client non notifié »
 * (gris). Depuis le 2026-09-18, « Client notifié » suit l'envoi réel
 * (NotificationDeliveryBadge) : spinner jusqu'à l'accusé de l'application,
 * « Échec d'envoi de la notification » et « Réessayer » s'il ne vient pas. Icônes calées sur la première ligne du texte : dans la bande
 * étroite des cartes, un message peut se replier sur deux lignes.
 */
export function OrderStatusSelect({
  orderId,
  status,
  notifyAllowed,
  wasDelivered,
}: {
  orderId: string;
  /** Statut courant, relu par la page ; l'action relit le sien de toute façon. */
  status: OrderStatus;
  /** Le client a autorisé les notifications d'état de commande. */
  notifyAllowed: boolean;
  /** La commande est déjà passée au moins une fois par « livrée ». */
  wasDelivered: boolean;
}) {
  const [result, formAction, pending] = useActionState<
    StatusChangeResult,
    FormData
  >(changeOrderStatus, idleActionResult);
  const id = useId();
  const [choice, setChoice] = useState<OrderStatus>(status);
  const [seen, setSeen] = useState<OrderStatus>(status);
  const [notify, setNotify] = useState(notifyAllowed && !wasDelivered);
  const [seenDelivered, setSeenDelivered] = useState(wasDelivered);
  if (seen !== status) {
    // Nouveau statut venu du serveur (succès, ou page actualisée après un conflit) : la liste suit.
    setSeen(status);
    setChoice(status);
  }
  if (seenDelivered !== wasDelivered) {
    // La commande vient de passer par « livrée » : les notifications suivantes se décochent d'elles-mêmes.
    setSeenDelivered(wasDelivered);
    if (wasDelivered) setNotify(false);
  }
  const cancelling = choice === "cancelled" && status !== "cancelled";
  const Icon = STATUS_ICONS[choice];

  function choose(next: OrderStatus) {
    setChoice(next);
    if (next === "cancelled" || next === status) return;
    const data = new FormData();
    data.set("orderId", orderId);
    data.set("nextStatus", next);
    data.set("notify", notify ? "1" : "0");
    startTransition(() => formAction(data));
  }

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="orderId" value={orderId} />
      <label htmlFor={id} className="text-muted-foreground text-xs font-medium">
        Statut de la commande
      </label>
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
            STATUS_ICON_TONE[choice],
          )}
        >
          <Icon />
        </span>
        <NativeSelect
          id={id}
          name="nextStatus"
          value={choice}
          disabled={pending}
          onChange={(event) => choose(event.target.value as OrderStatus)}
          className={cn("w-full font-medium", STATUS_SELECT_TONE[choice])}
        >
          {ORDER_STATUSES.map((s) => (
            <NativeSelectOption key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {pending ? (
          <LoaderCircle
            className="text-muted-foreground size-4 shrink-0 animate-spin"
            aria-hidden="true"
          />
        ) : null}
      </div>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm has-disabled:cursor-not-allowed has-disabled:opacity-70">
        <input
          type="checkbox"
          name="notify"
          value="1"
          checked={notify}
          disabled={pending || !notifyAllowed}
          onChange={(event) => setNotify(event.target.checked)}
          className="accent-primary size-4"
        />
        {notifyAllowed
          ? "Notifier le client"
          : "Notifications non autorisées par le client"}
      </label>

      {cancelling ? (
        <div
          role="group"
          aria-label="Annulation de la commande"
          className="border-destructive/40 bg-destructive/5 flex flex-col gap-3 rounded-xl border p-3"
        >
          <CancellationFields autoFocus />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? <LoaderCircle className="animate-spin" /> : <Ban />}
              Confirmer l&apos;annulation
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setChoice(status)}
            >
              Retour
            </Button>
          </div>
        </div>
      ) : null}

      <div role="status" className="flex flex-col gap-1 text-sm">
        {result.status === "idle" ? null : (
          <p
            className={cn(
              "flex items-start gap-1.5",
              result.status === "success" ? "text-success" : "text-destructive",
            )}
          >
            {result.status === "success" ? (
              <CircleCheck
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <CircleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            )}
            {result.message}
          </p>
        )}
        {result.status === "success" && result.notified !== undefined ? (
          result.notified ? (
            result.notificationId ? (
              // La clé relance le suivi pour chaque nouvelle notification déposée.
              <NotificationDeliveryBadge
                key={result.notificationId}
                notificationId={result.notificationId}
              />
            ) : (
              <p className="text-success flex items-center gap-1.5">
                <BadgeCheck className="size-4 shrink-0" aria-hidden="true" />
                Client notifié
              </p>
            )
          ) : (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <BellOff className="size-4 shrink-0" aria-hidden="true" />
              Client non notifié
            </p>
          )
        ) : null}
      </div>
    </form>
  );
}
