import { fn } from "storybook/test";

export const useAuth = fn().mockName("useAuth");
export const useClerk = fn().mockName("useClerk");
export const useReverification = fn((action) => action).mockName(
  "useReverification",
);
export const useUser = fn().mockName("useUser");
