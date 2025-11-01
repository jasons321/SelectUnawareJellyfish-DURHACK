import React, { useState } from "react";
import {
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Box,
} from "@mui/material";

import Grid from "@mui/material/Grid";

import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import FileDropzone from "./filedropzone"; // adjust path if needed

const Upload: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);

  const handleFilesSelected = (fileList: FileList) => {
    const newFiles = Array.from(fileList);
    setFiles((prev) => [...prev, ...newFiles]);
  };

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5", // optional for contrast
      }}
    >
      <Paper
        elevation={3}
        sx={{
          width: { xs: "90%", sm: "80%", md: "70%", lg: "60%" },
          p: 4,
        }}
      >
        {/* Header */}
        <Box sx={{ mb: 4, textAlign: "center" }}>
          <Typography variant="h4" gutterBottom>
            File Upload
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Drag and drop your files below or click to browse.
          </Typography>
        </Box>

        {/* Main content */}
        <Grid container spacing={4}>
          {/* Left: Dropzone */}
          <Grid>
            <FileDropzone onFilesSelected={handleFilesSelected} />
          </Grid>

          {/* Right: File List */}
          <Grid>
            <Paper
              elevation={1}
              sx={{
                p: 2,
                display: "flex",
                flexDirection: "column",
                minHeight: 200,
              }}
            >
              <Typography variant="h6" gutterBottom>
                Uploaded Files
              </Typography>

              {files.length === 0 ? (
                <Box
                  sx={{
                    flexGrow: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "text.secondary",
                    fontStyle: "italic",
                  }}
                >
                  No files uploaded
                </Box>
              ) : (
                <List dense sx={{ overflowY: "auto" }}>
                  {files.map((file, idx) => (
                    <ListItem key={idx} divider>
                      <ListItemIcon>
                        <InsertDriveFileIcon color="action" />
                      </ListItemIcon>
                      <ListItemText
                        primary={file.name}
                        secondary={`${(file.size / 1024).toFixed(2)} KB`}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default Upload;
