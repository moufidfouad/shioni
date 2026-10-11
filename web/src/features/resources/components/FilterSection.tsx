import { Checkbox } from "@/components/ui/checkbox";

interface FilterOption {
  key: string;
  label: string;
}

export default function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: FilterOption[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2 border-b pb-4 last:border-b-0 last:pb-0">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <div className="space-y-1.5">
        {options.map((opt) => (
          <label
            key={opt.key}
            className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground"
          >
            <Checkbox
              checked={selected.includes(opt.key)}
              onCheckedChange={() => onToggle(opt.key)}
            />
            <span
              className={
                selected.includes(opt.key) ? "text-foreground" : undefined
              }
            >
              {opt.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
