import { useLocation, useNavigate } from "react-router-dom";
import { Box, Typography, Button, CircularProgress, LinearProgress, Alert } from "@mui/material";
import React from "react";

interface GeminiResult {
  name: string;
  tags: string[];
  description: string;
}

interface StreamEvent {
  status: 'uploading' | 'processing' | 'result' | 'complete' | 'error';
  message?: string;
  progress?: number;
  total?: number;
  index?: number;
  original_name?: string;
  result?: GeminiResult;
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const { groups, filesMap, files } = location.state as {
    groups: string[][];
    filesMap: Record<string, string>;
    files: File[];
  };

  // Debug: Log what we received
  React.useEffect(() => {
    console.log('Results page received:');
    console.log('- groups:', groups);
    console.log('- files:', files);
    console.log('- files length:', files?.length);
    console.log('- filesMap keys:', Object.keys(filesMap));
  }, [groups, files, filesMap]);

  // Initialize state to select all images except the last one in each group
  const [selectedImages, setSelectedImages] = React.useState<boolean[][]>(() =>
    groups.map((group) =>
      group.map((_, index) => index !== group.length - 1) // Select all except the last image in each group
    )
  );

  // Processing state
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [processingStatus, setProcessingStatus] = React.useState<string>("");
  const [uploadProgress, setUploadProgress] = React.useState<number>(0);
  const [processedResults, setProcessedResults] = React.useState<Record<string, GeminiResult>>({});
  const [errorMessage, setErrorMessage] = React.useState<string>("");
  const [filteredFiles, setFilteredFiles] = React.useState<File[]>([]);
  const [processingComplete, setProcessingComplete] = React.useState(false);

  // Navigate to review page when processing is complete
  React.useEffect(() => {
    if (processingComplete && filteredFiles.length > 0) {
      console.log('=== NAVIGATION DEBUG ===');
      console.log('All processed results:', processedResults);
      console.log('processedResults keys:', Object.keys(processedResults));
      console.log('filteredFiles:', filteredFiles.map((f, i) => `${i}: ${f.name}`));
      console.log('filteredFiles count:', filteredFiles.length);
      console.log('=== END NAVIGATION DEBUG ===');
      
      navigate('/review', { 
        state: { 
          processedResults, 
          filteredFiles 
        } 
      });
      
      // Reset the flag
      setProcessingComplete(false);
    }
  }, [processingComplete, processedResults, filteredFiles, navigate]);


  const toggleImageSelection = (groupIndex: number, imageIndex: number) => {
    setSelectedImages((prev) => {
      const updatedSelection = [...prev];
      updatedSelection[groupIndex] = [...updatedSelection[groupIndex]];
      updatedSelection[groupIndex][imageIndex] = !updatedSelection[groupIndex][imageIndex];
      return updatedSelection;
    });
  };

  const handleConfirmSelection = async () => {
    console.log('=== CONFIRM SELECTION DEBUG ===');
    console.log('Files array:', files);
    console.log('Files length:', files?.length);
    
    // Create a set of filenames that should be REMOVED (selected for deletion)
    const filesToRemove = new Set<string>();
    
    groups.forEach((group, groupIndex) => {
      group.forEach((filename, imageIndex) => {
        // If the image is selected (checked/red), it should be removed
        if (selectedImages[groupIndex][imageIndex]) {
          filesToRemove.add(filename);
        }
      });
    });

    console.log('Files to remove (Set):', Array.from(filesToRemove));

    // Filter files: keep only those NOT in the filesToRemove set
    const filteredFiles = files.filter((file) => {
      const shouldKeep = !filesToRemove.has(file.name);
      console.log(`File "${file.name}": ${shouldKeep ? 'KEEP' : 'REMOVE'}`);
      return shouldKeep;
    });

    console.log('Files to remove:', Array.from(filesToRemove));
    console.log('Files to keep:', filteredFiles);
    console.log('Original count:', files?.length || 0, '-> Filtered count:', filteredFiles.length);
    console.log('=== END DEBUG ===');
    
    // Validate we have files to upload
    if (filteredFiles.length === 0) {
      setErrorMessage("No files to process. Please select at least one image to keep.");
      return;
    }
    
    // Store filtered files for later navigation
    setFilteredFiles(filteredFiles);

    // Start processing
    await uploadAndProcessImages(filteredFiles);
  };

  const uploadAndProcessImages = async (filesToUpload: File[]) => {
    setIsProcessing(true);
    setProcessingStatus("Preparing upload...");
    setUploadProgress(0);
    setErrorMessage("");

    try {
      // Create FormData - CRITICAL: use 'files' (plural) as the field name
      const formData = new FormData();
      filesToUpload.forEach((file) => {
        console.log(`Appending file: ${file.name} (${file.size} bytes, ${file.type})`);
        formData.append('files', file);  // Must match backend parameter name
      });

      console.log(`Uploading ${filesToUpload.length} files to /api/upload`);
      console.log('FormData has', Array.from(formData.entries()).length, 'entries');

      // Determine the correct API URL
      const apiUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:8001/api/upload'
        : '/api/upload';

      console.log('Posting to:', apiUrl);

      // Start the streaming request
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
        // DON'T set Content-Type - browser will set it with boundary
      });

      console.log('Response status:', response.status, response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        // Try to get error details
        let errorDetail = '';
        try {
          const contentType = response.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            const errorData = await response.json();
            errorDetail = errorData.detail || JSON.stringify(errorData);
          } else {
            errorDetail = await response.text();
          }
        } catch (e) {
          errorDetail = 'Could not read error details';
        }
        
        throw new Error(
          `Upload failed: ${response.status} ${response.statusText}\n${errorDetail}`
        );
      }

      // Check if we got SSE response
      const contentType = response.headers.get('content-type');
      if (!contentType?.includes('text/event-stream')) {
        console.warn('Response is not SSE. Content-Type:', contentType);
      }

      // Read the stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('Stream complete');
          break;
        }

        // Decode the chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete messages (ending with \n\n)
        const messages = buffer.split('\n\n');
        buffer = messages.pop() || ''; // Keep incomplete message in buffer

        for (const message of messages) {
          if (message.trim().startsWith('data:')) {
            const jsonStr = message.replace(/^data:\s*/, '');
            try {
              const event: StreamEvent = JSON.parse(jsonStr);
              console.log('Stream event:', event);
              handleStreamEvent(event);
            } catch (e) {
              console.error('Failed to parse SSE message:', jsonStr, e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Upload error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error occurred';
      setErrorMessage(errorMsg);
      setProcessingStatus(`Error: ${errorMsg}`);
      setIsProcessing(false);
    }
  };

  const handleStreamEvent = (event: StreamEvent) => {
    console.log('Handling stream event:', event);

    switch (event.status) {
      case 'uploading':
        setProcessingStatus(event.message || 'Uploading files...');
        if (event.progress && event.total) {
          setUploadProgress((event.progress / event.total) * 30); // 0-30% for upload
        }
        break;

      case 'processing':
        setProcessingStatus(event.message || 'Processing images...');
        setUploadProgress(40); // 40% when processing starts
        break;

      case 'result':
        if (event.result && event.original_name) {
          setProcessedResults((prev) => ({
            ...prev,
            [event.original_name!]: event.result!,
          }));
          
          // Update progress based on results received
          if (event.index !== undefined && event.total) {
            const progressPercent = 40 + ((event.index + 1) / event.total) * 50; // 40-90%
            setUploadProgress(progressPercent);
            setProcessingStatus(`Processing: ${event.index + 1}/${event.total} images`);
          }
        }
        break;

      case 'complete':
        setProcessingStatus(event.message || 'Processing complete!');
        setUploadProgress(100);
        setTimeout(() => {
          setIsProcessing(false);
          setProcessingComplete(true); // Trigger navigation via useEffect
        }, 1000);
        break;

      case 'error':
        const errorMsg = event.message || 'Unknown error';
        setErrorMessage(errorMsg);
        setProcessingStatus(`Error: ${errorMsg}`);
        setIsProcessing(false);
        break;
    }
  };

  return (
    <Box
      sx={{
        width: "100vw",
        minHeight: "100vh",
        p: 4,
        background:
          "linear-gradient(-45deg, #0f2027, #203a43, #2c5364, #184e68)",
        backgroundSize: "400% 400%",
        animation: "gradientShift 12s ease infinite",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        color: "#fff",
        "@keyframes gradientShift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
      }}
    >
      <Typography
        variant="h4"
        sx={{
          fontWeight: "bold",
          color: "#b2ffb2",
          textAlign: "center",
          mb: 4,
          textShadow: "0 0 10px rgba(178,255,178,0.6)",
        }}
      >
        Confirm Duplicate Image Groups
      </Typography>

      {/* Error Alert */}
      {errorMessage && !isProcessing && (
        <Alert 
          severity="error" 
          onClose={() => setErrorMessage("")}
          sx={{ mb: 3, maxWidth: "70%" }}
        >
          {errorMessage}
        </Alert>
      )}

      <Box
        sx={{
          width: { xs: "95%", sm: "85%", md: "70%" },
          backdropFilter: "blur(15px)",
          backgroundColor: "rgba(20,20,20,0.8)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* Processing overlay */}
        {isProcessing && (
          <Box
            sx={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              gap: 3,
            }}
          >
            <CircularProgress size={60} sx={{ color: "#6ee7b7" }} />
            <Typography variant="h6" sx={{ color: "#fff", textAlign: "center", px: 4 }}>
              {processingStatus}
            </Typography>
            <Box sx={{ width: "60%", maxWidth: 400 }}>
              <LinearProgress
                variant="determinate"
                value={uploadProgress}
                sx={{
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  "& .MuiLinearProgress-bar": {
                    backgroundColor: "#6ee7b7",
                  },
                }}
              />
              <Typography variant="caption" sx={{ color: "#ccc", mt: 1, textAlign: "center", display: "block" }}>
                {Math.round(uploadProgress)}%
              </Typography>
            </Box>
          </Box>
        )}

        {groups.map((group, groupIndex) => (
          <Box
            key={`group-${groupIndex}`}
            sx={{
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 2,
              p: 2,
              background: "rgba(255,255,255,0.05)",
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            <Typography
              variant="subtitle1"
              sx={{
                width: "100%",
                fontWeight: "bold",
                mb: 1,
                color: "#8edeab",
              }}
            >
              Group {groupIndex + 1}
            </Typography>

            {group.map((filename: string, imageIndex: number) => (
              <Box
                key={filename}
                onClick={() => toggleImageSelection(groupIndex, imageIndex)}
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: selectedImages[groupIndex][imageIndex]
                    ? "3px solid #ff4444" // Red border for selected (to be deleted)
                    : "3px solid rgba(142, 222, 171, 0.6)", // Green border for kept images
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    selectedImages[groupIndex][imageIndex]
                      ? "rgba(255,0,0,0.3)" // Red background for selected (will be deleted)
                      : "rgba(0,0,0,0.3)", // Dark background for kept
                  boxShadow: selectedImages[groupIndex][imageIndex]
                    ? "0 0 15px rgba(255,68,68,0.6)" // Red glow for selected
                    : "0 4px 12px rgba(0,0,0,0.5)",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    border: selectedImages[groupIndex][imageIndex]
                      ? "3px solid #ff6666"
                      : "3px solid rgba(142, 222, 171, 0.9)",
                    transform: "scale(1.05)",
                  },
                }}
              >
                <img
                  src={filesMap[filename]}
                  alt={filename}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </Box>
            ))}
          </Box>
        ))}

        <Box sx={{ textAlign: "center", mt: 3 }}>
          <Typography variant="body2" sx={{ mb: 2, color: "#ccc" }}>
            🔴 Red border = Will be deleted | 🟢 Green border = Will be kept
          </Typography>
          <Button
            variant="contained"
            disabled={isProcessing}
            sx={{
              background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
              color: "#fff",
              fontWeight: "bold",
              borderRadius: "30px",
              paddingX: 4,
              paddingY: 1.2,
              boxShadow: "0px 0px 10px rgba(110,231,183,0.5)",
              "&:hover": {
                background: "linear-gradient(45deg, #57cc99, #2fa88a)",
                boxShadow: "0px 0px 20px rgba(110,231,183,0.8)",
              },
              "&:disabled": {
                background: "rgba(255,255,255,0.3)",
                color: "rgba(255,255,255,0.5)",
              },
            }}
            onClick={handleConfirmSelection}
          >
            {isProcessing ? "Processing..." : "Confirm Selection & Process"}
          </Button>
        </Box>
      </Box>
    </Box>
  );
}