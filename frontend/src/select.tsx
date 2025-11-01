import React from 'react';
import SelectActionCard from './card.tsx';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { Box } from '@mui/material';

export default function SelectPage() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);

  const handleContinue = () => {
    console.log('Continue clicked with selection:', selectedCard);
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
        gap: 4,
        p: 2,
        boxSizing: 'border-box',
        backgroundColor: '#f5f5f5', // optional
        mx: 'auto',
      }}
    >
      {/* Big Top Title */}
      <Typography
        variant="h3"
        component="h1"
        sx={{ fontWeight: 'bold', color: '#283b4a', textAlign: 'center' }}
      >
        Upload Your Files
      </Typography>

      {/* Centered Card Selection */}
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
    </Box>
  );
}
