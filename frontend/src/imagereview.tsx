import React from "react";
import {
  Box,
  Typography,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  IconButton,
} from "@mui/material";
import { ArrowBackIos, ArrowForwardIos, Delete, Add } from "@mui/icons-material";

interface ImageData {
  name: string;
  src: string;
  description: string;
  tags: string[];
}

interface ImageReviewPageProps {
  images: ImageData[];
}

export default function ImageReviewPage({ images }: ImageReviewPageProps) {
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [editableImages, setEditableImages] = React.useState<ImageData[]>(images);
  const [openSaveDialog, setOpenSaveDialog] = React.useState(false);
  const [newTag, setNewTag] = React.useState("");
  const [editingTagIndex, setEditingTagIndex] = React.useState<number | null>(null);
  const [editingTagValue, setEditingTagValue] = React.useState("");

  const currentImage = editableImages[currentIndex];

  const handleNext = () => {
    if (currentIndex < editableImages.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setOpenSaveDialog(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((prev) => prev - 1);
  };

  const handleConfirmSave = () => {
    setOpenSaveDialog(false);
    console.log("✅ User finished reviewing all images. Final state:", editableImages);
    // TODO: Add save logic (e.g. API or navigate)
  };

  const handleFieldChange = (field: keyof ImageData, value: string) => {
    setEditableImages((prev) => {
      const updated = [...prev];
      updated[currentIndex] = { ...updated[currentIndex], [field]: value };
      return updated;
    });
  };

  const handleAddTag = () => {
    if (newTag.trim()) {
      setEditableImages((prev) => {
        const updated = [...prev];
        updated[currentIndex].tags.push(newTag.trim());
        return updated;
      });
      setNewTag("");
    }
  };

  const handleRemoveTag = (index: number) => {
    setEditableImages((prev) => {
      const updated = [...prev];
      updated[currentIndex].tags.splice(index, 1);
      return updated;
    });
  };

  const handleStartEditTag = (index: number, value: string) => {
    setEditingTagIndex(index);
    setEditingTagValue(value);
  };

  const handleEditTagSave = () => {
    if (editingTagIndex !== null) {
      setEditableImages((prev) => {
        const updated = [...prev];
        updated[currentIndex].tags[editingTagIndex] = editingTagValue;
        return updated;
      });
      setEditingTagIndex(null);
      setEditingTagValue("");
    }
  };

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
      {/* Editable Title */}
      <TextField
        value={currentImage.name}
        onChange={(e) => handleFieldChange("name", e.target.value)}
        variant="outlined"
        InputProps={{
          style: {
            color: "#b2ffb2",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "1.5rem",
          },
        }}
        sx={{
          background: "rgba(255,255,255,0.05)",
          borderRadius: "12px",
          mb: 3,
          input: { textAlign: "center" },
          "& fieldset": { border: "1px solid rgba(142,222,171,0.4)" },
          width: { xs: "90%", sm: "70%", md: "50%" },
        }}
      />

      {/* Main Image */}
      <Box
        sx={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          maxWidth: "800px",
          height: { xs: "60vh", sm: "70vh" },
        }}
      >
        <ArrowBackIos
          onClick={handlePrev}
          sx={{
            position: "absolute",
            left: 0,
            color: currentIndex === 0 ? "rgba(255,255,255,0.3)" : "#b2ffb2",
            fontSize: 40,
            cursor: currentIndex === 0 ? "default" : "pointer",
            transition: "transform 0.3s ease",
            "&:hover": { transform: currentIndex === 0 ? "none" : "scale(1.2)" },
          }}
        />

        <Box
          sx={{
            borderRadius: "16px",
            overflow: "hidden",
            border: "3px solid rgba(142,222,171,0.6)",
            boxShadow: "0 0 20px rgba(178,255,178,0.3)",
            width: "100%",
            height: "100%",
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
              width: "100%",
              height: "100%",
              objectFit: "contain",
              borderRadius: "12px",
            }}
          />
        </Box>

        <ArrowForwardIos
          onClick={handleNext}
          sx={{
            position: "absolute",
            right: 0,
            color: "#b2ffb2",
            fontSize: 40,
            cursor: "pointer",
            transition: "transform 0.3s ease",
            "&:hover": { transform: "scale(1.2)" },
          }}
        />
      </Box>

      {/* Editable Description */}
      <TextField
        multiline
        minRows={2}
        value={currentImage.description}
        onChange={(e) => handleFieldChange("description", e.target.value)}
        variant="outlined"
        placeholder="Enter image description..."
        sx={{
          mt: 3,
          mb: 2,
          width: { xs: "90%", sm: "70%", md: "50%" },
          background: "rgba(255,255,255,0.05)",
          borderRadius: "12px",
          "& fieldset": { border: "1px solid rgba(142,222,171,0.4)" },
          textarea: { color: "#ddd", fontSize: "1rem" },
        }}
      />

      {/* Tags Section */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 1.5,
          justifyContent: "center",
          mb: 3,
        }}
      >
        {currentImage.tags.map((tag, i) =>
          editingTagIndex === i ? (
            <TextField
              key={i}
              value={editingTagValue}
              onChange={(e) => setEditingTagValue(e.target.value)}
              onBlur={handleEditTagSave}
              autoFocus
              size="small"
              sx={{
                background: "rgba(255,255,255,0.08)",
                "& fieldset": { border: "1px solid rgba(142,222,171,0.5)" },
                input: { color: "#8edeab", fontWeight: "bold" },
              }}
            />
          ) : (
            <Chip
              key={i}
              label={tag}
              onDelete={() => handleRemoveTag(i)}
              deleteIcon={<Delete sx={{ color: "#ff5555" }} />}
              onClick={() => handleStartEditTag(i, tag)}
              sx={{
                background: "rgba(142,222,171,0.15)",
                color: "#8edeab",
                border: "1px solid rgba(142,222,171,0.4)",
                fontWeight: "bold",
                "&:hover": {
                  background: "rgba(142,222,171,0.25)",
                  cursor: "pointer",
                },
              }}
            />
          )
        )}
      </Box>

      {/* Add new tag */}
      <Box sx={{ display: "flex", gap: 1, justifyContent: "center", mb: 3 }}>
        <TextField
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          placeholder="Add new tag..."
          size="small"
          sx={{
            background: "rgba(255,255,255,0.05)",
            borderRadius: "12px",
            "& fieldset": { border: "1px solid rgba(142,222,171,0.4)" },
            input: { color: "#ccc" },
          }}
        />
        <IconButton
          onClick={handleAddTag}
          sx={{
            color: "#8edeab",
            background: "rgba(142,222,171,0.15)",
            "&:hover": { background: "rgba(142,222,171,0.3)" },
          }}
        >
          <Add />
        </IconButton>
      </Box>

      {/* Save Confirmation Popup */}
      <Dialog
        open={openSaveDialog}
        onClose={() => setOpenSaveDialog(false)}
        PaperProps={{
          sx: {
            background: "rgba(20,20,20,0.9)",
            border: "1px solid rgba(255,255,255,0.2)",
            color: "#fff",
            borderRadius: "16px",
            p: 2,
            backdropFilter: "blur(15px)",
          },
        }}
      >
        <DialogTitle sx={{ color: "#8edeab", fontWeight: "bold" }}>
          Review Complete
        </DialogTitle>
        <DialogContent>
          <Typography>
            You've finished reviewing all images. Would you like to save your changes?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenSaveDialog(false)}
            sx={{ color: "#ccc", "&:hover": { color: "#fff" } }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmSave}
            variant="contained"
            sx={{
              background: "linear-gradient(45deg, #6ee7b7, #3caea3)",
              color: "#fff",
              fontWeight: "bold",
              borderRadius: "30px",
              px: 3,
              "&:hover": {
                background: "linear-gradient(45deg, #57cc99, #2fa88a)",
              },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
