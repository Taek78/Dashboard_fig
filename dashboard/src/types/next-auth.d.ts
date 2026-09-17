import type { Role } from "@/domain/auth/roles";
import type { DefaultSession } from "next-auth";

/*
 * Augmentation des types Auth.js : le rôle voyage dans le User renvoyé par
 * authorize(), dans le jeton JWT, puis dans session.user.
 */
declare module "next-auth" {
  interface User {
    role: Role;
  }
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
    /** Ouverture de la session (ms) : comparée à passwordChangedAt à chaque lecture. */
    sat?: number;
  }
}
