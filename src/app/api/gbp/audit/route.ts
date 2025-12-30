import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

function getSupabaseCredentials() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    };
  }
  return { url: '', anonKey: '' };
}

async function getSupabaseFromCookie() {
  const { url, anonKey } = getSupabaseCredentials();
  if (url && anonKey) return { url, anonKey };
  
  const cookieStore = await cookies();
  const configCookie = cookieStore.get('supabase-config');
  if (configCookie?.value) {
    try {
      return JSON.parse(decodeURIComponent(configCookie.value));
    } catch (e) {
      console.error('Failed to parse supabase-config cookie:', e);
    }
  }
  return { url: '', anonKey: '' };
}

interface PlaceDetails {
  name?: string;
  formatted_address?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  business_status?: string;
  types?: string[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
  };
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  reviews?: Array<{
    rating: number;
    text: string;
    time: number;
    author_name: string;
    relative_time_description: string;
  }>;
  editorial_summary?: {
    overview?: string;
  };
  price_level?: number;
  reservable?: boolean;
  serves_beer?: boolean;
  serves_breakfast?: boolean;
  serves_dinner?: boolean;
  serves_lunch?: boolean;
  serves_wine?: boolean;
  takeout?: boolean;
  delivery?: boolean;
  dine_in?: boolean;
  curbside_pickup?: boolean;
  wheelchair_accessible_entrance?: boolean;
}

interface AuditSection {
  name: string;
  score: number;
  status: 'good' | 'warning' | 'error';
  issues: string[];
  recommendations: string[];
  details?: Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { placeId, businessId } = body;
    
    // Get Google API key from request header or body
    const googleApiKey = request.headers.get('x-google-api-key') || body.googleApiKey;

    // Validate Place ID
    if (!placeId || typeof placeId !== 'string') {
      return NextResponse.json(
        { error: 'Google Place ID is required. Format: ChIJ...' },
        { status: 400 }
      );
    }

    // Validate Place ID format (should start with ChIJ or be a valid format)
    if (!placeId.startsWith('ChIJ') && !placeId.match(/^[A-Za-z0-9_-]+$/)) {
      return NextResponse.json(
        { error: 'Invalid Place ID format. Place IDs typically start with "ChIJ"' },
        { status: 400 }
      );
    }

    // If no Google API key but we have a businessId, do an audit with stored GBP data
    if (!googleApiKey && businessId) {
      const { url, anonKey } = await getSupabaseFromCookie();
      if (url && anonKey) {
        const supabase = createClient(url, anonKey);
        const { data: business } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .single();

        if (business) {
          // If we have synced GBP data, use it for a more complete audit
          if (business.gbp_data && Object.keys(business.gbp_data).length > 0) {
            return NextResponse.json(createAuditFromGBPData(business, placeId));
          }
          // Otherwise fallback to basic audit from stored data
          return NextResponse.json(createBasicAuditFromStoredData(business, placeId));
        }
      }
    }

    // Check for Google API key for full audit
    if (!googleApiKey) {
      return NextResponse.json(
        { 
          error: 'Google Places API key is required for detailed audits. Configure it in Settings > Places API, or connect your Google Business Profile for basic audits.',
          needsConfig: true 
        },
        { status: 400 }
      );
    }

    // Fetch place details from Google Places API
    const fields = [
      'name',
      'formatted_address',
      'formatted_phone_number',
      'international_phone_number',
      'website',
      'url',
      'rating',
      'user_ratings_total',
      'business_status',
      'types',
      'opening_hours',
      'photos',
      'reviews',
      'editorial_summary',
      'price_level',
      'reservable',
      'serves_beer',
      'serves_breakfast',
      'serves_dinner',
      'serves_lunch',
      'serves_wine',
      'takeout',
      'delivery',
      'dine_in',
      'curbside_pickup',
      'wheelchair_accessible_entrance',
    ].join(',');

    const placesUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=${fields}&key=${googleApiKey}`;
    
    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (placesData.status === 'REQUEST_DENIED') {
      return NextResponse.json(
        { error: 'Google API request denied. Check your API key and ensure Places API is enabled.' },
        { status: 403 }
      );
    }

    if (placesData.status === 'INVALID_REQUEST' || placesData.status === 'NOT_FOUND') {
      return NextResponse.json(
        { error: `Place not found. Status: ${placesData.status}. Verify the Place ID is correct.` },
        { status: 404 }
      );
    }

    if (placesData.status !== 'OK') {
      return NextResponse.json(
        { error: `Google API error: ${placesData.status}` },
        { status: 500 }
      );
    }

    const place: PlaceDetails = placesData.result;

    // Perform the audit
    const sections: AuditSection[] = [];

    // 1. Basic Information Audit
    const basicInfoAudit = auditBasicInfo(place);
    sections.push(basicInfoAudit);

    // 2. Contact & Website Audit
    const contactAudit = auditContact(place);
    sections.push(contactAudit);

    // 3. Photos Audit
    const photosAudit = auditPhotos(place);
    sections.push(photosAudit);

    // 4. Reviews Audit
    const reviewsAudit = auditReviews(place);
    sections.push(reviewsAudit);

    // 5. Hours & Attributes Audit
    const hoursAudit = auditHoursAndAttributes(place);
    sections.push(hoursAudit);

    // Calculate overall score
    const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
    const overallScore = Math.round(totalScore / sections.length);

    return NextResponse.json({
      score: overallScore,
      businessName: place.name,
      businessAddress: place.formatted_address,
      placeId,
      sections,
      rawData: {
        rating: place.rating,
        reviewCount: place.user_ratings_total,
        photoCount: place.photos?.length || 0,
        businessStatus: place.business_status,
        types: place.types,
      },
    });
  } catch (error) {
    console.error('GBP audit error:', error);
    return NextResponse.json(
      { error: 'Failed to run audit. Please check your Place ID and API key.' },
      { status: 500 }
    );
  }
}

// Create an audit from synced GBP data (reviews, photos, hours from GBP API)
function createAuditFromGBPData(business: Record<string, unknown>, placeId: string) {
  const sections: AuditSection[] = [];
  const address = business.address as { street?: string; city?: string; state?: string; country?: string } | null;
  const gbpData = business.gbp_data as {
    reviews?: Array<{ starRating?: string; comment?: string }>;
    photos?: Array<unknown>;
    hours?: { periods?: Array<unknown> };
    averageRating?: number;
    totalReviews?: number;
    totalPhotos?: number;
    ratingDistribution?: Record<string, number>;
    categories?: { primaryCategory?: { displayName?: string }; additionalCategories?: Array<{ displayName?: string }> };
  };

  // 1. Basic Information Section
  const basicInfoSection: AuditSection = {
    name: 'Basic Information',
    score: 100,
    status: 'good',
    issues: [],
    recommendations: [],
    details: {
      name: business.name,
      address: address ? `${address.street || ''}, ${address.city || ''}, ${address.state || ''}`.replace(/^, |, $/g, '') : 'Not set',
      status: 'Connected via GBP',
      categories: business.categories || [],
    },
  };

  if (!business.name) {
    basicInfoSection.issues.push('Business name is missing');
    basicInfoSection.score -= 20;
  }
  if (!address?.city) {
    basicInfoSection.issues.push('Address incomplete');
    basicInfoSection.score -= 15;
  }
  const categories = business.categories as string[] | undefined;
  if (!categories || categories.length === 0) {
    basicInfoSection.issues.push('No business categories set');
    basicInfoSection.score -= 15;
    basicInfoSection.recommendations.push('Add relevant business categories in GBP dashboard');
  } else if (categories.length < 3) {
    basicInfoSection.recommendations.push('Consider adding more relevant categories (up to 10)');
    basicInfoSection.score -= 5;
  }
  
  basicInfoSection.status = basicInfoSection.score >= 80 ? 'good' : basicInfoSection.score >= 60 ? 'warning' : 'error';
  sections.push(basicInfoSection);

  // 2. Contact & Website Section
  const contactSection: AuditSection = {
    name: 'Contact & Website',
    score: 100,
    status: 'good',
    issues: [],
    recommendations: [],
    details: {
      phone: business.phone || 'Not set',
      website: business.website || 'Not set',
    },
  };

  if (!business.phone) {
    contactSection.issues.push('No phone number set');
    contactSection.score -= 25;
    contactSection.recommendations.push('Add a phone number to help customers contact you');
  }
  if (!business.website) {
    contactSection.issues.push('No website linked');
    contactSection.score -= 25;
    contactSection.recommendations.push('Add your website URL to drive traffic');
  }
  
  contactSection.status = contactSection.score >= 80 ? 'good' : contactSection.score >= 60 ? 'warning' : 'error';
  sections.push(contactSection);

  // 3. Photos Section (using synced GBP data)
  const photoCount = gbpData.totalPhotos || gbpData.photos?.length || 0;
  const photosSection: AuditSection = {
    name: 'Photos',
    score: 100,
    status: 'good',
    issues: [],
    recommendations: [],
    details: {
      photoCount,
      hasPhotos: photoCount > 0,
    },
  };

  if (photoCount === 0) {
    photosSection.issues.push('No photos uploaded');
    photosSection.score = 20;
    photosSection.recommendations.push('Upload at least 10 high-quality photos');
    photosSection.recommendations.push('Include: exterior, interior, products/services, team photos');
  } else if (photoCount < 5) {
    photosSection.issues.push(`Only ${photoCount} photos (recommended: 10+)`);
    photosSection.score = 40;
    photosSection.recommendations.push('Add more photos to showcase your business');
  } else if (photoCount < 10) {
    photosSection.score = 70;
    photosSection.recommendations.push(`${photoCount} photos uploaded. Adding more can increase engagement`);
  } else if (photoCount < 20) {
    photosSection.score = 85;
    photosSection.recommendations.push('Good photo count! Consider adding seasonal photos regularly');
  } else {
    photosSection.recommendations.push('Excellent photo coverage! Keep photos updated regularly');
  }
  
  photosSection.status = photosSection.score >= 80 ? 'good' : photosSection.score >= 60 ? 'warning' : 'error';
  sections.push(photosSection);

  // 4. Reviews Section (using synced GBP data)
  const reviewCount = gbpData.totalReviews || gbpData.reviews?.length || 0;
  const rating = gbpData.averageRating || 0;
  const reviewsSection: AuditSection = {
    name: 'Reviews',
    score: 100,
    status: 'good',
    issues: [],
    recommendations: [],
    details: {
      rating: rating > 0 ? rating.toFixed(1) : 'No ratings',
      reviewCount,
      ratingDistribution: gbpData.ratingDistribution,
    },
  };

  if (reviewCount === 0) {
    reviewsSection.issues.push('No reviews yet');
    reviewsSection.score = 30;
    reviewsSection.recommendations.push('Encourage satisfied customers to leave reviews');
  } else if (reviewCount < 10) {
    reviewsSection.score = 60;
    reviewsSection.recommendations.push(`Only ${reviewCount} reviews. Aim for 25+ for credibility`);
  } else if (reviewCount < 25) {
    reviewsSection.score = 75;
    reviewsSection.recommendations.push('Good start! Continue building reviews');
  }

  if (rating > 0) {
    if (rating < 3.0) {
      reviewsSection.issues.push(`Low rating: ${rating.toFixed(1)}/5 stars`);
      reviewsSection.score -= 30;
      reviewsSection.recommendations.push('Address negative feedback urgently');
    } else if (rating < 4.0) {
      reviewsSection.issues.push(`Rating below 4 stars (${rating.toFixed(1)}/5)`);
      reviewsSection.score -= 15;
    } else if (rating >= 4.5) {
      reviewsSection.recommendations.push(`Excellent rating (${rating.toFixed(1)}/5)! Maintain this quality`);
    }
  }
  
  reviewsSection.recommendations.push('Respond to ALL reviews within 24-48 hours');
  reviewsSection.status = reviewsSection.score >= 80 ? 'good' : reviewsSection.score >= 60 ? 'warning' : 'error';
  sections.push(reviewsSection);

  // 5. Hours & Attributes Section
  const hoursSection: AuditSection = {
    name: 'Hours & Attributes',
    score: 100,
    status: 'good',
    issues: [],
    recommendations: [],
    details: {
      hasHours: !!(gbpData.hours?.periods && gbpData.hours.periods.length > 0),
      hoursCount: gbpData.hours?.periods?.length || 0,
    },
  };

  if (!gbpData.hours?.periods || gbpData.hours.periods.length === 0) {
    hoursSection.issues.push('Business hours not set');
    hoursSection.score = 50;
    hoursSection.recommendations.push('Add your business hours in GBP dashboard');
  } else if (gbpData.hours.periods.length < 7) {
    hoursSection.score = 75;
    hoursSection.recommendations.push('Ensure hours are set for all days');
  }
  
  hoursSection.recommendations.push('Keep hours updated, especially for holidays');
  hoursSection.status = hoursSection.score >= 80 ? 'good' : hoursSection.score >= 60 ? 'warning' : 'error';
  sections.push(hoursSection);

  // Calculate overall score
  const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
  const overallScore = Math.round(totalScore / sections.length);

  return {
    score: overallScore,
    businessName: business.name,
    businessAddress: address ? `${address.city}, ${address.state}` : '',
    placeId,
    sections,
    isBasicAudit: false,
    rawData: {
      rating: rating || null,
      reviewCount: reviewCount || null,
      photoCount: photoCount || null,
      businessStatus: 'CONNECTED',
      types: business.categories || [],
    },
  };
}

// Create a basic audit from stored business data (when Places API not available)
function createBasicAuditFromStoredData(business: Record<string, unknown>, placeId: string) {
  const sections: AuditSection[] = [];
  const address = business.address as { street?: string; city?: string; state?: string; country?: string } | null;
  
  // Basic Info Section
  const basicInfoSection: AuditSection = {
    name: 'Basic Information',
    score: 70,
    status: 'warning',
    issues: [],
    recommendations: [
      'Configure Google Places API for a complete audit with real-time data',
      'This is a basic audit using stored profile data'
    ],
    details: {
      name: business.name,
      address: address ? `${address.street || ''}, ${address.city || ''}, ${address.state || ''}` : 'Not set',
      status: 'Connected via GBP',
      categories: business.categories || [],
    },
  };

  if (!business.name) {
    basicInfoSection.issues.push('Business name is missing');
    basicInfoSection.score -= 20;
  }
  if (!address?.city) {
    basicInfoSection.issues.push('Address incomplete');
    basicInfoSection.score -= 10;
  }
  if (!business.categories || (business.categories as string[]).length === 0) {
    basicInfoSection.issues.push('No business categories set');
    basicInfoSection.score -= 10;
    basicInfoSection.recommendations.push('Add relevant business categories');
  }
  
  basicInfoSection.status = basicInfoSection.score >= 80 ? 'good' : basicInfoSection.score >= 60 ? 'warning' : 'error';
  sections.push(basicInfoSection);

  // Contact Section
  const contactSection: AuditSection = {
    name: 'Contact & Website',
    score: 70,
    status: 'warning',
    issues: [],
    recommendations: [],
    details: {
      phone: business.phone || 'Not set',
      website: business.website || 'Not set',
    },
  };

  if (!business.phone) {
    contactSection.issues.push('No phone number set');
    contactSection.score -= 25;
    contactSection.recommendations.push('Add a phone number');
  }
  if (!business.website) {
    contactSection.issues.push('No website linked');
    contactSection.score -= 25;
    contactSection.recommendations.push('Add your website URL');
  }
  
  contactSection.status = contactSection.score >= 80 ? 'good' : contactSection.score >= 60 ? 'warning' : 'error';
  sections.push(contactSection);

  // Photos Section (limited info without Places API)
  const photosSection: AuditSection = {
    name: 'Photos',
    score: 50,
    status: 'warning',
    issues: ['Unable to check photo count without Places API'],
    recommendations: [
      'Configure Places API to audit photo count and quality',
      'Ensure you have at least 10 high-quality photos uploaded to GBP'
    ],
    details: {
      photoCount: 'Unknown (requires Places API)',
    },
  };
  sections.push(photosSection);

  // Reviews Section (limited info without Places API)
  const reviewsSection: AuditSection = {
    name: 'Reviews',
    score: 50,
    status: 'warning',
    issues: ['Unable to check reviews without Places API'],
    recommendations: [
      'Configure Places API to see review count and ratings',
      'Regularly encourage customers to leave reviews'
    ],
    details: {
      rating: 'Unknown (requires Places API)',
      reviewCount: 'Unknown (requires Places API)',
    },
  };
  sections.push(reviewsSection);

  // Hours Section (limited info without Places API)
  const hoursSection: AuditSection = {
    name: 'Hours & Attributes',
    score: 50,
    status: 'warning',
    issues: ['Unable to verify hours without Places API'],
    recommendations: [
      'Configure Places API to verify business hours',
      'Ensure your hours are accurate and up-to-date in GBP'
    ],
    details: {
      hasHours: 'Unknown (requires Places API)',
    },
  };
  sections.push(hoursSection);

  // Calculate overall score
  const totalScore = sections.reduce((sum, s) => sum + s.score, 0);
  const overallScore = Math.round(totalScore / sections.length);

  return {
    score: overallScore,
    businessName: business.name,
    businessAddress: address ? `${address.city}, ${address.state}` : '',
    placeId,
    sections,
    isBasicAudit: true,
    basicAuditMessage: 'This is a basic audit using your stored profile data. For a complete audit with reviews, photos, and hours data, configure the Google Places API in Settings.',
    rawData: {
      rating: null,
      reviewCount: null,
      photoCount: null,
      businessStatus: 'CONNECTED',
      types: business.categories || [],
    },
  };
}

function auditBasicInfo(place: PlaceDetails): AuditSection {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check business name
  if (!place.name) {
    issues.push('Business name is missing');
    score -= 20;
  }

  // Check address
  if (!place.formatted_address) {
    issues.push('Business address is missing');
    score -= 20;
  }

  // Check business status
  if (place.business_status !== 'OPERATIONAL') {
    issues.push(`Business status is "${place.business_status}" (not operational)`);
    score -= 30;
  }

  // Check categories/types
  const typeCount = place.types?.length || 0;
  if (typeCount === 0) {
    issues.push('No business categories set');
    score -= 15;
    recommendations.push('Add relevant business categories to improve discoverability');
  } else if (typeCount < 3) {
    recommendations.push(`Only ${typeCount} categories set. Consider adding more relevant categories (up to 10)`);
    score -= 5;
  }

  // Check description/editorial summary
  if (!place.editorial_summary?.overview) {
    recommendations.push('Add a detailed business description with relevant keywords');
    score -= 10;
  }

  const status = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'error';

  return {
    name: 'Basic Information',
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
    details: {
      name: place.name,
      address: place.formatted_address,
      status: place.business_status,
      categories: place.types,
    },
  };
}

function auditContact(place: PlaceDetails): AuditSection {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check phone number
  if (!place.formatted_phone_number && !place.international_phone_number) {
    issues.push('No phone number listed');
    score -= 25;
    recommendations.push('Add a phone number to help customers contact you');
  }

  // Check website
  if (!place.website) {
    issues.push('No website linked');
    score -= 25;
    recommendations.push('Add your website URL to drive traffic and improve credibility');
  }

  // Check Google Maps URL (should always exist for valid places)
  if (!place.url) {
    issues.push('Google Maps link not available');
    score -= 10;
  }

  // If both phone and website exist, full score
  if (place.formatted_phone_number && place.website) {
    recommendations.push('Great! Both phone and website are configured');
  }

  const status = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'error';

  return {
    name: 'Contact & Website',
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
    details: {
      phone: place.formatted_phone_number || place.international_phone_number,
      website: place.website,
      mapsUrl: place.url,
    },
  };
}

function auditPhotos(place: PlaceDetails): AuditSection {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const photoCount = place.photos?.length || 0;

  if (photoCount === 0) {
    issues.push('No photos uploaded');
    score = 20;
    recommendations.push('Upload at least 10 high-quality photos');
    recommendations.push('Include: exterior, interior, products/services, team photos');
  } else if (photoCount < 5) {
    issues.push(`Only ${photoCount} photos (recommended: 10+)`);
    score = 40;
    recommendations.push('Add more photos to showcase your business');
    recommendations.push('Businesses with 10+ photos get 35% more clicks');
  } else if (photoCount < 10) {
    score = 70;
    recommendations.push(`${photoCount} photos uploaded. Adding more can increase engagement`);
    recommendations.push('Aim for at least 10 diverse, high-quality photos');
  } else if (photoCount < 20) {
    score = 85;
    recommendations.push('Good photo count! Consider adding seasonal/promotional photos regularly');
  } else {
    score = 100;
    recommendations.push('Excellent photo coverage! Keep photos updated regularly');
  }

  // Photo quality recommendations
  if (photoCount > 0) {
    recommendations.push('Ensure photos are well-lit and professionally taken');
    recommendations.push('Add photos with geo-tags for better local SEO');
  }

  const status = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'error';

  return {
    name: 'Photos',
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
    details: {
      photoCount,
      hasPhotos: photoCount > 0,
    },
  };
}

function auditReviews(place: PlaceDetails): AuditSection {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  const reviewCount = place.user_ratings_total || 0;
  const rating = place.rating || 0;

  // Check review count
  if (reviewCount === 0) {
    issues.push('No reviews yet');
    score -= 40;
    recommendations.push('Encourage satisfied customers to leave reviews');
    recommendations.push('Send follow-up emails with a direct link to your Google review page');
  } else if (reviewCount < 10) {
    score -= 20;
    recommendations.push(`Only ${reviewCount} reviews. Aim for 25+ reviews for credibility`);
  } else if (reviewCount < 25) {
    score -= 10;
    recommendations.push('Good start! Continue building reviews for better visibility');
  }

  // Check rating
  if (rating > 0) {
    if (rating < 3.0) {
      issues.push(`Low rating: ${rating}/5 stars`);
      score -= 30;
      recommendations.push('Address negative feedback and improve customer experience');
      recommendations.push('Respond professionally to all negative reviews');
    } else if (rating < 4.0) {
      issues.push(`Rating: ${rating}/5 stars (below 4-star threshold)`);
      score -= 15;
      recommendations.push('Work on improving customer satisfaction to boost ratings');
    } else if (rating < 4.5) {
      score -= 5;
      recommendations.push(`Good rating (${rating}/5)! Keep providing excellent service`);
    } else {
      recommendations.push(`Excellent rating (${rating}/5)! Maintain this quality`);
    }
  }

  // Review response recommendations
  if (reviewCount > 0) {
    recommendations.push('Respond to ALL reviews within 24-48 hours');
    recommendations.push('Thank positive reviewers and address concerns in negative reviews');
  }

  const status = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'error';

  return {
    name: 'Reviews',
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
    details: {
      rating,
      reviewCount,
      recentReviews: place.reviews?.slice(0, 3).map(r => ({
        rating: r.rating,
        text: r.text?.substring(0, 100) + (r.text && r.text.length > 100 ? '...' : ''),
        time: r.relative_time_description,
      })),
    },
  };
}

function auditHoursAndAttributes(place: PlaceDetails): AuditSection {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  // Check opening hours
  if (!place.opening_hours) {
    issues.push('Business hours not set');
    score -= 30;
    recommendations.push('Add your business hours to help customers know when to visit');
  } else if (!place.opening_hours.weekday_text || place.opening_hours.weekday_text.length < 7) {
    issues.push('Incomplete business hours');
    score -= 15;
    recommendations.push('Ensure hours are set for all days of the week');
  }

  // Check business attributes
  const attributes = [];
  if (place.delivery) attributes.push('Delivery');
  if (place.takeout) attributes.push('Takeout');
  if (place.dine_in) attributes.push('Dine-in');
  if (place.curbside_pickup) attributes.push('Curbside pickup');
  if (place.reservable) attributes.push('Reservations');
  if (place.wheelchair_accessible_entrance) attributes.push('Wheelchair accessible');

  if (attributes.length === 0) {
    recommendations.push('Add business attributes (delivery, takeout, reservations, accessibility)');
    score -= 10;
  } else if (attributes.length < 3) {
    recommendations.push(`${attributes.length} attributes set. Consider adding more relevant attributes`);
    score -= 5;
  }

  // Service options for restaurants/food
  const isFood = place.types?.some(t => 
    ['restaurant', 'food', 'cafe', 'bakery', 'bar'].includes(t)
  );
  
  if (isFood) {
    if (!place.serves_breakfast && !place.serves_lunch && !place.serves_dinner) {
      recommendations.push('Specify meal types served (breakfast, lunch, dinner)');
      score -= 5;
    }
  }

  const status = score >= 80 ? 'good' : score >= 60 ? 'warning' : 'error';

  return {
    name: 'Hours & Attributes',
    score: Math.max(0, score),
    status,
    issues,
    recommendations,
    details: {
      hasHours: !!place.opening_hours,
      hours: place.opening_hours?.weekday_text,
      attributes,
      isCurrentlyOpen: place.opening_hours?.open_now,
    },
  };
}
