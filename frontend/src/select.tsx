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
import { useNavigate } from 'react-router-dom';
import { GoogleImagePicker, type GoogleImagePickerResult } from './GoogleDriveHandler';

export default function SelectPage() {
  // Restore selected card from sessionStorage after OAuth redirect
  const [selectedCard, setSelectedCard] = React.useState<number | null>(() => {
    const saved = sessionStorage.getItem('selected_card');
    return saved ? parseInt(saved, 10) : null;
  });
  
  const [openPopup, setOpenPopup] = React.useState(false);
  const [files, setFiles] = React.useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = React.useState<string[]>([]);
  const [dragOver, setDragOver] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [isGoogleDriveProcessing, setIsGoogleDriveProcessing] = React.useState(false);
  const theme = useTheme();
  const navigate = useNavigate();

  // Save selected card to sessionStorage whenever it changes
  React.useEffect(() => {
    if (selectedCard !== null) {
      sessionStorage.setItem('selected_card', selectedCard.toString());
    }
  }, [selectedCard]);

  // Check if we just returned from OAuth with Google Drive selected
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authenticated = urlParams.get('authenticated');
    const pickerPending = sessionStorage.getItem('google_picker_pending');
    
    if (authenticated === 'true' && pickerPending === 'true' && selectedCard === 2) {
      // Auto-click the continue button after OAuth
      console.log('Auto-triggering Continue button after OAuth');
      setTimeout(() => {
        const continueButton = document.querySelector('[data-continue-button]') as HTMLElement;
        if (continueButton) {
          continueButton.click();
        }
      }, 100);
    }
  }, [selectedCard]);

  const handleContinue = () => {
    console.log('Continue clicked with selection:', selectedCard);

    if (selectedCard === 1) {
      setOpenPopup(true);
    } else if (selectedCard === 2) {
      console.log('Google Drive flow will be initiated');
    } else {
      console.log('No valid selection');
    }
  };

  const handleGoogleDriveFilesSelected = async (result: GoogleImagePickerResult) => {
    console.log('Google Drive files selected:', result.files);
    setIsGoogleDriveProcessing(true);

    try {
      const fileArray: File[] = [];
      
      for (const pickedFile of result.files) {
        const blob = result.blobs.get(pickedFile.id);
        if (blob) {
          const file = new File([blob], pickedFile.name, {
            type: pickedFile.mimeType,
          });
          fileArray.push(file);
        }
      }

      console.log(`Converted ${fileArray.length} files from Google Drive`);

      const formData = new FormData();
      fileArray.forEach((file) => formData.append('images', file));

      const response = await fetch('http://localhost:8001/api/compute/phash-group', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Server error');

      const resultData = await response.json();

      console.log('pHash groups:', resultData.groups);

      // Clear the selection from sessionStorage
      sessionStorage.removeItem('selected_card');

      navigate('/results', {
        state: {
          groups: resultData.groups,
          phash: resultData.phash,
          files: fileArray.map((f) => ({
            name: f.name,
            url: URL.createObjectURL(f),
          })),
        },
      });
    } catch (err) {
      console.error('Error processing Google Drive images:', err);
      alert('Failed to process Google Drive images. Please try again.');
    } finally {
      setIsGoogleDriveProcessing(false);
    }
  };

  const handleGoogleDriveError = (error: Error) => {
    console.error('Google Drive error:', error);
    alert(`Google Drive error: ${error.message}`);
    setIsGoogleDriveProcessing(false);
  };

  const handleFilesSelect = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);

    const uniqueFiles = fileArray.filter(
      (f) =>
        f.type.startsWith('image/') &&
        !files.some((existing) => existing.name === f.name)
    );

    setFiles((prev) => [...prev, ...uniqueFiles]);
  };

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

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

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

  const handleLocalCompute = async () => {
    if (files.length === 0) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('images', file));

    try {
      const response = await fetch('http://localhost:8001/api/compute/phash-group', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Server error');

      const result = await response.json();

      console.log('pHash groups:', result.groups);

      // Clear the selection from sessionStorage
      sessionStorage.removeItem('selected_card');

      navigate('/results', {
        state: {
          groups: result.groups,
          phash: result.phash,
          files: files.map((f) => ({
            name: f.name,
            url: URL.createObjectURL(f),
          })),
        },
      });
    } catch (err) {
      console.error('Error computing image groups:', err);
    }
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
      <Typography
        variant="h3"
        component="h1"
        sx={{ fontWeight: 'bold', color: '#283b4a', textAlign: 'center' }}
      >
        Upload Your Files
      </Typography>

      <SelectActionCard
        selectedCard={selectedCard}
        onSelectCard={setSelectedCard}
      />

      {selectedCard === 2 ? (
        <GoogleImagePicker
          onFilesSelected={handleGoogleDriveFilesSelected}
          onError={handleGoogleDriveError}
          maxFiles={50}
        >
          <Button
            data-continue-button
            variant="contained"
            sx={{
              backgroundColor: '#8edeab',
              color: '#fff',
              '&:hover': { backgroundColor: '#76c89b' },
              minWidth: 180,
              fontWeight: 'bold',
            }}
            disabled={isGoogleDriveProcessing}
          >
            {isGoogleDriveProcessing ? (
              <>
                <CircularProgress size={20} sx={{ mr: 1, color: '#fff' }} />
                Processing...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </GoogleImagePicker>
      ) : (
        <Button
          data-continue-button
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
      )}

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
              <Typography
                variant="body1"
                sx={{ mt: 1, color: '#607d8b', textAlign: 'center' }}
              >
                Drag & Drop your <strong>image files</strong> here or click to browse
              </Typography>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelect(e.target.files)}
                style={{ display: 'none' }}
              />
            </Box>

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
                {uploading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  'Upload All'
                )}
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