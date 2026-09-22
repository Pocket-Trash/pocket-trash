import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Home, Settings } from "lucide-react";
import type { UserSettingsState } from "@/lib/user-settings";
import { LocaleProvider } from "@/providers/locale-provider";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInput,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "./sidebar";

const settings: UserSettingsState = {
  hasSavedSettings: true,
  settings: {
    currencyCode: "USD",
    dimensionUnit: "in",
    locale: "en-US",
    theme: "system",
    weightUnit: "g",
  },
};

const meta = {
  component: Sidebar,
  decorators: [
    (Story) => (
      <LocaleProvider initialSettingsState={settings}>
        <Story />
      </LocaleProvider>
    ),
  ],
  parameters: { layout: "fullscreen" },
  title: "UI/Sidebar",
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

function SidebarExample({ defaultOpen = true }: { defaultOpen?: boolean }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarInput aria-label="Search" placeholder="Search" />
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Archive</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive tooltip="Home">
                    <Home />
                    <span>Home</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton tooltip="Settings">
                    <Settings />
                    <span>Settings</span>
                  </SidebarMenuButton>
                  <SidebarMenuBadge>3</SidebarMenuBadge>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuSkeleton showIcon />
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarSeparator />
        <SidebarFooter>
          <SidebarTrigger />
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-h-80 p-6">
        <div className="rounded-md border border-border bg-card p-4 text-card-foreground">
          Content
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export const Expanded: Story = {
  render: () => <SidebarExample />,
};

export const Collapsed: Story = {
  render: () => <SidebarExample defaultOpen={false} />,
};
