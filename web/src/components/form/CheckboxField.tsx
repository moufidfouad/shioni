import { useField } from "formik";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CheckboxFieldProps {
  name: string;
  label: string;
  wrapperClassName?: string;
  disabled?: boolean;
}

// Case à cocher unique liée à un booléen Formik (ex: "obligatoire" pour une
// matière). Pour un ensemble de cases représentant un tableau de valeurs
// (ex: les rôles cochés d'un membre), voir `CheckboxGroupField`.
export default function CheckboxField({ name, label, wrapperClassName, disabled }: CheckboxFieldProps) {
  const [field, , helpers] = useField<boolean>(name);
  const inputId = name;

  return (
    <div className={cn("flex items-center gap-2", wrapperClassName)}>
      <Checkbox
        id={inputId}
        checked={Boolean(field.value)}
        disabled={disabled}
        onCheckedChange={(v) => helpers.setValue(v === true)}
      />
      <Label htmlFor={inputId} className="font-normal">
        {label}
      </Label>
    </div>
  );
}
