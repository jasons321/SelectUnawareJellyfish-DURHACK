import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardMedia,
  CardContent,
  Button,
  Divider,
} from '@mui/material';

interface UploadedFile {
  name: string;
  url: string;
}

export default function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // ✅ Properly type the expected route state
  const { groups, files } = (location.state || {}) as {
    groups: string[][];
    files: UploadedFile[];
  };

  if (!groups || !files) {
    return (
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography variant="h5" color="text.secondary">
          No data available. Please upload images first.
        </Typography>
        <Button
          variant="contained"
          sx={{
            mt: 3,
            backgroundColor: '#8edeab',
            '&:hover': { backgroundColor: '#76c89b' },
          }}
          onClick={() => navigate('/')}
        >
          Go Back
        </Button>
      </Box>
    );
  }

  // ✅ Strongly typed mapping from filenames to URLs
  const fileMap: Record<string, string> = Object.fromEntries(
    files.map((f: UploadedFile) => [f.name, f.url])
  );

  return (
    <Box
      sx={{
        width: '100vw',
        minHeight: '100vh',
        backgroundColor: '#f5f5f5',
        padding: '2rem',
      }}
    >
      {/* Title */}
      <Typography
        variant="h4"
        sx={{
          mb: 3,
          fontWeight: 'bold',
          textAlign: 'center',
          color: '#283b4a',
        }}
      >
        Grouped Similar Images
      </Typography>

      {/* Render Each Group */}
      {groups.map((groupData: string[], groupIdx: number) => {
        const groupKey = groupData.join('-');

        return (
          <Card
            key={groupKey}
            sx={{
              mb: 4,
              border: '2px solid #8edeab',
              borderRadius: '12px',
              backgroundColor: '#ffffff',
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
              p: 2,
            }}
          >
            <Typography
              variant="h6"
              sx={{
                color: '#283b4a',
                fontWeight: 'bold',
                mb: 2,
              }}
            >
              Group {groupIdx + 1}
            </Typography>

            <Divider sx={{ mb: 2 }} />

            {/* ✅ Flexbox layout instead of Grid */}
            <Box
              sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 2,
                justifyContent: 'flex-start',
              }}
            >
              {groupData.map((filename: string) => {
                const fileInfo = fileMap[filename];
                if (!fileInfo) return null;

                return (
                  <Card
                    key={`${groupKey}-${filename}`}
                    sx={{
                      width: { xs: '100%', sm: 160, md: 180 },
                      border: '1px solid #e0e0e0',
                      borderRadius: '10px',
                      transition: '0.2s',
                      '&:hover': { transform: 'scale(1.02)' },
                    }}
                  >
                    <CardMedia
                      component="img"
                      image={fileInfo}
                      alt={filename}
                      sx={{
                        height: 140,
                        objectFit: 'cover',
                        borderTopLeftRadius: '10px',
                        borderTopRightRadius: '10px',
                      }}
                    />
                    <CardContent
                      sx={{
                        textAlign: 'center',
                        padding: '0.5rem',
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: '#607d8b',
                          wordBreak: 'break-all',
                        }}
                      >
                        {filename}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}
            </Box>
          </Card>
        );
      })}

      {/* Confirm Button */}
      <Box sx={{ textAlign: 'center', mt: 5 }}>
        <Button
          variant="contained"
          sx={{
            backgroundColor: '#8edeab',
            color: '#fff',
            minWidth: 200,
            '&:hover': { backgroundColor: '#76c89b' },
          }}
          onClick={() => alert('Grouping confirmed!')}
        >
          Confirm Grouping
        </Button>
      </Box>
    </Box>
  );
}
