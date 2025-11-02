declare namespace google {
  namespace picker {
    class PickerBuilder {
      addView(view: DocsView): PickerBuilder;
      setOAuthToken(token: string): PickerBuilder;
      setDeveloperKey(key: string): PickerBuilder;
      setCallback(callback: (data: ResponseObject) => void): PickerBuilder;
      setMaxItems(max: number): PickerBuilder;
      enableFeature(feature: Feature): PickerBuilder;
      setTitle(title: string): PickerBuilder;
      build(): Picker;
    }

    class DocsView {
      constructor(viewId?: ViewId | string);
      setMimeTypes(mimeTypes: string): DocsView;
      setIncludeFolders(include: boolean): DocsView;
      setSelectFolderEnabled(enabled: boolean): DocsView;
    }

    interface Picker {
      setVisible(visible: boolean): void;
    }

    enum ViewId {
      DOCS = 'all',
      DOCS_IMAGES = 'docs-images',
      FOLDERS = 'folders',
    }

    enum Feature {
      MULTISELECT_ENABLED = 'multiselect',
    }

    enum Action {
      PICKED = 'picked',
      CANCEL = 'cancel',
    }

    interface ResponseObject {
      action: Action | string;
      docs: DocumentObject[];
    }

    interface DocumentObject {
      id: string;
      name: string;
      mimeType: string;
      url?: string;
      sizeBytes?: number;
      thumbnails?: Array<{
        url: string;
        width: number;
        height: number;
      }>;
    }
  }
}

interface Window {
  google: typeof google;
  gapi: {
    load: (
      api: string,
      options: { callback: () => void; onerror: () => void }
    ) => void;
  };
}