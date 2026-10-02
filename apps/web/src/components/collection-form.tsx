import type { CatalogImage, UserCollectionSummary } from "@package/services";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { FileDropInput } from "@/components/resource-file-input";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getImageUploadGuidance } from "@/lib/help-content";
import { useLocale } from "@/providers/locale-provider";

/**
 * Editable collection metadata submitted by the collection form.
 */
export type CollectionFormValue = {
  /**
   * Optional collection description entered by the user.
   */
  description: string;
  /**
   * Whether access to the collection is restricted.
   */
  isPrivate: boolean;
  /**
   * Collection name.
   */
  name: string;
  /**
   * Optional plain-text summary shown on collection cards.
   */
  summary: string;
};

/**
 * Pagination behavior used by the cover-history table.
 */
const managerPaginationFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
/**
 * Column builder for cover-history images.
 */
const managerColumnHelper = createColumnHelper<
  typeof managerPaginationFeatures,
  CatalogImage
>();
/**
 * Minimal columns required to paginate cover-history images.
 */
const managerColumns = managerColumnHelper.columns([
  managerColumnHelper.accessor("id", { header: "id" }),
]);

/**
 * Renders a stateful collection-details form with optional image selection.
 *
 * @param props - Collection form properties.
 * @param props.copy - Localized form labels and guidance.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.error - Optional submission error shown above the submit button.
 * @param props.includeImages - Whether to include the collection image picker.
 * @param props.initialValue - Initial metadata, defaulting to a blank private collection.
 * @param props.onSubmit - Receives the current metadata and selected image files.
 * @returns The collection form UI.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
export function CollectionForm({
  copy,
  disabled = false,
  error,
  includeImages = true,
  initialValue,
  onSubmit,
}: {
  /**
   * Localized form labels and guidance.
   */
  copy: {
    /**
     * Label for browsing image files.
     */
    browse: string;
    /**
     * Label for the cover-image field.
     */
    cover: string;
    /**
     * Label for the collection description.
     */
    description: string;
    /**
     * Placeholder for the collection description.
     */
    descriptionPlaceholder: string;
    /**
     * Guidance shown with the image picker.
     */
    imageHelp: string;
    /**
     * Description of accepted image formats.
     */
    imageTypes: string;
    /**
     * Label for the collection name.
     */
    name: string;
    /**
     * Placeholder for the collection name.
     */
    namePlaceholder: string;
    /**
     * Label for the public-visibility switch.
     */
    public: string;
    /**
     * Accessible label for removing a selected file.
     */
    removeFile: string;
    /**
     * Submit-button label.
     */
    submit: string;
    /**
     * Label for the collection summary.
     */
    summary: string;
    /**
     * Placeholder for the collection summary.
     */
    summaryPlaceholder: string;
  };
  /**
   * Whether interaction is disabled.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Optional submission error shown above the submit button.
   */
  error?: string | null;
  /**
   * Whether to include the collection image picker.
   *
   * @default true
   */
  includeImages?: boolean;
  /**
   * Initial metadata, defaulting to a blank private collection.
   *
   * @default { description: "", isPrivate: true, name: "", summary: "" }
   */
  initialValue?: CollectionFormValue;
  /**
   * Submits the current metadata and selected image files.
   *
   * @param value - Current collection metadata.
   * @param images - Image files selected for upload.
   * @returns No value, or a promise the form starts without awaiting.
   */
  onSubmit(value: CollectionFormValue, images: File[]): void | Promise<void>;
}) {
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const nameId = useId();
  const summaryId = useId();
  const descriptionId = useId();
  const descriptionRef = useRef<MarkdownEditorHandle>(null);
  const [value, setValue] = useState<CollectionFormValue>(
    initialValue ?? {
      description: "",
      isPrivate: true,
      name: "",
      summary: "",
    },
  );
  const [files, setFiles] = useState<File[]>([]);
  return (
    <form
      className="grid max-w-3xl gap-5 rounded-xl border border-border bg-card p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const description =
          descriptionRef.current?.getValue() ?? value.description;
        if (description.length > 5000 || value.summary.length > 200) return;
        void onSubmit({ ...value, description }, files);
      }}
    >
      <label className="grid gap-2 text-sm font-medium" htmlFor={nameId}>
        {copy.name}
        <Input
          disabled={disabled}
          id={nameId}
          maxLength={80}
          minLength={2}
          onChange={(event) => setValue({ ...value, name: event.target.value })}
          placeholder={copy.namePlaceholder}
          required
          value={value.name}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium" htmlFor={summaryId}>
        {copy.summary}
        <textarea
          className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled}
          id={summaryId}
          maxLength={200}
          name="summary"
          onChange={(event) =>
            setValue({ ...value, summary: event.target.value })
          }
          placeholder={copy.summaryPlaceholder}
          value={value.summary}
        />
      </label>
      <MarkdownEditor
        counter={{ limit: 5000, type: "characters", warningAt: 4800 }}
        defaultValue={value.description}
        disabled={disabled}
        id={descriptionId}
        label={copy.description}
        onChange={(description) =>
          setValue((current) => ({ ...current, description }))
        }
        placeholder={copy.descriptionPlaceholder}
        ref={descriptionRef}
      />
      <div className="grid gap-2">
        <span className="text-sm font-medium">{copy.public}</span>
        <PublicResourceSwitch
          checked={!value.isPrivate}
          disabled={disabled}
          onCheckedChange={(isPublic) =>
            setValue({ ...value, isPrivate: !isPublic })
          }
        />
      </div>
      {includeImages ? (
        <FileDropInput
          accept=".avif,.jpeg,.jpg,.png,.webp"
          aspectRatio={4 / 3}
          aspectRatioHelpHref="/help/image-size-and-resolution-guide"
          aspectRatioHelpLabel={imageGuidance.helpLabel}
          aspectRatioWarning={imageGuidance.warning}
          browseLabel={copy.browse}
          description={copy.imageHelp}
          disabled={disabled}
          fileTypes={copy.imageTypes}
          files={files}
          id="collection-images"
          label={copy.cover}
          multiple
          onFilesChange={(additions) =>
            setFiles((current) => [...current, ...additions])
          }
          onRemove={(index) =>
            setFiles((current) =>
              current.filter((_, candidate) => candidate !== index),
            )
          }
          removeFileLabel={copy.removeFile}
        />
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button
        disabled={
          disabled ||
          value.name.trim().length < 2 ||
          value.description.length > 5000 ||
          value.summary.length > 200
        }
        type="submit"
      >
        {copy.submit}
      </Button>
    </form>
  );
}

/**
 * Renders the current cover and 12-image pages of historical covers.
 * History excludes the current cover and orders images by descending position, then ID.
 *
 * @param props - Collection cover manager properties.
 * @param props.collection - Collection whose cover images can be managed.
 * @param props.copy - Localized labels, confirmations, and pagination text.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.onClear - Clears the current cover after confirmation.
 * @param props.onDelete - Deletes a cover image after confirmation.
 * @param props.onSelect - Selects a historical image as the current cover.
 * @returns The collection cover manager UI.
 */
export function CollectionCoverManager({
  collection,
  copy,
  disabled = false,
  onClear,
  onDelete,
  onSelect,
}: {
  /**
   * Collection whose cover images can be managed.
   */
  collection: UserCollectionSummary;
  /**
   * Localized labels, confirmations, and pagination text.
   */
  copy: {
    /**
     * Label for clearing the current cover.
     */
    clear: string;
    /**
     * Confirmation prompt shown before clearing the current cover.
     */
    clearConfirmation: string;
    /**
     * Heading for the current cover.
     */
    current: string;
    /**
     * Label for deleting an image.
     */
    delete: string;
    /**
     * Confirmation prompt shown before deleting an image.
     */
    deleteConfirmation: string;
    /**
     * Heading and navigation label for cover history.
     */
    history: string;
    /**
     * Accessible label for the next history page.
     */
    nextPage: string;
    /**
     * Formats the visible page position.
     *
     * @param page - Current one-based page number.
     * @param pageCount - Total number of pages.
     * @returns Localized pagination status text.
     */
    pageStatus(page: number, pageCount: number): string;
    /**
     * Accessible label for the previous history page.
     */
    previousPage: string;
    /**
     * Label for selecting a historical cover.
     */
    select: string;
  };
  /**
   * Whether interaction is disabled.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Clears the current collection cover.
   *
   * @returns No value, or a promise the manager starts without awaiting.
   */
  onClear(): void | Promise<void>;
  /**
   * Deletes a collection cover image.
   *
   * @param image - Image selected for deletion.
   * @returns No value, or a promise the manager starts without awaiting.
   */
  onDelete(image: CatalogImage): void | Promise<void>;
  /**
   * Makes a historical image the current collection cover.
   *
   * @param image - Image selected as the cover.
   * @returns No value, or a promise the manager starts without awaiting.
   */
  onSelect(image: CatalogImage): void | Promise<void>;
}) {
  const current = collection.coverImage;
  const previous = useMemo(
    () =>
      [...collection.coverImages]
        .filter(({ id }) => id !== current?.id)
        .sort((left, right) =>
          right.position === left.position
            ? right.id - left.id
            : right.position - left.position,
        ),
    [collection.coverImages, current?.id],
  );
  const initialState = useMemo(
    () => ({ pagination: { pageIndex: 0, pageSize: 12 } }),
    [],
  );
  const table = useTable(
    {
      columns: managerColumns,
      data: previous,
      features: managerPaginationFeatures,
      initialState,
    },
    (state) => ({ pagination: state.pagination }),
  );
  const pageCount = table.getPageCount();
  return (
    <section className="grid max-w-3xl gap-4 rounded-xl border border-border bg-card p-6">
      <h2 className="font-semibold">{copy.current}</h2>
      {current ? (
        <>
          <img
            alt=""
            className="aspect-4/3 max-w-sm rounded-lg object-cover"
            src={current.url}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={disabled}
              onClick={() => {
                if (window.confirm(copy.clearConfirmation)) void onClear();
              }}
              type="button"
              variant="outline"
            >
              {copy.clear}
            </Button>
            <Button
              disabled={disabled}
              onClick={() => {
                if (window.confirm(copy.deleteConfirmation)) {
                  void onDelete(current);
                }
              }}
              type="button"
              variant="destructive"
            >
              {copy.delete}
              <span className="sr-only">{current.fileName}</span>
            </Button>
          </div>
        </>
      ) : null}
      {previous.length ? (
        <>
          <h3 className="font-semibold">{copy.history}</h3>
          <ul className="grid gap-4 sm:grid-cols-2">
            {table.getRowModel().rows.map(({ original: image }) => (
              <li className="grid gap-2" key={image.id}>
                <img
                  alt=""
                  className="aspect-4/3 w-full rounded-lg object-cover"
                  src={image.url}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={disabled}
                    onClick={() => void onSelect(image)}
                    type="button"
                    variant="outline"
                  >
                    {copy.select}
                  </Button>
                  <Button
                    disabled={disabled}
                    onClick={() => {
                      if (window.confirm(copy.deleteConfirmation)) {
                        void onDelete(image);
                      }
                    }}
                    type="button"
                    variant="destructive"
                  >
                    {copy.delete}
                    <span className="sr-only">{image.fileName}</span>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {pageCount > 1 ? (
            <nav
              aria-label={copy.history}
              className="flex items-center justify-center gap-3"
            >
              <Button
                aria-label={copy.previousPage}
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronLeft />
              </Button>
              <output aria-live="polite" className="text-sm">
                {copy.pageStatus(
                  table.state.pagination.pageIndex + 1,
                  pageCount,
                )}
              </output>
              <Button
                aria-label={copy.nextPage}
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                size="icon"
                type="button"
                variant="outline"
              >
                <ChevronRight />
              </Button>
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

/**
 * Renders a batch image uploader that clears successful submissions.
 *
 * @param props - Collection image uploader properties.
 * @param props.copy - Localized uploader labels and guidance.
 * @param props.disabled - Whether interaction is disabled.
 * @param props.error - Optional upload error shown above the submit button.
 * @param props.onUpload - Uploads the selected files and reports whether to clear them.
 * @returns The collection image uploader UI.
 * @throws {Error} When rendered outside `LocaleProvider`.
 */
export function CollectionImageUploader({
  copy,
  disabled = false,
  error,
  onUpload,
}: {
  /**
   * Localized uploader labels and guidance.
   */
  copy: {
    /**
     * Label for browsing image files.
     */
    browse: string;
    /**
     * Guidance shown with the image picker.
     */
    imageHelp: string;
    /**
     * Description of accepted image formats.
     */
    imageTypes: string;
    /**
     * Label for the image picker.
     */
    label: string;
    /**
     * Accessible label for removing a selected file.
     */
    removeFile: string;
    /**
     * Upload-button label.
     */
    submit: string;
  };
  /**
   * Whether interaction is disabled.
   *
   * @default false
   */
  disabled?: boolean;
  /**
   * Optional upload error shown above the submit button.
   */
  error?: string | null;
  /**
   * Uploads a batch of selected collection images.
   *
   * @param files - Image files selected for upload.
   * @returns Whether the uploader should clear the selected files.
   */
  onUpload(files: File[]): Promise<boolean>;
}) {
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const [files, setFiles] = useState<File[]>([]);
  return (
    <form
      className="grid max-w-3xl gap-4 rounded-xl border border-border bg-card p-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (files.length && (await onUpload(files))) setFiles([]);
      }}
    >
      <FileDropInput
        accept=".avif,.jpeg,.jpg,.png,.webp"
        aspectRatio={4 / 3}
        aspectRatioHelpHref="/help/image-size-and-resolution-guide"
        aspectRatioHelpLabel={imageGuidance.helpLabel}
        aspectRatioWarning={imageGuidance.warning}
        browseLabel={copy.browse}
        description={copy.imageHelp}
        disabled={disabled}
        fileTypes={copy.imageTypes}
        files={files}
        id="collection-gallery-images"
        label={copy.label}
        multiple
        onFilesChange={(additions) =>
          setFiles((current) => [...current, ...additions])
        }
        onRemove={(index) =>
          setFiles((current) =>
            current.filter((_, candidate) => candidate !== index),
          )
        }
        removeFileLabel={copy.removeFile}
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button disabled={disabled || !files.length} type="submit">
        {copy.submit}
      </Button>
    </form>
  );
}
