import {
  ConfidenceLevels,
  EpcDataSourceType,
  ExtractedPropertyScrapingData,
} from "@/types/property";

export const emptyPropertyData: ExtractedPropertyScrapingData = {
  salePrice: null,
  address: {
    displayAddress: null,
    postcode: null,
    isAddressConfirmedByUser: false,
  },
  bedrooms: null,
  bathrooms: null,
  councilTax: null,
  size: null,
  propertyType: null,
  propertyId: null,
  tenure: null,
  parking: null,
  heating: null,
  floorPlan: null,
  garden: null,
  epc: {
    url: null,
    automatedProcessingResult: null,
    value: null,
    confidence: ConfidenceLevels.NONE,
    source: EpcDataSourceType.NONE,
    error: null,
  },
  broadband: null,
  listingHistory: null,
  windows: null,
  publicRightOfWayObligation: null,
  privateRightOfWayObligation: null,
  listedProperty: null,
  restrictions: null,
  floodDefences: null,
  floodSources: null,
  floodedInLastFiveYears: null,
  accessibility: null,
  agent: null,
  copyLinkUrl: null,
  isRental: false,
  salesHistory: {
    priceDiscrepancy: {
      value: null,
      status: null,
      reason: null,
    },
    compoundAnnualGrowthRate: null,
    volatility: null,
  },
  buildingSafety: {
    value: null,
    status: null,
    reason: null,
  },
  coastalErosion: {
    value: null,
    status: null,
    reason: null,
  },
  miningImpact: {
    value: null,
    status: null,
    reason: null,
  },
  miningImpactStatus: null,
  locationCoordinates: {
    lat: null,
    lng: null,
  },
  leaseTerm: null,
  groundRent: null,
  serviceCharge: null,
  nearestStations: [],
  nearbySchools: [],
};
