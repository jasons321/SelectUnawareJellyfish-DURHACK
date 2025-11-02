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

const initiateLogin = async (): Promise<void> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      credentials: 'include',
    });
    const data = await response.json();
    
    if (data.authorization_url) {
      sessionStorage.setItem('google_picker_pending', 'true');
      window.location.href = data.authorization_url;
    }
  } catch (error) {
    throw new Error(`Failed to initiate login: ${error}`);
  }
};

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

  const pickerCallback = useCallback(
    async (data: google.picker.ResponseObject) => {
      if (data.action === google.picker.Action.PICKED) {
        setIsLoading(true);
        
        try {
          let allFiles: PickedFile[] = [];

          for (const doc of data.docs) {
            if (doc.mimeType === 'application/vnd.google-apps.folder') {
              const folderImages = await getImagesFromFolder(doc.id);
              allFiles = allFiles.concat(folderImages);
            } else if (doc.mimeType.startsWith('image/')) {
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

          if (allFiles.length > maxFiles) {
            allFiles = allFiles.slice(0, maxFiles);
            console.warn(`Limited selection to ${maxFiles} files`);
          }

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

  useEffect(() => {
    loadGooglePickerAPI()
      .then(() => setIsApiLoaded(true))
      .catch((error) => {
        console.error('Failed to load Google Picker API:', error);
        onError?.(new Error('Failed to load Google Picker API'));
      });
  }, [onError]);

  // Clean up URL params after OAuth redirect
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authenticated = urlParams.get('authenticated');
    
    if (authenticated === 'true') {
      // Just clean up the URL, don't try to auto-open
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const showPicker = useCallback(
    async (accessToken: string) => {
      if (!window.google?.picker) {
        throw new Error('Google Picker API not loaded');
      }

      const apiKey = await getApiKey();

      const imageMimeTypes = [
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif',
        'image/bmp', 'image/webp', 'image/svg+xml', 'image/tiff',
        'image/heic', 'image/heif',
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
        .setDeveloperKey(apiKey)
        .setCallback(pickerCallback)
        .setMaxItems(maxFiles)
        .enableFeature(google.picker.Feature.MULTISELECT_ENABLED)
        .setTitle('Select Images or Folders')
        .build();

      picker.setVisible(true);
    },
    [pickerCallback, maxFiles]
  );

  const openPicker = async () => {
    if (isLoading || !isApiLoaded) return;

    setIsLoading(true);

    try {
      // Check if we're returning from OAuth and should open picker immediately
      const pickerPending = sessionStorage.getItem('google_picker_pending');
      const isAuthenticated = await checkAuthStatus();

      if (!isAuthenticated) {
        // Start OAuth flow
        await initiateLogin();
        return;
      }

      // Clear the pending flag since we're authenticated
      if (pickerPending) {
        sessionStorage.removeItem('google_picker_pending');
      }

      // Open the picker
      const accessToken = await getPickerToken();
      await showPicker(accessToken);
    } catch (error) {
      console.error('Error in image picker flow:', error);
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
          {isLoading ? 'Loading...' : 'Select Images from Google Drive'}
        </button>
      )}
    </div>
  );
};

export {
  checkAuthStatus,
  initiateLogin,
  getPickerToken,
  downloadFile,
  loadGooglePickerAPI,
};