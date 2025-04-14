import {
  AirportNoise,
  NearbyPlanningApplication,
  PlanningApplication,
  PremiumStreetDataResponse,
  ProcessedPremiumDataStatus,
  ProcessedPremiumStreetData,
} from "@/types/premiumStreetData";
import { calculateRemainingLeaseTerm } from "@/utils/dateCalculations";

/**
 * Processes raw premium street data and query status into a structured format.
 * Safely extracts relevant fields, handling potential null or undefined values.
 */
export const processPremiumStreetData = (
  rawData: PremiumStreetDataResponse | undefined,
  queryStatus: ProcessedPremiumDataStatus
): ProcessedPremiumStreetData => {
  const attributes = rawData?.data?.attributes;

  const estimatedSaleValue =
    attributes?.estimated_values?.[0]?.estimated_market_value_rounded ?? null;
  const estimatedRentalValue =
    attributes?.estimated_rental_value?.estimated_monthly_rental_value ?? null;
  const estimatedAnnualRentalYield =
    attributes?.estimated_rental_value?.estimated_annual_rental_yield ?? null;
  const propensityToSell = attributes?.propensity_to_sell_score ?? null;
  const propensityToLet = attributes?.propensity_to_let_score ?? null;
  const outcodeMarketActivity =
    attributes?.market_statistics?.outcode?.count_total_properties_sold_last_12_months ?? null;
  const premiumLeaseEndDate = attributes?.tenure?.lease_details?.calculated_end_of_lease ?? null;
  const constructionAgeBand = attributes?.construction_age_band ?? null;
  const occupancyStatus = attributes?.occupancy?.occupancy_type ?? null;
  const conservationAreaStatus = attributes?.localities?.conservation_area ?? null;
  const airportNoiseAssessment = (attributes?.airport_noise as AirportNoise) ?? null;
  const nationalParkProximity = attributes?.localities?.national_park ?? null;
  const policeForceProximity = attributes?.localities?.police_force ?? null;
  const propertyPlanningApplications =
    (attributes?.planning_applications as PlanningApplication[]) ?? null;
  const nearbyPlanningApplications =
    (attributes?.nearby_planning_applications as NearbyPlanningApplication[]) ?? null;
  const outcodeAvgSalesPrice =
    attributes?.market_statistics?.outcode?.average_price_properties_sold_last_12_months ?? null;
  const { formatted: formattedPremiumLeaseTerm, totalMonths: premiumLeaseTotalMonths } =
    calculateRemainingLeaseTerm(premiumLeaseEndDate);
  const constructionMaterials = {
    walls: attributes?.energy_performance?.walls_description ?? null,
    roof: attributes?.energy_performance?.roof_description ?? null,
    floor: attributes?.energy_performance?.floor_description ?? null,
    windows: attributes?.energy_performance?.windows_description ?? null,
  };

  const titleDeedIssues = null; // Placeholder - requires specific logic/source
  const detailedFloodRiskAssessment = null; // Placeholder - requires specific logic/source
  const mobileServiceCoverage = null; // Placeholder - requires specific logic/source
  const healthcareProximity = null; // Placeholder - requires specific logic/source
  const trainStationProximity = null; // Placeholder - requires specific logic/source
  const schoolProximity = null; // Placeholder - requires specific logic/source

  return {
    status: queryStatus,
    estimatedSaleValue,
    estimatedRentalValue,
    estimatedAnnualRentalYield,
    propensityToSell,
    propensityToLet,
    outcodeMarketActivity,
    premiumLeaseEndDate,
    formattedPremiumLeaseTerm,
    premiumLeaseTotalMonths,
    constructionMaterials,
    constructionAgeBand,
    titleDeedIssues,
    conservationAreaStatus,
    detailedFloodRiskAssessment,
    airportNoiseAssessment,
    nationalParkProximity,
    policeForceProximity,
    mobileServiceCoverage,
    propertyPlanningApplications,
    nearbyPlanningApplications,
    occupancyStatus,
    healthcareProximity,
    trainStationProximity,
    schoolProximity,
    outcodeAvgSalesPrice,
  };
};
