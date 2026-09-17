"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PASSWORD_ADVICE,
  PASSWORD_PROBLEM_MESSAGES,
  passwordStrength,
  type PasswordContext,
  type PasswordStrength,
} from "@/domain/auth/password-policy";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/domain/auth/types";
import { cn } from "@/lib/utils";

/*
 * Champ « nouveau mot de passe » avec sa JAUGE (client : la force se calcule
 * à chaque frappe, avec les règles pures de password-policy.ts, jamais zod).
 * Quatre segments et un mot : Trop court, Refusé (avec la raison), Correct,
 * Fort, Très fort. La jauge guide ; le serveur applique la même politique,
 * plus la vérification contre les fuites connues. `context` (nom, e-mail du
 * compte) sert à la règle « ni votre nom ni votre e-mail ».
 */
const SEGMENT: Record<PasswordStrength["level"], string> = {
  0: "bg-destructive",
  1: "bg-destructive",
  2: "bg-warning",
  3: "bg-success",
  4: "bg-success",
};
const TEXT: Record<PasswordStrength["level"], string> = {
  0: "text-destructive",
  1: "text-destructive",
  2: "text-warning",
  3: "text-success",
  4: "text-success",
};

export function PasswordField({
  id,
  name = id,
  label,
  autoComplete = "new-password",
  context,
  autoFocus,
  className,
}: {
  id: string;
  name?: string;
  label: string;
  autoComplete?: "new-password" | "current-password";
  context?: PasswordContext;
  autoFocus?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState("");
  const strength = passwordStrength(value, context);
  const filled = value.length === 0 ? 0 : Math.max(1, strength.level);

  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        aria-describedby={`${id}-strength`}
        onChange={(event) => setValue(event.target.value)}
      />
      <div id={`${id}-strength`} className="grid gap-1">
        <div className="grid grid-cols-4 gap-1" aria-hidden="true">
          {[1, 2, 3, 4].map((segment) => (
            <span
              key={segment}
              className={cn(
                "bg-muted h-1.5 rounded-full transition-colors",
                segment <= filled && SEGMENT[strength.level],
              )}
            />
          ))}
        </div>
        <p className="text-muted-foreground text-xs" aria-live="polite">
          {value.length === 0 ? (
            PASSWORD_ADVICE
          ) : (
            <>
              <span className={cn("font-semibold", TEXT[strength.level])}>
                {strength.label}
              </span>
              {strength.problem
                ? ` : ${PASSWORD_PROBLEM_MESSAGES[strength.problem]}`
                : null}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
