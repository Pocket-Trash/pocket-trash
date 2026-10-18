import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { PublicUserPage } from "./public-user-page";

/** Minimal shell properties used by the page test. */
type TestShellProps = {
  /** Profile content. */
  children: React.ReactNode;
  /** Profile title. */
  title: string;
};

vi.mock("@/components/app-shell", () => ({
  /**
   * Renders a minimal titled shell for profile assertions.
   *
   * @param props - Shell properties.
   * @param props.children - Profile content.
   * @param props.title - Profile title.
   * @returns Titled profile fixture.
   */
  AppShell: ({ children, title }: TestShellProps) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

it("renders the username title with an empty profile body", () => {
  const html = renderToStaticMarkup(<PublicUserPage username="collector" />);

  expect(html).toBe("<div><h1>collector</h1><main></main></div>");
});
