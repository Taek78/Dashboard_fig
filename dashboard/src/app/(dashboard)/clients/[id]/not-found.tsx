import Link from "next/link";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ClientNotFound() {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
          <UserX />
        </EmptyMedia>
        <EmptyTitle>Client introuvable</EmptyTitle>
        <EmptyDescription>
          Ce client n&apos;existe pas ou n&apos;est plus disponible.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/clients" />}>
          Retour aux clients
        </Button>
      </EmptyContent>
    </Empty>
  );
}
