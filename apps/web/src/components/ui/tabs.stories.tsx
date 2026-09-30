import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect } from "storybook/test";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";

const meta = {
  component: Tabs,
  title: "UI/Tabs",
} satisfies Meta<typeof Tabs>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ExampleTabs />,
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Product details")).toBeVisible();
    await userEvent.click(canvas.getByRole("tab", { name: "Images" }));
    await expect(canvas.getByText("Product images")).toBeVisible();
  },
};

export const DisabledTab: Story = {
  render: () => <ExampleTabs disableImages />,
};

function ExampleTabs({ disableImages = false }: { disableImages?: boolean }) {
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
