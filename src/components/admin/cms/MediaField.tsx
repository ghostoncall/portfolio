// Media field: wraps MediaItemFields (library picker + URL/alt/caption fields).

import * as React from "react";
import { MediaItem } from "@/components/media";
import { MediaItemFields } from "@/components/admin/MediaPicker";
import { Field } from "./FormSection";

export function MediaField({
  label,
  value,
  onChange,
  accept = "image",
}: {
  label?: string | undefined;
  value: MediaItem | undefined;
  onChange: (value: MediaItem) => void;
  accept?: "image" | "pdf" | "any" | undefined;
}) {
  const item = value ?? {};
  return (
    <Field label={label} hint={undefined} error={undefined} className={undefined}>
      <MediaItemFields
        label={label ?? "Media"}
        value={item}
        onChange={onChange}
        accept={accept === "pdf" ? "any" : accept}
      />
    </Field>
  );
}
