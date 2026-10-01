import type { CatalogImage, UserCollectionSummary } from "@package/services";
import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn } from "storybook/test";
import { CollectionCoverManager } from "./collection-form";

/**
 * Current cover image shared by the manager stories.
 */
const current = image(
  1000,
  "one.webp",
  1,
  "https://cdn.pocket-trash.app/assets/storybook/collection-images/one.webp",
);
/**
 * Historical cover image shared by the manager stories.
 */
const previous = image(
  1001,
  "three.webp",
  0,
  "https://cdn.pocket-trash.app/assets/storybook/collection-images/three.webp",
);
/**
 * Collection with current and historical covers used by the manager stories.
 */
const collection: UserCollectionSummary = {
  coverImage: current,
  coverImages: [current, previous],
  createdAt: new Date("2026-01-01"),
  description: null,
  id: 1000,
  isAdminPrivate: false,
  isPrivate: true,
  itemCount: 3,
  name: "Daily Carry",
  ownerUserId: 1000,
  updatedAt: new Date("2026-01-02"),
};

/**
 * Configures Storybook coverage for the collection cover manager examples.
 */
const meta = {
  component: CollectionCoverManager,
  args: {
    collection,
    copy: {
      clear: "Clear cover",
      clearConfirmation: "Clear the current cover?",
      current: "Current cover",
      delete: "Delete image",
      deleteConfirmation: "Permanently delete this image?",
      history: "Gallery",
      nextPage: "Next page",
      /**
       * Formats the current cover-history page.
       *
       * @param page - Current one-based page number.
       * @param pageCount - Total number of pages.
       * @returns Human-readable pagination status.
       */
      pageStatus: (page, pageCount) => `Page ${page} of ${pageCount}`,
      previousPage: "Previous page",
      select: "Use this cover",
    },
    onClear: fn(),
    onDelete: fn(),
    onSelect: fn(),
  },
  title: "Components/CollectionCoverManager",
} satisfies Meta<typeof CollectionCoverManager>;

export default meta;
/**
 * Storybook story contract for the collection cover manager examples.
 */
type Story = StoryObj<typeof meta>;

/**
 * Defines the current and history collection cover manager story.
 */
export const CurrentAndHistory: Story = {
  /**
   * Exercises the collection cover manager story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Use this cover" }),
    );
    await expect(args.onSelect).toHaveBeenCalledWith(previous);
  },
};

/**
 * Defines the cleared with history collection cover manager story.
 */
export const ClearedWithHistory: Story = {
  args: {
    collection: { ...collection, coverImage: null },
  },
};

/**
 * Defines the confirm clear collection cover manager story.
 */
export const ConfirmClear: Story = {
  /**
   * Accepts the confirmation prompt before the story runs.
   */
  beforeEach: () => {
    window.confirm = fn(() => true);
  },
  /**
   * Exercises the collection cover manager story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(canvas.getByRole("button", { name: "Clear cover" }));
    await expect(args.onClear).toHaveBeenCalledOnce();
  },
};

/**
 * Defines the confirm delete collection cover manager story.
 */
export const ConfirmDelete: Story = {
  /**
   * Accepts the confirmation prompt before the story runs.
   */
  beforeEach: () => {
    window.confirm = fn(() => true);
  },
  /**
   * Exercises the collection cover manager story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete image three.webp" }),
    );
    await expect(args.onDelete).toHaveBeenCalledWith(previous);
  },
};

/**
 * Defines the confirm delete current collection cover manager story.
 */
export const ConfirmDeleteCurrent: Story = {
  /**
   * Accepts the confirmation prompt before the story runs.
   */
  beforeEach: () => {
    window.confirm = fn(() => true);
  },
  /**
   * Exercises the collection cover manager story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.args - Current Storybook story arguments.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ args, canvas, userEvent }) => {
    await userEvent.click(
      canvas.getByRole("button", { name: "Delete image one.webp" }),
    );
    await expect(args.onDelete).toHaveBeenCalledWith(current);
  },
};

/**
 * Defines the paginated collection cover manager story.
 */
export const Paginated: Story = {
  args: {
    collection: {
      ...collection,
      coverImages: [
        current,
        previous,
        ...Array.from({ length: 13 }, (_, index) =>
          image(
            1002 + index,
            `image-${index + 2}.webp`,
            index + 2,
            previous.url,
          ),
        ),
      ],
    },
  },
  /**
   * Exercises the collection cover manager story interaction and assertions.
   *
   * @param context - Storybook interaction context.
   * @param context.canvas - Queries scoped to the rendered story canvas.
   * @param context.userEvent - Storybook interaction driver.
   */
  play: async ({ canvas, userEvent }) => {
    await expect(canvas.getByText("Page 1 of 2")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: "Delete image image-2.webp" }),
    ).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole("button", { name: "Next page" }));
    await expect(canvas.getByText("Page 2 of 2")).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "Delete image image-2.webp" }),
    ).toBeVisible();
  },
};

/**
 * Creates a collection image fixture.
 *
 * @param id - Stable image identifier.
 * @param fileName - Stored file name.
 * @param position - Image order within the collection.
 * @param url - Public image URL.
 * @returns A collection image fixture.
 */
function image(
  id: number,
  fileName: string,
  position: number,
  url: string,
): CatalogImage {
  return {
    contentType: "image/webp",
    createdAt: new Date("2026-01-01"),
    deletedAt: null,
    deletedByClerkId: null,
    deletedByRole: null,
    fileName,
    id,
    objectPath: `collections/1000/${fileName}`,
    position,
    size: 1024,
    url,
  };
}
