import { NextRequest, NextResponse } from 'next/server';

const API_PORT = '3002';
const API_BASE_URL = `http://localhost:${API_PORT}/api/v1`;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${API_BASE_URL}/${path}?${searchParams.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${API_BASE_URL}/${path}?${searchParams.toString()}`;

  const body = await request.text();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${API_BASE_URL}/${path}?${searchParams.toString()}`;

  const body = await request.text();

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body,
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join('/');
  const searchParams = request.nextUrl.searchParams;
  const url = `${API_BASE_URL}/${path}?${searchParams.toString()}`;

  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
