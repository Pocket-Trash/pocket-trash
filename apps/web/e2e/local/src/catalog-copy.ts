/**
 * Returns the small copy surface used by the local pagination regression.
 *
 * @returns A deterministic formatter that needs no application credentials.
 */
export function useCatalogCopy() {
  return (key: string, values: Readonly<Record<string, unknown>> = {}) => {
    if (key === "web.search.pagination.firstPage") return "First page";
    if (key === "web.search.pagination.lastPage") return "Last page";
    if (key === "web.search.pagination.goToPage") {
      return `Go to page ${String(values.page)}`;
    }
    if (key === "web.search.pagination.previousPage") return "Previous page";
    if (key === "web.search.pagination.nextPage") return "Next page";
    if (key === "web.search.pagination.pageStatus") {
      return `Page ${String(values.page)} of ${String(values.pageCount)}`;
    }
    if (key === "web.collections.gallery.previousPage") return "Previous page";
    if (key === "web.collections.gallery.nextPage") return "Next page";
    if (key === "web.collections.gallery.pageStatus") {
      return `Page ${String(values.page)} of ${String(values.pageCount)}`;
    }
    return key;
  };
}
