import React, { useCallback, useState } from "react";
import type { DragEvent } from "react"; // ✅ type-only import
import { Box, Typography, useTheme } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

interface FileDropzoneProps {
  onFilesSelected?: (files: FileList) => void;
}

const FileDropzone: React.FC<FileDropzoneProps> = ({ onFilesSelected }) => {
  const theme = useTheme();
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        onFilesSelected?.(e.dataTransfer.files);
        e.dataTransfer.clearData();
      }
    },
    [onFilesSelected]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      onFilesSelected?.(e.target.files);
    }
  };

  return (
    <Box
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById("fileInput")?.click()}
      sx={{
        border: "2px dashed",
        borderColor: isDragging ? theme.palette.primary.main : "grey.400",
        borderRadius: 2,
        p: 6,
        textAlign: "center",
        cursor: "pointer",
        backgroundColor: isDragging ? "action.hover" : "background.paper",
        transition: "border-color 0.2s, background-color 0.2s",
      }}
    >
      <CloudUploadIcon
        sx={{
          fontSize: 48,
          color: isDragging ? theme.palette.primary.main : "grey.500",
          mb: 1,
        }}
      />

      <Typography variant="body1" color="text.secondary">
        Drag & drop files here, or{" "}
        <Typography
          component="span"
          color="primary"
          sx={{ textDecoration: "underline" }}
        >
          browse
        </Typography>
      </Typography>

      <input
        id="fileInput"
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileSelect}
      />
    </Box>
  );
};

export default FileDropzone;
