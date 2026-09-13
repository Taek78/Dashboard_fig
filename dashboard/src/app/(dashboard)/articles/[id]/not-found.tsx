import Link from "next/link";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ArticleNotFound() {
  return (
    <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia
          variant="icon"
          className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
        >
          <FileQuestion />
        </EmptyMedia>
        <EmptyTitle>Article introuvable</EmptyTitle>
        <EmptyDescription>
          Cet article n&apos;existe pas ou a été supprimé.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" render={<Link href="/articles" />}>
          Retour aux articles
        </Button>
      </EmptyContent>
    </Empty>
  );
}
