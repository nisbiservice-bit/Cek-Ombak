import React, { useState, useEffect } from 'react';
import { User } from '../types';

interface WatermarkOverlayProps {
  currentUser: User | null;
}

export const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ currentUser }) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleDateString('id-ID', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
      );
    };
    updateTime();
    // Update every minute so any photograph records the exact minute
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!currentUser) return null;

  const phoneStr = currentUser.phone ? ` • ${currentUser.phone}` : '';
  const watermarkText = `${currentUser.namaLengkap} (@${currentUser.username}${phoneStr}) • ${timeStr} • RAHASIA TIM CÉNGHAR`;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-20 overflow-hidden select-none opacity-[0.065] text-slate-100 flex flex-col justify-around rotate-[-22deg] scale-125"
    >
      {[...Array(14)].map((_, i) => (
        <div
          key={i}
          className="whitespace-nowrap text-[12px] sm:text-[13px] font-extrabold tracking-widest uppercase font-mono py-6"
        >
          {`${watermarkText}               ${watermarkText}               ${watermarkText}`}
        </div>
      ))}
    </div>
  );
};
