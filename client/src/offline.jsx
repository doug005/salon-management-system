import { useEffect, useState } from 'react';
import { useLanguage } from './i18n.jsx';

export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}

export function ConnectionBanner() {
  const online = useOnline();
  const { t } = useLanguage();
  return <div role="status" aria-live="polite" className={online ? 'connection-banner is-online' : 'connection-banner is-offline'}>
    {online
      ? t('Online · live actions require a working connection.')
      : t('Offline · cached app shell and public info only. Booking, sign-in, and payment verification need internet; no action is queued.')}
  </div>;
}
