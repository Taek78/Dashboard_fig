import Link from "next/link";
import { Mail, MapPin, Phone, Users } from "lucide-react";
import { LoyaltyBadge } from "@/components/customers/loyalty-badge";
import { mobileCardFrame, tableFrame } from "@/components/orders/orders-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoyaltyStatus } from "@/domain/customers/loyalty";
import type { Customer } from "@/domain/customers/types";
import { toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Liste des clients (serveur). Sous 768 px, une pile de cartes : le nom mène à
 * la fiche, l'e-mail et le téléphone sont des liens d'action (mailto:, tel:)
 * assez grands pour le doigt. À partir de 768 px, le tableau ; Téléphone et
 * Ville apparaissent dès 1024 px. Un seul des deux rendus est affiché.
 * `loyalty` (par id de client) affiche la série de fidélité ; `showCommunity`
 * ajoute la communauté d'appartenance (liste d'une communauté : inutile).
 */
const hideUntilLg = "hidden lg:table-cell";

export function CustomersTable({
  customers,
  loyalty,
  showCommunity = true,
}: {
  customers: Customer[];
  loyalty?: ReadonlyMap<string, LoyaltyStatus>;
  showCommunity?: boolean;
}) {
  return (
    <>
      <ul className="flex flex-col gap-3 md:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className={mobileCardFrame}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/clients/${customer.id}`}
                className="font-medium underline-offset-4 hover:underline focus-visible:underline"
              >
                {customer.fullName}
              </Link>
              {loyalty?.get(customer.id) ? (
                <LoyaltyBadge status={loyalty.get(customer.id)!} />
              ) : null}
            </div>
            <ul className="flex flex-col gap-1.5 text-sm">
              <li className="flex items-center gap-2">
                <Mail
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <a
                  href={`mailto:${customer.email}`}
                  className="min-w-0 truncate underline-offset-4 hover:underline"
                >
                  <span className="sr-only">E-mail : </span>
                  {customer.email}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <a
                  href={toTelHref(customer.phone)}
                  className="tabular-nums underline-offset-4 hover:underline"
                >
                  <span className="sr-only">Téléphone : </span>
                  {customer.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <MapPin
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  <span className="sr-only">Ville : </span>
                  {customer.postalCode} {customer.city}
                </span>
              </li>
              {showCommunity && customer.community ? (
                <li className="flex items-center gap-2">
                  <Users
                    className="text-muted-foreground size-4 shrink-0"
                    aria-hidden="true"
                  />
                  <Link
                    href={`/clients/communautes/${customer.community.id}`}
                    className="underline-offset-4 hover:underline"
                  >
                    <span className="sr-only">Communauté : </span>
                    {customer.community.name}
                  </Link>
                </li>
              ) : null}
            </ul>
          </li>
        ))}
      </ul>

      <div className={cn(tableFrame, "hidden md:block")}>
        <Table>
          <TableCaption className="sr-only">
            Clients avec leurs coordonnées et leur fidélité.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead scope="col">Nom</TableHead>
              <TableHead scope="col">E-mail</TableHead>
              <TableHead scope="col" className={hideUntilLg}>
                Téléphone
              </TableHead>
              <TableHead scope="col" className={hideUntilLg}>
                Ville
              </TableHead>
              {showCommunity ? (
                <TableHead scope="col" className={hideUntilLg}>
                  Communauté
                </TableHead>
              ) : null}
              {loyalty ? <TableHead scope="col">Fidélité</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/clients/${customer.id}`}
                    className="underline-offset-4 hover:underline focus-visible:underline"
                  >
                    {customer.fullName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground break-all">
                  {customer.email}
                </TableCell>
                <TableCell className={`${hideUntilLg} tabular-nums`}>
                  {customer.phone}
                </TableCell>
                <TableCell className={hideUntilLg}>
                  {customer.postalCode} {customer.city}
                </TableCell>
                {showCommunity ? (
                  <TableCell className={hideUntilLg}>
                    {customer.community ? (
                      <Link
                        href={`/clients/communautes/${customer.community.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {customer.community.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                ) : null}
                {loyalty ? (
                  <TableCell>
                    {loyalty.get(customer.id) ? (
                      <LoyaltyBadge status={loyalty.get(customer.id)!} />
                    ) : null}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
