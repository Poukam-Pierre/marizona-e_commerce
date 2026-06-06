import { Metadata } from 'next';
import { Suspense } from 'react';
import OrderTrackingContent, {
  TrackingSkeleton,
} from './order-tracking-content';

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={<TrackingSkeleton />}>
      <OrderTrackingContent />
    </Suspense>
  );
}
