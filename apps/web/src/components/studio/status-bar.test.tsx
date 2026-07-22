import { beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SAMPLE_DIAGRAM } from "@/lib/sample-diagram";
import { useStudioStore } from "@/store/studio-store";
import { StatusBar } from "./status-bar";

beforeEach(() => {
  useStudioStore.getState().setSource(SAMPLE_DIAGRAM);
});

describe("StatusBar", () => {
  it("reports a clean diagram", () => {
    render(<StatusBar />);
    expect(screen.getByText(/no problems/i)).toBeInTheDocument();
  });

  it("counts errors and warnings separately", () => {
    useStudioStore
      .getState()
      .setSource('lambda L {}\nservice S {\n  colour: "x"\n}\nflow F {\n  S -> S\n}');
    render(<StatusBar />);
    expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/i)).toBeInTheDocument();
  });

  it("pluralises counts", () => {
    useStudioStore.getState().setSource("lambda A {}\nlambda B {}\nservice S {}\nflow F {\n  S -> S\n}");
    render(<StatusBar />);
    expect(screen.getByText(/2 errors/i)).toBeInTheDocument();
  });

  it("says when the canvas is showing an older diagram", () => {
    useStudioStore.getState().setSource("service A {");
    render(<StatusBar />);
    expect(screen.getByText(/last valid diagram/i)).toBeInTheDocument();
  });

  it("reports the node and flow counts of what is on screen", () => {
    render(<StatusBar />);
    expect(screen.getByText(/8 components/i)).toBeInTheDocument();
    expect(screen.getByText(/2 flows/i)).toBeInTheDocument();
  });
});
