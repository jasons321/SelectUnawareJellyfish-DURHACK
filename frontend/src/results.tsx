import { useLocation } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import React from "react";

export default function ResultsPage() {
  const location = useLocation();

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

  const toggleImageSelection = (groupIndex: number, imageIndex: number) => {
    setSelectedImages((prev) => {
      const updatedSelection = [...prev];
      updatedSelection[groupIndex] = [...updatedSelection[groupIndex]];
      updatedSelection[groupIndex][imageIndex] = !updatedSelection[groupIndex][imageIndex];
      return updatedSelection;
    });
  };

  const handleConfirmSelection = () => {
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
    
    // TODO: Navigate to next step or update state with filteredFiles
    // Example: navigate('/next-step', { state: { files: filteredFiles } });
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
                    ? "3px solid #ff4444" // Thicker, brighter red border for selected (to be deleted)
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
            }}
            onClick={handleConfirmSelection}
          >
            Confirm Selection
          </Button>
        </Box>
      </Box>
    </Box>
  );
}