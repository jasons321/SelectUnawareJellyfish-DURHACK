// Select.tsx
import React from 'react';
import SelectActionCard from './card.tsx';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export default function SelectPage() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);

  const handleContinue = () => {
    console.log('Continue clicked with selection:', selectedCard);
    // You can add navigation or logic here, e.g.:
    // if (selectedCard === 0) navigate('/upload');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column', // stack vertically
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        padding: '1rem',
        gap: '2rem', // space between elements
      }}
    >
      {/* Big Top Title */}
      <Typography variant="h3" component="h1" sx={{ fontWeight: 'bold', color: '#283b4a' }}>
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
        disabled={selectedCard === null} // disable until selection is made
      >
        Continue
      </Button>
    </div>
  );
}
