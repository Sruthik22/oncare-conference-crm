import { NextResponse } from 'next/server';

const APOLLO_API_URL = process.env.NEXT_PUBLIC_APOLLO_API_URL;
const APOLLO_API_KEY = process.env.NEXT_PUBLIC_APOLLO_API_KEY;

if (!APOLLO_API_KEY) {
  console.error('Missing Apollo API key in environment variables');
}

export async function POST(request: Request) {
  if (!APOLLO_API_KEY) {
    return NextResponse.json(
      { error: 'Apollo API key is not configured' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { endpoint, method = 'GET', data, params } = body;

    // Remove any leading slashes from the endpoint and api/v1 if present
    const cleanEndpoint = endpoint.replace(/^\/+/, '').replace(/^api\/v1\//, '');
    
    // Build URL with query parameters if they exist
    const searchParams = new URLSearchParams(params);
    const queryString = params ? `?${searchParams.toString()}` : '';
    const url = `${APOLLO_API_URL}/${cleanEndpoint}${queryString}`;

    const headers = {
      'x-api-key': APOLLO_API_KEY,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'accept': 'application/json'
    };

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (data) {
      fetchOptions.body = JSON.stringify(data);
    }

    const response = await fetch(url, fetchOptions);
    let responseData;
    const responseText = await response.text();
    
    try {
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error('Failed to parse Apollo API response:', {
        status: response.status,
        text: responseText.substring(0, 1000), // Log first 1000 chars in case of large response
        error: parseError,
        url
      });
      return NextResponse.json(
        { 
          error: 'Invalid response from Apollo API',
          details: {
            status: response.status,
            text: responseText.substring(0, 1000),
            parseError: parseError instanceof Error ? parseError.message : String(parseError)
          }
        },
        { status: 500 }
      );
    }

    if (!response.ok) {
      console.error('Apollo API error response:', {
        status: response.status,
        data: responseData,
        url
      });
      return NextResponse.json(
        { 
          error: responseData?.message || 'Apollo API request failed',
          details: {
            status: response.status,
            data: responseData,
            url
          }
        },
        { status: response.status }
      );
    }

    if (!responseData) {
      return NextResponse.json(
        { 
          error: 'Empty response from Apollo API',
          details: {
            url,
            status: response.status
          }
        },
        { status: 500 }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Apollo API error:', {
      error,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: {
          stack: error instanceof Error ? error.stack : undefined,
          type: error instanceof Error ? error.constructor.name : typeof error
        }
      },
      { status: 500 }
    );
  }
} 