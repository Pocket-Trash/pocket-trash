import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useForm } from "@tanstack/react-form";
import { expect, fn } from "storybook/test";
import { useCatalogCopy } from "@/lib/catalog-copy";
import { Button } from "@/components/ui/button";
import { StoryProviders } from "../../.storybook/story-fixtures";
import { ProductAliasesEditor } from "./product-aliases-editor";

/**
 * Hosts aliases inside a real parent form to detect accidental Enter submission.
 * @param props - Initial product aliases and persistence observer.
 * @param props.initialValue - Previously saved names, unchanged by draft edits.
 * @param props.onSave - Receives names only when the product is submitted.
 * @returns Controlled alias editor inside the main product form.
 */
function AliasStoryForm({
  initialValue = [],
  onSave,
}: {
  /** Previously saved product names. */
  initialValue?: string[];
  /**
   * Observes explicit product submission.
   * @param aliases - Complete saved alias set.
   */
  onSave: (aliases: string[]) => void;
}) {
  const t = useCatalogCopy();
  const form = useForm({
    defaultValues: { aliases: initialValue },
    /**
     * Persists only explicit main-form submission.
     * @param input - Current product alias draft.
     */
    onSubmit: ({ value }) => {
      onSave(value.aliases);
    },
  });
  return (
    <form
      className="grid min-w-0 grid-cols-1 gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="aliases">
        {(field) => (
          <ProductAliasesEditor
            onChange={field.handleChange}
            value={field.state.value}
          />
        )}
      </form.Field>
      <Button type="submit">{t("action.save")}</Button>
    </form>
  );
}

/** Alias disclosure and one-name-at-a-time entry stories. */
const meta = {
  component: AliasStoryForm,
  args: { initialValue: [], onSave: fn() },
  decorators: [
    (Story) => (
      <StoryProviders>
        <div className="w-[40rem] max-w-full p-4">
          <Story />
        </div>
      </StoryProviders>
    ),
  ],
  title: "Components/ProductAliasesEditor",
} satisfies Meta<typeof AliasStoryForm>;
export default meta;
/** Alias editor story contract. */
type Story = StoryObj<typeof meta>;

/** Optional guidance remains visible when the empty editor starts collapsed. */
export const CollapsedNew: Story = {
  /**
   * Checks the native left disclosure marker and visible collapsed guidance.
   * @param context - Browser interaction context.
   * @rejects When the native alias disclosure is absent.
   */
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByText(
        "Other names for this product that help people find it in search.",
      ),
    ).toBeVisible();
    await expect(canvas.getByText("Optional")).toBeVisible();
    await expect(
      canvas.getByLabelText("Alternative product name"),
    ).not.toBeVisible();
    const details = canvasElement.querySelector("details");
    const summary = canvasElement.querySelector("summary");
    if (!details || !summary) throw new Error("Missing alias disclosure.");
    await expect(details.open).toBe(false);
    await expect(getComputedStyle(summary).display).toBe("list-item");
    await expect(getComputedStyle(details).borderLeftWidth).toBe("0px");
    await expect(getComputedStyle(details).borderRightWidth).toBe("0px");
  },
};

/** Editing existing names starts collapsed and exposes its count. */
export const CollapsedExisting: Story = {
  args: { initialValue: ["Pocket Writer", "Model 36"] },
  /**
   * Checks the count without expanding the optional input.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText("2", { selector: "[data-slot=badge]" }),
    ).toBeVisible();
    await expect(
      canvas.getByLabelText("Alternative product name"),
    ).not.toBeVisible();
  },
};

/** Enter and Add preserve complete names and save only on product submission. */
export const EntryAndSave: Story = {
  /**
   * Adds a comma-containing alias and a second name without submitting early.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("heading", { name: "Aliases" }));
    const input = canvas.getByRole("textbox", {
      name: "Alternative product name",
    });
    await userEvent.type(input, "  Model 36, special edition  ");
    await userEvent.keyboard("{Enter}");
    await expect(
      canvas.getByRole("button", {
        name: "Remove alias Model 36, special edition",
      }),
    ).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toHaveFocus();
    await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.type(input, "Pocket Writer");
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await expect(
      canvas.getByRole("button", { name: "Remove alias Pocket Writer" }),
    ).toBeVisible();
    await expect(args.onSave).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledWith([
      "Model 36, special edition",
      "Pocket Writer",
    ]);
  },
};

/** Invalid names stay uncommitted; removing a badge returns focus to entry. */
export const ValidationAndRemoval: Story = {
  args: { initialValue: ["Café"] },
  /**
   * Checks blank, length and normalized-duplicate errors, then removes one name.
   * @param context - Browser interaction context.
   */
  play: async ({ canvas, userEvent, args }) => {
    await userEvent.click(canvas.getByRole("heading", { name: "Aliases" }));
    const input = canvas.getByRole("textbox", {
      name: "Alternative product name",
    });
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "Enter an alternative product name.",
    );
    await userEvent.type(input, "x".repeat(81));
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "80 characters or fewer",
    );
    await userEvent.clear(input);
    await userEvent.type(input, "  CAFE  ");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.getByRole("alert")).toHaveTextContent(
      "already has that alternative name",
    );
    await expect(
      canvas.getAllByRole("button", { name: /Remove alias/ }),
    ).toHaveLength(1);
    await userEvent.clear(input);
    await userEvent.type(input, "Pocket Writer");
    await userEvent.keyboard("{Enter}");
    await expect(canvas.queryByRole("alert")).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByRole("button", { name: "Remove alias Café" }),
    );
    await expect(input).toHaveFocus();
    await expect(
      canvas.queryByRole("button", { name: "Remove alias Café" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Save" }));
    await expect(args.onSave).toHaveBeenCalledTimes(1);
    await expect(args.onSave).toHaveBeenCalledWith(["Pocket Writer"]);
  },
};

/** Long alias badges wrap around their accessible removal action on phones. */
export const MobileLongAlias: Story = {
  args: { initialValue: ["x".repeat(80)] },
  parameters: { viewport: { defaultViewport: "mobile1" } },
  /**
   * Checks the complete disclosure and its badges at a real phone viewport.
   * @param context - Browser interaction context.
   * @rejects When the alias disclosure fixture is absent.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await expect(window.innerWidth).toBeLessThanOrEqual(400);
    await userEvent.click(canvas.getByRole("heading", { name: "Aliases" }));
    const details = canvasElement.querySelector("details");
    if (!details) throw new Error("Missing alias disclosure.");
    await expect(details.scrollWidth).toBeLessThanOrEqual(details.clientWidth);
    await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      window.innerWidth,
    );
    await userEvent.click(
      canvas.getByRole("button", { name: `Remove alias ${"x".repeat(80)}` }),
    );
    await expect(
      canvas.getByRole("textbox", { name: "Alternative product name" }),
    ).toHaveFocus();
  },
};
