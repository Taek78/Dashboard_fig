import "server-only";
import { alertsDb } from "@/data/alerts.db";
import type { AlertsSource } from "@/domain/alerts/source";

/* FAÇADE du flux des alertes en direct (implémentation alerts.db.ts). */
export const {
  getAlertFeed,
  getAlertPrefs,
  setAlertPrefs,
  markAlertsSeen,
}: AlertsSource = alertsDb;
