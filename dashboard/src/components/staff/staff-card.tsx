import {
  ArrowRight,
  CalendarDays,
  Clock,
  Copy,
  Mail,
  Pencil,
  Phone,
} from "lucide-react";
import { DeleteStaffButton } from "@/components/staff/delete-staff-button";
import {
  AvailabilityBadge,
  StaffKindBadge,
} from "@/components/staff/staff-badges";
import { buttonVariants } from "@/components/ui/button";
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { SHIFT_LABELS, WEEKDAY_LABELS, WEEKDAYS } from "@/domain/staff/kind";
import { staffFullName, type StaffWorkSummary } from "@/domain/staff/rules";
import type { StaffMember } from "@/domain/staff/types";
import { initials } from "@/lib/text";
import { formatDateFr, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Carte d'une personne de l'équipe (serveur) : identité et métier, coordonnées
 * en un tap, créneau et jours travaillés, compteurs d'activité calculés à
 * partir des commandes (préparées, livrées, en cours), lien vers la fiche.
 * Pour un rôle qui gère le personnel (admin, gestionnaire) : modifier (la
 * fiche, formulaire en haut), dupliquer (nouvelle fiche préremplie) et
 * supprimer (fenêtre de confirmation) directement depuis la carte. Les actions
 * revérifient le rôle côté serveur.
 */
export function StaffCard({
  member,
  summary,
  canManage = false,
}: {
  member: StaffMember;
  summary: StaffWorkSummary;
  /** Rôle autorisé à gérer le personnel : affiche les actions. */
  canManage?: boolean;
}) {
  const name = staffFullName(member);
  const isDriver = member.kind === "livreur";

  return (
    <article
      aria-label={`Personne ${name}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift cv-auto flex flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 @2xl/main:p-5",
        !member.active && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-gradient-brand flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
        >
          {initials(name)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="truncate text-lg leading-tight font-semibold">
            <HoverPrefetchLink
              href={`/personnel/${member.id}`}
              className="underline-offset-4 hover:underline focus-visible:underline"
            >
              {name}
            </HoverPrefetchLink>
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <StaffKindBadge kind={member.kind} />
            <AvailabilityBadge
              availability={member.availability}
              active={member.active}
            />
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">
          <Phone className="size-4" aria-hidden="true" />
          <span className="sr-only">Téléphone</span>
        </dt>
        <dd>
          <a
            href={toTelHref(member.phone)}
            className="tabular-nums underline-offset-4 hover:underline"
          >
            {member.phone}
          </a>
        </dd>
        <dt className="text-muted-foreground">
          <Mail className="size-4" aria-hidden="true" />
          <span className="sr-only">E-mail</span>
        </dt>
        <dd className="truncate">
          <a
            href={`mailto:${member.email}`}
            className="underline-offset-4 hover:underline"
          >
            {member.email}
          </a>
        </dd>
        <dt className="text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          <span className="sr-only">Créneau</span>
        </dt>
        <dd>{SHIFT_LABELS[member.shift]}</dd>
        <dt className="text-muted-foreground">
          <CalendarDays className="size-4" aria-hidden="true" />
          <span className="sr-only">Jours travaillés</span>
        </dt>
        <dd>
          <ul className="flex flex-wrap gap-1" aria-label="Jours travaillés">
            {WEEKDAYS.map((day) => {
              const works = member.workDays.includes(day);
              return (
                <li
                  key={day}
                  title={WEEKDAY_LABELS[day]}
                  className={cn(
                    "flex size-6 items-center justify-center rounded-md text-[11px] font-medium uppercase",
                    works
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground/60 line-through",
                  )}
                >
                  <span aria-hidden="true">{day.slice(0, 1)}</span>
                  <span className="sr-only">
                    {WEEKDAY_LABELS[day]}
                    {works ? "" : " (repos)"}
                  </span>
                </li>
              );
            })}
          </ul>
        </dd>
      </dl>

      <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl p-3 text-center">
        <div>
          <dt className="text-muted-foreground text-xs">
            {isDriver ? "Livrées" : "Préparées"}
          </dt>
          <dd className="text-lg font-semibold tabular-nums">
            {isDriver ? summary.delivered : summary.prepared}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">En cours</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {summary.inProgress}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Dernière</dt>
          <dd className="text-sm font-medium">
            {summary.lastActivityDate
              ? formatDateFr(summary.lastActivityDate)
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex flex-col gap-2 border-t pt-3">
        <HoverPrefetchLink
          href={`/personnel/${member.id}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "-ml-2 self-start",
          )}
        >
          Fiche et historique
          <ArrowRight />
        </HoverPrefetchLink>
        {canManage ? (
          <div
            role="group"
            aria-label={`Actions sur ${name}`}
            className="flex flex-wrap items-center gap-1.5"
          >
            <HoverPrefetchLink
              href={`/personnel/${member.id}#modifier`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Pencil />
              Modifier
            </HoverPrefetchLink>
            <HoverPrefetchLink
              href={`/personnel/nouveau?depuis=${member.id}`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Copy />
              Dupliquer
            </HoverPrefetchLink>
            <DeleteStaffButton staffId={member.id} name={name} compact />
          </div>
        ) : null}
      </div>
    </article>
  );
}
