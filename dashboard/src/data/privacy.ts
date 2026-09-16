import "server-only";
import { privacyDb } from "@/data/privacy.db";
import type { PrivacySource } from "@/domain/privacy/source";

/*
 * FAÇADE des demandes RGPD (export et anonymisation d'un client) : le seul
 * module que la route d'export et la Server Action importent.
 */
export const { getCustomerExportData, anonymizeCustomer }: PrivacySource =
  privacyDb;
