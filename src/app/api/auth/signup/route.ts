import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { hashPassword, hashRecoverySecret, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const body = await req.json();
    const {
      username,
      password,
      recoveryType,
      recoveryQuestion,
      recoverySecret,
      avatarType = 'DEFAULT',
      avatarValue = 'default-1',
    } = body;

    if (!username || !password || !recoveryType || !recoverySecret) {
      return NextResponse.json(
        { error: 'Username, password, and recovery method are required' },
        { status: 400 }
      );
    }

    const cleanUsername = String(username).trim();
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      return NextResponse.json(
        { error: 'Username must be between 3 and 20 characters' },
        { status: 400 }
      );
    }

    if (recoveryType === 'PIN') {
      const pinStr = String(recoverySecret).trim();
      if (!/^\d{4}$/.test(pinStr)) {
        return NextResponse.json(
          { error: 'Recovery PIN must be exactly 4 digits (e.g. 1234)' },
          { status: 400 }
        );
      }
    } else if (recoveryType === 'QUESTION') {
      if (!recoveryQuestion || !String(recoverySecret).trim()) {
        return NextResponse.json(
          { error: 'Please choose a security question and provide an answer' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid recovery method specified' },
        { status: 400 }
      );
    }

    // Check username uniqueness (case-insensitive)
    const existingRows = await db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = lower(${cleanUsername})`)
      .limit(1);

    if (existingRows.length > 0) {
      return NextResponse.json(
        { error: 'This username is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const passwordHash = hashPassword(String(password));
    const recoveryHash = hashRecoverySecret(String(recoverySecret));

    const [newUser] = await db
      .insert(users)
      .values({
        username: cleanUsername,
        password_hash: passwordHash,
        recovery_type: recoveryType,
        recovery_question: recoveryType === 'QUESTION' ? recoveryQuestion : null,
        recovery_hash: recoveryHash,
        avatar_type: avatarType === 'CUSTOM' ? 'CUSTOM' : 'DEFAULT',
        avatar_value: avatarValue,
        is_admin: false,
        is_bot: false,
        created_at: now,
      })
      .returning();

    await createSession({
      userId: newUser.id,
      username: newUser.username,
      isAdmin: newUser.is_admin,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        avatarType: newUser.avatar_type,
        avatarValue: newUser.avatar_value,
        isAdmin: newUser.is_admin,
      },
    });
  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json(
      { error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
