import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    // Demo data - in production, this would fetch and analyze the actual page
    const demoResult = {
      score: 68,
      title: {
        text: 'Sample Business - Best Services in San Francisco',
        length: 47,
        status: 'good',
      },
      meta_description: {
        text: 'We provide the best local services in San Francisco. Contact us today for a free quote.',
        length: 89,
        status: 'warning',
      },
      headings: {
        h1_count: 1,
        h2_count: 4,
        status: 'good',
      },
      images: {
        total: 8,
        missing_alt: 2,
        status: 'warning',
      },
      links: {
        internal: 12,
        external: 5,
        broken: 0,
      },
      performance: {
        lcp: 2.4,
        fid: 45,
        cls: 0.08,
      },
      local_schema: {
        present: false,
        type: '',
      },
      recommendations: [
        'Add LocalBusiness schema markup to improve local search visibility',
        'Extend meta description to 150-160 characters',
        'Add alt text to all images for better accessibility and SEO',
        'Include city/neighborhood names in H2 headings',
        'Add more internal links to service pages',
        'Consider adding customer testimonials with review schema',
      ],
    };

    return NextResponse.json(demoResult);
  } catch (error) {
    console.error('On-page audit error:', error);
    return NextResponse.json(
      { error: 'Failed to run audit' },
      { status: 500 }
    );
  }
}





