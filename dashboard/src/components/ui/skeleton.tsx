import { cn } from "cn";

/* Bloc de chargement : reflet traversant (utilitaire skeleton-shimmer de globals.css). */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
