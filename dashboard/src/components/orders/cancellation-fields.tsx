"use client";

import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  CANCELLATION_DETAIL_MAX_LENGTH,
  CANCELLATION_REASON_LABELS,
  CANCELLATION_REASONS,
  type CancellationReason,
} from "@/domain/orders/cancellation";

/*
 * Champs du motif d'annulation (client), partagés par les cartes et la fiche :
 * un motif parmi trois, et pour « Autre » une précision libre bornée à 100
 * caractères avec compteur. Les noms de champs (reason, detail) sont ceux que
 * changeStatusSchema attend ; c'est lui qui exige le motif, pas ce composant.
 */
export function CancellationFields({
  autoFocus = false,
}: {
  autoFocus?: boolean;
}) {
  const id = useId();
  const [reason, setReason] = useState<CancellationReason>("stock");
  const [detail, setDetail] = useState("");

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-reason`}>Motif communiqué au client</Label>
        <NativeSelect
          id={`${id}-reason`}
          name="reason"
          value={reason}
          autoFocus={autoFocus}
          onChange={(e) => setReason(e.target.value as CancellationReason)}
          className="w-full"
        >
          {CANCELLATION_REASONS.map((r) => (
            <NativeSelectOption key={r} value={r}>
              {CANCELLATION_REASON_LABELS[r]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {reason === "other" ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-detail`}>Précision</Label>
          <Input
            id={`${id}-detail`}
            name="detail"
            required
            maxLength={CANCELLATION_DETAIL_MAX_LENGTH}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder="Ex. : client absent, adresse introuvable"
            aria-describedby={`${id}-count`}
          />
          <p
            id={`${id}-count`}
            className="text-muted-foreground text-xs tabular-nums"
          >
            {detail.length} / {CANCELLATION_DETAIL_MAX_LENGTH} caractères
          </p>
        </div>
      ) : null}
    </div>
  );
}
