import { cn } from "@/lib/utils";

/**
 * The optional free-text `label` on a component, tinted with the component's
 * own colour. Used both on the minimized board card and in the expanded views.
 */
export function LabelChip({
  label,
  color,
  className,
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-[9px] font-bold leading-none",
        className,
      )}
      style={{
        color,
        backgroundColor: `color-mix(in oklch, ${color} 15%, transparent)`,
        borderColor: `color-mix(in oklch, ${color} 32%, transparent)`,
      }}
    >
      {label}
    </span>
  );
}
