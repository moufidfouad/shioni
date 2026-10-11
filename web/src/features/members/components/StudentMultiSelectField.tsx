import { useState } from "react";
import { useField } from "formik";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface StudentOption {
  value: string;
  label: string;
}

export default function StudentMultiSelectField({
  name,
  options,
}: {
  name: string;
  options: StudentOption[];
}) {
  const [field, meta, helpers] = useField<string[]>(name);
  const [open, setOpen] = useState(false);
  const selected = field.value ?? [];
  const hasError = meta.touched && Boolean(meta.error);

  function toggle(value: string) {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    helpers.setValue(next);
    helpers.setTouched(true);
  }

  return (
    <div className="space-y-1.5">
      <Label>Élève(s)</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={hasError || undefined}
            className="w-full max-w-sm justify-between font-normal"
          >
            <span
              className={cn(
                "truncate",
                selected.length === 0 && "text-muted-foreground",
              )}
            >
              {selected.length === 0
                ? "Sélectionner un ou plusieurs élèves…"
                : `${selected.length} élève(s) sélectionné(s)`}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) max-w-sm p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Rechercher un élève…" />
            <CommandList>
              <CommandEmpty>Aucun élève trouvé.</CommandEmpty>
              <CommandGroup>
                {options.map((opt) => (
                  <CommandItem
                    key={opt.value}
                    value={opt.label}
                    onSelect={() => toggle(opt.value)}
                  >
                    <Check
                      className={cn(
                        "size-4",
                        selected.includes(opt.value)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {selected.map((id) => {
            const opt = options.find((o) => o.value === id);
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs"
              >
                {opt?.label ?? id}
                <button
                  type="button"
                  onClick={() => toggle(id)}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Retirer"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {hasError && (
        <p className="text-sm text-destructive">{meta.error as string}</p>
      )}
    </div>
  );
}
