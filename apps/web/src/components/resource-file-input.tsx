import { Upload, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appendResourceUploadFiles } from "@/lib/resource-upload-sessions";
import { cn } from "@/lib/utils";

const acceptedResourceFiles = ".stl,.3mf,.step,.stp,.pdf,.txt,.zip";

export function ResourceFileInput({
  browseLabel,
  description,
  disabled,
  fileTypes,
  files,
  id,
  label,
  onFilesChange,
  removeFileLabel,
}: {
  browseLabel: string;
  description: string;
  disabled?: boolean;
  fileTypes: string;
  files: File[];
  id: string;
  label: string;
  onFilesChange(files: File[]): void;
  removeFileLabel: string;
}) {
  return (
    <FileDropInput
      accept={acceptedResourceFiles}
      browseLabel={browseLabel}
      description={description}
      disabled={disabled}
      files={files}
      fileTypes={fileTypes}
      id={id}
      label={label}
      multiple
      onFilesChange={(additions) =>
        onFilesChange(appendResourceUploadFiles(files, additions))
      }
      onRemove={(index) =>
        onFilesChange(files.filter((_, fileIndex) => fileIndex !== index))
      }
      removeFileLabel={removeFileLabel}
    />
  );
}

export function FileDropInput({
  accept,
  browseLabel,
  description,
  disabled,
  fileTypes,
  files,
  id,
  label,
  multiple = false,
  onFilesChange,
  onRemove,
  removeFileLabel,
}: {
  accept: string;
  browseLabel: string;
  description: string;
  disabled?: boolean;
  fileTypes: string;
  files: File[];
  id: string;
  label: string;
  multiple?: boolean;
  onFilesChange(files: File[]): void;
  onRemove(index: number): void;
  removeFileLabel: string;
}) {
  const descriptionId = `${id}-description`;
  const [dragActive, setDragActive] = useState(false);

  function addFiles(additions: Iterable<File>) {
    if (!disabled) {
      onFilesChange(multiple ? [...additions] : [...additions].slice(0, 1));
    }
  }

  return (
    <div className="grid gap-2 text-sm font-medium">
      <div>
        <Input
          accept={accept}
          aria-describedby={descriptionId}
          className="peer sr-only"
          disabled={disabled}
          id={id}
          multiple={multiple}
          onChange={(event) => {
            addFiles(event.currentTarget.files ?? []);
            event.currentTarget.value = "";
          }}
          type="file"
        />
        <label
          className={cn(
            "flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-input bg-background px-6 py-10 text-center transition-colors hover:border-ring hover:bg-accent/40 peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50 peer-disabled:pointer-events-none peer-disabled:opacity-50",
            dragActive && "border-ring bg-accent/60",
          )}
          htmlFor={id}
          onDragEnter={(event) => {
            event.preventDefault();
            if (!disabled) setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = disabled ? "none" : "copy";
            if (!disabled) setDragActive(true);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
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
          <span className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-accent">
            {browseLabel}
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
                onClick={() => onRemove(index)}
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
