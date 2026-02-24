"use client";

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/utils";
import {
  Upload,
  X,
  FileText,
  Loader2,
  ExternalLink,
} from "lucide-react";

interface UploadResult {
  url: string;
  pathname: string;
  size: number;
}

interface PdfUploadProps {
  onUpload: (result: UploadResult) => void;
  onRemove?: () => void;
  currentFile?: {
    url: string;
    name: string;
    size: number;
  };
  accept?: string;
  folder?: string;
  label?: string;
}

export function PdfUpload({
  onUpload,
  onRemove,
  currentFile,
  accept = ".pdf,.jpg,.jpeg,.png,.webp",
  folder = "documents",
  label = "Upload file",
}: PdfUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsUploading(true);
      setStatusMessage("Uploading file...");

      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folder", folder);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const result: UploadResult = await response.json();
        onUpload(result);
        setStatusMessage("File uploaded successfully.");
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Upload failed. Please try again.";
        setError(message);
        setStatusMessage(null);
      } finally {
        setIsUploading(false);
      }
    },
    [folder, onUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) uploadFile(file);
      // Reset the input so the same file can be re-selected
      if (inputRef.current) inputRef.current.value = "";
    },
    [uploadFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) uploadFile(file);
    },
    [uploadFile]
  );

  const handleRemove = useCallback(() => {
    setStatusMessage("File removed.");
    setError(null);
    onRemove?.();
  }, [onRemove]);

  // Display current file
  if (currentFile && !isUploading) {
    return (
      <div className="rounded-md border border-input bg-background p-4">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{currentFile.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatFileSize(currentFile.size)}
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              asChild
              aria-label="Preview file in new tab"
            >
              <a href={currentFile.url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
            {onRemove && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={handleRemove}
                aria-label="Remove file"
                className="text-destructive hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div aria-live="polite" className="sr-only">
          {statusMessage}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isUploading) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-disabled={isUploading}
        className={`
          flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-6 transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-input hover:border-primary/50 hover:bg-muted/50"}
          ${isUploading ? "pointer-events-none opacity-60" : ""}
        `}
      >
        {isUploading ? (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
            <p className="mt-2 text-sm font-medium">
              Drop a file here or click to browse
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              PDF, JPEG, PNG, or WebP up to 10MB
            </p>
          </>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="sr-only"
        aria-label={label}
        tabIndex={-1}
      />

      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div aria-live="polite" className="sr-only">
        {statusMessage}
      </div>
    </div>
  );
}
