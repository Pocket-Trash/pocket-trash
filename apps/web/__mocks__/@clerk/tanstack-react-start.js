import { fn } from "storybook/test";

/** Configurable Clerk authentication hook mock. */
export const useAuth = fn().mockName("useAuth");
/** Configurable Clerk client hook mock. */
export const useClerk = fn().mockName("useClerk");
/**
 * Returns an action unchanged in place of Clerk reverification.
 *
 * @param action - Protected action supplied by the caller.
 * @returns The same action without a reverification wrapper.
 */
export const useReverification = fn((action) => action).mockName(
  "useReverification",
);
/** Configurable Clerk user hook mock. */
export const useUser = fn().mockName("useUser");
