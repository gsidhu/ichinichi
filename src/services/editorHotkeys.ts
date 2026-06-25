/**
 * Editor Hotkey Service
 * Maps keyboard shortcuts to execCommand calls.
 * Exports toggle functions for use by both hotkeys and toolbar buttons.
 */

function findAncestor(tagName: string): HTMLElement | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  let node: HTMLElement | null =
    range.commonAncestorContainer instanceof HTMLElement
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
  while (node) {
    if (node.tagName === tagName) return node;
    node = node.parentElement;
  }
  return null;
}

export function toggleInlineCode(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const codeAncestor = findAncestor("CODE");

  if (codeAncestor) {
    const unwrapRange = document.createRange();
    unwrapRange.selectNode(codeAncestor);
    selection.removeAllRanges();
    selection.addRange(unwrapRange);
    document.execCommand("insertHTML", false, codeAncestor.textContent ?? "");
  } else if (range.collapsed) {
    document.execCommand("insertHTML", false, "<code>​</code>");
  } else {
    const text = range.toString();
    document.execCommand("insertHTML", false, `<code>${text}</code>`);
  }
}

export function toggleBold(): void {
  document.execCommand("bold", false);
}

export function toggleItalic(): void {
  document.execCommand("italic", false);
}

export function toggleHighlight(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const markAncestor = findAncestor("MARK");

  if (markAncestor) {
    const unwrapRange = document.createRange();
    unwrapRange.selectNode(markAncestor);
    selection.removeAllRanges();
    selection.addRange(unwrapRange);
    document.execCommand("insertHTML", false, markAncestor.innerHTML);
  } else if (!range.collapsed) {
    const html = range.cloneContents();
    const wrapper = document.createElement("div");
    wrapper.appendChild(html);
    document.execCommand("insertHTML", false, `<mark>${wrapper.innerHTML}</mark>`);
  }
}

export function toggleBlockquote(): void {
  const ancestor = findAncestor("BLOCKQUOTE");
  if (ancestor) {
    document.execCommand("formatBlock", false, "div");
  } else {
    document.execCommand("formatBlock", false, "blockquote");
  }
}

export function toggleUnorderedList(): void {
  document.execCommand("insertUnorderedList", false);
}

export function toggleOrderedList(): void {
  document.execCommand("insertOrderedList", false);
}

export function handleKeyDown(event: KeyboardEvent): boolean {
  const key = event.key.toLowerCase();
  const mod = event.metaKey || event.ctrlKey;

  if (mod && event.shiftKey) {
    if (key === "x") { event.preventDefault(); document.execCommand("strikeThrough", false); return true; }
    if (key === "m") { event.preventDefault(); toggleInlineCode(); return true; }
    if (key === "h") { event.preventDefault(); toggleHighlight(); return true; }
    if (key === ".") { event.preventDefault(); toggleBlockquote(); return true; }
  }

  if (mod && !event.shiftKey) {
    if (key === "b") { event.preventDefault(); toggleBold(); return true; }
    if (key === "i") { event.preventDefault(); toggleItalic(); return true; }
    if (key === "u") { event.preventDefault(); document.execCommand("underline", false); return true; }
  }

  return false;
}
