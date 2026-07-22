export interface BookingLocation {
  address: string;
  latitude: number | null;
  longitude: number | null;
  zoneId: string | null;
  zoneName: string | null;
}

export interface BookingVia {
  id: string;
  position: number;
  address: string;
  latitude: number | null;
  longitude: number | null;
  zoneId: string | null;
  zoneName: string | null;
}

export interface BookingTimelineEvent {
  id: string;
  eventType: string;
  title: string;
  description: string | null;
  source: string;
  occurredAt: string;
}

export interface CustomerRecentBooking {
  id: string;
  externalId: string;
  status: string;
  bookedAtTime: string | null;
  pickupDueTime: string | null;
  pickupAddress: string | null;
  destinationAddress: string | null;
  price: number | null;
  fare: number | null;
  paymentType: string | null;
  bookingSource: string | null;
}

export interface CustomerIntelligence {
  name: string | null;
  telephoneNumber: string | null;
  email: string | null;
  totalBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  totalValue: number;
  averageBookingValue: number;
  lastBookingAt: string | null;
  recentBookings: CustomerRecentBooking[];
}

export interface BookingWorkspaceData {
  id: string;
  provider: string;
  externalId: string;
  status: string;

  customerName: string | null;
  telephoneNumber: string | null;
  customerEmail: string | null;

  customer?: CustomerIntelligence;

  pickupDueTime: string | null;
  dropOffDueTime: string | null;
  bookedAtTime: string | null;

  pickup: BookingLocation | null;
  destination: BookingLocation | null;
  vias: BookingVia[];

  passengers: number;
  luggage: number;

  fare: number | null;
  price: number | null;
  cost: number | null;

  distance: number | null;
  estimatedDistance: number | null;
  estimatedPrice: number | null;

  paymentType: string | null;
  accountName: string | null;
  companyName: string | null;

  driverNote: string | null;
  officeNote: string | null;

  bookingSource: string | null;
  ourReference: string | null;

  timeline: BookingTimelineEvent[];

  createdAt: string;
  updatedAt: string;
}
