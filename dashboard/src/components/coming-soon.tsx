import { Hourglass } from "lucide-react";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

/*
 * État vide commun des sections pas encore livrées (catalogue, clients, métriques…).
 *
 * - `feature` est une chaîne déjà rédigée avec son article (« Le catalogue »), pour
 *   que la phrase reste correcte.
 * - Une icône lucide est un composant : on la rend avec <Hourglass />, pas {Hourglass}
 *   (c'était l'erreur TS2322 : un composant n'est pas un ReactNode tant qu'il n'est
 *   pas instancié).
 * - `border` est nécessaire : la classe de base d'Empty pose border-dashed sans
 *   épaisseur, donc sans lui rien ne s'affiche.
 */
type ComingSoonProps = { feature: string };

export function ComingSoon({ feature }: ComingSoonProps) {
  return (
    <Empty className="min-h-[50vh] border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Hourglass />
        </EmptyMedia>
        <EmptyTitle>Bientôt disponible</EmptyTitle>
        <EmptyDescription>
          {feature} arrive dans une prochaine version du back-office.
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
