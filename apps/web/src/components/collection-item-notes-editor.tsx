import { faArrowDown, faArrowUp } from "@fortawesome/pro-light-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { CollectionItemNoteWrite } from "@package/services";
import { normalizeCollectionName } from "@package/services/catalog-terminology";
import {
  formatTranslation,
  type TranslationKey,
} from "@pocket-trash/localizations";
import { useForm, useStore } from "@tanstack/react-form";
import { useId, useRef } from "react";
import {
  MarkdownEditor,
  type MarkdownEditorHandle,
} from "@/components/markdown-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLocale } from "@/providers/locale-provider";

/**
 * Makes each visibility group's draft positions contiguous without changing its relative order.
 * @param notes - Draft note list after an edit, deletion, or ordering action.
 * @returns Independently ordered note groups ready for the parent save.
 */
function orderedNotes(
  notes: CollectionItemNoteWrite[],
): CollectionItemNoteWrite[] {
  return [true, false].flatMap((isPublic) =>
    notes
      .filter((note) => note.isPublic === isPublic)
      .sort((a, b) => a.position - b.position)
      .map((note, position) =>
        note.position === position ? note : { ...note, position },
      ),
  );
}

/**
 * Owns one note dialog while the item form owns the complete unsaved note list.
 * @param props - Owner-authorized note drafts and their form update operation.
 * @returns Compact summaries, independent ordering controls, and one Markdown dialog.
 */
export function CollectionItemNotesEditor(props: {
  /** Current owner-visible notes, including unsaved edits. */
  value: CollectionItemNoteWrite[];
  /**
   * Replaces the item form's note drafts; persistence occurs with its atomic save.
   * @param notes - Complete replacement draft list.
   */
  onChange: (notes: CollectionItemNoteWrite[]) => void;
}) {
  const { locale } = useLocale();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const editor = useRef<MarkdownEditorHandle>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const addButton = useRef<HTMLButtonElement>(null);
  /**
   * Formats one note message using the active locale.
   * @param key - Semantic localization key.
   * @param values - Complete-message interpolation values.
   * @returns Localized note copy.
   */
  const t = (
    key: TranslationKey,
    values: Record<string, string | number> = {},
  ) => formatTranslation(key, values, locale);
  /** Initial dialog state; private is the default for every new note. */
  const defaults = {
    id: "",
    originalKey: "",
    name: "",
    content: "",
    isPublic: false,
    editorKey: "initial",
    editorLoading: true,
  };
  /**
   * Validates trimmed note bounds and normalized uniqueness before committing a draft.
   * @param input - Current dialog fields.
   * @returns A localized validation key, or undefined when the note is valid.
   */
  const validate = (input: {
    /** Current dialog fields. */ value: typeof defaults;
  }): TranslationKey | undefined => {
    const value = input.value;
    const name = value.name.trim();
    const content = value.content.trim();
    if ([...name].length < 1 || [...name].length > 100)
      return "web.collectionItemMetadata.noteNameError";
    if (
      props.value.some(
        (note) =>
          (note.id ?? note.name) !== value.originalKey &&
          normalizeCollectionName(note.name) === normalizeCollectionName(name),
      )
    )
      return "web.collectionItemMetadata.duplicateNoteNameError";
    if ([...content].length < 5 || [...content].length > 2000)
      return "web.collectionItemMetadata.noteContentError";
    return undefined;
  };
  const form = useForm({
    defaultValues: defaults,
    validators: { onChange: validate, onSubmit: validate },
    /**
     * Commits a valid dialog draft to the parent form and restores a stable focus target.
     * @param input - Validated note dialog fields.
     */
    onSubmit: ({ value }) => {
      if (value.editorLoading) return;
      const previous = props.value.find(
        (note) => (note.id ?? note.name) === value.originalKey,
      );
      const position =
        previous?.isPublic === value.isPublic
          ? previous.position
          : props.value.filter(
              (note) => note.isPublic === value.isPublic && note !== previous,
            ).length;
      const next = {
        id: value.id,
        name: value.name.trim(),
        content: value.content.trim(),
        isPublic: value.isPublic,
        position,
      };
      props.onChange(
        orderedNotes([
          ...props.value.filter((note) => note !== previous),
          next,
        ]),
      );
      dialog.current?.close();
      if (
        previous &&
        (previous.isPublic !== value.isPublic || previous.id === undefined)
      )
        addButton.current?.focus();
    },
  });
  const fields = useStore(form.store, (state) => state.values);
  const canSubmit = useStore(form.store, (state) => state.canSubmit);
  const error = validate({ value: fields });
  const nameError =
    error === "web.collectionItemMetadata.noteNameError" ||
    error === "web.collectionItemMetadata.duplicateNoteNameError"
      ? error
      : undefined;
  const contentError =
    error === "web.collectionItemMetadata.noteContentError" ? error : undefined;
  /**
   * Opens an existing note or a fresh private note with a new editor lifetime.
   * @param note - Existing draft, or undefined to add a note.
   */
  const open = (note?: CollectionItemNoteWrite) => {
    form.reset(
      {
        ...defaults,
        ...note,
        id: note?.id ?? crypto.randomUUID(),
        originalKey: note ? (note.id ?? note.name) : "",
        editorKey: crypto.randomUUID(),
        editorLoading: true,
      },
      { keepDefaultValues: true },
    );
    dialog.current?.showModal();
    nameInput.current?.focus();
  };
  /**
   * Moves one note inside its current visibility group without reordering the other group.
   * @param note - Note whose position changes.
   * @param direction - Adjacent position offset.
   */
  const move = (note: CollectionItemNoteWrite, direction: -1 | 1) => {
    const group = props.value
      .filter((value) => value.isPublic === note.isPublic)
      .sort((a, b) => a.position - b.position);
    const index = group.findIndex((value) => value === note);
    const other = group[index + direction];
    if (!other) return;
    props.onChange(
      orderedNotes(
        props.value.map((value) =>
          value === note
            ? { ...value, position: other.position }
            : value === other
              ? { ...value, position: note.position }
              : value,
        ),
      ),
    );
  };
  return (
    <section className="mt-4 grid gap-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3>{t("web.collectionItemMetadata.notes")}</h3>
        <Button
          ref={addButton}
          type="button"
          variant="outline"
          onClick={() => open()}
        >
          {t("web.collectionItemMetadata.addNote")}
        </Button>
      </div>
      {!props.value.length ? (
        <p className="text-sm text-muted-foreground">
          {t("web.collectionItemMetadata.noNotes")}
        </p>
      ) : null}
      {[true, false].map((isPublic) => {
        const notes = props.value
          .filter((note) => note.isPublic === isPublic)
          .sort((a, b) => a.position - b.position);
        return notes.length ? (
          <section className="grid gap-2" key={String(isPublic)}>
            <h4 className="text-sm text-muted-foreground">
              {t(
                isPublic
                  ? "web.collectionItemMetadata.public"
                  : "web.collectionItemMetadata.private",
              )}
            </h4>
            {notes.map((note, index) => (
              <article
                key={note.id ?? note.name}
                className="grid gap-2 border border-border p-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h5 className="min-w-0 break-words text-sm font-semibold">
                    {note.name}
                  </h5>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("web.collectionItemMetadata.moveNoteUp", {
                        name: note.name,
                      })}
                      disabled={index === 0}
                      onClick={() => move(note, -1)}
                    >
                      <FontAwesomeIcon aria-hidden="true" icon={faArrowUp} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t("web.collectionItemMetadata.moveNoteDown", {
                        name: note.name,
                      })}
                      disabled={index === notes.length - 1}
                      onClick={() => move(note, 1)}
                    >
                      <FontAwesomeIcon aria-hidden="true" icon={faArrowDown} />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => open(note)}
                    >
                      {t("web.collectionItemMetadata.editNote")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        if (
                          window.confirm(
                            t(
                              "web.collectionItemMetadata.deleteNoteConfirmation",
                              { name: note.name },
                            ),
                          )
                        ) {
                          props.onChange(
                            orderedNotes(
                              props.value.filter((value) => value !== note),
                            ),
                          );
                          addButton.current?.focus();
                        }
                      }}
                    >
                      {t("web.collectionItemMetadata.deleteNote")}
                    </Button>
                  </div>
                </div>
                <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">
                  {note.content}
                </p>
              </article>
            ))}
          </section>
        ) : null;
      })}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            dialog.current?.close();
          }
        }}
        className="m-auto max-h-[90dvh] w-[min(36rem,95vw)] overflow-auto border border-border bg-background p-4 text-foreground backdrop:bg-black/50"
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            form.setFieldValue(
              "content",
              editor.current?.getValue() ?? fields.content,
            );
            void form.handleSubmit();
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id={`${id}-title`}>
              {t(
                props.value.some(
                  (note) => (note.id ?? note.name) === fields.originalKey,
                )
                  ? "web.collectionItemMetadata.editNote"
                  : "web.collectionItemMetadata.addNote",
              )}
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={() => dialog.current?.close()}
            >
              {t("action.cancel")}
            </Button>
          </div>
          <div className="grid gap-2">
            <label htmlFor={`${id}-name`}>
              {t("web.collectionItemMetadata.noteName")}
            </label>
            <Input
              ref={nameInput}
              required
              id={`${id}-name`}
              value={fields.name}
              aria-invalid={fields.name && nameError ? true : undefined}
              aria-describedby={
                fields.name && nameError ? `${id}-name-error` : undefined
              }
              onChange={(event) =>
                form.setFieldValue("name", event.target.value)
              }
            />
            {fields.name && nameError ? (
              <p
                id={`${id}-name-error`}
                role="alert"
                className="text-destructive"
              >
                {t(nameError)}
              </p>
            ) : null}
          </div>
          <MarkdownEditor
            ref={editor}
            key={fields.editorKey}
            id={`${id}-content`}
            label={t("web.collectionItemMetadata.noteContent")}
            aria-describedby={`${id}-content-help`}
            defaultValue={fields.content}
            counter={{ limit: 2000, warningAt: 1900, type: "characters" }}
            error={fields.content && contentError ? t(contentError) : undefined}
            onChange={(value) => {
              if (form.getFieldValue("editorKey") === fields.editorKey)
                form.setFieldValue("content", value);
            }}
            onLoadingChange={(loading) => {
              if (form.getFieldValue("editorKey") === fields.editorKey)
                form.setFieldValue("editorLoading", loading);
            }}
          />
          <p
            id={`${id}-content-help`}
            className="text-xs text-muted-foreground"
          >
            {t("web.collectionItemMetadata.noteContentError")}
          </p>
          <div className="grid gap-2">
            <span id={`${id}-visibility`}>
              {t("web.collectionItemMetadata.noteVisibility")}
            </span>
            <Switch
              checked={fields.isPublic}
              label={t("web.collectionItemMetadata.public")}
              onCheckedChange={(checked) =>
                form.setFieldValue("isPublic", checked)
              }
            />
          </div>
          <Button
            type="submit"
            disabled={!canSubmit || Boolean(error) || fields.editorLoading}
          >
            {t("web.collectionItemMetadata.saveNote")}
          </Button>
        </form>
      </dialog>
    </section>
  );
}
