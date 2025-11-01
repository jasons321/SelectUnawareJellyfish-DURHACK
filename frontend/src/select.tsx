import React from 'react';
import SelectActionCard from './card.tsx';
import {
  Button,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  useTheme,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';

export default function SelectPage() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const [openPopup, setOpenPopup] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<string[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const theme = useTheme();

  /** Continue button handler */
  const handleContinue = () => {
    console.log('Continue clicked with selection:', selectedCard);

    // ✅ Only open popup if "Local Computer" card is selected (e.g., index 0)
    if (selectedCard === 1) {
      setOpenPopup(true);
    } else {
      console.log('Popup only opens for Local Computer card');
      // Optionally: alert('File upload is only available for Local Computer.');
    }
  };

  /** Handle file selection */
  const handleFilesSelect = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);
    // Avoid duplicates
    const uniqueFiles = fileArray.filter(
      (f) => !files.some((existing) => existing.name === f.name)
    );
    setFiles((prev) => [...prev, ...uniqueFiles]);
  };

  /** Drag events */
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    handleFilesSelect(e.dataTransfer.files);
  };

  /** Upload simulation */
  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    // Simulate per-file upload delay
    for (const f of files) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setUploadedFiles((prev) =>
        prev.includes(f.name) ? prev : [...prev, f.name]
      );
      console.log('File uploaded:', f.name);
    }

    setUploading(false);
  };

  const handleClosePopup = () => {
    setOpenPopup(false);
    setFiles([]);
    setUploadedFiles([]);
    setUploading(false);
  };

  const handleLocalCompute = () => {
    console.log('Local compute pressed with files:', uploadedFiles);
    setOpenPopup(false);
  };

  return (
    <Box
      sx={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        gap: '2rem',
      }}
    >
      {/* Title */}
      <Typography
        variant="h3"
        component="h1"
        sx={{ fontWeight: 'bold', color: '#283b4a', textAlign: 'center' }}
      >
        Upload Your Files
      </Typography>

      {/* Card Selection */}
      <SelectActionCard selectedCard={selectedCard} onSelectCard={setSelectedCard} />

      {/* Continue Button */}
      <Button
        variant="contained"
        sx={{
          backgroundColor: '#8edeab',
          color: '#fff',
          '&:hover': { backgroundColor: '#76c89b' },
          minWidth: 180,
          fontWeight: 'bold',
        }}
        onClick={handleContinue}
        disabled={selectedCard === null}
      >
        Continue
      </Button>

      {/* Popup Dialog */}
      <Dialog open={openPopup} onClose={handleClosePopup} maxWidth="md" fullWidth>
        <DialogTitle>Upload Files</DialogTitle>
        <DialogContent>
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
              alignItems: 'stretch',
              mt: 2,
            }}
          >
            {/* Drag-and-Drop Zone */}
            <Box
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              sx={{
                flex: 1,
                border: `2px dashed ${
                  dragOver ? theme.palette.primary.main : '#b0bec5'
                }`,
                borderRadius: '10px',
                height: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backgroundColor: dragOver ? '#f0f9f4' : '#fafafa',
                transition: 'all 0.3s ease',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
              onClick={() => document.getElementById('fileInput')?.click()}
            >
              <CloudUploadIcon
                sx={{
                  fontSize: 48,
                  color: dragOver ? theme.palette.primary.main : '#90a4ae',
                }}
              />
              <Typography variant="body1" sx={{ mt: 1, color: '#607d8b', textAlign: 'center' }}>
                Drag & Drop your files here or click to browse
              </Typography>
              <input
                id="fileInput"
                type="file"
                multiple
                onChange={(e) => handleFilesSelect(e.target.files)}
                style={{ display: 'none' }}
              />
            </Box>

            {/* File List */}
            <Box
              sx={{
                flex: 1,
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: 2,
                backgroundColor: '#f9f9f9',
                overflowY: 'auto',
                maxHeight: 220,
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {files.length === 0 ? 'No Files Selected' : 'Files to Upload:'}
              </Typography>

              <List dense>
                {files.map((f) => (
                  <React.Fragment key={f.name}>
                    <ListItem
                      secondaryAction={
                        uploadedFiles.includes(f.name) && (
                          <CheckCircleIcon sx={{ color: '#4caf50' }} />
                        )
                      }
                    >
                      <ListItemIcon>
                        <InsertDriveFileIcon sx={{ color: '#607d8b' }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={f.name}
                        secondary={
                          uploadedFiles.includes(f.name)
                            ? 'Uploaded'
                            : 'Pending'
                        }
                      />
                    </ListItem>
                    <Divider />
                  </React.Fragment>
                ))}
              </List>
            </Box>
          </Box>

          {/* Upload Button */}
          {files.length > 0 && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                sx={{
                  backgroundColor: '#8edeab',
                  color: '#fff',
                  '&:hover': { backgroundColor: '#76c89b' },
                  minWidth: 200,
                }}
              >
                {uploading ? <CircularProgress size={24} color="inherit" /> : 'Upload All'}
              </Button>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={handleClosePopup}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleLocalCompute}
            disabled={uploadedFiles.length === 0}
            sx={{
              backgroundColor:
                uploadedFiles.length > 0 ? '#8edeab' : '#ccc',
              color: '#fff',
              '&:hover': {
                backgroundColor:
                  uploadedFiles.length > 0 ? '#76c89b' : '#ccc',
              },
            }}
          >
            Local Compute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
