import { NextRequest, NextResponse } from 'next/server';

const DIRECTORIES_BY_COUNTRY: Record<string, { name: string; region: string }[]> = {
  US: [
    { name: 'Google Business Profile', region: 'Global' },
    { name: 'Yelp', region: 'US' },
    { name: 'Facebook', region: 'Global' },
    { name: 'Apple Maps', region: 'Global' },
    { name: 'Bing Places', region: 'Global' },
    { name: 'Yellow Pages', region: 'US' },
    { name: 'BBB', region: 'US' },
    { name: 'Foursquare', region: 'Global' },
    { name: 'TripAdvisor', region: 'Global' },
    { name: 'Nextdoor', region: 'US' },
  ],
  IN: [
    { name: 'Google Business Profile', region: 'Global' },
    { name: 'JustDial', region: 'India' },
    { name: 'Sulekha', region: 'India' },
    { name: 'IndiaMART', region: 'India' },
    { name: 'Facebook', region: 'Global' },
    { name: 'Yelp', region: 'Global' },
    { name: 'Yellow Pages India', region: 'India' },
    { name: 'TradeIndia', region: 'India' },
    { name: 'ExportersIndia', region: 'India' },
    { name: 'Grotal', region: 'India' },
  ],
  UK: [
    { name: 'Google Business Profile', region: 'Global' },
    { name: 'Yell', region: 'UK' },
    { name: 'Facebook', region: 'Global' },
    { name: 'Yelp', region: 'Global' },
    { name: 'Thomson Local', region: 'UK' },
    { name: 'Scoot', region: 'UK' },
    { name: 'Cylex UK', region: 'UK' },
    { name: 'Hotfrog UK', region: 'UK' },
    { name: 'FreeIndex', region: 'UK' },
    { name: '192.com', region: 'UK' },
  ],
  CA: [
    { name: 'Google Business Profile', region: 'Global' },
    { name: 'Yellow Pages Canada', region: 'Canada' },
    { name: 'Yelp', region: 'Global' },
    { name: 'Facebook', region: 'Global' },
    { name: 'Canpages', region: 'Canada' },
    { name: 'iBegin', region: 'Canada' },
    { name: 'Canada411', region: 'Canada' },
    { name: 'Cylex Canada', region: 'Canada' },
    { name: 'Hotfrog Canada', region: 'Canada' },
    { name: 'Profile Canada', region: 'Canada' },
  ],
  AU: [
    { name: 'Google Business Profile', region: 'Global' },
    { name: 'Yellow Pages Australia', region: 'Australia' },
    { name: 'True Local', region: 'Australia' },
    { name: 'Yelp', region: 'Global' },
    { name: 'Facebook', region: 'Global' },
    { name: 'Hotfrog Australia', region: 'Australia' },
    { name: 'StartLocal', region: 'Australia' },
    { name: 'AussieWeb', region: 'Australia' },
    { name: 'Cylex Australia', region: 'Australia' },
    { name: 'Whereis', region: 'Australia' },
  ],
};

export async function POST(request: NextRequest) {
  try {
    const { businessName, country } = await request.json();

    const directories = DIRECTORIES_BY_COUNTRY[country] || DIRECTORIES_BY_COUNTRY.US;

    // Generate demo citation data
    const citations = directories.map((dir) => {
      const random = Math.random();
      let status: 'found' | 'not_found' | 'inconsistent';
      
      if (random > 0.6) {
        status = 'found';
      } else if (random > 0.3) {
        status = 'not_found';
      } else {
        status = 'inconsistent';
      }

      return {
        directory: dir.name,
        region: dir.region,
        url: status === 'found' ? `https://example.com/${dir.name.toLowerCase().replace(/\s+/g, '')}` : null,
        status,
        nap: {
          name: status === 'found' || Math.random() > 0.3,
          address: status === 'found' || Math.random() > 0.4,
          phone: status === 'found' || Math.random() > 0.3,
        },
      };
    });

    return NextResponse.json({ citations });
  } catch (error) {
    console.error('Citation discovery error:', error);
    return NextResponse.json(
      { error: 'Failed to discover citations' },
      { status: 500 }
    );
  }
}





