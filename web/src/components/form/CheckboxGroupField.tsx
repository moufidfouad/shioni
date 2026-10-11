import { useField } from "formik";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface CheckboxGroupOption {
  value: string;
  label: string;
}

export interface CheckboxGroupFieldProps {
  name: string;
  label?: string;
  options: CheckboxGroupOption[];
  wrapperClassName?: string;
  itemClassName?: string;
}

// Ensemble de cases à cocher lié à un tableau Formik (ex: les rôles d'un
// membre — un utilisateur peut en cumuler plusieurs). Voir `CheckboxField`
// pour une case unique liée à un simple booléen.
export default function CheckboxGroupField({ name, label, options, wrapperClassName, itemClassName }: CheckboxGroupFieldProps) {
  const [field, meta, helpers] = useField<string[]>(name);
  const values = field.value ?? [];
  const hasError = meta.touched && Boolean(meta.error);

  function toggle(value: string) {
    const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
    helpers.setValue(next);
    helpers.setTouched(true);
  }

  return (
    <div className={cn("space-y-2", wrapperClassName)}>
      {label && <Label>{label}</Label>}
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt.value} className={cn("flex items-center gap-2 text-sm", itemClassName)}>
            <Checkbox checked={values.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
            {opt.label}
          </label>
        ))}
      </div>
      {hasError && <p className="text-sm text-destructive">{meta.error as string}</p>}
    </div>
  );
}
