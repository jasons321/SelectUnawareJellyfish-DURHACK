// card.tsx
import * as React from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import GoogleIcon from '@mui/icons-material/Google';
import CloudIcon from '@mui/icons-material/Cloud';

interface CardItem {
  id: number;
  title: string;
  icon: React.ReactNode;
}

interface SelectActionCardProps {
  selectedCard: number | null;
  onSelectCard: (id: number) => void;
}

const cards: CardItem[] = [
  { id: 1, title: 'Local Upload', icon: <CloudUploadIcon sx={{ fontSize: 50, color: '#fff' }} /> },
  { id: 2, title: 'Google Drive', icon: <GoogleIcon sx={{ fontSize: 50, color: '#fff' }} /> },
  { id: 3, title: 'OneDrive', icon: <CloudIcon sx={{ fontSize: 50, color: '#fff' }} /> },
];

const SelectActionCard: React.FC<SelectActionCardProps> = ({ selectedCard, onSelectCard }) => {
  return (
    <Box
      sx={{
        display: 'flex',
        gap: 3,
        paddingBottom: 2,
      }}
    >
      {cards.map((card) => (
        <Card
          key={card.id}
          sx={{
            minWidth: 220,
            minHeight: 240,
            flexShrink: 0,
            textAlign: 'center',
            backgroundColor: selectedCard === card.id ? '#8edeab' : '#283b4a',
            transition: 'background-color 0.3s, transform 0.2s',
            '&:hover': {
              transform: 'scale(1.05)',
            },
          }}
        >
          <CardActionArea onClick={() => onSelectCard(card.id)} sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>{card.icon}</Box>
              <Typography variant="h6" component="div" sx={{ color: '#fff' }}>
                {card.title}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
    </Box>
  );
};

export default SelectActionCard;
