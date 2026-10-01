import type { Meta, StoryObj } from "@storybook/tanstack-react";
import * as React from "react";
import { expect, fn, mocked, waitFor } from "storybook/test";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { MarkdownEditor } from "./markdown-editor";
import type { MarkdownVisualEditorProps } from "./markdown-visual-editor";

/** Storybook metadata for the Markdown editor. */
const meta = {
  args: {
    label: "Description",
    onChange: fn(),
    onLoadingChange: fn(),
  },
  /** Resets the visual editor module mock before each story. */
  beforeEach: async () => {
    (await visualEditorMock()).mockReset();
  },
  component: MarkdownEditor,
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[min(48rem,calc(100vw-2rem))]">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/MarkdownEditor",
} satisfies Meta<typeof MarkdownEditor>;

export default meta;
/** Markdown editor story type. */
type Story = StoryObj<typeof meta>;

/** Empty visual editor story. */
export const EmptyVisual: Story = {
  /**
   * Verifies the visual editor's accessible multiline surface.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-multiline", "true");
  },
};

/** Populated visual editor story. */
export const PopulatedVisual: Story = {
  args: {
    defaultValue:
      "# Daily carry\n\nA **small** collection with:\n\n- Pens\n- Notebooks",
  },
};

/** Visual toolbar interaction story. */
export const VisualToolbar: Story = {
  /**
   * Verifies heading formatting from the visual toolbar.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.click(canvas.getByRole("button", { name: "Heading 1" }));
    await userEvent.type(editor, "Toolbar heading");
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Toolbar heading" }),
    ).toBeVisible();
  },
};

/** Visual typing shortcut story. */
export const TypingShortcut: Story = {
  /**
   * Verifies the supported heading typing shortcut.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.type(editor, "# Typed heading");
    await expect(
      canvas.getByRole("heading", { level: 1, name: "Typed heading" }),
    ).toBeVisible();
  },
};

/** Unsupported initial code block story. */
export const UnsupportedCodeIsReadableText: Story = {
  args: { defaultValue: "```markdown\n# Not a real heading\n```" },
  /**
   * Verifies unsupported code renders as readable text.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await expect(editor).toHaveTextContent("# Not a real heading");
    await expect(editor.querySelector("code")).toBeNull();
  },
};

/** Unsupported pasted code block story. */
export const PastedCodeIsReadableText: Story = {
  /**
   * Verifies pasted code is downgraded to readable text.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.click(editor);
    await userEvent.paste("before\n\n```markdown\n# Pasted text\n```\n\nafter");
    await expect(editor).toHaveTextContent("# Pasted text");
    await expect(editor.textContent).toBe("before\n\n# Pasted text\n\nafter");
    await expect(editor.querySelector("code")).toBeNull();
  },
};

/** Visual undo and redo story. */
export const VisualHistory: Story = {
  /**
   * Verifies visual edits can be undone and redone.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    const editor = await canvas.findByRole("textbox", {
      name: "Description",
    });
    await userEvent.type(editor, "Undo me");
    await expect(editor).toHaveTextContent("Undo me");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await expect(editor).not.toHaveTextContent("Undo me");
    await userEvent.keyboard("{Meta>}{Shift>}z{/Shift}{/Meta}");
    await expect(editor).toHaveTextContent("Undo me");
  },
};

/** Source mode formatting story. */
export const Source: Story = {
  args: { defaultValue: "A **formatted** description." },
  /**
   * Verifies Source mode and exact formatting removal.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    const source = canvas.getByRole("textbox", {
      name: "Description",
    }) as HTMLTextAreaElement;
    await expect(source).toHaveValue("A **formatted** description.");
    source.setSelectionRange(2, 15);
    await userEvent.click(canvas.getByRole("button", { name: "Bold" }));
    await expect(source).toHaveValue("A formatted description.");
  },
};

/** Fixed-height loading state story. */
export const Loading: Story = {
  /** Leaves the mocked visual editor pending. */
  beforeEach: async () => {
    (await visualEditorMock()).mockImplementation(() => <></>);
  },
  /**
   * Verifies loading status and disabled toolbar controls.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("status")).toHaveTextContent(
      "Loading Markdown editor.",
    );
    await expect(canvas.getByRole("button", { name: "Bold" })).toBeDisabled();
  },
};

/** Value-preserving initialization fallback story. */
export const InitializationFallback: Story = {
  args: { defaultValue: "Keep **this** content." },
  /** Makes visual editor initialization fail. */
  beforeEach: async () => {
    (await visualEditorMock()).mockImplementation(FailingVisualEditor);
  },
  /**
   * Verifies fallback messaging and preserved Source content.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await waitFor(() =>
      expect(canvas.getByText(/visual editor couldn't load/i)).toBeVisible(),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveValue("Keep **this** content.");
  },
};

/** Disabled editor story. */
export const Disabled: Story = {
  args: { defaultValue: "This editor is disabled.", disabled: true },
  /**
   * Verifies the visual editor exposes disabled semantics.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-disabled", "true");
  },
};

/** Read-only editor story. */
export const ReadOnly: Story = {
  args: { defaultValue: "This editor is read-only.", readOnly: true },
  /**
   * Verifies the visual editor exposes read-only semantics.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-readonly", "true");
  },
};

/** Validation error story. */
export const Error: Story = {
  args: { error: "A description is required." },
  /**
   * Verifies error state is connected to the editing surface.
   *
   * @param context - Story interaction context.
   * @returns A promise that resolves after assertions complete.
   */
  play: async ({ canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Source" }));
    await expect(
      canvas.getByRole("textbox", { name: "Description" }),
    ).toHaveAttribute("aria-invalid", "true");
  },
};

/** Normal character counter story. */
export const CharacterNormal: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "Short",
  },
};

/** Warning character counter story. */
export const CharacterWarning: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "123456789012345",
  },
};

/** Exact character limit story. */
export const CharacterLimitReached: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "12345678901234567890",
  },
};

/** Over character limit story. */
export const CharacterOverLimit: Story = {
  args: {
    counter: { limit: 20, type: "characters", warningAt: 15 },
    defaultValue: "123456789012345678901",
  },
};

/** Normal word counter story. */
export const WordNormal: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two",
  },
};

/** Warning word counter story. */
export const WordWarning: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four",
  },
};

/** Exact word limit story. */
export const WordLimitReached: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four five",
  },
};

/** Over word limit story. */
export const WordOverLimit: Story = {
  args: {
    counter: { limit: 5, type: "words", warningAt: 4 },
    defaultValue: "one two three four five six",
  },
};

/**
 * Story-only visual editor that reports initialization failure.
 *
 * @param props - Visual editor properties.
 * @param props.onError - Failure callback.
 * @returns An empty visual editor element.
 */
function FailingVisualEditor({ onError }: MarkdownVisualEditorProps) {
  React.useEffect(onError, [onError]);
  return <></>;
}

/**
 * Loads the Storybook visual editor mock.
 *
 * @returns The typed visual editor mock.
 */
async function visualEditorMock() {
  const { MarkdownVisualEditor } = await import("./markdown-visual-editor");
  return mocked(MarkdownVisualEditor);
}
