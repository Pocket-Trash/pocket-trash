import { fn } from "storybook/test";

/** Configurable Clerk authentication hook mock. */
export const useAuth = fn().mockName("useAuth");
/** Configurable Clerk client hook mock. */
export const useClerk = fn().mockName("useClerk");
/** Clerk reverification mock that returns the supplied action unchanged. */
export const useReverification = fn((action) => action).mockName(
  "useReverification",
);
/** Configurable Clerk user hook mock. */
export const useUser = fn().mockName("useUser");
