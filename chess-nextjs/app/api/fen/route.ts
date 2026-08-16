import { NextResponse } from 'next/server';
import { getGameSession } from '@/lib/chess/gameSession';

export async function GET() {
  const session = getGameSession();
  return NextResponse.json({ fen: session.currentFen() });
}
