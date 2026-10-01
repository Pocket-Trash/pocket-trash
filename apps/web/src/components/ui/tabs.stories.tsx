import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

/**
 * Configures Storybook coverage for the tabs examples.
 */
const meta = {
  component: Tabs,
  title: "UI/Tabs",
} satisfies Meta<typeof Tabs>;

export default meta;
/**
 * Storybook story contract for the tabs examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Shows the tabs default example.
 */
export const Default: Story = {
  /**
   * Renders the tabs default example.
   *
   * @returns The rendered story example.
   */
  render: () => <ExampleTabs />,
  /**
   * Exercises the tabs default interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Product details")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Images" }));
    await expect(canvas.getByText("Product images")).toBeVisible();
  },
};

/**
 * Shows the tabs disabled tab example.
 */
export const DisabledTab: Story = {
  /**
   * Renders the tabs disabled tab example.
   *
   * @returns The rendered story example.
   */
  render: () => <ExampleTabs disableImages />,
};

/**
 * Renders the shared tab story example with optional disabled content.
 *
 * @param props - Example tabs properties.
 * @param props.disableImages - Whether to disable the images tab in the story.
 * @returns The rendered example tabs UI.
 */
function ExampleTabs({
  disableImages = false,
}: {
  /**
   * Whether to disable the images tab in the story.
   */
  disableImages?: boolean;
}) {
  return (
    <Tabs defaultValue="details">
      <TabsList aria-label="Product sections">
        <TabsTrigger value="details">Details</TabsTrigger>
        <TabsTrigger disabled={disableImages} value="images">
          Images
        </TabsTrigger>
      </TabsList>
      <TabsContent value="details">Product details</TabsContent>
      <TabsContent value="images">Product images</TabsContent>
    </Tabs>
  );
}
