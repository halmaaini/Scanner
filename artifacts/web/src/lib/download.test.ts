import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadTextFile } from "./download";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("downloadTextFile", () => {
  it("starts the download, and only releases the file a while later", async () => {
    vi.useFakeTimers();
    const revoked: string[] = [];
    const link = { click: vi.fn(), remove: vi.fn(), href: "", download: "" };
    vi.stubGlobal("document", {
      createElement: () => link,
      body: { append: vi.fn() },
    });
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: (url: string) => revoked.push(url),
    });

    downloadTextFile("report.csv", "a,b\r\n");

    expect(link.download).toBe("report.csv");
    expect(link.click).toHaveBeenCalledTimes(1);
    // Not yet: some browsers start the download after this function returns.
    expect(revoked).toEqual([]);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(revoked).toEqual(["blob:test"]);
  });
});
