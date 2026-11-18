import { useEffect, useRef, useState } from 'react';
import { request } from './api.js';

// Google Identity Services renders its official button. Never trust browser-decoded identity.
export function GoogleButton({ onSession, link = false }) {
  const container = useRef(null);
  const [error, setError] = useState('');
  const clientId = __PUBLIC_CONFIG__.googleClientId;
  useEffect(() => {
    if (!clientId || !container.current || !navigator.onLine) return;
    let active = true;
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = async () => {
      if (!active || !container.current || !window.google?.accounts?.id) return;
      try {
        const { nonce } = await request('/auth/google/nonce', { method: 'POST', body: {} });
        if (!active || !container.current) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce,
          callback: async ({ credential }) => {
            try {
              setError('');
              const result = await request(link ? '/auth/google/link' : '/auth/google', {
                method: 'POST', body: { credential },
              });
              onSession(result);
            } catch (err) { setError(err.message); }
          },
        });
        window.google.accounts.id.renderButton(container.current, {
          theme: 'outline', size: 'large', text: link ? 'continue_with' : 'signin_with',
        });
      } catch (err) { if (active) setError(err.message); }
    };
    script.onerror = () => { if (active) setError('Google sign-in is unavailable. Try again online.'); };
    document.head.appendChild(script);
    return () => { active = false; script.remove(); };
  }, [clientId, link, onSession]);
  if (!clientId) return null;
  return <div className="google-login"><div ref={container} aria-label={link ? 'Link Google account' : 'Sign in with Google'} />{error && <p className="error" role="alert">{error}</p>}</div>;
}
