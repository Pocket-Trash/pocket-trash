import { describe, expect, it } from "vitest";
import { LocalizedServerError, localizedServerError } from "./server-errors";

describe("localizedServerError", () => {
  it("keeps a stable key with localized fallback text", () => {
    const error = localizedServerError("error.generic", "es-MX");

    expect(error).toBeInstanceOf(LocalizedServerError);
    expect(error.key).toBe("error.generic");
    expect(error.message).toBe("Algo salio mal.");
  });
});
