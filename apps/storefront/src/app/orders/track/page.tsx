'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  ClipboardPaste,
  MapPin,
  Package,
  Search,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecentOrder {
  id: string;
  orderNumber: string;
  trackingUrl: string;
  createdAt: string; // ISO string
}

const STORAGE_KEY = 'recent-orders';
const MAX_STORED = 10;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function loadRecentOrders(): RecentOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as RecentOrder[]).slice(0, MAX_STORED);
  } catch {
    return [];
  }
}

/** Exported so checkout page can call it after creating an order. */
export function saveRecentOrder(order: RecentOrder) {
  try {
    const existing = loadRecentOrders().filter((o) => o.id !== order.id);
    const updated = [order, ...existing].slice(0, MAX_STORED);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

/** Parse a tracking URL and validate that it contains an order id + token. */
function parseTrackingUrl(rawInput: string): string | null {
  try {
    // Accept both a full URL and a relative path like /orders/id?token=...
    const base =
      typeof window !== 'undefined' ? window.location.origin : 'http://x';
    const url = rawInput.startsWith('/')
      ? new URL(rawInput, base)
      : new URL(rawInput);
    const parts = url.pathname.split('/').filter(Boolean);
    // Must be /orders/<id> (track sub-path is excluded)
    if (parts[0] !== 'orders' || !parts[1] || parts[1] === 'track') return null;
    const token = url.searchParams.get('token');
    if (!token) return null;
    // Return the canonical relative path so navigation stays on same origin
    return `/orders/${parts[1]}?token=${encodeURIComponent(token)}`;
  } catch {
    return null;
  }
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function TrackOrderPage() {
  const router = useRouter();
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRecentOrders(loadRecentOrders());
  }, []);

  const handleGo = () => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please paste your tracking link first.');
      return;
    }
    const path = parseTrackingUrl(trimmed);
    if (!path) {
      setError(
        'That doesn\'t look like a valid tracking link. Make sure you copied the full URL from your order confirmation.',
      );
      return;
    }
    router.push(path);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInput(text);
      setError(null);
      inputRef.current?.focus();
    } catch {
      // Clipboard access denied — user can type manually
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-xl px-4 py-8 space-y-6">

        {/* ── Back nav ── */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to store
        </Link>

        {/* ── Heading ── */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Track your order</h1>
            <p className="text-sm text-muted-foreground">
              Use your tracking link to check order status and download digital products.
            </p>
          </div>
        </div>

        {/* ── Recent orders (from this device) ── */}
        {recentOrders.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Recent orders on this device
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              {recentOrders.map((order, i) => (
                <div key={order.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">
                        Order <span className="text-primary">#{order.orderNumber}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(order.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <Link href={order.trackingUrl}>
                      <Button size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                        View order
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                  {i < recentOrders.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Paste link lookup ── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              Paste your tracking link
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="tracking-link" className="text-sm">
                Tracking link
              </Label>
              <div className="flex gap-2">
                <Input
                  id="tracking-link"
                  ref={inputRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleGo()}
                  placeholder="https://… or /orders/…?token=…"
                  className="flex-1 font-mono text-xs"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Paste from clipboard"
                  onClick={handlePaste}
                >
                  <ClipboardPaste className="h-4 w-4" />
                </Button>
              </div>
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800 px-3 py-2 mt-1">
                  <TriangleAlert className="h-3.5 w-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 dark:text-red-300">{error}</p>
                </div>
              )}
            </div>
            <Button className="w-full gap-2" onClick={handleGo}>
              <Search className="h-4 w-4" />
              Find my order
            </Button>
          </CardContent>
        </Card>

        {/* ── Where to find the link ── */}
        <div className="rounded-xl border border-dashed p-4 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            Where is my tracking link?
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary font-semibold">1.</span>
              Check the order confirmation screen — a <strong>Track your order</strong> button appeared right after you placed your order.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-semibold">2.</span>
              Look in your browser history for a URL containing <code className="text-[10px] bg-muted px-1 py-0.5 rounded">/orders/…?token=</code>.
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-semibold">3.</span>
              If you used WhatsApp checkout, the link may have been included in the message you sent.
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
