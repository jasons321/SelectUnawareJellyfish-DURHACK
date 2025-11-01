// Select.tsx
import React from 'react';
import SelectActionCard from './card.tsx';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';

export default function SelectPage() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [apiMessage, setApiMessage] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const handleContinue = async () => {
    console.log('Continue clicked with selection:', selectedCard);
    
    setLoading(true);
    try {
      // Call the FastAPI endpoint
      const response = await fetch('/api');
      const data = await response.json();
      
      // Set the message from the API response
      setApiMessage(data.message || 'No message received');
      setOpenDialog(true);
    } catch (error) {
      console.error('Error calling API:', error);
      setApiMessage('Error: Failed to connect to the API');
      setOpenDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column', // stack vertically
        justifyContent: 'center',
        alignItems: 'center',
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
        disabled={selectedCard === null || loading} // disable until selection is made or while loading
      >
        {loading ? 'Loading...' : 'Continue'}
      </Button>

      {/* Dialog to display API message */}
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>API Response</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {apiMessage}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}