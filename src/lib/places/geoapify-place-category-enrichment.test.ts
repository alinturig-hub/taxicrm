import assert from "node:assert/strict";

import {
  inferPlaceCategoryFromName,
} from "./geoapify-place-category-enrichment";

const cases: Array<{
  name: string;
  expected: string | null;
}> = [
  {
    name:
      "Plymouth Railway Station",
    expected:
      "public_transport.train",
  },
  {
    name:
      "Karak Chaii",
    expected:
      "catering.cafe",
  },
  {
    name:
      "Crowne Plaza",
    expected:
      "accommodation.hotel",
  },
  {
    name:
      "Moxy Hotel",
    expected:
      "accommodation.hotel",
  },
  {
    name:
      "Marks & Spencer",
    expected:
      "commercial.department_store",
  },
  {
    name:
      "Tesco",
    expected:
      "commercial.supermarket",
  },
  {
    name:
      "Torpoint Ferry",
    expected:
      "public_transport.ferry",
  },
  {
    name:
      "Disabled Car Park",
    expected:
      "parking",
  },
  {
    name:
      "InPost",
    expected:
      "service.post",
  },
  {
    name:
      "Mannamead Hair Care & Beauty",
    expected:
      "service.beauty.hairdresser",
  },
  {
    name:
      "Devonport High School for Boys",
    expected:
      "education.school",
  },
  {
    name:
      "Happy Days Nursery & Preschool",
    expected:
      "childcare",
  },
  {
    name:
      "Orthopaedic & Rheumatology Outpatients",
    expected:
      "healthcare",
  },
  {
    name:
      "Laira Diesel Depot",
    expected:
      "industrial",
  },
  {
    name:
      "Looseleigh Lane",
    expected:
      null,
  },
];

for (const testCase of cases) {
  assert.equal(
    inferPlaceCategoryFromName(
      testCase.name,
    ),
    testCase.expected,
    testCase.name,
  );
}

assert.equal(
  inferPlaceCategoryFromName(
    null,
    undefined,
    "",
  ),
  null,
  "Empty place data must not be classified.",
);

console.log(
  "Place-name fallback classification tests passed.",
);
