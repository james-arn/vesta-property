import { ChecklistKey } from "@/constants/checklistKeys";
import { DashboardScoreCategory } from "@/constants/dashboardScoreCategoryConsts";
import { EpcProcessorResult } from "@/lib/epcProcessing";
import { EpcBandResult } from "@/sidepanel/propertychecklist/epcImageUtils";
import { ExtractedEpcData } from "@/utils/pdfProcessingUtils";
import React from "react";
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
  confidence?: Confidence | null;
  isUnlockedWithPremium: boolean;
  isBoostedWithPremium: boolean;
  restrictiveCovenants?: RestrictiveCovenant[] | null;
  publicRightOfWay?: RightOfWayDetails | null;
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

export const EpcDataSourceType = {
  LISTING: "Listing",
  PDF: "PDF",
  IMAGE: "Image",
  NONE: "None",
} as const;

export type EpcDataSourceType = (typeof EpcDataSourceType)[keyof typeof EpcDataSourceType];

export interface EpcData {
  url: string | null;
  displayUrl?: string | null;
  scores: EpcBandResult | ExtractedEpcData | null;
  value: string | null;
  confidence: Confidence;
  source: EpcDataSourceType;
  error?: string | null;
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

export interface ExtractedPropertyScrapingData {
  propertyId: string | null;
  accessibility: string | null;
  agent: AgentDetails | null;
  bathrooms: string | null;
  bedrooms: string | null;
  broadband: string | null;
  buildingSafety: PropertyItem;
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
  address: {
    displayAddress: string | null;
    postcode: string | null;
    isAddressConfirmedByUser: boolean;
  };
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
  locationCoordinates: {
    lat: number | null;
    lng: number | null;
  };
  leaseTerm: string | null;
  groundRent: string | null;
  serviceCharge: number | null;
  nearestStations: Station[];
  nearbySchools: NearbySchool[];
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
  NONE: "None",
} as const;

export type Confidence = (typeof ConfidenceLevels)[keyof typeof ConfidenceLevels];

export interface DashboardScore {
  scoreValue: number; // The calculated score value
  maxScore: number; // The maximum possible score for normalisation (e.g., 100)
  scoreLabel: string; // A qualitative label (e.g., "Good", "High", "Band C")
}

export interface CategoryScoreData {
  score: DashboardScore;
  contributingItems: PropertyDataListItem[];
  warningMessages: string[]; // Array of warnings for missing data affecting score reliability
}

export type DashboardScores = {
  [key in DashboardScoreCategory]?: CategoryScoreData;
};

export enum ScoreQuality {
  GOOD = "GOOD",
  AVERAGE = "AVERAGE",
  POOR = "POOR",
  UNKNOWN = "UNKNOWN",
}

export interface PreprocessedData {
  isPreprocessedDataLoading: boolean;
  preprocessedDataError: Error | null;
  processedEpcResult: EpcProcessorResult | null;
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
}
