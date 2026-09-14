import Link from "next/link";
import { User, Users } from "lucide-react";
import type { CustomerTab } from "@/domain/customers/schemas";
import { cn } from "@/lib/utils";

/*
 * Onglets de la section Clients (serveur) : particuliers (clients sans
 * communauté) ou communautés (groupes de clients livrés à un même point).
 * De vrais liens (?type=) : URL partageable, retour arrière gratuit.
 */
const TABS: { key: CustomerTab; label: string; icon: typeof User }[] = [
  { key: "particuliers", label: "Particuliers", icon: User },
  { key: "communautes", label: "Communautés", icon: Users },
];

export function CustomerTabs({ current }: { current: CustomerTab }) {
  return (
    <nav aria-label="Type de clients">
      <ul className="bg-muted/60 flex w-max gap-1 rounded-xl p-1">
        {TABS.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                href={
                  tab.key === "particuliers"
                    ? "/clients"
                    : `/clients?type=${tab.key}`
                }
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors [&_svg]:size-4",
                  active
                    ? "bg-gradient-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                <tab.icon aria-hidden="true" />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
