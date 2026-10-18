import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, groupMembers, weeks, picks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function GET() {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Find published weeks; prefer REGULAR season week as the primary active pick slate if OPEN/LOCKED
  const weekRows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.is_published, true))
    .orderBy(desc(weeks.week_number));

  const activeWeek =
    weekRows.find((w) => w.stage === 'REGULAR') || weekRows[0] || null;

  // Find groups user belongs to
  const userMemberships = await db
    .select({
      groupId: groupMembers.group_id,
      seatIndex: groupMembers.seat_index,
    })
    .from(groupMembers)
    .where(eq(groupMembers.user_id, currentUser.id));

  const userGroupIds = userMemberships.map((m) => m.groupId);
  if (userGroupIds.length === 0) {
    return NextResponse.json({ groups: [] });
  }

  const allGroups = await db.select().from(groups);
  const relevantGroups = allGroups.filter((g) => userGroupIds.includes(g.id));

  const result = [];
  for (const grp of relevantGroups) {
    const membersInGroup = await db
      .select({ id: groupMembers.id })
      .from(groupMembers)
      .where(eq(groupMembers.group_id, grp.id));

    let isLockedIn = false;
    let picksCount = 0;

    if (activeWeek) {
      const userPicks = await db
        .select({
          isLocked: picks.is_locked,
        })
        .from(picks)
        .where(
          and(
            eq(picks.group_id, grp.id),
            eq(picks.user_id, currentUser.id),
            eq(picks.week_id, activeWeek.id)
          )
        );

      picksCount = userPicks.length;
      isLockedIn = userPicks.length > 0 && userPicks.every((p) => Boolean(p.isLocked));
    }

    result.push({
      id: grp.id,
      name: grp.name,
      inviteCode: grp.invite_code,
      ownerId: grp.owner_id,
      memberCount: membersInGroup.length,
      maxMembers: 8,
      isLockedIn,
      picksCount,
      activeWeekLabel: activeWeek?.label || 'Week 8',
    });
  }

  return NextResponse.json({ groups: result });
}

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name } = await req.json();
    const cleanName = String(name || '').trim();

    if (!cleanName || cleanName.length > 24) {
      return NextResponse.json(
        { error: 'Group name must be between 1 and 24 characters' },
        { status: 400 }
      );
    }

    let inviteCode = generateInviteCode();
    let collision = await db
      .select()
      .from(groups)
      .where(eq(groups.invite_code, inviteCode))
      .limit(1);

    while (collision.length > 0) {
      inviteCode = generateInviteCode();
      collision = await db
        .select()
        .from(groups)
        .where(eq(groups.invite_code, inviteCode))
        .limit(1);
    }

    const now = new Date().toISOString();

    const [newGroup] = await db
      .insert(groups)
      .values({
        name: cleanName,
        invite_code: inviteCode,
        owner_id: currentUser.id,
        is_sandbox: false,
        created_at: now,
      })
      .returning();

    // Seat creator as seat_index: 0
    await db.insert(groupMembers).values({
      group_id: newGroup.id,
      user_id: currentUser.id,
      seat_index: 0,
      joined_at: now,
    });

    return NextResponse.json({ success: true, group: newGroup });
  } catch (error) {
    console.error('Create group error:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}
