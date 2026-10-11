import { useState } from "react";
import { useField } from "formik";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface SelectFieldOption {
  value: string;
  label: string;
  /** Termes supplémentaires pris en compte par la recherche (ex: matricule en plus du nom). */
  keywords?: string[];
}

export interface SelectFieldProps {
  name: string;
  label?: string;
  options: SelectFieldOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  /** Ajoute une option "—" en tête de liste pour vider la sélection. */
  clearable?: boolean;
  clearLabel?: string;
  wrapperClassName?: string;
  className?: string;
}

// Select "combobox" avec recherche, branché sur Formik via `useField` —
// remplace les `<Select>` shadcn/Radix simples utilisés jusqu'ici pour les
// listes longues (élèves, classes...) où retrouver une valeur en faisant
// défiler est pénible. Construit sur Popover + Command (cmdk), le patron
// standard shadcn/ui pour ce composant — API des deux librairies vérifiée
// sur les paquets réellement installés avant écriture (voir
// components/ui/command.tsx). Un `<Select>` Radix simple reste préférable
// pour les listes courtes (quelques options) : ce composant n'a pas
// vocation à remplacer partout `components/ui/select.tsx`.
export default function SelectField({
  name,
  label,
  options,
  placeholder = "Sélectionner…",
  searchPlaceholder = "Rechercher…",
  emptyMessage = "Aucun résultat.",
  disabled,
  clearable,
  clearLabel = "—",
  wrapperClassName,
  className,
}: SelectFieldProps) {
  const [field, meta, helpers] = useField<string>(name);
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === field.value);
  const inputId = name;
  const hasError = meta.touched && Boolean(meta.error);

  return (
    <div className={cn("space-y-1.5", wrapperClassName)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) helpers.setTouched(true);
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={inputId}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={hasError || undefined}
            disabled={disabled}
            className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", className)}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {clearable && (
                  <CommandItem
                    value={`__clear__ ${clearLabel}`}
                    onSelect={() => {
                      helpers.setValue("");
                      helpers.setTouched(true);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", field.value ? "opacity-0" : "opacity-100")} />
                    <span className="text-muted-foreground">{clearLabel}</span>
                  </CommandItem>
                )}
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    keywords={opt.keywords}
                    onSelect={() => {
                      helpers.setValue(opt.value);
                      helpers.setTouched(true);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", field.value === opt.value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {hasError && <p className="text-sm text-destructive">{meta.error}</p>}
    </div>
  );
}
