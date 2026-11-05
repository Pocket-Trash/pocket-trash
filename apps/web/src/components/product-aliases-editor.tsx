import { faXmark } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { productAliasesSchema } from "@/lib/catalog-api";
import { useCatalogCopy } from "@/lib/catalog-copy";

/**
 * Edits optional alternate product names without submitting the enclosing product.
 * @param props - Controlled aliases and main-form feedback.
 * @param props.error - Server validation key for the saved alias set.
 * @param props.onChange - Replaces the product draft's complete alias set.
 * @param props.value - Alternate names for this exact product.
 * @returns Flat, initially collapsed alias disclosure and draft-name controls.
 */
export function ProductAliasesEditor({
  error,
  onChange,
  value,
}: {
  /** Server validation key for the alias set. */
  error?: string;
  /**
   * Replaces aliases in the enclosing product draft.
   * @param aliases - Complete alternate product names.
   */
  onChange: (aliases: string[]) => void;
  /** Current complete alias names. */
  value: string[];
}) {
  const t = useCatalogCopy();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * Applies the product's existing full-set validation to the proposed name.
   * @param input - Uncommitted alias text.
   * @returns First localized validation key when the name cannot be added.
   */
  const validate = ({
    value: draft,
  }: {
    /** Uncommitted name. */
    value: {
      /** Complete text, including commas. */
      name: string;
    };
  }) => {
    const result = productAliasesSchema.safeParse([...value, draft.name]);
    return result.success ? undefined : result.error.issues[0]?.message;
  };
  const form = useForm({
    defaultValues: { name: "" },
    validators: { onChange: validate, onSubmit: validate },
    /**
     * Appends one complete validated name to the product draft.
     * @param input - Uncommitted name submitted with Add or Enter.
     */
    onSubmit: ({ value: draft }) => {
      onChange([...value, draft.name.trim()]);
      form.reset();
      inputRef.current?.focus();
    },
  });
  const feedback = useStore(form.store, (state) => state.errors[0]);
  const submitting = useStore(form.store, (state) => state.isSubmitting);
  return (
    <details
      className="min-w-0 border-y py-4"
      ref={(node) => {
        if (node && error) node.open = true;
      }}
    >
      <summary className="cursor-pointer focus-visible:outline focus-visible:outline-ring">
        <h2 className="inline text-sm font-medium">
          {t("web.pens.admin.aliases")}
        </h2>{" "}
        {value.length ? (
          <Badge aria-hidden="true" className="align-middle" variant="outline">
            {value.length}
          </Badge>
        ) : null}{" "}
        {value.length ? (
          <span className="sr-only">
            {t("web.catalog.aliases.count", { count: value.length })}
          </span>
        ) : null}
        <span className="text-xs text-muted-foreground">
          {t("web.catalog.aliases.optional")}
        </span>
        <span className="mt-1 block pl-4 text-xs text-muted-foreground">
          {t("web.catalog.aliases.help")}
        </span>
      </summary>
      <div className="grid min-w-0 gap-3 pt-4">
        <form.Field name="name">
          {(field) => (
            <div className="grid gap-2">
              <label className="text-sm font-medium" htmlFor={inputId}>
                {t("web.catalog.aliases.input")}
              </label>
              <div className="flex min-w-0 items-start gap-2">
                <Input
                  aria-describedby={`${inputId}-help${feedback ? ` ${inputId}-error` : ""}`}
                  aria-invalid={Boolean(feedback)}
                  id={inputId}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      event.stopPropagation();
                      if (!event.nativeEvent.isComposing)
                        void form.handleSubmit();
                    }
                  }}
                  ref={inputRef}
                  value={field.state.value}
                />
                <Button
                  disabled={submitting}
                  onClick={() => void form.handleSubmit()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {t("web.catalog.aliases.add")}
                </Button>
              </div>
              <p
                className="text-xs text-muted-foreground"
                id={`${inputId}-help`}
              >
                {t("web.catalog.aliases.instruction")}
              </p>
              {feedback ? (
                <p
                  className="text-sm text-destructive"
                  id={`${inputId}-error`}
                  role="alert"
                >
                  {t(feedback)}
                </p>
              ) : null}
            </div>
          )}
        </form.Field>
        <div className="flex flex-wrap gap-2">
          {value.map((name, index) => (
            <Badge
              className="max-w-full gap-1 whitespace-normal"
              key={name}
              variant="secondary"
            >
              <span className="min-w-0 wrap-anywhere">{name}</span>
              <Button
                aria-label={t("web.catalog.aliases.remove", { name })}
                className="size-6 shrink-0"
                onClick={() => {
                  onChange(value.filter((_, position) => position !== index));
                  form.setErrorMap({
                    onChange: undefined,
                    onSubmit: undefined,
                  });
                  inputRef.current?.focus();
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <FontAwesomeIcon aria-hidden="true" icon={faXmark} />
              </Button>
            </Badge>
          ))}
        </div>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {t(error)}
          </p>
        ) : null}
      </div>
    </details>
  );
}
