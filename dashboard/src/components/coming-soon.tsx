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
 * - Une icône lucide est un composant : on la rend avec <Hourglass />, pas {Hourglass}.
 * - L'icône reçoit le dégradé de marque pour donner une touche de couleur à un
 *   écran qui, sinon, n'en a aucune.
 */
type ComingSoonProps = { feature: string };

export function ComingSoon({ feature }: ComingSoonProps) {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
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
