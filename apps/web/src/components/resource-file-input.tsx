import { resourceMimeTypesByExtension } from "@package/services/constants";
import { ExternalLink, TriangleAlert, Upload, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appendResourceUploadFiles } from "@/lib/upload-sessions";
import { cn } from "@/lib/utils";

const acceptedResourceFiles = Object.keys(resourceMimeTypesByExtension).join(
  ",",
);

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
  aspectRatio,
  aspectRatioHelpHref,
  aspectRatioHelpLabel,
  aspectRatioWarning,
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
  aspectRatio?: number;
  aspectRatioHelpHref?: string;
  aspectRatioHelpLabel?: string;
  aspectRatioWarning?: string;
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
  const [hasAspectRatioMismatch, setHasAspectRatioMismatch] = useState(false);

  useEffect(() => {
    let active = true;
    if (!(aspectRatio && files.length)) {
      setHasAspectRatioMismatch(false);
      return;
    }

    void Promise.all(
      files.map((file) => imageHasDifferentAspectRatio(file, aspectRatio)),
    ).then((results) => {
      if (active) setHasAspectRatioMismatch(results.some(Boolean));
    });

    return () => {
      active = false;
    };
  }, [aspectRatio, files]);

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
      {hasAspectRatioMismatch &&
      aspectRatioWarning &&
      aspectRatioHelpHref &&
      aspectRatioHelpLabel ? (
        <div
          aria-live="polite"
          className="flex gap-2 border-l-4 border-primary bg-accent/30 p-3 text-sm font-normal"
        >
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
          />
          <p>
            {aspectRatioWarning}{" "}
            <a
              className="inline-flex items-center gap-1 text-primary underline underline-offset-2"
              href={aspectRatioHelpHref}
              rel="noopener noreferrer"
              target="_blank"
            >
              {aspectRatioHelpLabel}
              <ExternalLink aria-hidden="true" className="size-3.5" />
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}

export async function imageHasDifferentAspectRatio(
  file: File,
  expectedRatio: number,
): Promise<boolean> {
  const url = URL.createObjectURL(file);
  try {
    const { height, width } = await new Promise<{
      height: number;
      width: number;
    }>((resolve, reject) => {
      const image = new Image();
      image.onload = () =>
        resolve({ height: image.naturalHeight, width: image.naturalWidth });
      image.onerror = () => reject(new Error("Unable to read image size."));
      image.src = url;
    });
    return aspectRatioDiffers(width, height, expectedRatio);
  } catch {
    return false;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function aspectRatioDiffers(
  width: number,
  height: number,
  expectedRatio: number,
): boolean {
  return Math.abs(width / height - expectedRatio) > 0.01;
}
