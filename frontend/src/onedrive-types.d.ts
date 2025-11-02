declare namespace OneDrive {
  interface PickerOptions {

    clientId: string;

    action: 'download' | 'share' | 'query';

    multiSelect?: boolean;

    advanced?: {

      redirectUri?: string;

      filter?: string;

      startLocationId?: string;

      navigation?: {
        entryLocation?: {
          sharePoint?: {
            sitePath: string;
            listPath: string;
            itemPath: string;
          };
        };
      };

      linkType?: 'view' | 'edit' | 'embed';

      query?: string;
    };

    success: (response: PickerResponse) => void;

    cancel?: () => void;

    error?: (error: PickerError) => void;
  }

  interface PickerResponse {

    value: PickerItem[];

    accessToken?: string;

    apiEndpoint?: string;
  }

  interface PickerItem {

    id: string;

    name: string;

    size?: number;

    webUrl?: string;

    '@microsoft.graph.downloadUrl'?: string;

    parentReference?: {
      driveId: string;
      driveType: string;
      id: string;
      path: string;
    };

    file?: {
      mimeType: string;
      hashes?: {
        sha1Hash?: string;
        quickXorHash?: string;
      };
    };

    folder?: {
      childCount: number;
    };

    thumbnails?: Array<{
      id: string;
      large?: ThumbnailInfo;
      medium?: ThumbnailInfo;
      small?: ThumbnailInfo;
    }>;

    shared?: {
      scope: string;
    };

    createdDateTime?: string;

    lastModifiedDateTime?: string;

    createdBy?: UserInfo;

    lastModifiedBy?: UserInfo;
  }

  interface ThumbnailInfo {
    url: string;
    width: number;
    height: number;
  }

  interface UserInfo {
    user?: {
      displayName: string;
      id: string;
    };
  }

  interface PickerError {
    code?: string;
    message?: string;
    innerError?: {
      code: string;
      message: string;
    };
  }

  function open(options: PickerOptions): void;

  function save(options: {
    file: string | Blob | File;
    fileName: string;
    success?: (response: { value: PickerItem[] }) => void;
    error?: (error: PickerError) => void;
  }): void;
}

interface Window {
  OneDrive?: typeof OneDrive;
}