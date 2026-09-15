"use client";

import type * as React from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/*
 * Panneau de navigation mobile (Sheet, un Dialog de Base UI), sorti de
 * sidebar.tsx pour être chargé À LA DEMANDE (next/dynamic) : sur ordinateur il
 * n'est jamais affiché, et son code (dialogue, focus piégé, animations) ne
 * pèse plus sur le JavaScript initial de chaque page.
 */
const SIDEBAR_WIDTH_MOBILE = "18rem";

export function SidebarMobileSheet({
  open,
  onOpenChange,
  side,
  dir,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side: "left" | "right";
  dir?: React.ComponentProps<"div">["dir"];
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        dir={dir}
        data-sidebar="sidebar"
        data-slot="sidebar"
        data-mobile="true"
        className="bg-sidebar text-sidebar-foreground w-(--sidebar-width) max-w-[85vw] rounded-r-3xl p-0 shadow-2xl"
        style={
          {
            "--sidebar-width": SIDEBAR_WIDTH_MOBILE,
          } as React.CSSProperties
        }
        side={side}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Menu de navigation</SheetTitle>
          <SheetDescription>
            Navigation principale du back-office.
          </SheetDescription>
        </SheetHeader>
        <div className="flex h-full w-full flex-col">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
