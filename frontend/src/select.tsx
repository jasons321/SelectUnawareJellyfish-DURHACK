import React from "react";
import SelectActionCard from "./card.tsx";
import {
  Button,
  Typography,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Backdrop,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useNavigate } from 'react-router-dom';
import { GoogleImagePicker, type GoogleImagePickerResult } from './GoogleDriveHandler';
import { OneDriveImagePicker, type OneDrivePickerResult } from './OneDriveHandler';

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
  const [computing, setComputing] = React.useState(false);

  const [isGoogleDriveProcessing, setIsGoogleDriveProcessing] = React.useState(false);
  const [isOneDriveProcessing, setIsOneDriveProcessing] = React.useState(false);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingMessage, setProcessingMessage] = React.useState('');
  const navigate = useNavigate();

  // Save selected card to sessionStorage whenever it changes
  React.useEffect(() => {
    if (selectedCard !== null) {
      sessionStorage.setItem('selected_card', selectedCard.toString());
    }
  }, [selectedCard]);

  // Check if we just returned from OAuth with Google Drive or OneDrive selected
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authenticated = urlParams.get('authenticated');
    const googlePickerPending = sessionStorage.getItem('google_picker_pending');
    const onedrivePickerPending = sessionStorage.getItem('onedrive_picker_pending');
    
    if (authenticated === 'true' && (googlePickerPending === 'true' || onedrivePickerPending === 'true')) {
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
    } else if (selectedCard === 3) {
      console.log('OneDrive flow will be initiated');
    } else {
      console.log('No valid selection');
    }
  };

  const handleGoogleDriveFilesSelected = async (result: GoogleImagePickerResult) => {
    console.log('Google Drive files selected:', result.files);
    setIsGoogleDriveProcessing(true);
    setIsProcessing(true);
    setProcessingMessage('Processing images from Google Drive...');

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
      setProcessingMessage(`Analysing ${fileArray.length} images for duplicates...`);

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

      const filesMap: Record<string, string> = {};
      for (const file of fileArray) {
        filesMap[file.name] = URL.createObjectURL(file); 
      }

      navigate('/results', {
        state: {
          groups: resultData.groups,
          filesMap: filesMap,
        },
      });
    } catch (err) {
      console.error('Error processing Google Drive images:', err);
      alert('Failed to process Google Drive images. Please try again.');
      setIsProcessing(false);
    } finally {
      setIsGoogleDriveProcessing(false);
    }
  };

  const handleOneDriveFilesSelected = async (result: OneDrivePickerResult) => {
    console.log('OneDrive files selected:', result.files);
    setIsOneDriveProcessing(true);
    setIsProcessing(true);
    setProcessingMessage('Processing images from OneDrive...');

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

      console.log(`Converted ${fileArray.length} files from OneDrive`);
      setProcessingMessage(`Analysing ${fileArray.length} images for duplicates...`);

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

      const filesMap: Record<string, string> = {};
      for (const file of fileArray) {
        filesMap[file.name] = URL.createObjectURL(file); 
      }

      navigate('/results', {
        state: {
          groups: resultData.groups,
          filesMap: filesMap,
        },
      });
    } catch (err) {
      console.error('Error processing OneDrive images:', err);
      alert('Failed to process OneDrive images. Please try again.');
      setIsProcessing(false);
    } finally {
      setIsOneDriveProcessing(false);
    }
  };

  const handleGoogleDriveError = (error: Error) => {
    console.error('Google Drive error:', error);
    alert(`Google Drive error: ${error.message}`);
    setIsGoogleDriveProcessing(false);
    setIsProcessing(false);
  };

  const handleOneDriveError = (error: Error) => {
    console.error('OneDrive error:', error);
    alert(`OneDrive error: ${error.message}`);
    setIsOneDriveProcessing(false);
    setIsProcessing(false);
  };

  const handleGooglePickerCancelled = () => {
    console.log('Google Picker cancelled');
    setIsProcessing(false);
    setIsGoogleDriveProcessing(false);
  };

  const handleOnedrivePickerCancelled = () => {
    console.log('OneDrive Picker cancelled');
    setIsProcessing(false);
    setIsOneDriveProcessing(false);
  };

  const handleFilesSelect = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const fileArray = Array.from(newFiles);

    const uniqueFiles = fileArray.filter(
      (f) =>
        f.type.startsWith("image/") &&
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

    // Simulate upload delay
    for (const f of files) {
      await new Promise((resolve) => setTimeout(resolve, 700));
      setUploadedFiles((prev) =>
        prev.includes(f.name) ? prev : [...prev, f.name]
      );
    }

    setUploading(false);
  };

  const handleClosePopup = () => {
    setOpenPopup(false);
    setFiles([]);
    setUploadedFiles([]);
    setUploading(false);
    setComputing(false);
  };

  const handleLocalCompute = async () => {
    if (files.length === 0) return;

    setComputing(true);
    setIsProcessing(true);
    setProcessingMessage(`Analysing ${files.length} images for duplicates...`);
    
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));

    try {
      const response = await fetch(
        "http://localhost:8001/api/compute/phash-group",
        { method: "POST", body: formData }
      );

      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const result = await response.json();

      console.log('pHash groups:', result.groups);

      // Clear the selection from sessionStorage
      sessionStorage.removeItem('selected_card');

      const filesMap: Record<string, string> = {};
      for (const file of files) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
        });
        filesMap[file.name] = base64;
      }

      navigate("/results", { state: { groups: result.groups, filesMap } });
    } catch (err) {
      console.error("Error computing image groups:", err);
      setIsProcessing(false);
    } finally {
      setComputing(false);
    }
  };

  return (
    <Box
      sx={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "2rem",
        background:
          "linear-gradient(-45deg, #0f2027, #203a43, #2c5364, #184e68)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 12s ease infinite",
        color: "rgba(255,255,255,0.9)",
        overflow: "hidden",
        "@keyframes gradientShift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      }}
    >
      {/* Processing Overlay */}
      <Backdrop
        open={isProcessing}
        sx={{
          zIndex: (theme) => theme.zIndex.modal + 1,
          background: "linear-gradient(-45deg, rgba(15,32,39,0.95), rgba(32,58,67,0.95), rgba(44,83,100,0.95), rgba(24,78,104,0.95))",
          backgroundSize: "400% 400%",
          animation: "gradientShift 12s ease infinite",
          backdropFilter: "blur(10px)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 3,
            padding: 4,
            borderRadius: "20px",
            background: "rgba(20,20,20,0.6)",
            border: "1px solid rgba(142,222,171,0.3)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
          }}
        >
          <CircularProgress
            size={80}
            thickness={4}
            sx={{
              color: "#8edeab",
              filter: "drop-shadow(0 0 10px rgba(142,222,171,0.5))",
            }}
          />
          <Typography
            variant="h5"
            sx={{
              fontWeight: "bold",
              color: "#b2ffb2",
              textAlign: "center",
              textShadow: "0 0 10px rgba(178,255,178,0.6)",
            }}
          >
            {processingMessage}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              color: "rgba(255,255,255,0.7)",
              textAlign: "center",
            }}
          >
            Please wait while we analyse your images...
          </Typography>
        </Box>
      </Backdrop>

      <Box
        sx={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: "bold",
            background: "linear-gradient(90deg, #b2ffb2, #8edeab, #6ee7b7)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            textShadow: "0px 0px 20px rgba(178,255,178,0.3)",
          }}
        >
          Image Duplicate Detection
        </Typography>

        <Typography
          variant="body1"
          sx={{ color: "rgba(255,255,255,0.7)", fontSize: "1rem" }}
        >
          Choose a method to upload your images
        </Typography>
      </Box>

      <SelectActionCard
        selectedCard={selectedCard}
        onSelectCard={setSelectedCard}
      />

      <Box sx={{ textAlign: "center" }}>
        {selectedCard === 2 ? (
          <GoogleImagePicker
            onFilesSelected={handleGoogleDriveFilesSelected}
            onError={handleGoogleDriveError}
            onPickerCancelled={handleGooglePickerCancelled}
            onPickerOpened={() => {
              setIsProcessing(false);
              setProcessingMessage('');
            }}
            onPickerStarted={() => {
              setIsProcessing(true);
              setProcessingMessage('Processing selected images...');
            }}
            maxFiles={50}
          >
            <Button
              data-continue-button
              variant="contained"
              onClick={() => {
                setIsProcessing(true);
                setProcessingMessage('Opening Google Drive picker...');
              }}
              sx={{
                background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
                color: "#fff",
                fontWeight: "bold",
                paddingX: 4,
                paddingY: 1.2,
                borderRadius: "30px",
                boxShadow: "0px 0px 10px rgba(110,231,183,0.5)",
                "&:hover": {
                  background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                  boxShadow: "0px 0px 20px rgba(110,231,183,0.8)",
                },
                "&:disabled": {
                  background: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.5)",
                },
              }}
              disabled={selectedCard === null || isGoogleDriveProcessing || isProcessing}
            >
              {isGoogleDriveProcessing ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Continue'
              )}
            </Button>
          </GoogleImagePicker>
        ) : selectedCard === 3 ? (
          <OneDriveImagePicker
            onFilesSelected={handleOneDriveFilesSelected}
            onError={handleOneDriveError}
            onPickerCancelled={handleOnedrivePickerCancelled}
            maxFiles={50}
          >
            <Button
              data-continue-button
              variant="contained"
              onClick={() => {
                setIsProcessing(true);
                setProcessingMessage('Opening OneDrive picker...');
              }}
              sx={{
                background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
                color: "#fff",
                fontWeight: "bold",
                paddingX: 4,
                paddingY: 1.2,
                borderRadius: "30px",
                boxShadow: "0px 0px 10px rgba(110,231,183,0.5)",
                "&:hover": {
                  background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                  boxShadow: "0px 0px 20px rgba(110,231,183,0.8)",
                },
                "&:disabled": {
                  background: "rgba(255,255,255,0.15)",
                  color: "rgba(255,255,255,0.5)",
                },
              }}
              disabled={selectedCard === null || isOneDriveProcessing || isProcessing}
            >
              {isOneDriveProcessing ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Continue'
              )}
            </Button>
          </OneDriveImagePicker>
        ) : (
          <Button
            variant="contained"
            sx={{
              background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
              color: "#fff",
              fontWeight: "bold",
              paddingX: 4,
              paddingY: 1.2,
              borderRadius: "30px",
              boxShadow: "0px 0px 10px rgba(110,231,183,0.5)",
              "&:hover": {
                background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                boxShadow: "0px 0px 20px rgba(110,231,183,0.8)",
              },
              "&:disabled": {
                background: "rgba(255,255,255,0.15)",
                color: "rgba(255,255,255,0.5)",
              },
            }}
            onClick={handleContinue}
            disabled={selectedCard === null || isProcessing}
          >
            Continue
          </Button>
        )}
      </Box>

      {/* Darker Glass Dialog */}
      <Dialog
        open={openPopup}
        onClose={handleClosePopup}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            backdropFilter: "blur(25px)",
            backgroundColor: "rgba(20,20,20,0.85)",
            border: "1px solid rgba(255,255,255,0.15)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.8)",
            color: "#fff",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: "bold", color: "#8edeab" }}>
          Upload Files
        </DialogTitle>

        <DialogContent sx={{ position: "relative" }}>
          {computing && (
            <Box
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                bgcolor: "rgba(0,0,0,0.5)",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                zIndex: 10,
                borderRadius: "10px",
              }}
            >
              <CircularProgress size={60} color="success" />
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              gap: 3,
              alignItems: "stretch",
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
                  dragOver ? "#8edeab" : "rgba(255,255,255,0.3)"
                }`,
                borderRadius: "12px",
                height: 220,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                background: dragOver
                  ? "rgba(142,222,171,0.15)"
                  : "rgba(40,40,40,0.6)",
                transition: "all 0.3s ease",
                "&:hover": { background: "rgba(60,60,60,0.7)" },
              }}
              onClick={() => document.getElementById("fileInput")?.click()}
            >
              <CloudUploadIcon sx={{ fontSize: 48, color: "#8edeab" }} />
              <Typography variant="body1" sx={{ mt: 1, textAlign: "center" }}>
                Drag & Drop your <strong>image files</strong> here or click to
                browse
              </Typography>
              <input
                id="fileInput"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => handleFilesSelect(e.target.files)}
                style={{ display: "none" }}
              />
            </Box>

            <Box
              sx={{
                flex: 1,
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "10px",
                padding: 2,
                backgroundColor: "rgba(35,35,35,0.7)",
                overflowY: "auto",
                maxHeight: 200,
                "&::-webkit-scrollbar": {
                  width: "8px",
                },
                "&::-webkit-scrollbar-thumb": {
                  background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
                  borderRadius: "10px",
                  border: "2px solid rgba(255, 255, 255, 0.1)",
                },
                "&::-webkit-scrollbar-thumb:hover": {
                  background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                },
                "&::-webkit-scrollbar-track": {
                  background: "rgba(255, 255, 255, 0.1)",
                  borderRadius: "10px",
                },
                "&::-webkit-scrollbar-track:hover": {
                  background: "rgba(255, 255, 255, 0.2)",
                },
              }}
            >
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: "bold", mb: 1, color: "#b2ffb2" }}
              >
                {files.length === 0 ? "No Files Selected" : "Files to Upload:"}
              </Typography>

              <List dense>
                {files.map((f) => (
                  <React.Fragment key={f.name}>
                    <ListItem
                      secondaryAction={
                        uploadedFiles.includes(f.name) && (
                          <CheckCircleIcon sx={{ color: "#8edeab" }} />
                        )
                      }
                    >
                      <ListItemIcon>
                        <InsertDriveFileIcon sx={{ color: "#b0bec5" }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={f.name}
                        secondary={
                          uploadedFiles.includes(f.name) ? "Uploaded" : "Pending"
                        }
                      />
                    </ListItem>
                    <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
                  </React.Fragment>
                ))}
              </List>
            </Box>
          </Box>

          {files.length > 0 && (
            <Box sx={{ mt: 3, textAlign: "center" }}>
              <Button
                variant="contained"
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                sx={{
                  background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
                  color: "#fff",
                  fontWeight: "bold",
                  minWidth: 200,
                  borderRadius: "30px",
                  "&:hover": {
                    background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                  },
                }}
              >
                {uploading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  "Upload All"
                )}
              </Button>
            </Box>
          )}
        </DialogContent>

        <DialogActions>
          <Button
            onClick={handleClosePopup}
            disabled={computing || isProcessing}
            sx={{ color: "#ccc", "&:hover": { color: "#fff" } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleLocalCompute}
            disabled={uploadedFiles.length === 0 || computing || isProcessing}
            sx={{
              background:
                uploadedFiles.length > 0 && !computing && !isProcessing
                  ? "linear-gradient(45deg, #8edeab, #57cc99)"
                  : "rgba(255,255,255,0.15)",
              color: "#fff",
              borderRadius: "30px",
              "&:hover": {
                background:
                  uploadedFiles.length > 0 && !computing && !isProcessing
                    ? "linear-gradient(45deg, #57cc99, #2fa88a)"
                    : "rgba(255,255,255,0.25)",
              },
            }}
          >
            {computing ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              "Local Compute"
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}