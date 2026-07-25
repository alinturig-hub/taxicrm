import { processBookingCreatedWebhook } from "@/lib/autocab/process-booking-created";

export const AUTOCAB_EVENT_CATEGORIES = [
  "BOOKING",
  "DRIVER",
  "VEHICLE",
  "SYSTEM",
] as const;

export type AutocabEventCategory =
  (typeof AUTOCAB_EVENT_CATEGORIES)[number];

export const AUTOCAB_EVENT_STAGES = [
  "CREATED",
  "DISPATCHED",
  "ACCEPTED",
  "ARRIVED",
  "POB",
  "COMPLETED",
  "NO_FARE",
  "CANCELLED",
  "REJECTED",
  "CONTEXT",
] as const;

export type AutocabEventStage =
  (typeof AUTOCAB_EVENT_STAGES)[number];

export type AutocabEventHandler = (
  webhookEventId: string,
) => Promise<void>;

export type AutocabEventDefinition = {
  eventType: string;
  title: string;
  description: string;
  category: AutocabEventCategory;
  stage: AutocabEventStage;
  createSnapshot: boolean;
  createTimeline: boolean;
  aiRelevant: boolean;
  handler?: AutocabEventHandler;
};

const eventDefinitions = [
  {
    eventType: "BookingCreated",
    title: "Booking Created",
    description: "Booking created in Autocab.",
    category: "BOOKING",
    stage: "CREATED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
    handler: processBookingCreatedWebhook,
  },
  {
    eventType: "BookingDispatched",
    title: "Booking Dispatched",
    description: "Booking dispatched to a driver.",
    category: "BOOKING",
    stage: "DISPATCHED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingDispatchAccepted",
    title: "Dispatch Accepted",
    description: "Driver accepted the booking dispatch.",
    category: "BOOKING",
    stage: "ACCEPTED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingArrived",
    title: "Driver Arrived",
    description: "Driver arrived at the pickup location.",
    category: "BOOKING",
    stage: "ARRIVED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingPOB",
    title: "Passenger On Board",
    description: "Passenger boarded the vehicle.",
    category: "BOOKING",
    stage: "POB",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingComplete",
    title: "Booking Completed",
    description: "Booking completed successfully.",
    category: "BOOKING",
    stage: "COMPLETED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingNoFare",
    title: "No Fare",
    description: "Booking ended without a fare.",
    category: "BOOKING",
    stage: "NO_FARE",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingCancelled",
    title: "Booking Cancelled",
    description: "Booking was cancelled.",
    category: "BOOKING",
    stage: "CANCELLED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingRejected",
    title: "Booking Rejected",
    description: "Booking dispatch was rejected.",
    category: "BOOKING",
    stage: "REJECTED",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "BookingModified",
    title: "Booking Modified",
    description: "Booking details were modified.",
    category: "BOOKING",
    stage: "CONTEXT",
    createSnapshot: true,
    createTimeline: true,
    aiRelevant: true,
  },
  {
    eventType: "VehicleTracksChanged",
    title: "Vehicle Tracking Updated",
    description: "Vehicle tracking information changed.",
    category: "VEHICLE",
    stage: "CONTEXT",
    createSnapshot: false,
    createTimeline: false,
    aiRelevant: true,
  },
  {
    eventType: "DriverShiftStartedEnded",
    title: "Driver Shift Updated",
    description: "Driver shift state changed.",
    category: "DRIVER",
    stage: "CONTEXT",
    createSnapshot: false,
    createTimeline: false,
    aiRelevant: true,
  },
] satisfies AutocabEventDefinition[];

export const AUTOCAB_EVENT_REGISTRY = new Map<
  string,
  AutocabEventDefinition
>(
  eventDefinitions.map((definition) => [
    definition.eventType,
    definition,
  ]),
);

export function getAutocabEventDefinition(
  eventType: string,
): AutocabEventDefinition | null {
  return AUTOCAB_EVENT_REGISTRY.get(eventType) ?? null;
}

export function isRegisteredAutocabEvent(
  eventType: string,
): boolean {
  return AUTOCAB_EVENT_REGISTRY.has(eventType);
}
