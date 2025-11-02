import { useLocation } from "react-router-dom";
import { Box, Typography, Button } from "@mui/material";
import React from "react";

export default function ResultsPage() {
  const location = useLocation();

  const { groups, filesMap } = location.state as {
    groups: string[][];
    filesMap: Record<string, string>;
  };

  const [selectedGroups, setSelectedGroups] = React.useState<boolean[]>(
    () => groups.map(() => true)
  );

  const toggleGroupSelection = (groupIndex: number) => {
    setSelectedGroups((prev) =>
      prev.map((val, idx) => (idx === groupIndex ? !val : val))
    );
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
            onClick={() => toggleGroupSelection(groupIndex)}
            sx={{
              border: selectedGroups[groupIndex]
                ? "2px solid #8edeab"
                : "1px solid rgba(255,255,255,0.2)",
              borderRadius: 2,
              p: 2,
              background: selectedGroups[groupIndex]
                ? "rgba(142,222,171,0.1)"
                : "rgba(255,255,255,0.05)",
              display: "flex",
              flexWrap: "wrap",
              gap: 2,
              cursor: "pointer",
              transition: "all 0.3s ease",
              "&:hover": {
                background: selectedGroups[groupIndex]
                  ? "rgba(142,222,171,0.15)"
                  : "rgba(255,255,255,0.08)",
              },
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

            {group.map((filename: string) => (
              <Box
                key={filename}
                sx={{
                  width: 120,
                  height: 120,
                  borderRadius: 2,
                  overflow: "hidden",
                  border: "1px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0,0,0,0.3)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
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
            onClick={() => {
              const selected = groups.filter((_, idx) => selectedGroups[idx]);
              console.log("Selected groups:", selected);
              // navigate("/next-step", { state: { selected } });
            }}
          >
            Confirm Selection
          </Button>
        </Box>
      </Box>
    </Box>
  );
}
