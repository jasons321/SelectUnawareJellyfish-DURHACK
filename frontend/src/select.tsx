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
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Box from '@mui/material/Box';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
}

export default function SelectPage() {
  const [selectedCard, setSelectedCard] = React.useState<number | null>(null);
  const [openDialog, setOpenDialog] = React.useState(false);
  const [driveFiles, setDriveFiles] = React.useState<DriveFile[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);

  // Check if we just returned from OAuth and should auto-fetch files
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const justAuthenticated = urlParams.get('authenticated');
    
    if (justAuthenticated === 'true') {
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      
      // Auto-fetch files after authentication
      fetchDriveFiles();
    }
  }, []);

  const fetchDriveFiles = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Check authentication status
      const authResponse = await fetch('/api/auth/status');
      const authData = await authResponse.json();
      
      if (!authData.authenticated) {
        setIsAuthenticated(false);
        setError('Not authenticated. Please log in to Google Drive first.');
        setOpenDialog(true);
        setLoading(false);
        return;
      }
      
      setIsAuthenticated(true);
      
      // Fetch Drive files
      const filesResponse = await fetch('/api/drive/files?max_results=20');
      
      if (!filesResponse.ok) {
        throw new Error(`Failed to fetch files: ${filesResponse.statusText}`);
      }
      
      const filesData = await filesResponse.json();
      
      if (filesData.success) {
        setDriveFiles(filesData.files);
        setOpenDialog(true);
      } else {
        throw new Error('Failed to retrieve files');
      }
    } catch (error) {
      console.error('Error calling API:', error);
      setError(error instanceof Error ? error.message : 'Failed to connect to the API');
      setDriveFiles([]);
      setOpenDialog(true);
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    console.log('Continue clicked with selection:', selectedCard);
    await fetchDriveFiles();
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleLogin = async () => {
    try {
      const response = await fetch('/api/auth/login');
      const data = await response.json();
      
      if (data.authorization_url) {
        // Redirect to Google OAuth
        window.location.href = data.authorization_url;
      }
    } catch (error) {
      console.error('Error initiating login:', error);
    }
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return 'N/A';
    const size = parseInt(bytes);
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
        gap: '2rem',
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
        disabled={selectedCard === null || loading}
      >
        {loading ? 'Loading...' : 'Continue'}
      </Button>

      {/* Dialog to display Drive files */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {error ? 'Error' : 'Your Google Drive Files'}
        </DialogTitle>
        <DialogContent>
          {error ? (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <DialogContentText color="error" sx={{ mb: 2 }}>
                {error}
              </DialogContentText>
              {!isAuthenticated && (
                <Button 
                  variant="contained" 
                  color="primary"
                  onClick={handleLogin}
                >
                  Login with Google
                </Button>
              )}
            </Box>
          ) : driveFiles.length === 0 ? (
            <DialogContentText>
              No files found in your Google Drive.
            </DialogContentText>
          ) : (
            <List sx={{ width: '100%', bgcolor: 'background.paper' }}>
              {driveFiles.map((file) => (
                <ListItem 
                  key={file.id}
                  sx={{ 
                    borderBottom: '1px solid #eee',
                    '&:hover': { bgcolor: '#f5f5f5' }
                  }}
                >
                  <ListItemText
                    primary={file.name}
                    secondary={
                      <>
                        <Typography component="span" variant="body2" color="text.secondary">
                          Type: {file.mimeType.split('.').pop()}
                        </Typography>
                        <br />
                        <Typography component="span" variant="body2" color="text.secondary">
                          Size: {formatFileSize(file.size)} | Modified: {formatDate(file.modifiedTime)}
                        </Typography>
                      </>
                    }
                  />
                  {file.webViewLink && (
                    <Button
                      size="small"
                      onClick={() => window.open(file.webViewLink, '_blank')}
                    >
                      View
                    </Button>
                  )}
                </ListItem>
              ))}
            </List>
          )}
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