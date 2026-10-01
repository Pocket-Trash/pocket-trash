import { clerkSetup } from "@clerk/testing/playwright";
import { verifyMutationTargets } from "./mutation-guard";

/** Configures Clerk and verifies mutation targets in Playwright's parent process. */
export default async function globalSetup() {
  if (process.env.E2E_RUN_MUTATIONS === "true") {
    await verifyMutationTargets(process.env);
  }
  await clerkSetup();
}
