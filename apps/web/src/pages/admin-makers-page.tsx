import type { CatalogMaker } from "@package/services";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { Link, useNavigate } from "@tanstack/react-router";
import { Factory, Pencil } from "lucide-react";
import { type FormEvent, type ReactNode, useState } from "react";
import { AdminPageShell } from "@/components/admin-page-shell";
import { CatalogMarkdownEditor } from "@/components/catalog-markdown-editor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  makerProfileSchema,
  productSlugPreview,
  saveAdminMaker,
} from "@/lib/catalog-api";
import { cn } from "@/lib/utils";
import { useLocale } from "@/providers/locale-provider";

/** Maker directory page properties. */
interface AdminMakersPageProperties {
  /** Name-sorted maker profiles available to the administrator. */
  makers: CatalogMaker[];
}

/** Maker form page properties. */
interface AdminMakerFormPageProperties {
  /** Existing maker profile, or `undefined` for creation. */
  maker?: CatalogMaker;
}

/**
 * Renders the maker administration directory.
 *
 * @param props - Maker directory properties.
 * @param props.makers - Name-sorted maker profiles available to the administrator.
 * @returns The maker administration page.
 */
export function AdminMakersPage({ makers }: AdminMakersPageProperties) {
  const { locale } = useLocale();
  /**
   * Formats maker-administration copy for the active locale.
   *
   * @param key - Localization key.
   * @param values - Translation interpolation values.
   * @returns Localized maker-administration copy.
   */
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);

  return (
    <AdminPageShell section="makers" title={t("web.admin.makers.title")}>
      <main className="grid content-start gap-5 p-4 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="grid gap-1">
            <p className="m-0 text-sm text-muted-foreground">
              {t("web.admin.makers.description")}
            </p>
          </div>
          <Link className={buttonVariants()} to="/admin/makers/add">
            {t("web.action.addMaker")}
          </Link>
        </div>
        {makers.length ? (
          <ul className="grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {makers.map((maker) => (
              <li
                className="grid gap-3 rounded-lg border border-border bg-card p-4 text-card-foreground"
                key={maker.id}
              >
                <div className="flex items-start gap-3">
                  <Factory aria-hidden="true" className="mt-0.5 size-5" />
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-base font-semibold">
                      {maker.name}
                    </h2>
                    <p className="m-0 truncate text-xs text-muted-foreground">
                      {maker.slug}
                    </p>
                  </div>
                </div>
                <Link
                  aria-label={t("web.admin.makers.editMaker", {
                    name: maker.name,
                  })}
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "w-full",
                  )}
                  params={{ makerId: String(maker.id) }}
                  to="/admin/makers/$makerId/edit"
                >
                  <Pencil aria-hidden="true" />
                  {t("web.action.edit")}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
            {t("web.admin.makers.empty")}
          </p>
        )}
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders the maker profile create or edit form.
 *
 * @param props - Maker form properties.
 * @param props.maker - Existing maker profile, or `undefined` for creation.
 * @returns The maker profile form page.
 */
export function AdminMakerFormPage({ maker }: AdminMakerFormPageProperties) {
  const { locale } = useLocale();
  const navigate = useNavigate();
  const [name, setName] = useState(maker?.name ?? "");
  const [rootUrl, setRootUrl] = useState(maker?.rootUrl ?? "");
  const [description, setDescription] = useState(maker?.description ?? "");
  const [editorLoading, setEditorLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});
  const [formError, setFormError] = useState<string | null>(null);
  /**
   * Formats maker-form copy for the active locale.
   *
   * @param key - Localization key.
   * @param values - Translation interpolation values.
   * @returns Localized maker-form copy.
   */
  const t = (
    key: TranslationKey,
    values: Readonly<Record<string, unknown>> = {},
  ) => formatTranslation(key, values, locale);
  const title = maker
    ? t("web.admin.makers.editMaker", { name: maker.name })
    : t("web.action.addMaker");

  /**
   * Saves the current maker profile.
   *
   * @param event - Form submission event.
   * @returns A promise that resolves after validation and navigation complete.
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editorLoading || busy) return;
    const values = {
      description,
      makerId: maker?.id ?? null,
      name,
      rootUrl,
    };
    const parsed = makerProfileSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      setFormError("web.catalog.error.form");
      return;
    }
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    const result = await saveAdminMaker({ data: values });
    if (!result.ok) {
      setFieldErrors(result.fieldErrors);
      setFormError(result.formError);
      setBusy(false);
      return;
    }
    await navigate({ to: "/admin/makers" });
  }

  /**
   * Returns the first localized error for one maker field.
   *
   * @param field - Maker form field name.
   * @returns The localized error, or `undefined` when valid.
   */
  function errorFor(field: string) {
    const key = fieldErrors[field]?.[0];
    return key ? t(key as TranslationKey) : undefined;
  }

  return (
    <AdminPageShell
      breadcrumbItems={[
        { label: t("web.admin.makers.title"), to: "/admin/makers" },
      ]}
      section="makers"
      title={title}
    >
      <main className="grid content-start gap-5 p-4 md:p-6">
        <form className="grid max-w-2xl gap-5" onSubmit={submit}>
          <MakerField
            error={errorFor("name")}
            label={t("web.catalog.field.name")}
          >
            <Input
              aria-invalid={Boolean(errorFor("name"))}
              disabled={busy}
              maxLength={200}
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
          </MakerField>
          <MakerField label={t("web.catalog.field.slug")}>
            <Input readOnly value={maker?.slug ?? productSlugPreview(name)} />
          </MakerField>
          <MakerField
            error={errorFor("rootUrl")}
            label={t("web.admin.makers.rootUrl")}
          >
            <Input
              aria-invalid={Boolean(errorFor("rootUrl"))}
              disabled={busy}
              onChange={(event) => setRootUrl(event.target.value)}
              type="url"
              value={rootUrl}
            />
          </MakerField>
          <CatalogMarkdownEditor
            defaultValue={description}
            disabled={busy}
            error={errorFor("description")}
            help={t("web.catalog.help.markdownDescription")}
            id="maker-description"
            label={t("web.catalog.field.description")}
            onChange={setDescription}
            onLoadingChange={setEditorLoading}
          />
          {formError ? (
            <p className="m-0 text-sm text-destructive" role="alert">
              {t(formError as TranslationKey)}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy || editorLoading} type="submit">
              {t("action.save")}
            </Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              to="/admin/makers"
            >
              {t("action.cancel")}
            </Link>
          </div>
        </form>
      </main>
    </AdminPageShell>
  );
}

/**
 * Renders one labelled maker-form control and its validation message.
 *
 * @param props - Field label, control, and optional localized error.
 * @returns The labelled maker-form field.
 */
function MakerField({
  children,
  error,
  label,
}: {
  /** Form control. */
  children: ReactNode;
  /** Localized validation error. */
  error?: string;
  /** Localized field label. */
  label: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
