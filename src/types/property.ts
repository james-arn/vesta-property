import { ChecklistKey } from "@/constants/checklistKeys";
import {
  CALCULATED_STATUS,
  DashboardScoreCategory,
} from "@/constants/dashboardScoreCategoryConsts";
import { EpcBandResult } from "@/sidepanel/propertychecklist/Epc/epcImageUtils";
import { ExtractedEpcData } from "@/utils/pdfProcessingUtils";
import React from "react";
import { GovEpcValidationMatch } from "./govEpcCertificate";
import {
  ListedBuilding,
  ProcessedPremiumStreetData,
  RestrictiveCovenant,
} from "./premiumStreetData";
import { Station } from "./rightmovePageModel";

export enum DataStatus {
  FOUND_POSITIVE = "FOUND_POSITIVE",
  FOUND_NEGATIVE = "FOUND_NEGATIVE",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  ASK_AGENT = "ASK_AGENT",
  IS_LOADING = "IS_LOADING",
}

export interface PropertyDataListItem {
  label: string;
  status: DataStatus;
  value: React.ReactNode;
  key: ChecklistKey;
  checklistGroup: string;
  selected?: boolean;
  askAgentMessage: string;
  toolTipExplainer: string | React.ReactNode;
  epcBandData?: EpcBandResult;
  epcImageUrl?: string | null;
  confidence?: Confidence | null;
  isUnlockedWithPremium: boolean;
  isBoostedWithPremium: boolean;
  isExpectedInListing: boolean;
  restrictiveCovenants?: RestrictiveCovenant[] | null;
  publicRightOfWay?: RightOfWayDetails | null;
  epcSource?: EpcDataSourceType | null;
}

export interface AgentDetails {
  name: string;
  contactUrl: string;
  phoneNumber: string | null;
}

export interface PropertyItem {
  value: string | null;
  status: DataStatus | null;
  reason: string | null;
}

export enum EpcDataSourceType {
  NONE = "None",
  LISTING = "Listing", // From the initial scrape if EPC is directly on page
  PDF = "PDF", // From PDF OCR
  IMAGE = "Image", // From Image (e.g. EPC graph) OCR
  GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS = "GOV_FIND_EPC_SERVICE_BASED_ON_ADDRESS", // Here we found this property's address (or a very similar one) uniquely on the GOV EPC register, and this is the EPC data directly from that official record.".
  USER_PROVIDED = "USER_PROVIDED", // EPC chosen from user
  GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH = "GOV_EPC_SERVICE_AND_OCR_FILE_EPC_MATCH", // This source signifies that the EPC rating from a local file (OCR'd PDF/Image) was successfully
  // matched with the EPC rating of a unique property found on the GOV EPC Register's list for the postcode.
  PREMIUM_API = "PremiumAPI", // EPC data sourced from the premium API
}

export enum AddressSourceType {
  NONE = "None",
  INITIAL_SCRAPE = "InitialScrape", // Address as initially scraped from the listing
  HOUSE_PRICES_PAGE_MATCH = "HousePricesPageMatch", // Address confirmed via the house prices page (most reliable)
  GOV_FIND_EPC_SERVICE_CONFIRMED = "GOV_FIND_EPC_SERVICE_CONFIRMED", // Address confirmed as part of a GOV EPC lookup
  USER_PROVIDED = "UserProvided", // Address manually entered or confirmed by the user
  REVERSE_GEOCODE = "ReverseGeocode", // Address suggested by reverse geocoding
}

export interface EpcData {
  value: string | null;
  confidence: Confidence | null;
  url?: string | null;
  displayUrl?: string | null;
  validUntil?: string | null;
  certificateUrl?: string | null;
  isExpired?: boolean | null;
  error?: string | null;
  automatedProcessingResult: EpcBandResult | ExtractedEpcData | null;
  source: EpcDataSourceType;
  dataSourceType?: EpcDataSourceType | null;
}

export interface NearbySchool {
  name: string;
  type: string | null; // e.g., "State School", "Independent School"
  ratingBody: string | null; // e.g., "Ofsted"
  ratingLabel: string | null; // e.g., "Outstanding", "Requires improvement"
  distance: number | null; // Numerical distance value
  unit: string | null; // e.g., "miles"
}

export type RightOfWayRowType = string | null;

export interface RightOfWayDetails {
  distance: number | null;
  date_updated: string | null; // Assuming date format string
  parish: string | null;
  route_no: string | null;
  row_type: RightOfWayRowType;
  exists?: boolean;
}

export interface Address {
  displayAddress: string | null;
  postcode: string | null;
  isAddressConfirmedByUser: boolean;
  confirmedBuilding?: string | null;
  confirmedStreet?: string | null;
  confirmedTown?: string | null;
  confirmedPostcode?: string | null;
  addressConfidence?: Confidence | null;
  govEpcRegisterSuggestions?: GovEpcValidationMatch[] | null;
  source?: AddressSourceType | null;
}

export interface AddressLookupInputData {
  targetSaleYear: string | null;
  targetSalePrice: string | null;
  targetBedrooms: number | null;
  nearbySoldPropertiesPath: string | null;
}

export interface ExtractedPropertyScrapingData {
  propertyId: string | null;
  accessibility: string | null;
  agent: AgentDetails | null;
  bathrooms: string | null;
  bedrooms: string | null;
  broadband: string | null;
  coastalErosion: PropertyItem;
  copyLinkUrl: string | null;
  councilTax: string | null;
  epc: EpcData;
  floodedInLastFiveYears: boolean | null;
  floodDefences: boolean | null;
  floodSources: string[] | null;
  floorPlan: string | null;
  garden: string | null;
  heating: string | null;
  isRental: boolean;
  listedProperty: ListedBuilding[] | null;
  listingHistory: string | null;
  address: Address;
  miningImpact: PropertyItem;
  miningImpactStatus: boolean | null;
  parking: string | null;
  privateRightOfWayObligation: boolean | null;
  propertyType: string | null;
  publicRightOfWayObligation: RightOfWayDetails | null;
  restrictions: boolean | null;
  salePrice: string | null;
  salesHistory: {
    priceDiscrepancy: PropertyItem;
    compoundAnnualGrowthRate: number | null;
    volatility: string | null;
  };
  size: string | null;
  tenure: string | null;
  windows: string | null;
  locationCoordinates: { lat: number | null; lng: number | null };
  leaseTerm: string | null;
  groundRent: string | null;
  serviceCharge: number | null;
  nearestStations: Station[];
  nearbySchools: NearbySchool[];
  addressLookupInputs?: AddressLookupInputData | null;
}

export interface SaleHistoryEntry {
  year: string;
  soldPrice: string;
  percentageChange: string;
}

export const ConfidenceLevels = {
  HIGH: "High",
  MEDIUM: "Medium",
  USER_PROVIDED: "UserProvided",
  GOV_FIND_EPC_SERVICE_CONFIRMED: "GOV_FIND_EPC_SERVICE_CONFIRMED",
  NONE: "None",
} as const;

export type Confidence = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export interface DashboardScore {
  scoreValue: number; // The calculated score value
  maxScore: number; // The maximum possible score for normalisation (e.g., 100)
  scoreLabel: string; // A qualitative label (e.g., "Good", "High", "Band C")
}

// Define possible calculation statuses
export type ScoreCalculationStatus = (typeof CALCULATED_STATUS)[keyof typeof CALCULATED_STATUS];

export interface CategoryScoreData {
  score: DashboardScore | null; // Allow null if score truly cannot be determined
  contributingItems: PropertyDataListItem[];
  warningMessages?: string[];
  calculationStatus: ScoreCalculationStatus; // Uses the derived type
}

export type DashboardScores = { [key in DashboardScoreCategory]?: CategoryScoreData };

export enum ScoreQuality {
  GOOD = "GOOD",
  AVERAGE = "AVERAGE",
  POOR = "POOR",
  UNKNOWN = "UNKNOWN",
}

export interface PreprocessedData {
  isPreprocessedDataLoading: boolean;
  preprocessedDataError: Error | null;
  finalEpcBandData: EpcBandResult | undefined;
  processedPremiumData: ProcessedPremiumStreetData | null;
  finalEpcValue: string | null;
  finalEpcConfidence: Confidence | null;
  finalEpcSource: EpcDataSourceType | null;
  epcScoreForCalculation: number | null;
  calculatedLeaseMonths: number | null;
  nearbySchoolsScoreValue: number | null;
  broadbandScoreValue: number | null;
  broadbandDisplayValue: string | null;
  broadbandStatus: DataStatus | null;
  miningImpactStatus: boolean | null;
  conservationAreaDetails: {
    conservationAreaDataAvailable: boolean | null;
    conservationArea: string | null;
  } | null;
  listingHistoryStatus: DataStatus | null;
  listingHistoryDisplayValue: string | null;
  listingDaysOnMarket: number | null;
  publicRightOfWayObligation: RightOfWayDetails | null;
  privateRightOfWayObligation: boolean | null;
  listedProperty: ListedBuilding[] | null;
  restrictiveCovenants: RestrictiveCovenant[] | null;
  rawFloodDefences: boolean | null;
  rawFloodSources: string[] | null;
  rawFloodedInLastFiveYears: boolean | null;
}
