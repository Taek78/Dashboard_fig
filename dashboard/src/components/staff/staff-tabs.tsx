import Link from "next/link";
import {
  STAFF_KIND_PLURALS,
  STAFF_KINDS,
  type StaffKind,
} from "@/domain/staff/kind";
import { cn } from "@/lib/utils";

/*
 * Onglets de la section Personnel (serveur) : tout le monde, ou un métier
 * (?type=). De vrais liens : URL partageable, retour arrière gratuit. Le
 * compteur de chaque onglet vient de la page.
 */
export function StaffTabs({
  current,
  counts,
}: {
  current: StaffKind | undefined;
  counts: Record<StaffKind | "all", number>;
}) {
  const tabs: { key: StaffKind | "all"; label: string; href: string }[] = [
    { key: "all", label: "Toute l'équipe", href: "/personnel" },
    ...STAFF_KINDS.map((kind) => ({
      key: kind,
      label: STAFF_KIND_PLURALS[kind],
      href: `/personnel?type=${kind}`,
    })),
  ];
  const active = current ?? "all";

  return (
    <nav aria-label="Métiers" className="overflow-x-auto">
      <ul className="bg-muted/60 flex w-max gap-1 rounded-xl p-1">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg px-3 text-sm font-medium whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-gradient-brand text-white shadow-sm"
                    : "text-muted-foreground hover:bg-card hover:text-foreground",
                )}
              >
                {tab.label}
                <span
                  className={cn(
                    "rounded-full px-1.5 text-xs tabular-nums",
                    isActive ? "bg-white/20" : "bg-card",
                  )}
                >
                  {counts[tab.key]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
