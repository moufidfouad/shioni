import { ComponentProps, useState } from "react";
import { useField } from "formik";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TextInputFieldProps extends Omit<ComponentProps<"input">, "name" | "value" | "onChange" | "onBlur"> {
  /** Nom du champ dans les `values` Formik — aussi utilisé comme `id` par défaut. */
  name: string;
  label?: string;
  wrapperClassName?: string;
}

// Champ texte générique branché sur Formik via `useField` (au lieu du
// couple `<Field as={Input} />` + `<ErrorMessage />` répété dans chaque
// formulaire) : label, erreur affichée seulement après `touched`, et pour
// `type="password"` un bouton œil/œil barré qui bascule l'affichage en
// clair — sans jamais modifier `type` dans les `values` du formulaire (state
// d'affichage purement local).
export default function TextInputField({ name, label, type = "text", className, wrapperClassName, id, ...rest }: TextInputFieldProps) {
  const [field, meta] = useField(name);
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputId = id ?? name;
  const hasError = meta.touched && Boolean(meta.error);

  return (
    <div className={cn("space-y-1.5", wrapperClassName)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Input
          id={inputId}
          type={isPassword ? (showPassword ? "text" : "password") : type}
          aria-invalid={hasError || undefined}
          className={cn(isPassword && "pr-9", className)}
          {...field}
          value={field.value ?? ""}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {hasError && <p className="text-sm text-destructive">{meta.error}</p>}
    </div>
  );
}
