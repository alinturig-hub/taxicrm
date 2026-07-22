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

export interface BookingWorkspaceData {
  id: string;
  provider: string;
  externalId: string;
  status: string;

  customerName: string | null;
  telephoneNumber: string | null;
  customerEmail: string | null;

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
