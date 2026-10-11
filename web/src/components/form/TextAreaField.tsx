import { ComponentProps } from "react";
import { useField } from "formik";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface TextAreaFieldProps extends Omit<ComponentProps<"textarea">, "name" | "value" | "onChange" | "onBlur"> {
  name: string;
  label?: string;
  wrapperClassName?: string;
}

export default function TextAreaField({ name, label, className, wrapperClassName, id, ...rest }: TextAreaFieldProps) {
  const [field, meta] = useField(name);
  const inputId = id ?? name;
  const hasError = meta.touched && Boolean(meta.error);

  return (
    <div className={cn("space-y-1.5", wrapperClassName)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Textarea id={inputId} aria-invalid={hasError || undefined} className={className} {...field} value={field.value ?? ""} {...rest} />
      {hasError && <p className="text-sm text-destructive">{meta.error}</p>}
    </div>
  );
}
