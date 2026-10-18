'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Trophy, ChevronLeft, Shield, LogOut, User, RefreshCw } from 'lucide-react';

interface HeaderProps {
  currentUser?: {
    id: number;
    username: string;
    avatarType: 'DEFAULT' | 'CUSTOM';
    avatarValue: string;
    isAdmin: boolean;
  } | null;
  groupName?: string;
}

export default function Header({ currentUser, groupName }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [currentVersion, setCurrentVersion] = useState<string>('v1.0.0');
  const [updateAvailable, setUpdateAvailable] = useState<boolean>(false);
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);

  const isInsideGroup = pathname.startsWith('/groups/') && pathname !== '/groups';

  // Poll /api/version every 60 seconds & on window focus for stale mobile session auto-reload
  useEffect(() => {
    let localVersion: string | null = null;

    const checkVersion = async () => {
      try {
        const res = await fetch('/api/version', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const serverVersion = `v${data.version}`;
          if (!localVersion) {
            localVersion = serverVersion;
            setCurrentVersion(serverVersion);
          } else if (localVersion !== serverVersion) {
            setUpdateAvailable(true);
          }
        }
      } catch {
        // network error / offline
      }
    };

    checkVersion();
    const interval = setInterval(checkVersion, 60000);
    window.addEventListener('focus', checkVersion);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkVersion);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch {
      // logout error
    }
  };

  const avatarSrc = currentUser
    ? currentUser.avatarType === 'CUSTOM'
      ? currentUser.avatarValue
      : `/avatars/${currentUser.avatarValue || 'default-1'}.svg`
    : '/avatars/default-1.svg';

  return (
    <>
      {/* Update Available notification banner */}
      {updateAvailable && (
        <div className="bg-amber-500 text-slate-950 font-bold px-4 py-2 text-center text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>New update deployed!</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-2 underline font-black hover:text-black"
          >
            Tap to Refresh
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 w-full bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
          {/* Left section: Logo or "← Back to Groups" */}
          <div className="flex items-center gap-3">
            {isInsideGroup ? (
              <Link
                href="/groups"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold border border-slate-700 transition-all hover:border-amber-400 group"
              >
                <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform text-amber-400" />
                <span>Back to Groups</span>
              </Link>
            ) : (
              <Link href="/groups" className="flex items-center gap-2 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 p-1 flex items-center justify-center shadow-lg shadow-amber-500/20 group-hover:scale-105 transition-transform">
                  <Trophy className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-sm sm:text-base tracking-tight text-white leading-none">
                    GAMEDAY <span className="text-amber-400">PICK&apos;EM</span>
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    College Football
                  </span>
                </div>
              </Link>
            )}

            {groupName && (
              <div className="hidden md:flex items-center gap-2 pl-3 border-l border-slate-700">
                <span className="text-xs text-slate-400 font-semibold">Group:</span>
                <span className="text-xs font-bold text-amber-300 max-w-[180px] truncate">
                  {groupName}
                </span>
              </div>
            )}
          </div>

          {/* Right section: Patch Version Badge & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Version Badge & Creator Credit */}
            <div className="flex flex-col items-end">
              <div className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-mono text-slate-300 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{currentVersion}</span>
              </div>
              <span className="text-[9px] text-slate-500 font-medium tracking-tight mt-0.5">
                Created by <strong className="text-slate-400 font-semibold">ProdeaGG</strong>
              </span>
            </div>

            {currentUser ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 p-1 pl-2 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-slate-600 transition-all"
                >
                  <span className="text-xs font-bold text-slate-200 hidden sm:block max-w-[100px] truncate">
                    {currentUser.username}
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={currentUser.username}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg pixelated object-cover border border-amber-400 bg-slate-900"
                  />
                </button>

                {/* Dropdown Menu */}
                {dropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setDropdownOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-3 py-2 border-b border-slate-800">
                        <p className="text-xs font-bold text-white truncate">
                          {currentUser.username}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {currentUser.isAdmin ? 'Commissioner / Admin' : 'Player'}
                        </p>
                      </div>

                      <Link
                        href="/profile"
                        onClick={() => setDropdownOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <User className="w-3.5 h-3.5 text-amber-400" />
                        <span>Profile & Avatar</span>
                      </Link>

                      {currentUser.isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setDropdownOpen(false)}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors"
                        >
                          <Shield className="w-3.5 h-3.5 text-amber-400" />
                          <span>Admin Console</span>
                        </Link>
                      )}

                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm shadow-md transition-all"
              >
                Log In
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
