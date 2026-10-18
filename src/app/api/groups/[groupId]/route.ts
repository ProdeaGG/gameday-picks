import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { groups, groupMembers, users, weeks, picks } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const groupId = parseInt(params.groupId, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  const groupRows = await db.select().from(groups).where(eq(groups.id, groupId)).limit(1);
  const group = groupRows[0];
  if (!group) {
    return NextResponse.json({ error: 'Group not found' }, { status: 404 });
  }

  // Verify caller is a member
  const membershipRows = await db
    .select()
    .from(groupMembers)
    .where(
      and(
        eq(groupMembers.group_id, groupId),
        eq(groupMembers.user_id, currentUser.id)
      )
    )
    .limit(1);

  if (membershipRows.length === 0 && !currentUser.isAdmin) {
    return NextResponse.json(
      { error: 'You are not a member of this group' },
      { status: 403 }
    );
  }

  // Get published weeks; prefer REGULAR season week as default active week
  const weekRows = await db
    .select()
    .from(weeks)
    .where(eq(weeks.is_published, true))
    .orderBy(desc(weeks.week_number));

  const activeWeek =
    weekRows.find((w) => w.stage === 'REGULAR') || weekRows[0] || null;

  // Fetch all members with their user info
  const rawMembers = await db
    .select({
      memberId: groupMembers.id,
      seatIndex: groupMembers.seat_index,
      userId: users.id,
      username: users.username,
      avatarType: users.avatar_type,
      avatarValue: users.avatar_value,
      isBot: users.is_bot,
    })
    .from(groupMembers)
    .innerJoin(users, eq(groupMembers.user_id, users.id))
    .where(eq(groupMembers.group_id, groupId));

  const members = [];
  for (const m of rawMembers) {
    let isLocked = false;
    let picksCount = 0;

    if (activeWeek) {
      const userPicks = await db
        .select({
          isLocked: picks.is_locked,
        })
        .from(picks)
        .where(
          and(
            eq(picks.group_id, groupId),
            eq(picks.user_id, m.userId),
            eq(picks.week_id, activeWeek.id)
          )
        );

      picksCount = userPicks.length;
      isLocked =
        activeWeek.sandbox_state_override === 'ALL_SUBMITTED' ||
        (userPicks.length > 0 && userPicks.every((p) => Boolean(p.isLocked)));
    }

    members.push({
      userId: m.userId,
      username: m.username,
      avatarType: m.avatarType,
      avatarValue: m.avatarValue,
      seatIndex: m.seatIndex,
      isLocked,
      picksCount,
    });
  }

  return NextResponse.json({
    group,
    members,
    activeWeek,
    allWeeks: weekRows,
  });
}
