'use client';

import React from 'react';
import { CheckCircle2, Clock } from 'lucide-react';

export interface BoothMember {
  userId: number;
  username: string;
  avatarType: 'DEFAULT' | 'CUSTOM';
  avatarValue: string;
  isLocked: boolean;
  totalPicksCount?: number;
}

interface BroadcastBoothProps {
  groupName: string;
  members: BoothMember[];
  overrideCount?: number; // for sandbox 1-8 player count slider
}

export default function BroadcastBooth({
  groupName,
  members,
  overrideCount,
}: BroadcastBoothProps) {
  // If sandbox slider override is active, slice or pad members
  const displayMembers = React.useMemo(() => {
    const targetCount =
      overrideCount && overrideCount >= 1 && overrideCount <= 8
        ? overrideCount
        : Math.min(members.length, 8);

    if (members.length >= targetCount) {
      return members.slice(0, targetCount);
    }
    // Pad with placeholder members if previewing higher count
    const padded = [...members];
    for (let i = members.length; i < targetCount; i++) {
      padded.push({
        userId: -(i + 1),
        username: `Guest_${i + 1}`,
        avatarType: 'DEFAULT',
        avatarValue: `default-${(i % 10) + 1}`,
        isLocked: i % 2 === 0,
      });
    }
    return padded;
  }, [members, overrideCount]);

  const count = displayMembers.length;

  // Split into 1 row (1-4 members) or 2 diagonally staggered rows (5-8 members)
  const isTwoRows = count >= 5;
  const backRowCount = isTwoRows ? Math.floor(count / 2) : 0;

  const backRowMembers = isTwoRows ? displayMembers.slice(0, backRowCount) : [];
  const frontRowMembers = isTwoRows ? displayMembers.slice(backRowCount) : displayMembers;

  // When back row and front row have the same number of seats (e.g. 6 or 8 players),
  // apply a horizontal half-seat stagger so back-row username pills sit between front-row avatars
  const isEvenTwoRow = isTwoRows && backRowMembers.length === frontRowMembers.length;

  const renderAvatarItem = (m: BoothMember, isBackRow: boolean) => {
    const avatarSrc =
      m.avatarType === 'CUSTOM'
        ? m.avatarValue
        : `/avatars/${m.avatarValue || 'default-1'}.svg`;

    // Dynamic sizing based on row and total member count
    const sizeClasses = isBackRow
      ? 'w-11 h-11 sm:w-12 sm:h-12'
      : count <= 3
      ? 'w-16 h-16 sm:w-20 sm:h-20'
      : count === 4
      ? 'w-14 h-14 sm:w-16 sm:h-16'
      : 'w-11 h-11 sm:w-13 sm:h-13';

    return (
      <div
        key={m.userId}
        className="flex flex-col items-center group relative z-10 hover:z-40 transition-transform duration-200 hover:-translate-y-1.5"
      >
        {/* Avatar Frame with pixel border styling */}
        <div
          className={`relative rounded-md overflow-hidden border-2 shadow-lg transition-all ${
            m.isLocked
              ? 'border-emerald-400/90 shadow-emerald-950/60 ring-2 ring-emerald-500/30'
              : 'border-amber-400/80 shadow-amber-950/60'
          } ${sizeClasses}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarSrc}
            alt={m.username}
            className="w-full h-full object-cover pixelated bg-slate-900"
          />
        </div>

        {/* Username Pill & Lock Status — always visible above row below */}
        <div className="mt-1 z-30 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/95 border border-slate-700 shadow-lg group-hover:border-amber-400 transition-all">
          {m.isLocked ? (
            <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <Clock className="w-3 h-3 text-amber-400 animate-pulse flex-shrink-0" />
          )}
          <span className="text-[10px] sm:text-xs font-bold text-slate-100 truncate max-w-[68px] sm:max-w-[92px] group-hover:max-w-none">
            {m.username}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="relative w-full rounded-xl overflow-hidden shadow-2xl border border-slate-800 bg-[#080d1a] select-none">
      {/* 16-Bit Pixel Art Stadium Backdrop */}
      <div className="relative w-full h-64 sm:h-72 overflow-hidden">
        <svg
          viewBox="0 0 400 180"
          className="w-full h-full object-cover pixelated"
          preserveAspectRatio="none"
          shapeRendering="crispEdges"
        >
          {/* Night Sky Gradient Blocks */}
          <rect x="0" y="0" width="400" height="35" fill="#030712" />
          <rect x="0" y="35" width="400" height="30" fill="#091224" />
          <rect x="0" y="65" width="400" height="35" fill="#0f1f3d" />

          {/* Stadium Floodlights (Left & Right) */}
          <rect x="15" y="10" width="30" height="15" fill="#fef08a" opacity="0.8" />
          <polygon points="15,25 0,110 55,110" fill="#fef08a" opacity="0.15" />
          <rect x="355" y="10" width="30" height="15" fill="#fef08a" opacity="0.8" />
          <polygon points="355,25 345,110 400,110" fill="#fef08a" opacity="0.15" />

          {/* Cheering Pixel Crowd Stands */}
          <rect x="0" y="55" width="400" height="40" fill="#1e293b" />
          <g opacity="0.65">
            {Array.from({ length: 30 }).map((_, i) => (
              <React.Fragment key={i}>
                <rect x={i * 13 + 5} y="60" width="4" height="4" fill={i % 2 === 0 ? '#ef4444' : '#3b82f6'} />
                <rect x={i * 13 + 9} y="68" width="4" height="4" fill={i % 3 === 0 ? '#f59e0b' : '#10b981'} />
                <rect x={i * 13 + 3} y="76" width="4" height="4" fill={i % 2 === 0 ? '#f8fafc' : '#8b5cf6'} />
                <rect x={i * 13 + 7} y="84" width="4" height="4" fill={i % 4 === 0 ? '#f43f5e' : '#eab308'} />
              </React.Fragment>
            ))}
          </g>

          {/* Football Field Turf & Yard Lines */}
          <rect x="0" y="95" width="400" height="50" fill="#065f46" />
          <rect x="0" y="105" width="400" height="40" fill="#047857" />
          <line x1="50" y1="95" x2="30" y2="145" stroke="#f8fafc" strokeWidth="2" opacity="0.5" />
          <line x1="120" y1="95" x2="110" y2="145" stroke="#f8fafc" strokeWidth="2" opacity="0.5" />
          <line x1="200" y1="95" x2="200" y2="145" stroke="#f8fafc" strokeWidth="3" opacity="0.7" />
          <line x1="280" y1="95" x2="290" y2="145" stroke="#f8fafc" strokeWidth="2" opacity="0.5" />
          <line x1="350" y1="95" x2="370" y2="145" stroke="#f8fafc" strokeWidth="2" opacity="0.5" />

          {/* Yellow Goalpost in Center Field */}
          <rect x="198" y="65" width="4" height="35" fill="#facc15" />
          <rect x="180" y="65" width="40" height="3" fill="#facc15" />
          <rect x="180" y="43" width="4" height="22" fill="#facc15" />
          <rect x="216" y="43" width="4" height="22" fill="#facc15" />

          {/* Studio Camera Tower Silhouette */}
          <polygon points="10,145 15,95 25,95 30,145" fill="#0f172a" />
          <rect x="18" y="90" width="8" height="6" fill="#334155" />
        </svg>

        {/* Center-Outward Dynamic Avatars Seating Area */}
        <div className="absolute inset-x-0 bottom-12 sm:bottom-13 z-20 flex flex-col items-center pointer-events-auto px-2">
          {/* Elevated Back Row (if 5-8 members) with clear vertical separation & diagonal stagger */}
          {isTwoRows && (
            <div
              className={`flex items-end justify-center gap-3 sm:gap-7 mb-2 sm:mb-2.5 z-20 ${
                isEvenTwoRow ? '-translate-x-3 sm:-translate-x-5' : ''
              }`}
            >
              {backRowMembers.map((m) => renderAvatarItem(m, true))}
            </div>
          )}

          {/* Front Row (Centered over desk) */}
          <div
            className={`flex items-end justify-center gap-3 sm:gap-7 z-20 ${
              isEvenTwoRow ? 'translate-x-3 sm:translate-x-5' : ''
            }`}
          >
            {frontRowMembers.map((m) => renderAvatarItem(m, false))}
          </div>
        </div>

        {/* Foreground 16-Bit Broadcast Desk */}
        <div className="absolute inset-x-0 bottom-0 z-30 pointer-events-none">
          <div className="w-full h-11 sm:h-12 bg-gradient-to-b from-[#1e293b] via-[#0f172a] to-[#020617] border-t-4 border-amber-500 shadow-2xl relative flex items-center justify-center">
            {/* Center Studio Microphone */}
            <div className="absolute -top-3 w-5 h-4 bg-slate-700 rounded-t-sm border border-slate-500 shadow-md flex items-center justify-center">
              <div className="w-2.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            </div>

            {/* Front Desk Nameplate with Group Name in Retro Pixel Typography */}
            <div className="px-4 py-1 rounded bg-[#090e17] border-2 border-amber-400 shadow-lg text-center max-w-[85%] sm:max-w-md">
              <span className="font-mono uppercase tracking-widest text-xs sm:text-sm font-black text-amber-400 drop-shadow-[0_2px_4px_rgba(245,158,11,0.5)] truncate block">
                {groupName}
              </span>
            </div>

            {/* Subtle Woodgrain Accent Lines */}
            <div className="absolute inset-x-0 bottom-1 flex justify-between px-6 opacity-30">
              <div className="w-16 h-0.5 bg-amber-200" />
              <div className="w-32 h-0.5 bg-amber-200" />
              <div className="w-16 h-0.5 bg-amber-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
