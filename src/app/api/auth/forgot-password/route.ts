import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/db';
import { users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { hashPassword, verifyRecoverySecret } from '@/lib/auth';

// GET: retrieve user's recovery method info without revealing secrets
export async function GET(req: NextRequest) {
  await ensureDbInitialized();
  const { searchParams } = new URL(req.url);
  const username = searchParams.get('username')?.trim();

  if (!username) {
    return NextResponse.json(
      { error: 'Username is required' },
      { status: 400 }
    );
  }

  const userRows = await db
    .select({
      id: users.id,
      username: users.username,
      recoveryType: users.recovery_type,
      recoveryQuestion: users.recovery_question,
    })
    .from(users)
    .where(sql`lower(${users.username}) = lower(${username})`)
    .limit(1);

  const user = userRows[0];
  if (!user) {
    return NextResponse.json(
      { error: 'No account found with that username' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    username: user.username,
    recoveryType: user.recoveryType,
    recoveryQuestion: user.recoveryQuestion,
  });
}

// POST: verify recovery secret & set new password immediately
export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { username, recoverySecret, newPassword } = await req.json();

    if (!username || !recoverySecret || !newPassword) {
      return NextResponse.json(
        { error: 'Username, recovery verification, and new password are required' },
        { status: 400 }
      );
    }

    if (String(newPassword).length < 4) {
      return NextResponse.json(
        { error: 'New password must be at least 4 characters long' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    const userRows = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${cleanUsername})`)
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    const isMatch = verifyRecoverySecret(String(recoverySecret), user.recovery_hash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Incorrect recovery PIN or security answer. Please try again.' },
        { status: 401 }
      );
    }

    const newPasswordHash = hashPassword(String(newPassword));
    await db
      .update(users)
      .set({ password_hash: newPasswordHash })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}
