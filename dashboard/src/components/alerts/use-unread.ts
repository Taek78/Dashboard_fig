"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { markSectionSeen } from "@/app/(dashboard)/alertes/actions";
import type { AlertReadKind, UnreadCounts } from "@/domain/alerts/types";
import {
  announceSeen,
  onUnread,
  visibleUnread,
  type UnreadUpdate,
} from "@/lib/alert-events";

/*
 * Les compteurs non lus du menu, tels que le dernier relevé des alertes les
 * a publiés (onUnread), et `markSeen` : enregistre la visite d'une section
 * (Server Action, pour le compte connecté), remet son compteur à 0 tout de
 * suite et relance le relevé (announceSeen). Un relevé parti avant la visite
 * ne rallume pas le compteur (visibleUnread).
 */
const ZERO: UnreadCounts = { orders: 0, messages: 0, stock: 0 };

export function useUnread(): {
  counts: UnreadCounts;
  markSeen: (kind: AlertReadKind) => void;
} {
  const [last, setLast] = useState<UnreadUpdate | null>(null);
  const [seenAt, setSeenAt] = useState<Partial<Record<AlertReadKind, number>>>(
    {},
  );
  const marking = useRef(new Set<AlertReadKind>());
  useEffect(() => onUnread(setLast), []);

  const markSeen = useCallback((kind: AlertReadKind) => {
    if (marking.current.has(kind)) return;
    marking.current.add(kind);
    setSeenAt((current) => ({ ...current, [kind]: Date.now() }));
    void markSectionSeen(kind)
      .catch(() => {})
      .finally(() => {
        marking.current.delete(kind);
        announceSeen();
      });
  }, []);

  return { counts: last ? visibleUnread(last, seenAt) : ZERO, markSeen };
}
