import { EpcBandResult } from "@/sidepanel/propertychecklist/epcImageUtils";
import { ExtractedEpcData } from "@/utils/pdfProcessingUtils";
import React from "react";

export enum DataStatus {
  FOUND_POSITIVE = "FOUND_POSITIVE",
  FOUND_NEGATIVE = "FOUND_NEGATIVE",
  NOT_APPLICABLE = "NOT_APPLICABLE",
  ASK_AGENT = "ASK_AGENT",
  IS_LOADING = "IS_LOADING",
}

export interface PropertyDataList {
  label: string;
  status: DataStatus;
  value: React.ReactNode;
  key: string;
  group: string;
  selected?: boolean;
  askAgentMessage: string;
  toolTipExplainer: string | React.ReactNode;
  epcBandData?: EpcBandResult;
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
  confidence: EpcConfidence;
  source: EpcDataSourceType;
  error?: string | null;
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
  listedProperty: PropertyItem;
  listingHistory: string | null;
  address: {
    displayAddress: string | null;
    postcode: string | null;
    isAddressConfirmedByUser: boolean;
  };
  miningImpact: PropertyItem;
  parking: string | null;
  privateRightOfWayObligation: boolean | null;
  propertyType: string | null;
  publicRightOfWayObligation: boolean | null;
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
}

export interface SaleHistoryEntry {
  year: string;
  soldPrice: string;
  percentageChange: string;
}

export const EpcConfidenceLevels = {
  HIGH: "High",
  MEDIUM: "Medium",
  USER_PROVIDED: "UserProvided",
  NONE: "None",
} as const;

export type EpcConfidence = (typeof EpcConfidenceLevels)[keyof typeof EpcConfidenceLevels];
