import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = body;
    
    // Get Google API key from request header or body
    const googleApiKey = request.headers.get('x-google-api-key') || body.googleApiKey;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    if (!googleApiKey) {
      return NextResponse.json(
        { 
          error: 'Google Places API key is required. Configure it in Settings > Google APIs.',
          needsConfig: true 
        },
        { status: 400 }
      );
    }

    // Use Google Places Text Search API
    const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${googleApiKey}`;
    
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (data.status === 'REQUEST_DENIED') {
      return NextResponse.json(
        { error: 'Google API request denied. Check your API key and ensure Places API is enabled.' },
        { status: 403 }
      );
    }

    if (data.status === 'ZERO_RESULTS') {
      return NextResponse.json({ results: [] });
    }

    if (data.status !== 'OK') {
      return NextResponse.json(
        { error: `Google API error: ${data.status}` },
        { status: 500 }
      );
    }

    // Return simplified results
    const results = data.results.slice(0, 10).map((place: {
      place_id: string;
      name: string;
      formatted_address: string;
      rating?: number;
      user_ratings_total?: number;
      types?: string[];
    }) => ({
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.formatted_address,
      rating: place.rating,
      reviewCount: place.user_ratings_total,
      types: place.types,
    }));

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Place search error:', error);
    return NextResponse.json(
      { error: 'Failed to search places. Please check your API key.' },
      { status: 500 }
    );
  }
}





