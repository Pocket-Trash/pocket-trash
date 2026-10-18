import { createFileRoute, notFound } from "@tanstack/react-router";
import { getPublicUserProfile } from "@/lib/user-profiles";
import { PublicUserPage } from "@/pages/public-user-page";

/** Shows one public username-bearing user profile. */
export const Route = createFileRoute("/users/$username_")({
  component: PublicUserRoute,
  /**
   * Loads an exact public username.
   *
   * @param context - Route loader context.
   * @param context.params - Requested username.
   * @returns The public user profile.
   * @rejects With not-found when the username is absent.
   */
  loader: async ({ params }) => {
    const user = await getPublicUserProfile({
      data: { username: params.username },
    });
    if (!user) throw notFound();
    return user;
  },
  /**
   * Builds document metadata for the public user.
   *
   * @param context - Route head context.
   * @param context.loaderData - Loaded public user.
   * @returns Public user page metadata.
   */
  head: ({ loaderData }) => ({
    meta: [...(loaderData ? [{ title: loaderData.username }] : [])],
  }),
});

/**
 * Renders the loaded public user profile.
 *
 * @returns The loaded public user profile page.
 */
function PublicUserRoute() {
  return <PublicUserPage username={Route.useLoaderData().username} />;
}
