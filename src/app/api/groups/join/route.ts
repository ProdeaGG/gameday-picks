import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, groupMembers } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  await ensureDbInitialized();
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get('code') || '').trim().toUpperCase();

  if (!code) {
    return NextResponse.json({ error: 'Invite code required' }, { status: 400 });
  }

  const groupRows = await db
    .select()
    .from(groups)
    .where(sql`upper(${groups.invite_code}) = ${code}`)
    .limit(1);

  const group = groupRows[0];
  if (!group) {
    return NextResponse.json({ error: 'No group found with that invite code' }, { status: 404 });
  }

  const members = await db
    .select()
    .from(groupMembers)
    .where(eq(groupMembers.group_id, group.id));

  const currentUser = await getCurrentUser();
  const isMember = currentUser ? members.some((m) => m.user_id === currentUser.id) : false;

  return NextResponse.json({
    group: {
      id: group.id,
      name: group.name,
      inviteCode: group.invite_code,
      memberCount: members.length,
      maxMembers: 8,
      isFull: members.length >= 8,
      isMember,
    },
  });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { inviteCode } = await req.json();
    const cleanCode = String(inviteCode || '').trim().toUpperCase();

    if (!cleanCode) {
      return NextResponse.json(
        { error: 'Please enter a 6-character invite code' },
        { status: 400 }
      );
    }

    const groupRows = await db
      .select()
      .from(groups)
      .where(sql`upper(${groups.invite_code}) = ${cleanCode}`)
      .limit(1);

    const group = groupRows[0];
    if (!group) {
      return NextResponse.json(
        { error: 'No group found with that invite code' },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMembership = await db
      .select()
      .from(groupMembers)
      .where(
        sql`${groupMembers.group_id} = ${group.id} AND ${groupMembers.user_id} = ${currentUser.id}`
      )
      .limit(1);

    if (existingMembership.length > 0) {
      return NextResponse.json({
        success: true,
        alreadyMember: true,
        group,
      });
    }

    // Check group capacity (HARD LIMIT: 8 members max)
    const existingMembers = await db
      .select()
      .from(groupMembers)
      .where(eq(groupMembers.group_id, group.id));

    if (existingMembers.length >= 8) {
      return NextResponse.json(
        { error: 'This group is full (maximum 8 players reached)' },
        { status: 400 }
      );
    }

    const assignedSeat = existingMembers.length;
    const now = new Date().toISOString();

    await db.insert(groupMembers).values({
      group_id: group.id,
      user_id: currentUser.id,
      seat_index: assignedSeat,
      joined_at: now,
    });

    return NextResponse.json({
      success: true,
      group,
    });
  } catch (error) {
    console.error('Join group error:', error);
    return NextResponse.json(
      { error: 'Failed to join group' },
      { status: 500 }
    );
  }
}
