import {
  NearbyPlanningApplication,
  PlanningApplication,
  PremiumStreetDataResponse,
  ProcessedPremiumDataStatus,
  ProcessedPremiumStreetData,
} from "@/types/premiumStreetData";
import { RightOfWayDetails } from "@/types/property";
import { calculateRemainingLeaseTerm } from "@/utils/dateCalculations";

/**
 * Processes raw premium street data and query status into a structured format.
 * Safely extracts relevant fields, handling potential null or undefined values.
 */
export const processPremiumStreetData = (
  rawData: PremiumStreetDataResponse | undefined,
  queryStatus: ProcessedPremiumDataStatus,
  askingPrice: number | null
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
  const conservationAreaDetails = {
    conservationAreaDataAvailable: attributes?.localities?.conservation_area_data_available ?? null,
    conservationArea: attributes?.localities?.conservation_area ?? null,
  };
  const airportNoiseAssessment = attributes?.airport_noise ?? null;
  const policeForceProximity = attributes?.localities?.police_force ?? null;
  const propertyPlanningApplications =
    (attributes?.planning_applications as PlanningApplication[]) ?? null;
  const nearbyPlanningApplications =
    (attributes?.nearby_planning_applications as NearbyPlanningApplication[]) ?? null;
  const outcodeAvgSalesPrice =
    attributes?.market_statistics?.outcode?.average_price_properties_sold_last_12_months ?? null;
  const outcodeTotalProperties =
    attributes?.market_statistics?.outcode?.count_of_properties ?? null;
  const outcodeIdentifier = attributes?.market_statistics?.outcode?.outcode ?? null;
  const { formatted: formattedPremiumLeaseTerm, totalMonths: premiumLeaseTotalMonths } =
    calculateRemainingLeaseTerm(premiumLeaseEndDate);

  // Calculate Turnover Rate (as decimal)
  const outcodeTurnoverRate =
    outcodeMarketActivity !== null && outcodeTotalProperties !== null && outcodeTotalProperties > 0
      ? outcodeMarketActivity / outcodeTotalProperties
      : null;

  const constructionMaterials = {
    walls: attributes?.energy_performance?.walls_description ?? null,
    roof: attributes?.energy_performance?.roof_description ?? null,
    floor: attributes?.energy_performance?.floor_description ?? null,
    windows: attributes?.energy_performance?.windows_description ?? null,
    heating: attributes?.energy_performance?.mainheat_description ?? null,
  };
  const restrictiveCovenants = attributes?.restrictive_covenants ?? null;
  const detailedFloodRiskAssessment = attributes?.flood_risk ?? null;
  const mobileServiceCoverage = attributes?.mobile_service_coverage ?? null;
  const transport = attributes?.transport ?? null;
  const schoolProximity = attributes?.education ?? null;

  const coastalErosionRisk = attributes?.coastal_erosion ?? null;
  const rawPublicRightOfWay = attributes?.right_of_way ?? null;

  // Map the raw premium RoW data to the RightOfWayDetails structure
  const mappedPublicRoW: RightOfWayDetails | null = (() => {
    if (!rawPublicRightOfWay) return null;

    const exists = rawPublicRightOfWay.has_public_right_of_way;
    if (exists === null || exists === undefined) return null; // Cannot determine existence

    const details = rawPublicRightOfWay.right_of_way_details?.[0]; // Get the first detail if available

    return {
      exists: exists,
      distance: details?.distance ?? null,
      date_updated: details?.date_updated ?? null,
      parish: details?.parish ?? null,
      route_no: details?.route_no ?? null,
      row_type: details?.row_type ?? null,
    };
  })();

  // Calculate Asking Price vs Estimate Difference

  let askingVsEstimatePercentage: number | null = null;
  let askingVsEstimateAbsolute: number | null = null;

  if (estimatedSaleValue !== null && askingPrice !== null && askingPrice > 0) {
    askingVsEstimateAbsolute = estimatedSaleValue - askingPrice;
    askingVsEstimatePercentage = (askingVsEstimateAbsolute / askingPrice) * 100;
  }

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
    conservationAreaDetails,
    detailedFloodRiskAssessment,
    airportNoiseAssessment,
    policeForceProximity,
    mobileServiceCoverage,
    propertyPlanningApplications,
    nearbyPlanningApplications,
    occupancyStatus,
    transport,
    schoolProximity,
    outcodeAvgSalesPrice,
    outcodeTotalProperties,
    outcodeIdentifier,
    outcodeTurnoverRate,
    restrictiveCovenants,
    coastalErosionRisk,
    publicRightOfWay: rawPublicRightOfWay,
    askingVsEstimatePercentage,
    askingVsEstimateAbsolute,
    publicRightOfWayObligation: mappedPublicRoW,
  };
};
