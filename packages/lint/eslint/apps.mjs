/** Shared application icon and storage boundaries, also composed by web hook enforcement. */
export const appImportRestrictions = {
  paths: [
    {
      message: "Use Font Awesome icons instead.",
      name: "lucide-react",
    },
  ],
  patterns: [
    {
      group: ["@package/storage", "@package/storage/*"],
      message: "Apps must use storage through @package/services.",
    },
  ],
};

export default {
  files: ["apps/**/*.{js,jsx,ts,tsx}"],
  rules: { "no-restricted-imports": ["error", appImportRestrictions] },
};
