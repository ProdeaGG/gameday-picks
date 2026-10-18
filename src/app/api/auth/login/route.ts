import { NextRequest, NextResponse } from 'next/server';
import { db, ensureDbInitialized } from '@/db';
import { users } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { comparePassword, createSession } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    await ensureDbInitialized();
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
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
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const passwordMatches = comparePassword(String(password), user.password_hash);
    if (!passwordMatches) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    await createSession({
      userId: user.id,
      username: user.username,
      isAdmin: user.is_admin,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        avatarType: user.avatar_type,
        avatarValue: user.avatar_value,
        isAdmin: user.is_admin,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred during login' },
      { status: 500 }
    );
  }
}
