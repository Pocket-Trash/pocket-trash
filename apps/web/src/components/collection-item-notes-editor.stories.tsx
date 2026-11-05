import type { CollectionItemNoteWrite } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useReducer } from "react";
import { expect, fn, waitFor, within } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { CollectionItemNotesEditor } from "./collection-item-notes-editor";

/**
 * Owns unsaved notes exactly as the surrounding collection form does.
 * @param props - Initial note drafts.
 * @returns An interactive owner note editor.
 */
function Controlled(props: {
  /** Initial owner-visible notes. */ value: CollectionItemNoteWrite[];
  /**
   * Observes a complete write at the parent form boundary.
   * @param notes - Committed note drafts.
   */
  onChange?: (notes: CollectionItemNoteWrite[]) => void;
}) {
  const [value, update] = useReducer(
    (_state: CollectionItemNoteWrite[], next: CollectionItemNoteWrite[]) =>
      next,
    props.value,
  );
  return (
    <CollectionItemNotesEditor
      value={value}
      onChange={(notes) => {
        update(notes);
        props.onChange?.(notes);
      }}
    />
  );
}
/** Owner note authoring, ordering, and validation stories. */
const meta = {
  component: Controlled,
  title: "Components/CollectionItemNotesEditor",
  args: { value: [], onChange: fn() },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
} satisfies Meta<typeof Controlled>;
export default meta;
/** Note editor story contract. */
type Story = StoryObj<typeof meta>;
/** Add/edit/delete uses one private-by-default Markdown dialog and restores focus. */
export const NoteLifecycle: Story = {
  /**
   * Installs the browser confirmation boundary.
   * @returns Cleanup restoring the original confirmation dialog.
   */
  beforeEach: () => {
    const original = window.confirm;
    window.confirm = fn(() => true);
    return () => {
      window.confirm = original;
    };
  },
  /**
   * Exercises private creation, Markdown source, visibility change, and confirmed deletion.
   * @param context - Story queries and real browser interactions.
   */
  play: async (context) => {
    const add = context.canvas.getByRole("button", { name: "Add note" });
    await context.userEvent.click(add);
    const modal = within(
      await context.canvas.findByRole("dialog", { name: "Add note" }),
    );
    await expect(
      modal.getByRole("switch", { name: "Public" }),
    ).not.toBeChecked();
    await context.userEvent.type(
      modal.getByRole("textbox", { name: "Note name" }),
      "Setup",
    );
    await context.userEvent.click(
      modal.getByRole("button", { name: "Source" }),
    );
    await context.userEvent.type(
      await modal.findByRole("textbox", { name: "Note content" }),
      "A **ceramic** bearing.",
    );
    const save = modal.getByRole("button", { name: "Save note" });
    await waitFor(() => expect(save).toBeEnabled());
    await context.userEvent.click(save);
    await expect(context.args.onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: "Setup",
        isPublic: false,
      }),
    ]);
    await expect(
      context.canvas.getByRole("heading", { name: "Private" }),
    ).toBeVisible();
    await expect(
      context.canvas.getByText("A **ceramic** bearing.", { selector: "p" }),
    ).toBeVisible();
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Edit note" }),
    );
    const edit = within(
      await context.canvas.findByRole("dialog", { name: "Edit note" }),
    );
    await context.userEvent.click(edit.getByRole("switch", { name: "Public" }));
    await waitFor(() =>
      expect(edit.getByRole("button", { name: "Save note" })).toBeEnabled(),
    );
    await context.userEvent.click(
      edit.getByRole("button", { name: "Save note" }),
    );
    await expect(add).toHaveFocus();
    await expect(
      context.canvas.getByRole("heading", { name: "Public" }),
    ).toBeVisible();
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Delete note" }),
    );
    await expect(window.confirm).toHaveBeenCalled();
    await expect(context.canvas.getByText("No notes yet.")).toBeVisible();
    await expect(add).toHaveFocus();
    await context.userEvent.click(add);
    await context.userEvent.keyboard("{Escape}");
    await expect(add).toHaveFocus();
  },
};
/** Ordering controls change one visibility group and retain the other group. */
export const IndependentOrdering: Story = {
  args: {
    value: [
      {
        id: "first",
        name: "Care",
        content: "Keep the bearing dry.",
        isPublic: true,
        position: 0,
      },
      {
        id: "second",
        name: "Setup",
        content: "A ceramic bearing.",
        isPublic: true,
        position: 1,
      },
      {
        id: "private",
        name: "Condition",
        content: "Private condition notes.",
        isPublic: false,
        position: 0,
      },
    ],
  },
  /**
   * Moves a public note while the private group's only note remains fixed.
   * @rejects When an ordering or visibility assertion fails.
   * @param context - Rendered note cards and browser interactions.
   */
  play: async (context) => {
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Move Setup up" }),
    );
    await expect(
      context.canvas
        .getAllByRole("heading", { level: 5 })
        .map((node) => node.textContent),
    ).toEqual(["Setup", "Care", "Condition"]);
    await expect(
      context.canvas.getByRole("button", { name: "Move Condition up" }),
    ).toBeDisabled();
    await expect(
      context.canvas.getByRole("button", { name: "Move Condition down" }),
    ).toBeDisabled();
    const conditionCard = context.canvas
      .getAllByRole("article")
      .find((card) =>
        within(card).queryByRole("heading", { name: "Condition" }),
      );
    if (!conditionCard) throw new Error("Condition card missing.");
    await context.userEvent.click(
      within(conditionCard).getByRole("button", { name: "Edit note" }),
    );
    const edit = within(
      await context.canvas.findByRole("dialog", { name: "Edit note" }),
    );
    await context.userEvent.click(edit.getByRole("switch", { name: "Public" }));
    await waitFor(() =>
      expect(edit.getByRole("button", { name: "Save note" })).toBeEnabled(),
    );
    await context.userEvent.click(
      edit.getByRole("button", { name: "Save note" }),
    );
    await expect(
      context.canvas
        .getAllByRole("heading", { level: 5 })
        .map((node) => node.textContent),
    ).toEqual(["Setup", "Care", "Condition"]);
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Move Condition up" }),
    );
    await expect(
      context.canvas
        .getAllByRole("heading", { level: 5 })
        .map((node) => node.textContent),
    ).toEqual(["Setup", "Condition", "Care"]);
  },
};
/** Duplicate names ignore accents, case, whitespace, and punctuation across scopes. */
export const DuplicateName: Story = {
  args: {
    value: [
      {
        id: "saved",
        name: "Roy's",
        content: "A saved public note.",
        isPublic: true,
        position: 0,
      },
    ],
  },
  /**
   * Connects normalized-name duplication to the dialog name field.
   * @param context - Rendered note editor and browser interactions.
   */
  play: async (context) => {
    await context.userEvent.click(
      context.canvas.getByRole("button", { name: "Add note" }),
    );
    const modal = within(
      await context.canvas.findByRole("dialog", { name: "Add note" }),
    );
    const name = modal.getByRole("textbox", { name: "Note name" });
    await context.userEvent.type(name, "RÓY’S");
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(modal.getByRole("alert")).toHaveTextContent(
      "A note with this name already exists.",
    );
    await expect(
      modal.getByRole("button", { name: "Save note" }),
    ).toBeDisabled();
  },
};
