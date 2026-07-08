"use client";

import { useCallback, useState } from "react";
import { Upload, X, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  label?: string;
}

export function FileUploader({
  onFileSelect,
  accept = ".xlsx, .xls, .csv, .pdf",
  maxSize = 10 * 1024 * 1024, // 10MB
  label = "Click or drag to upload Excel or PDF file",
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    if (selectedFile.size > maxSize) {
      setError(`File size exceeds ${(maxSize / 1024 / 1024).toFixed(0)}MB limit.`);
      return;
    }
    // Simple extension check
    if (!selectedFile.name.match(/\.(xlsx|xls|csv|pdf)$/i)) {
      setError("Please upload a valid Excel or PDF file.");
      return;
    }

    setFile(selectedFile);
    onFileSelect(selectedFile);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        validateAndSetFile(droppedFile);
      }
    },
    [maxSize, onFileSelect]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  const removeFile = () => {
    setFile(null);
    setError(null);
    const input = document.getElementById("file-upload") as HTMLInputElement;
    if (input) input.value = '';
  };

  return (
    <div className="w-full">
      {!file ? (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer flex flex-col items-center justify-center gap-2",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
            error && "border-destructive/50 bg-destructive/5"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          <input
            id="file-upload"
            type="file"
            className="hidden"
            accept={accept}
            onChange={handleFileInput}
          />
          <div className="p-3 bg-muted rounded-full">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="font-medium text-sm">{label}</p>
            <p className="text-xs text-muted-foreground">
              Supports .xlsx, .xls, .csv, .pdf (Max 10MB)
            </p>
          </div>
          {error && <p className="text-xs text-destructive mt-2">{error}</p>}
        </div>
      ) : (
        <div className="border rounded-lg p-4 flex items-center justify-between bg-card">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <FileSpreadsheet className="h-5 w-5 text-green-600 dark:text-green-500" />
            </div>
            <div>
              <p className="font-medium text-sm truncate max-w-[200px] md:max-w-md">
                {file.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              removeFile();
            }}
            className="p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
