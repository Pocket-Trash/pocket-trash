import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appendResourceUploadFiles } from "@/lib/resource-upload-sessions";

const acceptedResourceFiles = ".stl,.3mf,.step,.stp,.pdf,.txt,.zip";

export function ResourceFileInput({
  description,
  disabled,
  fileTypes,
  files,
  id,
  label,
  onFilesChange,
  removeFileLabel,
}: {
  description: string;
  disabled?: boolean;
  fileTypes: string;
  files: File[];
  id: string;
  label: string;
  onFilesChange(files: File[]): void;
  removeFileLabel: string;
}) {
  const descriptionId = `${id}-description`;

  function addFiles(additions: Iterable<File>) {
    if (!disabled) {
      onFilesChange(appendResourceUploadFiles(files, additions));
    }
  }

  return (
    <div className="grid gap-2 text-sm font-medium">
      <div>
        <Input
          accept={acceptedResourceFiles}
          aria-describedby={descriptionId}
          className="peer sr-only"
          disabled={disabled}
          id={id}
          multiple
          onChange={(event) => {
            addFiles(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <label
          className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-input bg-background px-4 py-6 text-center transition-colors hover:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50"
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = disabled ? "none" : "copy";
          }}
          onDrop={(event) => {
            event.preventDefault();
            addFiles(event.dataTransfer.files);
          }}
        >
          <Upload aria-hidden="true" className="size-6 text-muted-foreground" />
          <span>{label}</span>
          <span
            className="text-xs leading-5 font-normal text-muted-foreground"
            id={descriptionId}
          >
            {description}
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {fileTypes}
          </span>
        </label>
      </div>

      {files.length > 0 ? (
        <ul aria-live="polite" className="m-0 grid list-none gap-2 p-0">
          {files.map((file, index) => (
            <li
              className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card pl-3"
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
            >
              <span className="min-w-0 flex-1 truncate font-normal">
                {file.name}
              </span>
              <Button
                aria-label={`${removeFileLabel} ${file.name}`}
                className="size-11"
                onClick={() =>
                  onFilesChange(
                    files.filter((_, fileIndex) => fileIndex !== index),
                  )
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <X />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
