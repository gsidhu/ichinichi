import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  RefObject,
} from "react";
import {
  ImagePlus,
  Lock,
  LockOpen,
  ALargeSmall,
  Bold,
  Italic,
  Highlighter,
  Quote,
  List,
  ListOrdered,
  Code,
  Strikethrough,
} from "lucide-react";
import { NoteEditorHeader } from "./NoteEditorHeader";
import { NoteEditorContent } from "./NoteEditorContent";
import type { DropIndicatorPosition } from "./useDropIndicator";
import type { WeatherLabelData } from "../../features/weather/WeatherDom";
import {
  toggleBold,
  toggleItalic,
  toggleHighlight,
  toggleBlockquote,
  toggleUnorderedList,
  toggleOrderedList,
  toggleInlineCode,
} from "../../services/editorHotkeys";
import styles from "./NoteEditor.module.css";

interface NoteEditorViewProps {
  date: string;
  formattedDate: string;
  isEditable: boolean;
  isSaving: boolean;
  lastSavedAt: number | null;
  autoFocus: boolean;
  showReadonlyBadge: boolean;
  statusText: string | null;
  isStatusError?: boolean;
  isUnlocked: boolean;
  isLockToggleDisabled: boolean;
  placeholderText: string;
  editorRef: RefObject<HTMLDivElement | null>;
  onInput?: (event: FormEvent<HTMLDivElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  onDrop?: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: DragEvent<HTMLDivElement>) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onToggleLock: () => void;
  onImageSelect?: (file: File) => void;
  isImageSelectDisabled?: boolean;
  isDraggingImage?: boolean;
  dropIndicatorPosition?: DropIndicatorPosition | null;
  uploadErrorText?: string | null;
  weather?: WeatherLabelData | null;
  hrPopover?: { hr: HTMLHRElement; rect: DOMRect } | null;
  onDismissHrPopover?: () => void;
  onDeleteHr?: () => void;
}

export function NoteEditorView({
  date,
  formattedDate,
  isEditable,
  isSaving,
  lastSavedAt,
  autoFocus,
  showReadonlyBadge,
  statusText,
  isStatusError = false,
  isUnlocked,
  isLockToggleDisabled,
  placeholderText,
  editorRef,
  onInput,
  onPaste,
  onDrop,
  onDragOver,
  onClick,
  onKeyDown,
  onToggleLock,
  onImageSelect,
  isImageSelectDisabled = false,
  isDraggingImage = false,
  dropIndicatorPosition,
  uploadErrorText = null,
  weather,
  hrPopover,
  onDismissHrPopover,
  onDeleteHr,
}: NoteEditorViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const formatMenuRef = useRef<HTMLDivElement>(null);
  const formatButtonRef = useRef<HTMLButtonElement>(null);
  const hrPopoverRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const bodyClassName = styles.body;

  useEffect(() => {
    if (!hrPopover || !onDismissHrPopover) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (hrPopoverRef.current?.contains(e.target as Node)) return;
      onDismissHrPopover();
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onDismissHrPopover();
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [hrPopover, onDismissHrPopover]);

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && onImageSelect) {
        onImageSelect(file);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [onImageSelect],
  );

  const applyFormat = useCallback(
    (fn: () => void) => {
      editorRef.current?.focus();
      fn();
      setShowFormatMenu(false);
    },
    [editorRef],
  );

  useEffect(() => {
    if (!showFormatMenu) return;
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (
        formatMenuRef.current?.contains(e.target as Node) ||
        formatButtonRef.current?.contains(e.target as Node)
      )
        return;
      setShowFormatMenu(false);
    };
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setShowFormatMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showFormatMenu]);

  return (
    <div className={styles.editor}>
      {isDraggingImage && (
        <div className={styles.dragOverlay} aria-hidden="true"></div>
      )}
      {dropIndicatorPosition && (
        <div
          className={styles.dropIndicator}
          style={{
            top: dropIndicatorPosition.top,
            left: dropIndicatorPosition.left,
            width: dropIndicatorPosition.width,
          }}
          aria-hidden="true"
        />
      )}
      <NoteEditorHeader
        date={date}
        formattedDate={formattedDate}
        showReadonlyBadge={showReadonlyBadge}
        isSaving={isSaving}
        lastSavedAt={lastSavedAt}
        statusText={statusText}
        isStatusError={isStatusError}
        weather={weather}
      />
      <div className={bodyClassName} ref={bodyRef}>
        <NoteEditorContent
          editorRef={editorRef}
          isEditable={isEditable}
          autoFocus={autoFocus}
          placeholderText={placeholderText}
          onInput={onInput}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onClick={onClick}
          onKeyDown={onKeyDown}
        />
        {hrPopover && onDeleteHr && onDismissHrPopover && (() => {
          const bodyRect = bodyRef.current?.getBoundingClientRect();
          if (!bodyRect) return null;
          const top = hrPopover.rect.top - bodyRect.top - 40;
          const right = 0;
          return (
            <div
              ref={hrPopoverRef}
              className={styles.hrPopover}
              style={{ top, right }}
            >
              <button
                type="button"
                className={styles.hrDeleteButton}
                onClick={onDeleteHr}
              >
                Delete
              </button>
              <button
                type="button"
                className={styles.hrCancelButton}
                onClick={onDismissHrPopover}
              >
                Cancel
              </button>
            </div>
          );
        })()}
      </div>
      <div className={styles.toolbar}>
        <button
          type="button"
          className={styles.toolbarButton}
          onClick={onToggleLock}
          disabled={isLockToggleDisabled}
          aria-label={isUnlocked ? "Lock note" : "Unlock note"}
          title={isUnlocked ? "Lock note" : "Unlock note"}
        >
          {isUnlocked ? <LockOpen size={18} /> : <Lock size={18} />}
        </button>
        {isEditable && (
          <div className={styles.formatContainer}>
            <button
              ref={formatButtonRef}
              type="button"
              className={styles.toolbarButton}
              onClick={() => setShowFormatMenu((v) => !v)}
              aria-label="Formatting"
              title="Formatting"
              aria-expanded={showFormatMenu}
            >
              <ALargeSmall size={18} />
            </button>
            {showFormatMenu && (
              <div ref={formatMenuRef} className={styles.formatMenu} role="toolbar" aria-label="Text formatting">
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleBold)} title="Bold (⌘B)"><Bold size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleItalic)} title="Italic (⌘I)"><Italic size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(() => document.execCommand("strikeThrough", false))} title="Strikethrough (⌘⇧X)"><Strikethrough size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleInlineCode)} title="Code (⌘⇧M)"><Code size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleHighlight)} title="Highlight (⌘⇧H)"><Highlighter size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleBlockquote)} title="Blockquote (⌘⇧.)"><Quote size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleUnorderedList)} title="Bullet list"><List size={16} /></button>
                <button type="button" className={styles.formatButton} onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat(toggleOrderedList)} title="Numbered list"><ListOrdered size={16} /></button>
              </div>
            )}
          </div>
        )}
        {onImageSelect && (
          <>
            <button
              type="button"
              className={styles.toolbarButton}
              onClick={handleButtonClick}
              disabled={isImageSelectDisabled}
              aria-label="Insert image"
              title="Insert image"
            >
              <ImagePlus size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className={styles.imageInput}
              onChange={handleFileChange}
            />
          </>
        )}
      </div>
      {uploadErrorText && (
        <div className={styles.uploadError} role="alert" aria-live="polite">
          {uploadErrorText}
        </div>
      )}
    </div>
  );
}
