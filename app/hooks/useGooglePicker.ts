import { useState, useCallback, useEffect } from 'react';

export function useGooglePicker(onFileSelect: (file: File, previewUrl: string) => void) {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    // Load gapi for the Picker
    if (!(window as any).gapi) {
      const gapiScript = document.createElement('script');
      gapiScript.src = 'https://apis.google.com/js/api.js';
      gapiScript.onload = () => {
        (window as any).gapi.load('picker', { callback: () => {} });
      };
      document.body.appendChild(gapiScript);
    }

    // Load gsi for authentication
    if (!(window as any).google?.accounts?.oauth2) {
      const gsiScript = document.createElement('script');
      gsiScript.src = 'https://accounts.google.com/gsi/client';
      gsiScript.onload = () => setIsScriptLoaded(true);
      document.body.appendChild(gsiScript);
    } else {
      setIsScriptLoaded(true);
    }
  }, []);

  const openPicker = useCallback(() => {
    if (!(window as any).google?.accounts?.oauth2 || !(window as any).gapi?.picker) {
      alert('Google APIs are still loading. Please try again in a second.');
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const appId = process.env.NEXT_PUBLIC_GOOGLE_APP_ID;

    if (!clientId || !apiKey || !appId) {
      alert('Google API credentials are missing from .env');
      return;
    }

    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      callback: (response: any) => {
        if (response.error !== undefined) {
          throw response;
        }
        createPicker(response.access_token);
      },
    });

    tokenClient.requestAccessToken({ prompt: 'consent' });

    function createPicker(accessToken: string) {
      // View for Google Drive Images
      const driveView = new (window as any).gapi.picker.DocsView()
        .setIncludeFolders(true)
        .setMimeTypes('image/png,image/jpeg,image/webp,image/jpg');
        
      const picker = new (window as any).gapi.picker.PickerBuilder()
        .addView(driveView)
        .setOAuthToken(accessToken)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setCallback((data: any) => pickerCallback(data, accessToken))
        .build();
        
      picker.setVisible(true);
    }

    async function pickerCallback(data: any, accessToken: string) {
      if (data.action === (window as any).gapi.picker.Action.PICKED) {
        const file = data.docs[0];
        const fileId = file.id;
        const fileName = file.name;
        
        try {
          // Download the file content from Google Drive
          const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          
          if (!response.ok) throw new Error('Failed to fetch file from Google Drive');
          
          const blob = await response.blob();
          const downloadedFile = new File([blob], fileName, { type: blob.type });
          
          // Generate local preview URL
          const reader = new FileReader();
          reader.onloadend = () => {
            onFileSelect(downloadedFile, reader.result as string);
          };
          reader.readAsDataURL(downloadedFile);
          
        } catch (error) {
          console.error('Error fetching file from Google Drive:', error);
          alert('Failed to download the selected image from Google Drive.');
        }
      }
    }
  }, [onFileSelect]);

  return { openPicker, isScriptLoaded };
}
