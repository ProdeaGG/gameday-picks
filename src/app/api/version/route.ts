import { NextResponse } from 'next/server';
import packageJson from '@/../package.json';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(
    {
      version: packageJson.version || '1.0.0',
      buildTimestamp: new Date().toISOString(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      },
    }
  );
}
