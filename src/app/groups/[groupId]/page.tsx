'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BroadcastBooth, { BoothMember } from '@/components/BroadcastBooth';
import PickFlow from '@/components/PickFlow';
import GroupPicksFeed from '@/components/GroupPicksFeed';
import LeaderboardTable from '@/components/LeaderboardTable';
import {
  Trophy,
  Copy,
  Check,
  Calendar,
  Lock,
  ListOrdered,
} from 'lucide-react';

interface GroupDetailData {
  group: {
    id: number;
    name: string;
    invite_code: string;
    owner_id: number;
    sandbox_player_count?: number;
  };
  members: Array<{
    userId: number;
    username: string;
    avatarType: 'DEFAULT' | 'CUSTOM';
    avatarValue: string;
    seatIndex: number;
    isLocked: boolean;
    picksCount: number;
  }>;
  activeWeek?: {
    id: number;
    week_number: number;
    label: string;
    stage: 'REGULAR' | 'BOWL' | 'PLAYOFF' | 'CHAMPIONSHIP';
    lock_time_utc: string;
  };
}

export default function GroupWorkspacePage() {
  const router = useRouter();
  const params = useParams();
  const groupId = parseInt(params.groupId as string, 10);

  const [currentUser, setCurrentUser] = useState<{
    id: number;
    username: string;
    avatarType: 'DEFAULT' | 'CUSTOM';
    avatarValue: string;
    isAdmin: boolean;
  } | null>(null);

  const [groupData, setGroupData] = useState<GroupDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PICKS' | 'GROUP_FEED' | 'LEADERBOARD'>('PICKS');
  const [copied, setCopied] = useState(false);

  const fetchGroup = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) {
        router.push('/login');
        return;
      }
      const meData = await meRes.json();
      setCurrentUser(meData.user);

      const res = await fetch(`/api/groups/${groupId}`);
      if (!res.ok) {
        router.push('/groups');
        return;
      }
      const data = await res.json();
      setGroupData(data);
    } catch {
      // fetch error
    } finally {
      setLoading(false);
    }
  }, [groupId, router]);

  useEffect(() => {
    fetchGroup();
    const handler = () => fetchGroup();
    window.addEventListener('gameday-sandbox-updated', handler);
    return () => window.removeEventListener('gameday-sandbox-updated', handler);
  }, [fetchGroup]);

  const copyInviteLink = () => {
    if (!groupData) return;
    const url = `${window.location.origin}/join/${groupData.group.invite_code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading || !groupData) {
    return (
      <div className="min-h-screen bg-[#080d1a] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const boothMembers: BoothMember[] = groupData.members.map((m) => ({
    userId: m.userId,
    username: m.username,
    avatarType: m.avatarType,
    avatarValue: m.avatarValue,
    isLocked: m.isLocked,
    totalPicksCount: m.picksCount,
  }));

  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col pb-28">
      <Header currentUser={currentUser} groupName={groupData.group.name} />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6">
        {/* Pixel-Art College GameDay Broadcast Booth Header */}
        <section className="mb-6">
          <BroadcastBooth
            groupName={groupData.group.name}
            members={boothMembers}
            overrideCount={groupData.group.sandbox_player_count}
          />
        </section>

        {/* Group Sub-Header Info Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 rounded-xl px-4 py-3 mb-6 shadow-md">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-300">
              Members: <strong className="text-white">{groupData.members.length} / 8</strong>
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <span className="text-xs text-slate-400">
              Slate: <strong className="text-amber-400">{groupData.activeWeek?.label || 'Week 8'}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-amber-400" />
                  <span>Invite Link: {groupData.group.invite_code}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Workspace Navigation Tabs */}
        <div className="flex border-b border-slate-800 mb-6 gap-2">
          <button
            onClick={() => setActiveTab('PICKS')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'PICKS'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Make Picks</span>
          </button>
          <button
            onClick={() => setActiveTab('GROUP_FEED')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'GROUP_FEED'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Group Selections</span>
          </button>
          <button
            onClick={() => setActiveTab('LEADERBOARD')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
              activeTab === 'LEADERBOARD'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Leaderboard</span>
          </button>
        </div>

        {/* Content Tabs */}
        <div>
          {activeTab === 'PICKS' && (
            <PickFlow groupId={groupId} onPicksLocked={fetchGroup} />
          )}

          {activeTab === 'GROUP_FEED' && (
            <GroupPicksFeed groupId={groupId} />
          )}

          {activeTab === 'LEADERBOARD' && (
            <LeaderboardTable groupId={groupId} />
          )}
        </div>
      </main>
    </div>
  );
}
