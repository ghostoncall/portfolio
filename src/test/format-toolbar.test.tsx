import { useState } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { FormatToolbar } from "@/components/admin/cms/FormatToolbar";

function Form({ initial = "Machine Learning" }: { initial?: string }) {
  const [title, setTitle] = useState(initial);
  const [link, setLink] = useState("https://github.com/x");
  return (
    <div>
      <input aria-label="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input aria-label="Website" type="url" value={link} onChange={(e) => setLink(e.target.value)} />
      <output data-testid="saved">{title}</output>
      <FormatToolbar />
    </div>
  );
}

describe("admin formatting toolbar", () => {
  it("appears on text fields and bolds the whole field through React state", () => {
    render(<Form />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;
    act(() => input.focus());
    const bold = screen.getByRole("button", { name: "Bold" });
    fireEvent.click(bold);
    expect(screen.getByTestId("saved").textContent).toBe("**Machine Learning**");
    // Clicking again removes it.
    fireEvent.click(bold);
    expect(screen.getByTestId("saved").textContent).toBe("Machine Learning");
  });

  it("formats only the selected words and changes the font", () => {
    render(<Form />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;
    act(() => input.focus());
    input.setSelectionRange(8, 16); // "Learning"
    fireEvent.click(screen.getByRole("button", { name: "Italic" }));
    expect(screen.getByTestId("saved").textContent).toBe("Machine *Learning*");
    input.setSelectionRange(0, 7); // "Machine"
    fireEvent.change(screen.getByRole("combobox", { name: "Font" }), { target: { value: "sans" } });
    expect(screen.getByTestId("saved").textContent).toBe("[font:sans]Machine[/font] *Learning*");
    input.setSelectionRange(0, input.value.length);
    fireEvent.click(screen.getByRole("button", { name: /Clear/ }));
    expect(screen.getByTestId("saved").textContent).toBe("Machine Learning");
  });

  it("supports Ctrl+B and skips link fields", () => {
    render(<Form />);
    const input = screen.getByLabelText("Title") as HTMLInputElement;
    act(() => input.focus());
    fireEvent.keyDown(input, { key: "b", ctrlKey: true });
    expect(screen.getByTestId("saved").textContent).toBe("**Machine Learning**");
    act(() => (screen.getByLabelText("Website") as HTMLInputElement).focus());
    expect(screen.queryByRole("toolbar", { name: "Text formatting" })).toBeNull();
  });
});
