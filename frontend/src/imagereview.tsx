import React from "react";
import { useLocation } from "react-router-dom";
import { Box, Typography, Chip, IconButton, Button } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

interface GeminiResult {
  name: string;
  tags: string[];
  description: string;
}

interface ImageReviewPageProps {
  // Optional props for test mode (when used with sample data)
  images?: Array<{
    name: string;
    src: string;
    description: string;
    tags: string[];
  }>;
}

export default function ImageReviewPage({ images: sampleImages }: ImageReviewPageProps) {
  const location = useLocation();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // Try to get real data from navigation state, fall back to sample data
  const { processedResults, filteredFiles } = (location.state as {
    processedResults?: Record<string, GeminiResult>;
    filteredFiles?: File[];
  }) || {};

  // Debug what we received
  React.useEffect(() => {
    console.log('=== IMAGEREVIEW RECEIVED STATE ===');
    console.log('location.state:', location.state);
    console.log('processedResults:', processedResults);
    console.log('filteredFiles:', filteredFiles);
    console.log('Has processedResults?', !!processedResults);
    console.log('Has filteredFiles?', !!filteredFiles);
    console.log('filteredFiles length:', filteredFiles?.length);
    console.log('=== END STATE DEBUG ===');
  }, [location.state, processedResults, filteredFiles]);

  // Prepare image data from either real processed results or sample data
  const imageData = React.useMemo(() => {
    if (processedResults && filteredFiles) {
      // Debug logging
      console.log('=== IMAGE REVIEW DEBUG ===');
      console.log('processedResults keys:', Object.keys(processedResults));
      console.log('filteredFiles:', filteredFiles.map((f, i) => `${i}: ${f.name}`));
      console.log('processedResults:', processedResults);
      
      // Real mode: use processed results from Gemini
      // Backend returns results keyed by "{index}_{filename}" format
      return filteredFiles.map((file, index) => {
        // Try to find result by index-prefixed name (e.g., "0_photo.jpg")
        const indexedName = `${index}_${file.name}`;
        let result: GeminiResult | undefined = processedResults[indexedName];
        
        console.log(`Looking for file ${index}: "${file.name}"`);
        console.log(`  Trying indexed name: "${indexedName}"`, result ? '✓ FOUND' : '✗ not found');
        
        // Fallback: search through all results to find a match
        if (!result) {
          const matchingKey = Object.keys(processedResults).find(key => 
            key.endsWith(file.name) || key === file.name
          );
          console.log(`  Fallback search - matchingKey: "${matchingKey}"`, matchingKey ? '✓ FOUND' : '✗ not found');
          result = matchingKey ? processedResults[matchingKey] : undefined;
        }
        
        // Final fallback: use default values
        const finalResult: GeminiResult = result || {
          name: file.name,
          tags: [],
          description: "No description available",
        };
        
        console.log(`  Final result:`, finalResult);
        
        return {
          name: finalResult.name,
          src: URL.createObjectURL(file),
          description: finalResult.description,
          tags: finalResult.tags,
          originalFile: file,
        };
      });
    } else if (sampleImages) {
      // Test mode: use sample images
      return sampleImages.map(img => ({
        ...img,
        originalFile: null,
      }));
    } else {
      // No data available
      return [];
    }
  }, [processedResults, filteredFiles, sampleImages]);

  const currentImage = imageData[currentIndex];

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % imageData.length);
  };

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + imageData.length) % imageData.length);
  };

  const handleDownload = () => {
    if (!currentImage) return;

    // For real images with File objects, we can trigger download
    if (currentImage.originalFile) {
      const url = URL.createObjectURL(currentImage.originalFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = currentImage.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // For sample images, just show an alert
      alert("Download not available for sample images");
    }
  };

  if (imageData.length === 0) {
    return (
      <Box
        sx={{
          width: "100vw",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(-45deg, #0f2027, #203a43, #2c5364, #184e68)",
          color: "#fff",
        }}
      >
        <Typography variant="h5">No images to display</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: "100vw",
        minHeight: "100vh",
        p: 4,
        background: "linear-gradient(-45deg, #0f2027, #203a43, #2c5364, #184e68)",
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
        Review & Edit Metadata
      </Typography>

      <Box
        sx={{
          width: { xs: "95%", sm: "85%", md: "70%" },
          maxWidth: "900px",
          backdropFilter: "blur(15px)",
          backgroundColor: "rgba(20,20,20,0.8)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: "16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
          p: 4,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* Image Display */}
        <Box
          sx={{
            width: "100%",
            height: "400px",
            borderRadius: "12px",
            overflow: "hidden",
            backgroundColor: "rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={currentImage.src}
            alt={currentImage.name}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </Box>

        {/* Navigation Controls */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <IconButton
            onClick={handlePrevious}
            disabled={imageData.length <= 1}
            sx={{
              color: "#8edeab",
              "&:hover": { backgroundColor: "rgba(142,222,171,0.2)" },
              "&:disabled": { color: "rgba(255,255,255,0.3)" },
            }}
          >
            <ArrowBackIcon fontSize="large" />
          </IconButton>

          <Typography variant="h6" sx={{ color: "#b2ffb2" }}>
            {currentIndex + 1} / {imageData.length}
          </Typography>

          <IconButton
            onClick={handleNext}
            disabled={imageData.length <= 1}
            sx={{
              color: "#8edeab",
              "&:hover": { backgroundColor: "rgba(142,222,171,0.2)" },
              "&:disabled": { color: "rgba(255,255,255,0.3)" },
            }}
          >
            <ArrowForwardIcon fontSize="large" />
          </IconButton>
        </Box>

        {/* Metadata Section */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {/* Filename */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ color: "#8edeab", fontWeight: "bold", mb: 1 }}
            >
              Filename
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#fff",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              {currentImage.name}
            </Typography>
          </Box>

          {/* Tags */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ color: "#8edeab", fontWeight: "bold", mb: 1 }}
            >
              Tags
            </Typography>
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
              {currentImage.tags.map((tag, idx) => (
                <Chip
                  key={idx}
                  label={tag}
                  sx={{
                    backgroundColor: "rgba(142,222,171,0.2)",
                    color: "#b2ffb2",
                    border: "1px solid rgba(142,222,171,0.4)",
                    fontWeight: "bold",
                  }}
                />
              ))}
            </Box>
          </Box>

          {/* Description */}
          <Box>
            <Typography
              variant="subtitle2"
              sx={{ color: "#8edeab", fontWeight: "bold", mb: 1 }}
            >
              Description
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: "#fff",
                backgroundColor: "rgba(255,255,255,0.05)",
                padding: "12px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.1)",
                lineHeight: 1.6,
              }}
            >
              {currentImage.description}
            </Typography>
          </Box>
        </Box>

        {/* Action Buttons */}
        <Box
          sx={{
            display: "flex",
            gap: 2,
            justifyContent: "center",
            mt: 2,
          }}
        >
          <Button
            variant="outlined"
            onClick={handleDownload}
            sx={{
              borderColor: "#8edeab",
              color: "#8edeab",
              "&:hover": {
                borderColor: "#b2ffb2",
                backgroundColor: "rgba(142,222,171,0.1)",
              },
            }}
          >
            Download Image
          </Button>
          <Button
            variant="contained"
            sx={{
              background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
              color: "#fff",
              fontWeight: "bold",
              "&:hover": {
                background: "linear-gradient(45deg, #57cc99, #2fa88a)",
              },
            }}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
    </Box>
  );
}