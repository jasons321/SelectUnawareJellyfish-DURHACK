import { useState, useEffect, useCallback } from 'react';

// Types
export interface PickedFile {
  id: string;
  name: string;
  mimeType: string;
  url?: string;
  thumbnailUrl?: string;
  sizeBytes?: number;
}

export interface OneDrivePickerResult {
  files: PickedFile[];
  blobs: Map<string, Blob>;
}

interface OneDriveImagePickerProps {
  onFilesSelected?: (result: OneDrivePickerResult) => void;
  onError?: (error: Error) => void;
  maxFiles?: number;
  children?: React.ReactNode;
  className?: string;
}

// API configuration
const API_BASE_URL = 'http://localhost:8001';

const checkAuthStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/onedrive/status`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data.authenticated;
  } catch (error) {
    console.error('Error checking OneDrive auth status:', error);
    return false;
  }
};

const getClientId = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/onedrive/client-id`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data.client_id;
  } catch (error) {
    throw new Error('Failed to get client ID');
  }
};

const initiateLogin = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/onedrive/login`, {
      credentials: 'include',
    });
    const data = await response.json();
    
    if (data.authorization_url) {
      sessionStorage.setItem('onedrive_picker_pending', 'true');
      window.location.href = data.authorization_url;
    }
  } catch (error) {
    throw new Error(`Failed to initiate OneDrive login: ${error}`);
  }
};

const getPickerToken = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/onedrive/picker-token`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get OneDrive picker token');
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    throw new Error(`Failed to get OneDrive picker token: ${error}`);
  }
};

const downloadFile = async (fileId: string): Promise<Blob> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/onedrive/download/${fileId}`,
      {
        credentials: 'include',
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    throw new Error(`Failed to download file ${fileId}: ${error}`);
  }
};

const loadOneDrivePickerAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if OneDrive Picker is already loaded
    if (window.OneDrive) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://js.live.net/v7.2/OneDrive.js';
    script.onload = () => {
      // Wait a brief moment for OneDrive object to be available
      setTimeout(() => {
        if (window.OneDrive) {
          resolve();
        } else {
          reject(new Error('OneDrive API failed to load'));
        }
      }, 100);
    };
    script.onerror = () => reject(new Error('Failed to load OneDrive Picker script'));
    document.head.appendChild(script);
  });
};

const processPickedFilesWithDirectUrls = async (files: PickedFile[]): Promise<OneDrivePickerResult> => {
  const blobs = new Map<string, Blob>();
  
  for (const file of files) {
    try {
      if (file.url) {
        // Download directly from Microsoft's download URL
        const response = await fetch(file.url);
        const blob = await response.blob();
        blobs.set(file.id, blob);
      }
    } catch (error) {
      console.error(`Failed to download file ${file.name}:`, error);
      throw error;
    }
  }

  return { files, blobs };
};

export const OneDriveImagePicker: React.FC<OneDriveImagePickerProps> = ({
  onFilesSelected,
  onError,
  maxFiles = 50,
  children,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  useEffect(() => {
    loadOneDrivePickerAPI()
      .then(() => setIsApiLoaded(true))
      .catch((error) => {
        console.error('Failed to load OneDrive Picker API:', error);
        onError?.(new Error('Failed to load OneDrive Picker API'));
      });
  }, [onError]);

  // Clean up URL params after OAuth redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authenticated = urlParams.get('authenticated');
    
    if (authenticated === 'true') {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const showPicker = useCallback(
    async (clientId: string) => {
        if (!window.OneDrive) {
        throw new Error('OneDrive Picker API not loaded');
        }

        const pickerOptions: OneDrive.PickerOptions = {
        clientId: clientId,
        action: 'download',  // Use download to get direct URLs
        multiSelect: true,
        advanced: {
            filter: 'folder,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg,.tiff,.heic,.heif',
        },
        success: async (response) => {
            console.log('Picker success! Full response:', response);
            console.log('Files value:', response.value);
            setIsLoading(true);
            
            try {
            if (!response.value || response.value.length === 0) {
                throw new Error('No files were selected');
            }

            let allFiles: PickedFile[] = [];

            for (const item of response.value) {
                // Check if it's a folder first
                if (item.folder) {
                    console.warn('Folder selected - folder support not yet implemented');
                    continue;
                }
                
                // If not a folder and has a name, check if it's an image
                if (item.name && isImageFile(item.name)) {
                    allFiles.push({
                    id: item.id,
                    name: item.name,
                    mimeType: getMimeTypeFromExtension(item.name),
                    url: item['@microsoft.graph.downloadUrl'],
                    thumbnailUrl: item.thumbnails?.[0]?.large?.url,
                    sizeBytes: item.size,
                    });
                }
                }

            if (allFiles.length === 0) {
                throw new Error('No image files found in selection');
            }

            // Download files using the direct download URLs
            const result = await processPickedFilesWithDirectUrls(allFiles);
            onFilesSelected?.(result);
            } catch (error) {
            console.error('Error processing OneDrive files:', error);
            onError?.(error as Error);
            } finally {
            setIsLoading(false);
            }
        },
        cancel: () => {
            setIsLoading(false);
            console.log('Picker cancelled');
        },
        error: (error) => {
            setIsLoading(false);
            console.error('Picker error:', error);
            onError?.(new Error(`OneDrive picker error: ${error.message || 'Unknown error'}`));
        },
        };

        window.OneDrive.open(pickerOptions);
    },
    [maxFiles, onFilesSelected, onError]
    );

  const openPicker = async () => {
    if (isLoading || !isApiLoaded) return;

    setIsLoading(true);

    try {
      const clientId = await getClientId();
      await showPicker(clientId);
    } catch (error) {
      console.error('Error in OneDrive picker flow:', error);
      onError?.(error as Error);
      setIsLoading(false);
    }
  };

  const handleClick = async () => {
    await openPicker();
  };

  return (
    <div onClick={handleClick} className={className}>
      {children || (
        <button disabled={isLoading || !isApiLoaded}>
          {isLoading ? 'Loading...' : 'Select Images from OneDrive'}
        </button>
      )}
    </div>
  );
};

// Helper functions
const isImageFile = (filename: string): boolean => {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg', '.tiff', '.heic', '.heif'];
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  return imageExtensions.includes(ext);
};

const getMimeTypeFromExtension = (filename: string): string => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.tiff': 'image/tiff',
    '.heic': 'image/heic',
    '.heif': 'image/heif',
  };
  return mimeTypes[ext] || 'application/octet-stream';
};

export {
  checkAuthStatus,
  initiateLogin,
  getPickerToken,
  downloadFile,
  loadOneDrivePickerAPI,
};