import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { decodeShareHash, encodeShareHash } from "@/lib/share-url";
import { useStudioStore } from "@/store/studio-store";
import { ShareButton } from "./share-button";
import { SharedFlowLoader } from "./shared-flow-loader";

const LOCAL_DSL = 'service Local "Local" {}\nflow LocalFlow {\n  Local -> Local\n}';
const SHARED_DSL = 'service Shared "Compartilhado" {}\nflow SharedFlow {\n  Shared -> Shared\n}';

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  useStudioStore.getState().setSource(LOCAL_DSL);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ShareButton", () => {
  it("copies a link containing the current DSL and confirms success", async () => {
    const user = userEvent.setup();
    render(<ShareButton />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    const copiedUrl = await navigator.clipboard.readText();
    await expect(decodeShareHash(new URL(copiedUrl).hash)).resolves.toBe(LOCAL_DSL);
  });

  it("keeps the action available when copying fails", async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("permission denied")) },
    });
    render(<ShareButton />);

    await user.click(screen.getByRole("button", { name: "Share" }));

    expect(await screen.findByRole("button", { name: "Try again" })).toBeEnabled();
  });
});

describe("SharedFlowLoader", () => {
  it("loads the DSL from the URL hash over the local diagram", async () => {
    const hash = await encodeShareHash(SHARED_DSL);
    window.history.replaceState(null, "", `/${hash}`);

    render(<SharedFlowLoader />);

    await waitFor(() => expect(useStudioStore.getState().source).toBe(SHARED_DSL));
  });

  it("loads a shared DSL when the hash changes without a page reload", async () => {
    render(<SharedFlowLoader />);
    const hash = await encodeShareHash(SHARED_DSL);

    window.history.replaceState(null, "", `/${hash}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    await waitFor(() => expect(useStudioStore.getState().source).toBe(SHARED_DSL));
  });

  it("leaves the local diagram intact for an invalid shared hash", async () => {
    window.history.replaceState(null, "", "/#flow=broken");

    await act(async () => {
      render(<SharedFlowLoader />);
    });

    expect(useStudioStore.getState().source).toBe(LOCAL_DSL);
  });
});
