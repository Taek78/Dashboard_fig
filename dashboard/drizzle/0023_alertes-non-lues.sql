-- Alertes non lues (2026-09-18) : préférences de notification cochées dans
-- « Mon profil » (commandes, messages ; activées par défaut) et dernière
-- visite de chaque section (commandes, messages, stock du catalogue), d'où
-- se comptent les nouveautés non lues du menu. Rien de destructeur : cinq
-- colonnes avec valeur par défaut ; les comptes existants partent de
-- l'instant de la migration (aucune ancienne commande comptée non lue).
ALTER TABLE "users" ADD COLUMN "notify_orders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_messages" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "orders_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "messages_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stock_seen_at" timestamp with time zone DEFAULT now() NOT NULL;