# TaxiCRM Domain Model

Version: 1.0

---

# Core Business Entities

## Customer

Represents a passenger or account customer.

Owns:

- Booking History
- Customer Intelligence
- Behaviour Patterns
- Lifetime Value
- Customer KPIs

---

## Driver

Represents a licensed driver.

Owns:

- Shift History
- Performance
- Revenue
- Acceptance Rate
- Reject Analysis
- Driver KPIs

---

## Vehicle

Represents a fleet vehicle.

Owns:

- Utilisation
- Mileage
- Revenue
- Maintenance History

---

## Booking

Represents one customer journey.

Owns:

- Timeline
- Financial Data
- Journey Data
- Operational Events

---

## Company

Represents the taxi business.

Owns:

- Revenue
- Costs
- KPIs
- Targets
- AI Recommendations

---

## Zone

Represents an operational area.

Owns:

- Demand
- Supply
- Revenue
- Performance

---

# Relationship

Customer

↓

Booking

↓

Driver

↓

Vehicle

↓

Zone

↓

Company

Every booking connects the entire business together.
