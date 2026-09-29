import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyCameraError, diagnoseCameraFailure } from "./camera";

afterEach(() => vi.unstubAllGlobals());

const domError = (name: string) => new DOMException("x", name);

describe("classifyCameraError", () => {
  it("recognises a blocked camera", () => {
    for (const name of [
      "NotAllowedError",
      "PermissionDeniedError",
      "SecurityError",
    ]) {
      expect(classifyCameraError(domError(name))).toBe("denied");
    }
  });

  it("recognises a missing camera", () => {
    for (const name of [
      "NotFoundError",
      "DevicesNotFoundError",
      "OverconstrainedError",
    ]) {
      expect(classifyCameraError(domError(name))).toBe("unavailable");
    }
  });

  it("calls anything else an error, including a camera another app is using", () => {
    expect(classifyCameraError(domError("NotReadableError"))).toBe("error");
    expect(classifyCameraError("Camera not found.")).toBe("error");
    expect(classifyCameraError(undefined)).toBe("error");
  });
});

describe("diagnoseCameraFailure", () => {
  const stubBrowser = (
    getUserMedia: (() => Promise<MediaStream>) | undefined,
    isSecureContext = true,
  ) => {
    vi.stubGlobal("window", { isSecureContext });
    vi.stubGlobal("navigator", {
      mediaDevices: getUserMedia ? { getUserMedia } : undefined,
    });
  };

  it("says the page is not secure before asking for the camera", async () => {
    const getUserMedia = vi.fn();
    stubBrowser(getUserMedia, false);
    expect(await diagnoseCameraFailure()).toBe("insecure");
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("finds out a blocked camera even though the library only says 'not found'", async () => {
    stubBrowser(() => Promise.reject(domError("NotAllowedError")));
    expect(await diagnoseCameraFailure()).toBe("denied");
  });

  it("finds out a missing camera", async () => {
    stubBrowser(() => Promise.reject(domError("NotFoundError")));
    expect(await diagnoseCameraFailure()).toBe("unavailable");
  });

  it("has nothing to ask when the browser offers no camera API", async () => {
    stubBrowser(undefined);
    expect(await diagnoseCameraFailure()).toBe("unavailable");
  });

  it("lets go of a camera it managed to open, and reports a plain error", async () => {
    const stop = vi.fn();
    stubBrowser(() =>
      Promise.resolve({
        getTracks: () => [{ stop }],
      } as unknown as MediaStream),
    );
    expect(await diagnoseCameraFailure()).toBe("error");
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
