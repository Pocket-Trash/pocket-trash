import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, waitFor, within } from "storybook/test";
import type { UserSettingsState } from "@/lib/user-settings";
import { LocaleProvider } from "@/providers/locale-provider";
import { UserMenu } from "./user-menu";

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

const signOut = fn(async () => undefined).mockName("signOut");

const loadingAuth = { isSignedIn: undefined } as ReturnType<typeof useAuth>;
const signedOutAuth = { isSignedIn: false } as ReturnType<typeof useAuth>;
const signedInAuth = {
  isSignedIn: true,
  sessionClaims: { role: "user" },
} as unknown as ReturnType<typeof useAuth>;
const adminAuth = {
  isSignedIn: true,
  sessionClaims: { role: "admin" },
} as unknown as ReturnType<typeof useAuth>;

const loadingUser = {
  isLoaded: false,
  isSignedIn: undefined,
  user: undefined,
} as ReturnType<typeof useUser>;
const signedOutUser = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
} as ReturnType<typeof useUser>;
const signedInUser = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    imageUrl: "",
    primaryEmailAddress: { emailAddress: "ada@example.com" },
    username: "Ada Lovelace",
  },
} as ReturnType<typeof useUser>;

const meta = {
  beforeEach: () => {
    mocked(useClerk).mockReturnValue({ signOut } as unknown as ReturnType<
      typeof useClerk
    >);
  },
  component: UserMenu,
  decorators: [
    (Story) => (
      <LocaleProvider initialSettingsState={settings}>
        <div className="w-64">
          <Story />
        </div>
      </LocaleProvider>
    ),
  ],
  title: "Components/UserMenu",
} satisfies Meta<typeof UserMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(loadingAuth);
    mocked(useUser).mockReturnValue(loadingUser);
  },
};

export const SignedOut: Story = {
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(signedOutAuth);
    mocked(useUser).mockReturnValue(signedOutUser);
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  },
};

export const CompactSignedOut: Story = {
  args: { compact: true },
  beforeEach: SignedOut.beforeEach,
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  },
};

export const BasicSignedInUser: Story = {
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(signedInAuth);
    mocked(useUser).mockReturnValue(signedInUser);
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Ada Lovelace/ }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("ada@example.com")).toBeVisible();
    await expect(
      await page.findByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();
  },
};

export const CompactUserButton: Story = {
  args: { compact: true },
  beforeEach: BasicSignedInUser.beforeEach,
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Account menu" }),
    ).toBeVisible();
  },
};

export const AdminUser: Story = {
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(adminAuth);
    mocked(useUser).mockReturnValue(signedInUser);
  },
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Ada Lovelace/ }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByRole("menuitem", { name: "Beta features" }),
    ).toBeVisible();
  },
};

export const SignOut: Story = {
  beforeEach: BasicSignedInUser.beforeEach,
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = canvasElement.ownerDocument.body;

    await userEvent.click(canvas.getByRole("button", { name: /Ada Lovelace/ }));
    await userEvent.click(
      await within(page).findByRole("menuitem", {
        name: "Log out",
      }),
    );

    await expect(signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
    await waitFor(() => {
      expect(page.querySelector("[data-base-ui-focus-guard]")).toBeNull();
    });
  },
};

export const KeyboardDismiss: Story = {
  beforeEach: BasicSignedInUser.beforeEach,
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: /Ada Lovelace/ }));

    const page = canvasElement.ownerDocument.body;
    await expect(
      await within(page).findByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => {
      expect(page.querySelector('[role="menu"]')).toBeNull();
    });
  },
};
