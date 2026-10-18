import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, hashPassword, hashRecoverySecret } from '@/lib/auth';
import { db, ensureDbInitialized } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  await ensureDbInitialized();
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { avatarType, avatarValue, newPassword, recoveryType, recoveryQuestion, recoverySecret } =
      await req.json();

    const updates: Partial<typeof users.$inferInsert> = {};

    if (avatarType && avatarValue) {
      updates.avatar_type = avatarType === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT';
      updates.avatar_value = avatarValue;
    }

    if (newPassword && String(newPassword).length >= 4) {
      updates.password_hash = hashPassword(String(newPassword));
    }

    if (recoveryType && recoverySecret) {
      updates.recovery_type = recoveryType;
      updates.recovery_question = recoveryType === 'QUESTION' ? recoveryQuestion : null;
      updates.recovery_hash = hashRecoverySecret(String(recoverySecret));
    }

    if (Object.keys(updates).length > 0) {
      await db
        .update(users)
        .set(updates)
        .where(eq(users.id, currentUser.id));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
