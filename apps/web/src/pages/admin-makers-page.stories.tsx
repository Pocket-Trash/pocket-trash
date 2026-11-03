import type { CatalogMaker } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, mocked, waitFor } from "storybook/test";
import { saveAdminMaker } from "@/lib/catalog-api";
import { mockStoryRole, StoryProviders } from "../../.storybook/story-fixtures";
import { AdminMakerFormPage } from "./admin-makers-page";

/** Existing maker profile for edit and failure coverage. */
const maker: CatalogMaker = {
  id: 77,
  name: "Maker",
  slug: "maker",
  rootUrl: null,
  description: "Maker profile.",
  images: [],
};
/** Maker form setup using the existing shell, auth mocks, and editor. */
const meta = {
  component: AdminMakerFormPage,
  /** Configures an administrator and isolated save failures. */
  beforeEach: () => {
    mockStoryRole("admin");
    mocked(saveAdminMaker).mockRejectedValue(new Error("Offline"));
  },
  decorators: [
    (Story) => (
      <StoryProviders>
        <Story />
      </StoryProviders>
    ),
  ],
  title: "Components/AdminMakerFormPage",
} satisfies Meta<typeof AdminMakerFormPage>;
export default meta;
/** Maker form story contract. */
type Story = StoryObj<typeof meta>;
/** Blank create state with the existing native required name field. */
export const Add: Story = { args: {} };
/** Existing profile with a stable read-only slug. */
export const Edit: Story = { args: { maker } };
/** Failed saves retain the actual editor's name/document draft. */
export const FailedSave: Story = {
  args: { maker },
  /**
   * Exercises save failure through the actual Markdown consumer.
   * @param context - Story interaction context.
   * @returns Completion after draft preservation is verified.
   */
  play: async ({ canvas, userEvent }) => {
    const save = canvas.getByRole("button", { name: "Save" });
    await waitFor(() => expect(save).toBeEnabled());
    const name = canvas.getByRole("textbox", { name: "Name" });
    await userEvent.clear(name);
    await userEvent.type(name, "Updated maker");
    await userEvent.click(save);
    await waitFor(() => expect(saveAdminMaker).toHaveBeenCalled());
    await expect(canvas.getByRole("alert")).toBeVisible();
    await expect(name).toHaveValue("Updated maker");
    await expect(canvas.getByDisplayValue("maker")).toHaveAttribute("readonly");
    await expect(save).toBeEnabled();
  },
};
