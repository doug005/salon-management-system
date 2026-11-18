import { useEffect, useState } from 'react';
export function ConnectionBanner() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  if (online) return null;
  return <div role="status" className="offline-banner">
    Offline: saved app pages may open, but bookings, payments, sign-in and live business records need internet. Do not assume a booking is confirmed.
  </div>;
}
