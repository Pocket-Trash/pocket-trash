import {
  faArrowUpRightFromSquare,
  faTriangleExclamation,
  faUpload,
  faXmark,
} from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { resourceMimeTypesByExtension } from "@package/services/constants";
import { useReducer } from "react";
import { useImageFileValidation } from "@/hooks/use-image-file-validation";

export {
  aspectRatioDiffers,
  imageHasDifferentAspectRatio,
} from "@/hooks/use-image-file-validation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appendResourceUploadFiles } from "@/lib/upload-sessions";
import { cn } from "@/lib/utils";

/**
 * Comma-separated browser accept list derived from supported resource extensions.
 */
const acceptedResourceFiles = Object.keys(resourceMimeTypesByExtension).join(
  ",",
);

/**
 * Renders a multi-file resource picker that appends additions and removes by index.
 *
 * @param props - Resource file input properties.
 * @param props.browseLabel - Label for opening the native file browser.
 * @param props.description - Guidance associated with the input.
 * @param props.disabled - Whether browsing and dropping additions is disabled; existing files remain removable.
 * @param props.fileTypes - Human-readable supported file types.
 * @param props.files - Current selected files.
 * @param props.id - Native input ID.
 * @param props.label - Visible and accessible input label.
 * @param props.onFilesChange - Receives the updated file list.
 * @param props.removeFileLabel - Accessible label prefix for removing a file.
 * @returns The resource file-picker UI.
 */
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
  /**
   * Label for opening the native file browser.
   */
  browseLabel: string;
  /**
   * Guidance associated with the input.
   */
  description: string;
  /**
   * Whether browsing and dropping additions is disabled; existing files remain removable.
   */
  disabled?: boolean;
  /**
   * Human-readable supported file types.
   */
  fileTypes: string;
  /**
   * Current selected files.
   */
  files: File[];
  /**
   * Native input ID.
   */
  id: string;
  /**
   * Visible and accessible input label.
   */
  label: string;
  /**
   * Reports the updated resource file list.
   *
   * @param files - Current files with additions appended or one item removed.
   */
  onFilesChange(files: File[]): void;
  /**
   * Accessible label prefix for removing a file.
   */
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

/**
 * Renders a native file input with drag-and-drop, selection display, and optional aspect-ratio guidance.
 * Mismatch guidance appears only when the expected ratio, warning, help URL, and help label are all provided.
 *
 * @param props - File drop input properties.
 * @param props.accept - Native file-picker accept value.
 * @param props.aspectRatio - Expected width-to-height ratio used for guidance.
 * @param props.aspectRatioHelpHref - Help URL shown with an aspect-ratio warning.
 * @param props.aspectRatioHelpLabel - Accessible help-link label.
 * @param props.aspectRatioWarning - Warning shown when a selected image differs from the expected ratio.
 * @param props.browseLabel - Label for opening the native file browser.
 * @param props.description - Guidance associated with the input.
 * @param props.disabled - Whether browsing and dropping additions is disabled; existing files remain removable.
 * @param props.fileTypes - Human-readable supported file types.
 * @param props.files - Current selected files.
 * @param props.id - Native input ID and description-ID prefix.
 * @param props.label - Visible and accessible input label.
 * @param props.multiple - Whether one interaction may add multiple files.
 * @param props.onFilesChange - Receives newly selected files.
 * @param props.onRemove - Receives the index of a file to remove.
 * @param props.removeFileLabel - Accessible label prefix for removing a file.
 * @returns The file drop-input UI.
 */
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
  /**
   * Native file-picker accept value.
   */
  accept: string;
  /**
   * Expected width-to-height ratio used for guidance.
   */
  aspectRatio?: number;
  /**
   * Help URL shown with an aspect-ratio warning.
   */
  aspectRatioHelpHref?: string;
  /**
   * Accessible help-link label.
   */
  aspectRatioHelpLabel?: string;
  /**
   * Warning shown when a selected image differs from the expected ratio.
   */
  aspectRatioWarning?: string;
  /**
   * Label for opening the native file browser.
   */
  browseLabel: string;
  /**
   * Guidance associated with the input.
   */
  description: string;
  /**
   * Whether browsing and dropping additions is disabled; existing files remain removable.
   */
  disabled?: boolean;
  /**
   * Human-readable supported file types.
   */
  fileTypes: string;
  /**
   * Current selected files.
   */
  files: File[];
  /**
   * Native input ID and description-ID prefix.
   */
  id: string;
  /**
   * Visible and accessible input label.
   */
  label: string;
  /**
   * Whether one interaction may add multiple files.
   *
   * @default false
   */
  multiple?: boolean;
  /**
   * Reports files selected by browsing or dropping.
   *
   * @param files - All additions, or only the first addition in single-file mode.
   */
  onFilesChange(files: File[]): void;
  /**
   * Requests removal of one selected file.
   *
   * @param index - Zero-based index in `files`.
   */
  onRemove(index: number): void;
  /**
   * Accessible label prefix for removing a file.
   */
  removeFileLabel: string;
}) {
  const descriptionId = `${id}-description`;
  const [dragActive, dispatch] = useReducer(
    (_state: boolean, event: "dragEntered" | "dragLeft" | "filesDropped") =>
      event === "dragEntered",
    false,
  );
  const hasAspectRatioMismatch = useImageFileValidation(files, aspectRatio);

  /**
   * Reports enabled file additions according to the single- or multi-file mode.
   *
   * @param additions - Files chosen through the browser or drop target.
   */
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
          aria-label={label}
          className="peer sr-only size-px p-0 border-0"
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
            if (!disabled) dispatch("dragEntered");
          }}
          onDragLeave={() => dispatch("dragLeft")}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = disabled ? "none" : "copy";
            if (!disabled) dispatch("dragEntered");
          }}
          onDrop={(event) => {
            event.preventDefault();
            dispatch("filesDropped");
            addFiles(event.dataTransfer.files);
          }}
        >
          <FontAwesomeIcon
            aria-hidden="true"
            className="size-6 text-muted-foreground"
            icon={faUpload}
          />
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
                <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
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
          <FontAwesomeIcon
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0"
            icon={faTriangleExclamation}
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
              <FontAwesomeIcon
                aria-hidden="true"
                className="size-3.5"
                icon={faArrowUpRightFromSquare}
              />
            </a>
          </p>
        </div>
      ) : null}
    </div>
  );
}
