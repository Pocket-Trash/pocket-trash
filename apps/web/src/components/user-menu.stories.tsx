import { useAuth, useClerk, useUser } from "@clerk/tanstack-react-start";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, mocked, waitFor, within } from "storybook/test";
import type { UserSettingsState } from "@/lib/user-settings";
import { LocaleProvider } from "@/providers/locale-provider";
import { UserMenu } from "./user-menu";

/** English user settings supplied to the locale provider in each story. */
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

/**
 * Spy used to verify the menu's sign-out request.
 *
 * @returns A promise that resolves after the simulated sign-out completes.
 */
const signOut = fn(async () => undefined).mockName("signOut");

/** Authentication fixture used while Clerk is loading. */
const loadingAuth = { isSignedIn: undefined } as ReturnType<typeof useAuth>;
/** Authentication fixture for a signed-out visitor. */
const signedOutAuth = { isSignedIn: false } as ReturnType<typeof useAuth>;
/** Authentication fixture for a regular signed-in user. */
const signedInAuth = {
  isSignedIn: true,
  sessionClaims: { role: "user" },
  userId: "user_123",
} as unknown as ReturnType<typeof useAuth>;
/** Authentication fixture for an administrator. */
const adminAuth = {
  isSignedIn: true,
  sessionClaims: { role: "admin" },
  userId: "admin_123",
} as unknown as ReturnType<typeof useAuth>;
/** Authentication fixture for an editor. */
const editorAuth = {
  isSignedIn: true,
  sessionClaims: { role: "editor" },
  userId: "editor_123",
} as unknown as ReturnType<typeof useAuth>;

/** User fixture used while Clerk is loading. */
const loadingUser = {
  isLoaded: false,
  isSignedIn: undefined,
  user: undefined,
} as ReturnType<typeof useUser>;
/** User fixture for a signed-out visitor. */
const signedOutUser = {
  isLoaded: true,
  isSignedIn: false,
  user: null,
} as ReturnType<typeof useUser>;
/** User fixture with a complete account profile. */
const signedInUser = {
  isLoaded: true,
  isSignedIn: true,
  user: {
    imageUrl: "",
    primaryEmailAddress: { emailAddress: "ada@example.com" },
    username: "Ada Lovelace",
  },
} as ReturnType<typeof useUser>;

/**
 * Configures Storybook coverage for the user menu examples.
 */
const meta = {
  /** Restores the Clerk client with the shared sign-out spy. */
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
/**
 * Storybook story contract for the user menu examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the loading user menu story.
 */
export const Loading: Story = {
  /** Configures loading authentication and user fixtures. */
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(loadingAuth);
    mocked(useUser).mockReturnValue(loadingUser);
  },
};

/**
 * Defines the signed out user menu story.
 */
export const SignedOut: Story = {
  /** Configures signed-out authentication and user fixtures. */
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(signedOutAuth);
    mocked(useUser).mockReturnValue(signedOutUser);
  },
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  },
};

/**
 * Defines an alternate signed-out user menu story.
 */
export const CompactSignedOut: Story = {
  args: { compact: true },
  beforeEach: SignedOut.beforeEach,
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(canvas.getByRole("button", { name: "Sign in" })).toBeVisible();
  },
};

/**
 * Defines the basic signed in user user menu story.
 */
export const BasicSignedInUser: Story = {
  /** Configures regular signed-in authentication and user fixtures. */
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(signedInAuth);
    mocked(useUser).mockReturnValue(signedInUser);
  },
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Account menu" }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(await page.findByText("ada@example.com")).toBeVisible();
    await expect(
      await page.findByRole("menuitem", { name: "Log out" }),
    ).toBeVisible();
    await expect(
      page.queryByRole("menuitem", { name: "Admin Panel" }),
    ).not.toBeInTheDocument();
  },
};

/**
 * Defines an alternate signed-in user menu story.
 */
export const CompactUserButton: Story = {
  args: { compact: true },
  beforeEach: BasicSignedInUser.beforeEach,
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole("button", { name: "Account menu" }),
    ).toBeVisible();
  },
};

/**
 * Defines the admin user user menu story.
 */
export const AdminUser: Story = {
  /** Configures administrator authentication and signed-in user fixtures. */
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(adminAuth);
    mocked(useUser).mockReturnValue(signedInUser);
  },
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Account menu" }));

    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByRole("menuitem", { name: "Admin Panel" }),
    ).toHaveAttribute("href", "/admin");
  },
};

/**
 * Defines the editor user user menu story.
 */
export const EditorUser: Story = {
  /** Configures editor authentication and signed-in user fixtures. */
  beforeEach: () => {
    mocked(useAuth).mockReturnValue(editorAuth);
    mocked(useUser).mockReturnValue(signedInUser);
  },
  play: AdminUser.play,
};

/**
 * Defines the sign out user menu story.
 */
export const SignOut: Story = {
  beforeEach: BasicSignedInUser.beforeEach,
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    const page = canvasElement.ownerDocument.body;

    await userEvent.click(canvas.getByRole("button", { name: "Account menu" }));
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

/**
 * Defines the keyboard dismiss user menu story.
 */
export const KeyboardDismiss: Story = {
  beforeEach: BasicSignedInUser.beforeEach,
  /**
   * Exercises the user menu story interaction and assertions.
   *
   * @param context - Storybook play context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.canvasElement - Rendered Storybook canvas element.
   * @param context.userEvent - Storybook interaction driver.
   * @returns A promise that resolves after the interaction assertions pass.
   * @rejects {Error} If a user interaction or assertion fails.
   */
  play: async ({ canvas, canvasElement, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Account menu" }));

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
