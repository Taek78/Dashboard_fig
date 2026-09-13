import Link from "next/link";
import { tableFrame } from "@/components/orders/orders-table";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Customer } from "@/domain/customers/types";

/* Tableau des clients (serveur). Le nom mène à la fiche ; e-mail et téléphone sont des liens d'action. */
const hideOnMobile = "hidden md:table-cell";

export function CustomersTable({ customers }: { customers: Customer[] }) {
  return (
    <div className={tableFrame}>
      <Table>
        <TableCaption className="sr-only">
          Clients avec leurs coordonnées.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Nom</TableHead>
            <TableHead scope="col">E-mail</TableHead>
            <TableHead scope="col" className={hideOnMobile}>
              Téléphone
            </TableHead>
            <TableHead scope="col" className={hideOnMobile}>
              Ville
            </TableHead>
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
              <TableCell className={`${hideOnMobile} tabular-nums`}>
                {customer.phone}
              </TableCell>
              <TableCell className={hideOnMobile}>
                {customer.postalCode} {customer.city}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
