import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3002/api/v1';

/** Returns a 503 when the API backend is down instead of crashing with 500. */
function apiUnavailable() {
  return NextResponse.json(
    { message: 'API service unavailable. Please try again shortly.' },
    { status: 503 },
  );
}

function buildUrl(slug: string[], searchParams: URLSearchParams) {
  const path = slug.join('/');
  return `${API_BASE_URL}/${path}?${searchParams.toString()}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const url = buildUrl(slug, request.nextUrl.searchParams);

  try {
    // Use redirect:'manual' so Node.js fetch doesn't follow the API's 302 and
    // try to parse a binary/HTML body as JSON. Instead we read the Location
    // header from the API response and redirect the browser to it directly.
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      redirect: 'manual',
    } as RequestInit);

    // Forward 3xx redirects (e.g. digital file download) straight to the browser.
    // response.status is accessible even on opaque redirects when redirect:'manual'.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        return NextResponse.redirect(location, { status: response.status });
      }
    }

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return apiUnavailable();
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const url = buildUrl(slug, request.nextUrl.searchParams);
  const body = await request.text();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return apiUnavailable();
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const url = buildUrl(slug, request.nextUrl.searchParams);
  const body = await request.text();

  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return apiUnavailable();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  const url = buildUrl(slug, request.nextUrl.searchParams);

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch {
    return apiUnavailable();
  }
}
