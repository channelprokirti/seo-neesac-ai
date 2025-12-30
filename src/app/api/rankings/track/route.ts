import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { keyword, location } = await request.json();

    // Demo data - in production, this would call a SERP API
    const localPackPosition = Math.random() > 0.3 ? Math.floor(Math.random() * 3) + 1 : null;
    const organicPosition = Math.random() > 0.2 ? Math.floor(Math.random() * 20) + 1 : null;

    const trackedKeyword = {
      keyword,
      location,
      rankings: [
        {
          date: new Date().toISOString(),
          local_pack_position: localPackPosition,
          organic_position: organicPosition,
        },
        {
          date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          local_pack_position: localPackPosition ? localPackPosition + Math.floor(Math.random() * 3) - 1 : null,
          organic_position: organicPosition ? organicPosition + Math.floor(Math.random() * 5) - 2 : null,
        },
      ],
    };

    return NextResponse.json({ keyword: trackedKeyword });
  } catch (error) {
    console.error('Ranking track error:', error);
    return NextResponse.json(
      { error: 'Failed to track ranking' },
      { status: 500 }
    );
  }
}





