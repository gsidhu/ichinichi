// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { NoteEditor } from "../components/NoteEditor";
import { formatDate } from "../utils/date";

vi.mock("../components/NoteEditor/useContentEditableEditor", () => ({
  useContentEditableEditor: () => ({
    editorRef: { current: null },
    handleInput: vi.fn(),
    handlePaste: vi.fn(),
    handleDrop: vi.fn(),
    handleDragOver: vi.fn(),
    handleClick: vi.fn(),
    handleKeyDown: vi.fn(),
    handleFileInput: vi.fn(),
  }),
}));

vi.mock("../components/NoteEditor/useInlineImages", () => ({
  useInlineImageUpload: () => ({
    onImageDrop: vi.fn(),
  }),
  useInlineImageUrls: vi.fn(),
}));

vi.mock("../components/NoteEditor/useImageDragState", () => ({
  useImageDragState: () => ({
    isDraggingImage: false,
    endImageDrag: vi.fn(),
  }),
}));

vi.mock("../components/NoteEditor/useDropIndicator", () => ({
  useDropIndicator: () => ({
    indicatorPosition: null,
    updateIndicator: vi.fn(),
    clearIndicator: vi.fn(),
  }),
}));

vi.mock("../hooks/useShareTarget", () => ({
  useShareTarget: vi.fn(),
}));

vi.mock("../contexts/weatherContext", () => ({
  useWeatherContext: () => ({
    state: {
      showWeather: false,
    },
    clearWeatherFromEditor: vi.fn(),
    displayWeather: null,
  }),
}));

describe("NoteEditor lock toggle", () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    localStorage.clear();
  });

  it("opens locked by default and unlocks today when editing is allowed", () => {
    render(
      <NoteEditor
        date={formatDate(new Date())}
        content=""
        onChange={vi.fn()}
        isClosing={false}
        hasEdits={false}
        isSaving={false}
        lastSavedAt={null}
        isContentReady={true}
      />,
    );

    const editor = screen.getByRole("textbox");
    const unlockButton = screen.getByRole("button", { name: "Unlock note" });
    const imageButton = screen.getByRole("button", { name: "Insert image" });

    expect(editor.getAttribute("aria-readonly")).toBe("true");
    expect(imageButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(unlockButton);

    expect(screen.getByRole("button", { name: "Lock note" })).toBeTruthy();
    expect(editor.getAttribute("aria-readonly")).toBe("false");
    expect(
      screen
        .getByRole("button", { name: "Insert image" })
        .hasAttribute("disabled"),
    ).toBe(false);
  });

  it("does not unlock a past note", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    render(
      <NoteEditor
        date={formatDate(yesterday)}
        content=""
        onChange={vi.fn()}
        isClosing={false}
        hasEdits={false}
        isSaving={false}
        lastSavedAt={null}
        isContentReady={true}
      />,
    );

    const editor = screen.getByRole("textbox");
    const unlockButton = screen.getByRole("button", { name: "Unlock note" });

    expect(unlockButton.hasAttribute("disabled")).toBe(true);
    expect(editor.getAttribute("aria-readonly")).toBe("true");
  });
});
