import { useCallback, useRef } from "react";
import type {
  ChangeEvent,
  ClipboardEvent,
  DragEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  RefObject,
} from "react";
import { ImagePlus, Lock, LockOpen } from "lucide-react";
import { NoteEditorHeader } from "./NoteEditorHeader";
import { NoteEditorContent } from "./NoteEditorContent";
import type { DropIndicatorPosition } from "./useDropIndicator";
import type { WeatherLabelData } from "../../features/weather/WeatherDom";
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
  footer?: ReactNode;
  weather?: WeatherLabelData | null;
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
  footer,
  weather,
}: NoteEditorViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyClassName = styles.body;

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
      <div className={bodyClassName}>
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
      {footer}
    </div>
  );
}
