import type { CatalogImage, UserCollectionSummary } from "@package/services";
import {
  createColumnHelper,
  createPaginatedRowModel,
  rowPaginationFeature,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { FileDropInput } from "@/components/resource-file-input";
import { PublicResourceSwitch } from "@/components/resource-visibility-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getImageUploadGuidance } from "@/lib/help-content";
import { useLocale } from "@/providers/locale-provider";

export type CollectionFormValue = {
  description: string;
  isPrivate: boolean;
  name: string;
};

const managerPaginationFeatures = tableFeatures({
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});
const managerColumnHelper = createColumnHelper<
  typeof managerPaginationFeatures,
  CatalogImage
>();
const managerColumns = managerColumnHelper.columns([
  managerColumnHelper.accessor("id", { header: "id" }),
]);

export function CollectionForm({
  copy,
  disabled = false,
  error,
  includeImages = true,
  initialValue,
  onSubmit,
}: {
  copy: {
    browse: string;
    cover: string;
    description: string;
    descriptionPlaceholder: string;
    imageHelp: string;
    imageTypes: string;
    name: string;
    namePlaceholder: string;
    public: string;
    removeFile: string;
    submit: string;
  };
  disabled?: boolean;
  error?: string | null;
  includeImages?: boolean;
  initialValue?: CollectionFormValue;
  onSubmit(value: CollectionFormValue, images: File[]): void | Promise<void>;
}) {
  const { locale } = useLocale();
  const imageGuidance = getImageUploadGuidance(locale);
  const nameId = useId();
  const descriptionId = useId();
  const [value, setValue] = useState<CollectionFormValue>(
    initialValue ?? { description: "", isPrivate: true, name: "" },
  );
  const [files, setFiles] = useState<File[]>([]);
  return (
    <form
      className="grid max-w-3xl gap-5 rounded-xl border border-border bg-card p-6"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void onSubmit(value, files);
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
      <label className="grid gap-2 text-sm font-medium" htmlFor={descriptionId}>
        {copy.description}
        <textarea
          className="min-h-28 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
          disabled={disabled}
          id={descriptionId}
          onChange={(event) =>
            setValue({ ...value, description: event.target.value })
          }
          placeholder={copy.descriptionPlaceholder}
          value={value.description}
        />
      </label>
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
      <Button disabled={disabled || value.name.trim().length < 2} type="submit">
        {copy.submit}
      </Button>
    </form>
  );
}

export function CollectionCoverManager({
  collection,
  copy,
  disabled = false,
  onClear,
  onDelete,
  onSelect,
}: {
  collection: UserCollectionSummary;
  copy: {
    clear: string;
    clearConfirmation: string;
    current: string;
    delete: string;
    deleteConfirmation: string;
    history: string;
    nextPage: string;
    pageStatus(page: number, pageCount: number): string;
    previousPage: string;
    select: string;
  };
  disabled?: boolean;
  onClear(): void | Promise<void>;
  onDelete(image: CatalogImage): void | Promise<void>;
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

export function CollectionImageUploader({
  copy,
  disabled = false,
  error,
  onUpload,
}: {
  copy: {
    browse: string;
    imageHelp: string;
    imageTypes: string;
    label: string;
    removeFile: string;
    submit: string;
  };
  disabled?: boolean;
  error?: string | null;
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
