"use client";

import { useRef, useState } from "react";
import { sendMessageAction } from "@/app/(app)/chat/[conversationId]/actions";

const EMOJIS = ["😀", "😂", "😍", "👍", "🙏", "🎉", "🔥", "❤️", "😢", "😮", "🤔", "👋", "✅", "🚀", "😴", "🥳"];
const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    let width = bitmap.width;
    let height = bitmap.height;

    if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
      const scale = MAX_DIMENSION / Math.max(width, height);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const newName = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], newName, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function ChatComposer({ conversationId }: { conversationId: string }) {
  const [showEmojis, setShowEmojis] = useState(false);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const textRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function insertEmoji(emoji: string) {
    if (textRef.current) {
      textRef.current.value += emoji;
      textRef.current.focus();
    }
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !fileRef.current) {
      setPhotoName(null);
      return;
    }

    setIsCompressing(true);
    const compressed = await compressImage(file);
    setIsCompressing(false);

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(compressed);
    fileRef.current.files = dataTransfer.files;
    setPhotoName(compressed.name);
  }

  function clearPhoto() {
    if (fileRef.current) {
      fileRef.current.value = "";
    }
    setPhotoName(null);
  }

  function handleSubmit() {
    setShowEmojis(false);
    setTimeout(() => {
      if (textRef.current) textRef.current.value = "";
      clearPhoto();
    }, 0);
  }

  return (
    <div>
      {photoName && (
        <div className="photo-preview-row">
          <span className="user-card-meta">
            {isCompressing ? "Preparing photo…" : `Attached: ${photoName}`}
          </span>
          <button type="button" className="photo-remove-button" onClick={clearPhoto}>
            Remove
          </button>
        </div>
      )}
      {showEmojis && (
        <div className="emoji-panel">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-option"
              onClick={() => insertEmoji(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
      <form
        ref={formRef}
        action={sendMessageAction}
        onSubmit={handleSubmit}
        className="chat-input-form"
      >
        <input type="hidden" name="conversationId" value={conversationId} />
        <button
          type="button"
          className="emoji-toggle-button"
          onClick={() => setShowEmojis((prev) => !prev)}
          aria-label="Toggle emoji picker"
        >
          🙂
        </button>
        <label className="photo-attach-button" aria-label="Attach a photo">
          📷
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/*"
            onChange={handleFileChange}
            className="photo-input-hidden"
          />
        </label>
        <input
          ref={textRef}
          type="text"
          name="text"
          className="text-input"
          placeholder="Write a message"
          maxLength={2000}
          autoComplete="off"
        />
        <button type="submit" className="chat-send-button" disabled={isCompressing}>
          Send
        </button>
      </form>
    </div>
  );
}