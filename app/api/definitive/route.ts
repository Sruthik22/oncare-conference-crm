import { NextResponse } from 'next/server';

// Definitive API base URL
const DEFINITIVE_API_URL = 'https://api.defhc.com/v4';

// Credentials from environment variables
const DEFINITIVE_USERNAME = process.env.DEFINITIVE_USERNAME;
const DEFINITIVE_PASSWORD = process.env.DEFINITIVE_PASSWORD;

// Check if credentials are present
if (!DEFINITIVE_USERNAME || !DEFINITIVE_PASSWORD) {
  console.error('Missing Definitive API credentials in environment variables');
}

// Function to get an access token
async function getDefinitiveToken() {
  try {
    const tokenUrl = `${DEFINITIVE_API_URL}/token`;
    
    // Prepare the form data
    const formData = new URLSearchParams();
    formData.append('grant_type', 'password');
    formData.append('username', DEFINITIVE_USERNAME as string);
    formData.append('password', DEFINITIVE_PASSWORD as string);
    
    // Make the token request
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });
    
    if (!response.ok) {
      console.error('Failed to get Definitive API token:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`Failed to get token: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error('Error getting Definitive API token:', error);
    throw error;
  }
}

export async function POST(request: Request) {
  // Check if credentials are available
  if (!DEFINITIVE_USERNAME || !DEFINITIVE_PASSWORD) {
    return NextResponse.json(
      { error: 'Definitive API credentials are not configured' },
      { status: 500 }
    );
  }

  try {
    // Get the access token
    const accessToken = await getDefinitiveToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Failed to obtain Definitive API token' },
        { status: 500 }
      );
    }
    
    // Process the API request
    const body = await request.json();
    const { endpoint, method = 'GET', data, params } = body;

    // Remove any leading slashes from the endpoint
    const cleanEndpoint = endpoint.replace(/^\/+/, '');
    
    // Build URL with query parameters if they exist
    const searchParams = new URLSearchParams(params);
    const queryString = params ? `?${searchParams.toString()}` : '';
    const url = `${DEFINITIVE_API_URL}/${cleanEndpoint}${queryString}`;

    const headers = {
      'Authorization': `Bearer ${accessToken}`,
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
      responseData = responseText ? JSON.parse(responseText) : {};
    } catch (e) {
      // If it's not JSON, return the raw text
      console.error('Definitive API response is not JSON:', responseText);
      responseData = responseText;
    }

    if (!response.ok) {
      console.error('Definitive API request failed:', response.status, responseText);
      return NextResponse.json(
        {
          error: 'Definitive API request failed',
          status: response.status,
          details: responseData,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error proxying to Definitive API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 