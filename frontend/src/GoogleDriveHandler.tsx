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

export interface GoogleImagePickerResult {
  files: PickedFile[];
  blobs: Map<string, Blob>;
}

interface GoogleImagePickerProps {
  onFilesSelected?: (result: GoogleImagePickerResult) => void;
  onError?: (error: Error) => void;
  maxFiles?: number;
  children?: React.ReactNode;
  className?: string;
}

// API configuration
const API_BASE_URL = 'http://localhost:8001';

// Utility function to check authentication status
const checkAuthStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/status`, {
      credentials: 'include',
    });
    const data = await response.json();
    return data.authenticated;
  } catch (error) {
    console.error('Error checking auth status:', error);
    return false;
  }
};

// Utility function to initiate login
const initiateLogin = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      credentials: 'include',
    });
    const data = await response.json();
    
    if (data.authorization_url) {
      // Open OAuth flow in same window
      window.location.href = data.authorization_url;
    }
  } catch (error) {
    throw new Error(`Failed to initiate login: ${error}`);
  }
};

// Utility function to get OAuth token for Picker API
const getPickerToken = async (): Promise<string> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/picker-token`, {
      credentials: 'include',
    });
    
    if (!response.ok) {
      throw new Error('Failed to get picker token');
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    throw new Error(`Failed to get picker token: ${error}`);
  }
};

// Utility function to download file from Google Drive
const downloadFile = async (fileId: string): Promise<Blob> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/drive/download/${fileId}`,
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

// Load Google Picker API script
const loadGooglePickerAPI = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.picker) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      window.gapi.load('picker', {
        callback: resolve,
        onerror: reject,
      });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
};

export const GoogleImagePicker: React.FC<GoogleImagePickerProps> = ({
  onFilesSelected,
  onError,
  maxFiles = 50,
  children,
  className,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isApiLoaded, setIsApiLoaded] = useState(false);

  // Load Google Picker API on mount
  useEffect(() => {
    loadGooglePickerAPI()
      .then(() => setIsApiLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Picker API:', error);
        onError?.(new Error('Failed to load Google Picker API'));
      });
  }, [onError]);

  // Get all image files from a folder recursively
  const getImagesFromFolder = async (folderId: string): Promise<PickedFile[]> => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drive/folder-images/${folderId}`,
        {
          credentials: 'include',
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch folder images');
      }
      
      const data = await response.json();
      return data.files || [];
    } catch (error) {
      throw new Error(`Failed to get images from folder: ${error}`);
    }
  };

  // Process picked files (download them)
  const processPickedFiles = async (files: PickedFile[]): Promise<GoogleImagePickerResult> => {
    const blobs = new Map<string, Blob>();
    const downloadPromises = files.map(async (file) => {
      try {
        const blob = await downloadFile(file.id);
        blobs.set(file.id, blob);
      } catch (error) {
        console.error(`Failed to download file ${file.name}:`, error);
        throw error;
      }
    });

    await Promise.all(downloadPromises);

    return {
      files,
      blobs,
    };
  };

  // Handle picker callback
  const pickerCallback = useCallback(
    async (data: google.picker.ResponseObject) => {
      if (data.action === google.picker.Action.PICKED) {
        setIsLoading(true);
        
        try {
          let allFiles: PickedFile[] = [];

          // Process each picked item
          for (const doc of data.docs) {
            if (doc.mimeType === 'application/vnd.google-apps.folder') {
              // If it's a folder, get all images from it
              const folderImages = await getImagesFromFolder(doc.id);
              allFiles = allFiles.concat(folderImages);
            } else if (doc.mimeType.startsWith('image/')) {
              // If it's an image, add it directly
              allFiles.push({
                id: doc.id,
                name: doc.name,
                mimeType: doc.mimeType,
                url: doc.url,
                thumbnailUrl: doc.thumbnails?.[0]?.url,
                sizeBytes: doc.sizeBytes,
              });
            }
          }

          // Limit to maxFiles
          if (allFiles.length > maxFiles) {
            allFiles = allFiles.slice(0, maxFiles);
            console.warn(`Limited selection to ${maxFiles} files`);
          }

          // Download all files
          const result = await processPickedFiles(allFiles);
          onFilesSelected?.(result);
        } catch (error) {
          console.error('Error processing picked files:', error);
          onError?.(error as Error);
        } finally {
          setIsLoading(false);
        }
      } else if (data.action === google.picker.Action.CANCEL) {
        setIsLoading(false);
      }
    },
    [maxFiles, onFilesSelected, onError]
  );

  // Create and show picker
  const showPicker = useCallback(
    async (accessToken: string) => {
      if (!window.google?.picker) {
        throw new Error('Google Picker API not loaded');
      }

      // Image MIME types to filter
      const imageMimeTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/bmp',
        'image/webp',
        'image/svg+xml',
        'image/tiff',
        'image/heic',
        'image/heif',
      ];

      const picker = new google.picker.PickerBuilder()
        .addView(
          new google.picker.DocsView(google.picker.ViewId.DOCS_IMAGES)
            .setMimeTypes(imageMimeTypes.join(','))
            .setIncludeFolders(true)
        )
        .addView(
          new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
        )
        .setOAuthToken(accessToken)
        .setDeveloperKey(await getApiKey())
        .setCallback(pickerCallback)
        .setMaxItems(maxFiles)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle('Select Images or Folders')
        .build();

      picker.setVisible(true);
    },
    [pickerCallback, maxFiles]
  );

  // Get API key from backend
  const getApiKey = async (): Promise<string> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/api-key`, {
        credentials: 'include',
      });
      const data = await response.json();
      return data.api_key;
    } catch (error) {
      throw new Error('Failed to get API key');
    }
  };

  // Main click handler
  const handleClick = async () => {
    if (isLoading || !isApiLoaded) return;

    setIsLoading(true);

    try {
      // Step 1: Check if authenticated
      const isAuthenticated = await checkAuthStatus();

      if (!isAuthenticated) {
        // Step 2: If not authenticated, initiate OAuth flow
        await initiateLogin();
        return; // Function will be called again after redirect
      }

      // Step 3: Get access token for Picker API
      const accessToken = await getPickerToken();

      // Step 4: Show picker
      await showPicker(accessToken);
    } catch (error) {
      console.error('Error in image picker flow:', error);
      onError?.(error as Error);
      setIsLoading(false);
    }
  };

  // Render children with click handler
  return (
    <div onClick={handleClick} className={className}>
      {children || (
        <button disabled={isLoading || !isApiLoaded}>
          {isLoading ? 'Loading...' : 'Select Images from Google Drive'}
        </button>
      )}
    </div>
  );
};

// Export utility functions for advanced use cases
export {
  checkAuthStatus,
  initiateLogin,
  getPickerToken,
  downloadFile,
  loadGooglePickerAPI,
};