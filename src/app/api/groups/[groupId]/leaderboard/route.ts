import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { calculateGroupLeaderboard } from '@/lib/leaderboard';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const groupId = parseInt(params.groupId, 10);
  if (isNaN(groupId)) {
    return NextResponse.json({ error: 'Invalid group ID' }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const sortBy = searchParams.get('sortBy') === 'WIN_PCT' ? 'WIN_PCT' : 'WINS';

  const rows = await calculateGroupLeaderboard(groupId, sortBy);
  return NextResponse.json({ leaderboard: rows });
}
