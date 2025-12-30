/**
 * GBP Scoring System
 * 
 * Calculates scores for different aspects of a Google Business Profile
 * based on completeness and optimization best practices.
 */

export interface GBPScoreBreakdown {
  profileInfo: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      hasName: boolean;
      hasDescription: boolean;
      hasCategory: boolean;
      hasPhone: boolean;
      hasWebsite: boolean;
      hasAddress: boolean;
    };
  };
  reviews: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      averageRating: number;
      totalReviews: number;
      responseRate: number;
      recentReviews: number;
    };
  };
  photos: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      totalPhotos: number;
      hasCoverPhoto: boolean;
      hasLogoPhoto: boolean;
      photoCategories: string[];
    };
  };
  posts: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      totalPosts: number;
      postsLast30Days: number;
      lastPostDate: string | null;
    };
  };
  products: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      totalProducts: number;
      productsWithPhotos: number;
      productsWithDescriptions: number;
    };
  };
  services: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      totalServices: number;
      servicesWithDescriptions: number;
    };
  };
  qAndA: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      totalQuestions: number;
      answeredQuestions: number;
      ownerAnswers: number;
    };
  };
  attributes: {
    score: number;
    maxScore: number;
    issues: string[];
    recommendations: string[];
    details: {
      hasHours: boolean;
      hasPaymentMethods: boolean;
      hasAccessibility: boolean;
      hasAmenities: boolean;
      totalAttributes: number;
    };
  };
}

export interface GBPData {
  name?: string;
  description?: string;
  categories?: {
    primaryCategory?: { displayName?: string };
    additionalCategories?: Array<{ displayName?: string }>;
  };
  phone?: string;
  website?: string;
  address?: Record<string, unknown>;
  reviews?: Array<{
    starRating?: string;
    createTime?: string;
    reviewReply?: { comment?: string };
  }>;
  photos?: Array<{
    mediaFormat?: string;
    googleUrl?: string;
    category?: string; // COVER, LOGO, EXTERIOR, INTERIOR, PRODUCT, TEAM, etc.
    locationAssociation?: { category?: string };
  }>;
  posts?: Array<{
    createTime?: string;
    topicType?: string;
    summary?: string;
    callToAction?: unknown;
  }>;
  products?: Array<{
    productDescription?: string;
    name?: string;
    media?: unknown[];
  }>;
  services?: Array<{
    displayName?: string;
    description?: string;
    structuredServiceItem?: { serviceTypeId?: string; description?: string };
    freeFormServiceItem?: { label?: { displayName?: string; description?: string } };
  }>;
  questions?: Array<{
    author?: string;
    text?: string;
    topAnswers?: Array<{ author?: { type?: string }; text?: string }>;
  }>;
  attributes?: {
    profile?: { description?: string };
    openInfo?: unknown;
    serviceItems?: unknown[];
    [key: string]: unknown;
  };
  hours?: {
    periods?: Array<unknown>;
  };
  averageRating?: number;
  totalReviews?: number;
  totalPhotos?: number;
  totalProducts?: number;
  totalServices?: number;
}

// Weights for overall score calculation
const SCORE_WEIGHTS = {
  profileInfo: 20,
  reviews: 20,
  photos: 15,
  posts: 15,
  products: 10,
  services: 5,
  qAndA: 10,
  attributes: 5,
};

export function calculateGBPScore(data: GBPData): {
  overallScore: number;
  breakdown: GBPScoreBreakdown;
  status: 'excellent' | 'good' | 'needs_work' | 'poor';
} {
  const breakdown: GBPScoreBreakdown = {
    profileInfo: calculateProfileScore(data),
    reviews: calculateReviewsScore(data),
    photos: calculatePhotosScore(data),
    posts: calculatePostsScore(data),
    products: calculateProductsScore(data),
    services: calculateServicesScore(data),
    qAndA: calculateQAScore(data),
    attributes: calculateAttributesScore(data),
  };

  // Calculate weighted overall score
  let overallScore = 0;
  let totalWeight = 0;

  for (const [key, weight] of Object.entries(SCORE_WEIGHTS)) {
    const section = breakdown[key as keyof GBPScoreBreakdown];
    const sectionScore = section.maxScore > 0 
      ? (section.score / section.maxScore) * 100 
      : 0;
    overallScore += sectionScore * weight;
    totalWeight += weight;
  }

  overallScore = Math.round(overallScore / totalWeight);

  let status: 'excellent' | 'good' | 'needs_work' | 'poor';
  if (overallScore >= 85) status = 'excellent';
  else if (overallScore >= 70) status = 'good';
  else if (overallScore >= 50) status = 'needs_work';
  else status = 'poor';

  return { overallScore, breakdown, status };
}

function calculateProfileScore(data: GBPData): GBPScoreBreakdown['profileInfo'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 6;

  const hasName = !!data.name;
  // Check description in multiple places - root level or in attributes.profile
  const hasDescription = !!(
    data.description || 
    (data.attributes?.profile as { description?: string })?.description
  );
  const hasCategory = !!data.categories?.primaryCategory?.displayName;
  const hasPhone = !!data.phone;
  const hasWebsite = !!data.website;
  const hasAddress = !!data.address && Object.keys(data.address).length > 0;

  if (hasName) score++;
  else issues.push('Business name is missing');

  if (hasDescription) score++;
  else {
    issues.push('Business description is missing');
    recommendations.push('Add a detailed business description with relevant keywords (750 characters recommended)');
  }

  if (hasCategory) score++;
  else {
    issues.push('Primary category is not set');
    recommendations.push('Set your primary business category and add relevant secondary categories');
  }

  if (hasPhone) score++;
  else {
    issues.push('Phone number is missing');
    recommendations.push('Add your business phone number');
  }

  if (hasWebsite) score++;
  else {
    issues.push('Website URL is missing');
    recommendations.push('Add your business website URL');
  }

  if (hasAddress) score++;
  else {
    issues.push('Business address is incomplete');
    recommendations.push('Complete your business address details');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { hasName, hasDescription, hasCategory, hasPhone, hasWebsite, hasAddress },
  };
}

function calculateReviewsScore(data: GBPData): GBPScoreBreakdown['reviews'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 10;

  const reviews = data.reviews || [];
  const totalReviews = reviews.length;
  const averageRating = data.averageRating || 0;
  
  // Count reviews with responses
  const reviewsWithResponses = reviews.filter(r => r.reviewReply?.comment).length;
  const responseRate = totalReviews > 0 ? Math.round((reviewsWithResponses / totalReviews) * 100) : 0;
  
  // Count recent reviews (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentReviews = reviews.filter(r => {
    if (!r.createTime) return false;
    return new Date(r.createTime) > thirtyDaysAgo;
  }).length;

  // Score for rating
  if (averageRating >= 4.5) score += 3;
  else if (averageRating >= 4.0) score += 2;
  else if (averageRating >= 3.5) score += 1;
  else if (averageRating > 0) {
    issues.push(`Average rating (${averageRating.toFixed(1)}) is below 3.5`);
    recommendations.push('Focus on improving customer satisfaction to boost your rating');
  }

  // Score for volume
  if (totalReviews >= 50) score += 3;
  else if (totalReviews >= 20) score += 2;
  else if (totalReviews >= 5) score += 1;
  else {
    issues.push(`Only ${totalReviews} reviews - aim for at least 20`);
    recommendations.push('Encourage satisfied customers to leave reviews');
  }

  // Score for response rate
  if (responseRate >= 90) score += 2;
  else if (responseRate >= 70) score += 1;
  else {
    issues.push(`Response rate (${responseRate}%) is below 70%`);
    recommendations.push('Respond to all reviews, especially negative ones');
  }

  // Score for recent activity
  if (recentReviews >= 5) score += 2;
  else if (recentReviews >= 2) score += 1;
  else {
    issues.push('Not enough recent reviews');
    recommendations.push('Implement a review generation strategy for consistent new reviews');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { averageRating, totalReviews, responseRate, recentReviews },
  };
}

function calculatePhotosScore(data: GBPData): GBPScoreBreakdown['photos'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 6;

  const photos = data.photos || [];
  const totalPhotos = data.totalPhotos || photos.length;
  
  // Check for specific photo types - check both category and locationAssociation.category
  const getPhotoCategory = (p: GBPData['photos'][number]) => 
    p.category || p.locationAssociation?.category;
  
  const hasCoverPhoto = photos.some(p => getPhotoCategory(p) === 'COVER');
  // Logo can be LOGO or PROFILE category (Google uses both)
  const hasLogoPhoto = photos.some(p => {
    const cat = getPhotoCategory(p);
    return cat === 'LOGO' || cat === 'PROFILE';
  });
  const photoCategories = [...new Set(photos.map(p => getPhotoCategory(p)).filter(Boolean))];

  // Score for quantity
  if (totalPhotos >= 25) score += 3;
  else if (totalPhotos >= 10) score += 2;
  else if (totalPhotos >= 5) score += 1;
  else {
    issues.push(`Only ${totalPhotos} photos - Google recommends at least 10`);
    recommendations.push('Add more high-quality photos of your business (interior, exterior, team, products)');
  }

  // Score for cover photo
  if (hasCoverPhoto) score += 1;
  else {
    issues.push('Cover photo is not set');
    recommendations.push('Upload a compelling cover photo that represents your business');
  }

  // Score for logo
  if (hasLogoPhoto) score += 1;
  else {
    issues.push('Logo photo is not set');
    recommendations.push('Upload your business logo');
  }

  // Score for variety
  if (photoCategories.length >= 4) score += 1;
  else {
    issues.push('Limited variety in photo types');
    recommendations.push('Add photos in different categories: interior, exterior, team, products/services');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { totalPhotos, hasCoverPhoto, hasLogoPhoto, photoCategories },
  };
}

function calculatePostsScore(data: GBPData): GBPScoreBreakdown['posts'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 5;

  const posts = data.posts || [];
  const totalPosts = posts.length;
  
  // Count posts from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const postsLast30Days = posts.filter(p => {
    if (!p.createTime) return false;
    return new Date(p.createTime) > thirtyDaysAgo;
  }).length;

  // Find last post date
  let lastPostDate: string | null = null;
  if (posts.length > 0 && posts[0]?.createTime) {
    lastPostDate = posts[0].createTime;
  }

  // Score for recent activity
  if (postsLast30Days >= 8) score += 3; // 2+ per week
  else if (postsLast30Days >= 4) score += 2; // 1 per week
  else if (postsLast30Days >= 1) score += 1;
  else {
    issues.push('No posts in the last 30 days');
    recommendations.push('Post updates at least weekly - share offers, events, or news');
  }

  // Score for total posts
  if (totalPosts >= 20) score += 2;
  else if (totalPosts >= 5) score += 1;
  else {
    issues.push(`Only ${totalPosts} total posts`);
    recommendations.push('Build a consistent posting schedule to improve engagement');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { totalPosts, postsLast30Days, lastPostDate },
  };
}

function calculateProductsScore(data: GBPData): GBPScoreBreakdown['products'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 4;

  const products = data.products || [];
  const totalProducts = data.totalProducts || products.length;
  const productsWithPhotos = products.filter(p => p.media && Array.isArray(p.media) && p.media.length > 0).length;
  const productsWithDescriptions = products.filter(p => p.productDescription || p.name).length;

  // Score for having products
  if (totalProducts >= 10) score += 2;
  else if (totalProducts >= 3) score += 1;
  else if (totalProducts === 0) {
    issues.push('No products listed');
    recommendations.push('Add your products/services with detailed descriptions');
  }

  // Score for completeness
  if (totalProducts > 0) {
    if (productsWithPhotos === totalProducts) score += 1;
    else {
      issues.push(`${totalProducts - productsWithPhotos} products missing photos`);
      recommendations.push('Add photos to all products');
    }

    if (productsWithDescriptions === totalProducts) score += 1;
    else {
      issues.push(`${totalProducts - productsWithDescriptions} products missing descriptions`);
      recommendations.push('Add detailed descriptions to all products');
    }
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { totalProducts, productsWithPhotos, productsWithDescriptions },
  };
}

function calculateServicesScore(data: GBPData): GBPScoreBreakdown['services'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 3;

  const services = data.services || [];
  const totalServices = data.totalServices || services.length;
  
  // Check for descriptions - services can have multiple formats
  const servicesWithDescriptions = services.filter(s => 
    s.description || 
    s.structuredServiceItem?.description || 
    s.freeFormServiceItem?.label?.description
  ).length;

  // Score for having services
  if (totalServices >= 5) score += 2;
  else if (totalServices >= 1) score += 1;
  else {
    issues.push('No services listed');
    recommendations.push('List your services with detailed descriptions');
  }

  // Score for completeness
  if (totalServices > 0 && servicesWithDescriptions === totalServices) {
    score += 1;
  } else if (totalServices > 0) {
    issues.push(`${totalServices - servicesWithDescriptions} services missing descriptions`);
    recommendations.push('Add descriptions to all services');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { totalServices, servicesWithDescriptions },
  };
}

function calculateQAScore(data: GBPData): GBPScoreBreakdown['qAndA'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 4;

  const questions = data.questions || [];
  const totalQuestions = questions.length;
  const answeredQuestions = questions.filter(q => q.topAnswers && q.topAnswers.length > 0).length;
  const ownerAnswers = questions.filter(q => 
    q.topAnswers?.some(a => a.author?.type === 'MERCHANT')
  ).length;

  // Score for having Q&A
  if (totalQuestions >= 10) score += 1;
  else if (totalQuestions >= 3) score += 0.5;

  // Score for answer rate
  if (totalQuestions > 0) {
    const answerRate = answeredQuestions / totalQuestions;
    if (answerRate >= 0.9) score += 1;
    else if (answerRate >= 0.7) score += 0.5;
    else {
      issues.push('Low Q&A response rate');
      recommendations.push('Answer all customer questions promptly');
    }
  }

  // Score for owner participation
  if (totalQuestions > 0) {
    const ownerParticipation = ownerAnswers / totalQuestions;
    if (ownerParticipation >= 0.8) score += 2;
    else if (ownerParticipation >= 0.5) score += 1;
    else {
      issues.push('Low owner participation in Q&A');
      recommendations.push('Proactively answer questions as the business owner');
    }
  } else {
    // Seed Q&A with common questions
    recommendations.push('Seed your Q&A section with common questions and answers');
    score += 0; // Neutral if no questions
  }

  return {
    score: Math.round(score),
    maxScore,
    issues,
    recommendations,
    details: { totalQuestions, answeredQuestions, ownerAnswers },
  };
}

function calculateAttributesScore(data: GBPData): GBPScoreBreakdown['attributes'] {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let score = 0;
  const maxScore = 4;

  const hours = data.hours;
  const attributes = data.attributes || {};
  
  const hasHours = !!(hours?.periods && hours.periods.length > 0);
  const hasPaymentMethods = !!attributes['payment'];
  const hasAccessibility = !!attributes['accessibility'];
  const hasAmenities = !!attributes['amenities'];
  const totalAttributes = Object.keys(attributes).length;

  if (hasHours) score += 1;
  else {
    issues.push('Business hours not set');
    recommendations.push('Set your business hours including special hours');
  }

  if (totalAttributes >= 10) score += 2;
  else if (totalAttributes >= 5) score += 1;
  else {
    issues.push(`Only ${totalAttributes} attributes set`);
    recommendations.push('Fill out all relevant business attributes (payment methods, accessibility, amenities)');
  }

  if (hasPaymentMethods || hasAccessibility || hasAmenities) score += 1;
  else {
    recommendations.push('Add payment methods, accessibility features, and amenities');
  }

  return {
    score,
    maxScore,
    issues,
    recommendations,
    details: { hasHours, hasPaymentMethods, hasAccessibility, hasAmenities, totalAttributes },
  };
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'excellent': return 'text-emerald-600';
    case 'good': return 'text-blue-600';
    case 'needs_work': return 'text-amber-600';
    case 'poor': return 'text-red-600';
    default: return 'text-slate-600';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-red-600';
}

export function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

