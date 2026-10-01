import { StartClient } from "@tanstack/react-start/client";
import { useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

/**
 * Marks the document ready after React attaches event handlers.
 *
 * @returns The TanStack Start client.
 */
function HydratedClient() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return <StartClient />;
}

hydrateRoot(document, <HydratedClient />);
