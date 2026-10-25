'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export interface PickedPhoto {
  filename: string;
  mimeType: string;
  base64: string;
}

interface UseGooglePhotosPickerOptions {
  onPhotosSelected: (photos: PickedPhoto[]) => void | Promise<void>;
  onError?: (err: string) => void;
  maxItems?: number;
}

export function useGooglePhotosPicker({
  onPhotosSelected,
  onError,
  maxItems = 2000,
}: UseGooglePhotosPickerOptions) {
  const { data: session } = useSession();
  const [isPicking, setIsPicking] = useState(false);
  const [pickingStatus, setPickingStatus] = useState<string | null>(null);
  const [needsClickToOpen, setNeedsClickToOpen] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const popupRef = useRef<Window | null>(null);
  const tokenClientRef = useRef<any>(null);

  const cleanup = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setIsPicking(false);
    setPickingStatus(null);
    setNeedsClickToOpen(false);
  }, []);

  const cancelPicking = useCallback(() => {
    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch (e) {}
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => {
    // Load Google Identity Services script if not already present
    if (typeof window !== 'undefined' && !(window as any).google?.accounts?.oauth2) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => setIsScriptLoaded(true);
      document.body.appendChild(script);
    } else {
      setIsScriptLoaded(true);
    }

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Helper to retrieve an existing, active token
  const getExistingToken = useCallback((): string | null => {
    // 1. Check if NextAuth session token was granted photospicker scope
    const sessionScope = ((session?.user as any)?.scope as string) || '';
    const sessionToken = (session?.user as any)?.accessToken as string | undefined;
    if (sessionToken && sessionScope.includes('photospicker.mediaitems.readonly')) {
      return sessionToken;
    }

    // 2. Check if a GIS token was cached in sessionStorage
    if (typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem('gphotos_token');
        const exp = sessionStorage.getItem('gphotos_token_exp');
        if (cached && exp && Date.now() < Number(exp)) {
          return cached;
        }
      } catch (e) {}
    }

    return null;
  }, [session]);

  // Launches the Google Photos Picker session and begins polling
  const startPickerWithToken = useCallback(
    async (accessToken: string, targetPopup: Window | null) => {
      setPickingStatus('Connecting to Google Photos...');

      try {
        // 1. Create a PickingSession on backend
        const res = await fetch('/api/google/photos/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: accessToken, maxItems }),
        });

        const data = await res.json();
        if (!res.ok || !data.pickerUri) {
          if (targetPopup && !targetPopup.closed) {
            targetPopup.close();
          }
          if (res.status === 401 || res.status === 403) {
            // Token invalid or revoked - clear cache and re-prompt
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('gphotos_token');
              sessionStorage.removeItem('gphotos_token_exp');
            }
          }
          throw new Error(data.error || 'Failed to initialize Google Photos session');
        }

        const { sessionId, pickerUri } = data;
        const pickerUrl = pickerUri.endsWith('/autoclose') ? pickerUri : `${pickerUri}/autoclose`;

        // 2. Direct the popup window to the picker URL
        if (targetPopup && !targetPopup.closed) {
          targetPopup.location.href = pickerUrl;
          try {
            targetPopup.focus();
          } catch (e) {}
        } else {
          const newWin = window.open(
            pickerUrl,
            'GooglePhotosPicker',
            'width=980,height=720,menubar=no,toolbar=no,location=no,status=no'
          );
          popupRef.current = newWin;
        }

        setPickingStatus('Select photos in Google Photos & click Done');

        // 3. Poll for session completion every 2 seconds
        let pollAttempts = 0;
        let closedWindowTicks = 0;
        let isRequestInFlight = false;
        let isFinished = false;
        const maxPollAttempts = 180; // ~6 minutes max
        const maxClosedWindowTicks = 15; // Keep polling for up to 30 seconds after window closes

        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

        pollIntervalRef.current = setInterval(async () => {
          if (isRequestInFlight || isFinished) return;

          pollAttempts++;
          if (pollAttempts > maxPollAttempts) {
            console.warn('[Google Photos Hook] Max polling attempts reached.');
            cleanup();
            return;
          }

          const currentPopup = popupRef.current;
          const isWindowClosed = Boolean(currentPopup && currentPopup.closed);

          if (isWindowClosed) {
            closedWindowTicks++;
            setPickingStatus('Google Photos closed. Finalizing your selection...');
            if (closedWindowTicks > maxClosedWindowTicks) {
              console.log('[Google Photos Hook] Window closed with no items selected after 30s. Cleaning up.');
              cleanup();
              return;
            }
          }

          isRequestInFlight = true;
          try {
            console.log(`[Google Photos Hook] Poll #${pollAttempts} (closedTicks: ${closedWindowTicks})...`);
            const pollRes = await fetch(
              `/api/google/photos/session?sessionId=${sessionId}&token=${accessToken}`
            );

            if (pollRes.ok) {
              const pollData = await pollRes.json();
              console.log('[Google Photos Hook] Poll result:', pollData);

              if (pollData.completed || pollData.status === 'EXPIRED_OR_COMPLETED') {
                isFinished = true;
                cleanup();
                return;
              }

              if (pollData.mediaItemsSet) {
                isFinished = true;
                if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
                setPickingStatus('Importing chosen photos...');

                if (Array.isArray(pollData.items) && pollData.items.length > 0) {
                  console.log(`[Google Photos Hook] SUCCESS: Passing ${pollData.items.length} items to onPhotosSelected`);
                  await onPhotosSelected(pollData.items);
                } else {
                  console.warn('[Google Photos Hook] mediaItemsSet is true but pollData.items is empty:', pollData);
                }

                cleanup();
                return;
              }
            } else {
              console.warn('[Google Photos Hook] Poll request status:', pollRes.status);
            }
          } catch (pollErr) {
            console.warn('[Google Photos Poll Error]:', pollErr);
          } finally {
            isRequestInFlight = false;
          }
        }, 2000);
      } catch (err: any) {
        if (targetPopup && !targetPopup.closed) targetPopup.close();
        cleanup();
        const msg = err.message || 'Error connecting to Google Photos';
        if (onError) onError(msg);
        else alert(msg);
      }
    },
    [maxItems, onPhotosSelected, cleanup, onError]
  );

  // Called when user clicks "Open Google Photos" modal button after GIS authorization
  const openAuthorizedPhotosWindow = useCallback(() => {
    const token = getExistingToken();
    if (!token) return;

    setNeedsClickToOpen(false);

    // Direct synchronous user click - 100% immune to popup blockers
    const popup = window.open(
      'about:blank',
      'GooglePhotosPicker',
      'width=980,height=720,menubar=no,toolbar=no,location=no,status=no'
    );
    popupRef.current = popup;
    if (popup) {
      popup.document.write(`
        <!DOCTYPE html><html><head><title>Opening Google Photos...</title>
        <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#1e293b;}.box{text-align:center;padding:28px;background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);}.spinner{width:36px;height:36px;border:3px solid #f1f5f9;border-top-color:#3b82f6;border-radius:50%;animation:s 0.8s linear infinite;margin:0 auto 16px;}@keyframes s{to{transform:rotate(360deg)}}h2{font-size:16px;margin:0 0 8px;font-weight:600;}p{font-size:13px;color:#64748b;margin:0;}</style>
        </head><body><div class="box"><div class="spinner"></div><h2>Opening Google Photos</h2><p>Loading your photo library...</p></div></body></html>
      `);
    }

    startPickerWithToken(token, popup);
  }, [getExistingToken, startPickerWithToken]);

  // Main entrypoint: Click "Photos"
  const openPhotosPicker = useCallback(() => {
    const existingToken = getExistingToken();

    if (existingToken) {
      // 1. Token is ready! Open the popup IMMEDIATELY synchronously on user click!
      setIsPicking(true);
      setPickingStatus('Opening Google Photos...');

      const popup = window.open(
        'about:blank',
        'GooglePhotosPicker',
        'width=980,height=720,menubar=no,toolbar=no,location=no,status=no'
      );
      popupRef.current = popup;
      if (popup) {
        popup.document.write(`
          <!DOCTYPE html><html><head><title>Connecting to Google Photos...</title>
          <style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fafafa;color:#1e293b;}.box{text-align:center;padding:28px;background:white;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.06);}.spinner{width:36px;height:36px;border:3px solid #f1f5f9;border-top-color:#3b82f6;border-radius:50%;animation:s 0.8s linear infinite;margin:0 auto 16px;}@keyframes s{to{transform:rotate(360deg)}}h2{font-size:16px;margin:0 0 8px;font-weight:600;}p{font-size:13px;color:#64748b;margin:0;}</style>
          </head><body><div class="box"><div class="spinner"></div><h2>Connecting to Google Photos</h2><p>Please wait while your session is prepared...</p></div></body></html>
        `);
      }

      startPickerWithToken(existingToken, popup);
      return;
    }

    // 2. Token not present yet - request GIS token IMMEDIATELY and SYNCHRONOUSLY on user click!
    // Calling this immediately prevents ANY popup blocker error from GIS!
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
    if (!clientId) {
      const msg = 'Google Client ID is missing.';
      if (onError) onError(msg);
      else alert(msg);
      return;
    }

    if (!(window as any).google?.accounts?.oauth2) {
      const msg = 'Google Services are loading. Please try again in a moment.';
      if (onError) onError(msg);
      else alert(msg);
      return;
    }

    setIsPicking(true);
    setPickingStatus('Authorizing Google Photos...');

    const tokenClient = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly',
      callback: (tokenResponse: any) => {
        if (tokenResponse.error) {
          cleanup();
          const msg = `Google Authorization Error: ${tokenResponse.error}`;
          if (onError) onError(msg);
          else alert(msg);
          return;
        }

        const accessToken = tokenResponse.access_token;
        if (!accessToken) {
          cleanup();
          return;
        }

        // Cache granted token in sessionStorage (valid for 50 minutes)
        try {
          sessionStorage.setItem('gphotos_token', accessToken);
          sessionStorage.setItem('gphotos_token_exp', String(Date.now() + 50 * 60 * 1000));
        } catch (e) {}

        // Since user just interacted with the GIS popup, show the direct Open button
        // so the subsequent window.open is a fresh, unblockable user gesture!
        setPickingStatus('Authorized! Click below to open photos.');
        setNeedsClickToOpen(true);
      },
    });

    tokenClientRef.current = tokenClient;
    tokenClient.requestAccessToken({ prompt: '' });
  }, [getExistingToken, startPickerWithToken, onError, cleanup]);

  return {
    openPhotosPicker,
    openAuthorizedPhotosWindow,
    needsClickToOpen,
    isPicking,
    pickingStatus,
    cancelPicking,
    isScriptLoaded,
  };
}
