import { useId } from "react";

/** Shared immediate-save checkbox used by Résumé / CV and section settings. */
export function VisibilityToggle({
  label,
  visible,
  disabled,
  description,
  onChange,
}: {
  label: string;
  visible: boolean;
  disabled?: boolean;
  description?: string;
  onChange: (visible: boolean) => void;
}) {
  const helpId = useId();
  return (
    <div className="space-y-1">
      <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={visible}
          disabled={disabled}
          aria-describedby={description ? helpId : undefined}
          className="h-4 w-4 accent-foreground"
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        {label}
      </label>
      {description && (
        <p id={helpId} className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  );
}
