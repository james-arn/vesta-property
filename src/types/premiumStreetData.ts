import { EpcData, Address as PropertyAddress, RightOfWayDetails } from "./property";

export interface AddressMatchData {
  id: string;
  type: "property";
  attributes: PropertyAttributes;
}

export interface AddressMatchMeta {
  address_match_confidence: number; // Float between 0 and 1
  request_cost_gbp: number;
  balance_gbp: number;
}

export interface PropertyTransaction {
  transaction_id: string;
  date: string; // ISO date
  price: number;
  is_new_build: boolean;
  meta: {
    data_type: "actual" | "predicted";
    source: string;
    attribution_string: string | null;
  };
}

export interface PropertyValueEstimate {
  month: number;
  year: number;
  estimated_market_value: number;
  estimated_market_value_rounded: number;
}

export interface RentalEstimate {
  estimated_monthly_rental_value: number;
  estimated_annual_rental_yield: number;
}

export interface BroadbandAvailability {
  broadband_type: string | null;
  maximum_predicted_download_speed: number | null;
  maximum_predicted_upload_speed: number | null;
}

export interface Connectivity {
  mobile_service_coverage?: MobileServiceCoverageItem[] | null;
  broadband_availability?: BroadbandAvailability[] | null;
}

export interface PropertyAttributes {
  street_group_property_id: string | null;
  address: Address | null;
  airport_noise: AirportNoise | null;
  localities: Localities | null;
  identities: Identities | null;
  location: GeoPointLocation | null;
  property_type: PropertyTypeObject | null;
  construction_age_band: string | null;
  tenure: Tenure | null;
  occupancy: Occupancy | null;
  ownership: Ownership | null;
  title_deeds: TitleDeeds | null;
  planning_applications?: PlanningApplication[] | null;
  nearby_planning_applications?: NearbyPlanningApplication[] | null;
  market_statistics?: MarketStatisticsWrapper | null;
  transactions?: PropertyTransaction[];
  estimated_values?: PropertyValueEstimate[];
  estimated_rental_value?: RentalEstimate;
  propensity_to_sell_score?: number;
  propensity_to_let_score?: number;
  energy_performance?: EnergyPerformance | null;
  flood_risk?: FloodRisk | null;
  connectivity?: Connectivity | null;
  education?: Education | null;
  transport?: Transport | null;
  restrictive_covenants?: RestrictiveCovenant[] | null;
  coastal_erosion?: CoastalErosion | null;
  right_of_way?: RightOfWay | null;
  plot: Plot | null;
  listed_buildings_on_plot?: ListedBuilding[] | null;
  internal_area_square_metres?: number | null;
}

export interface Address {
  royal_mail_format: RoyalMailFormat;
  street_group_format: StreetGroupFormat;
  simplified_format: SimplifiedFormat;
  is_none_residential: boolean;
  premiumLeaseEndDate: string | null;
  formattedPremiumLeaseTerm: string | null;
  premiumLeaseTotalMonths: number | null;
  constructionMaterials: ConstructionMaterials | null;
  constructionAgeBand: string | null;
  titleDeedIssues: unknown | null;
  conservationAreaStatus: string | null;
  detailedFloodRiskAssessment: FloodRisk | null;
  airportNoiseAssessment: AirportNoise | null;
  nationalParkProximity: string | null;
  schoolProximity: Education | null;
  outcodeAvgSalesPrice: number | null;
  restrictiveCovenants: RestrictiveCovenant[] | null;
  coastalErosionRisk: CoastalErosion | null;
}

export interface RoyalMailFormat {
  organisation_name: string | null;
  department_name: string | null;
  building_number: string | null;
  building_name: string | null;
  sub_building_name: string | null;
  thoroughfare: string | null;
  dependent_thoroughfare: string | null;
  dependent_locality: string | null;
  double_dependent_locality: string | null;
  post_town: string | null;
  postcode: string;
}

export interface StreetGroupFormat {
  address_lines: string;
  postcode: string;
}

export interface SimplifiedFormat {
  house_number: string;
  street: string | null;
  locality: string | null;
  town: string | null;
  postcode: string;
}

export interface AirportNoise {
  area: string;
  assessment_date: string; // ISO date string
  level: number;
  category:
    | "None"
    | "Minimal"
    | "Occasional"
    | "Regular"
    | "Frequent"
    | "High"
    | "Very High"
    | "Extremely High";
  description: string;
  assessment: string;
}

export interface Localities {
  // Flag indicating if conservation area data is available for this property's local authority.
  conservation_area_data_available: boolean;
  conservation_area: string | null;
  ward: string | null;
  local_authority: string | null;
  county: string | null;
  country: string | null;
  parliamentary_constituency_name: string | null;
  national_park: string | null;
  police_force: string | null;
  primary_care_organisation: string | null;
  rural_urban_classification: string | null;
}

export interface Identities {
  street_group_property_id: string;
  royal_mail: RoyalMailIdentifiers;
  ordnance_survey: OrdnanceSurveyIdentifiers | null;
}

export interface RoyalMailIdentifiers {
  udprn: string | null;
  umprn: number | null;
}

export interface OrdnanceSurveyIdentifiers {
  uprn: string | null;
  parent_uprn: string | null;
  usrn: string | null;
  os_topo_toid: string | null;
  os_address_toid: string | null;
  os_roadlink_toid: string | null;
}

export interface GeoPointLocation {
  coordinates: {
    longitude: number;
    latitude: number;
  };
  type?: "property" | "postcode" | "polygon" | null;
}

export interface PropertyTypeObject {
  value:
    | "Detached"
    | "Semi-Detached"
    | "Terraced"
    | "Flats/Maisonettes"
    | "Commercial"
    | "Non-Residential"
    | "Other"
    | null;
  meta: {
    data_type: "actual" | "predicted";
    source?: string | null;
    attribution_string?: string | null;
  } | null;
}

export interface Tenure {
  tenure_type: "freehold" | "leasehold" | null;
  tenure_type_predicted: boolean | null;
  lease_details: LeaseDetails;
  meta: {
    data_type: "actual" | "predicted";
    source?: string | null;
    attribution_string?: string | null;
  } | null;
}

export interface LeaseDetails {
  date_of_lease: string | null;
  lease_term: string | null;
  formatted_lease_term?: string | null;
  calculated_start_of_lease?: string | null;
  calculated_end_of_lease?: string | null;
  lease_term_in_days?: number | null;
  remaining_lease_term_in_days?: number | null;
}

export interface Occupancy {
  owner_occupied: boolean;
  occupancy_type: "Rented (private)" | "Rented (social)" | "Owner-occupied";
}

export interface Ownership {
  company_owned: boolean;
  overseas_owned: boolean;
  social_housing: boolean;
}

export interface TitleDeeds {
  titles: Title[];
  meta: {
    data_type: "actual" | "predicted";
    source?: string | null;
    attribution_string?: string | null;
  };
}

export interface Title {
  title_number: string;
  class_of_title: string | null;
  estate_interest: string | null;
  polygons: TitlePolygon[];
}

export interface TitlePolygon {
  polygon_id: string;
  date_polygon_created: string;
  date_polygon_updated: string;
  epsg_4326_polygon: PolygonModel | MultiPolygonModel | null;
  epsg_27700_polygon: OSGBPolygonModel | OSGBMultiPolygonModel | null;
  polygon_contains_property: boolean;
  boundary_area_square_metres: number;
  distance_from_property: number;
}

export interface PolygonModel {
  type: "Polygon";
  coordinates: number[][][];
}

export interface MultiPolygonModel {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export interface OSGBPolygonModel {
  type: "Polygon"; // Assuming it's always Polygon based on example
  coordinates: number[][][]; // Array of rings, each ring is an array of [x, y] points
}

export interface OSGBMultiPolygonModel {
  type: string;
  coordinates: number[][][];
}

export interface PlanningApplication {
  reference_number: string;
  url: string;
  description: string;
  status: string;
  validated_date: string | null;
  received_date: string | null;
  decision: string | null;
  decision_date: string | null;
  appeal_status: string | null;
  appeal_decision: string | null;
  additional_dates: PlanningDatesObject;
}

export interface PlanningDatesObject {
  actual_committee_date: string | null;
  agreed_extension_to_statutory_determination_deadline: string | null;
  application_received_date: string | null;
  application_validated_date: string | null;
  decision_issued_date: string | null;
  decision_made_date: string | null;
  decision_printed_date: string | null;
  last_advertised_in_press_date: string | null;
  last_site_notice_posted_date: string | null;
  latest_advertisement_expiry_date: string | null;
  latest_neighbour_consultation_date: string | null;
  latest_site_notice_expiry_date: string | null;
  latest_statutory_consultee_consultation_date: string | null;
  neighbour_comments_should_be_submitted_by_date: string | null;
  overall_consultation_expiry_date: string | null;
  permission_expiry_date: string | null;
  statutory_consultee_consultation_expiry_date: string | null;
  target_date: string | null;
}

export interface NearbyPlanningApplication extends PlanningApplication {
  street_group_property_id: string;
  address: string;
  postcode: string;
  council: string;
  location: GeoPointLocation;
  distance_in_metres: number;
}

export interface MarketStatisticsWrapper {
  outcode: {
    count_of_properties: number;
    count_total_properties_sold_last_12_months: number;
    average_price_properties_sold_last_12_months: number;
    sales_yearly: { year: number; count_of_sales: number; average_price: number }[];
    outcode: string;
    local_authority: string;
    national: MarketStatisticsNational;
  };
  local_authority: {
    count_of_properties: number;
    count_total_properties_sold_last_12_months: number;
    average_price_properties_sold_last_12_months: number;
    sales_yearly: { year: number; count_of_sales: number; average_price: number }[];
    outcode: string;
    local_authority: string;
    national: MarketStatisticsNational;
  };
  national: MarketStatisticsNational;
}

export interface MarketStatisticsNational {
  count_of_properties: number;
  country: string;
  // Additional market statistics fields may be added here.
}

// --- New Flood Risk Types Start ---

export interface FloodRiskDetailMeta {
  data_type: "actual" | "predicted" | string | null;
  source: string | null;
  attribution_string: string | null;
}

export interface FloodRiskDetail {
  risk: string | null;
  risk_interpretation: string | null;
  risk_suitability?: string | null; // Optional as not present in surface_water
  meta: FloodRiskDetailMeta | null;
}

export interface FloodRisk {
  rivers_and_seas: FloodRiskDetail | null;
  surface_water: FloodRiskDetail | null;
}

export interface MobileServiceCoverageItem {
  network: string | null;
  // enum is 0 - 4 - 4 being excellent, 0 being no coverage
  data_indoor_4g: number | null;
  data_outdoor_4g: number | null;
  data_indoor_no_4g: number | null;
  data_outdoor_no_4g: number | null;
  voice_indoor_4g: number | null;
  voice_outdoor_4g: number | null;
  voice_indoor_no_4g: number | null;
  voice_outdoor_no_4g: number | null;
}

export interface ProcessedMobileServiceCoverageWithScoreAndLabel {
  mobileServiceCoverageArray: MobileServiceCoverageItem[];
  mobileCoverageScore: number | null;
  mobileCoverageLabel: string | null;
}

export interface EnvironmentalImpact {
  current_impact: number;
  potential_impact: number;
}

export interface EnergyEfficiency {
  current_rating: string | null;
  potential_rating: string | null;
  current_efficiency: number | null;
  potential_efficiency: number | null;
}

export interface EnergyPerformanceMeta {
  data_type: "actual" | "predicted" | string | null; // Allow for other strings if needed
  source: string | null;
  attribution_string: string | null;
}

export interface EnergyPerformance {
  lmk_key: string | null;
  lodgement_date: string | null; // ISO date string ideally, but string for safety
  expiry_date: string | null; // ISO date string ideally, but string for safety
  address1: string | null;
  address2: string | null;
  address3: string | null;
  postcode: string | null;
  number_habitable_rooms: number | null;
  number_heated_rooms: number | null;
  extension_count: number | null;
  total_floor_area: number | null;
  floor_level: string | null;
  floor_height: number | null;
  flat_top_storey: "Y" | "N" | string | null; // Assuming Y/N but allow other strings
  flat_storey_count: number | null;
  main_fuel: string | null;
  mains_gas_flag: "Y" | "N" | string | null; // Assuming Y/N but allow other strings
  mainheat_description: string | null;
  mainheat_energy_eff: string | null;
  main_heating_controls: unknown | null; // Type unknown from example
  secondheat_description: string | null;
  hotwater_description: string | null;
  hot_water_energy_eff: string | null;
  windows_description: string | null;
  windows_energy_eff: string | null;
  glazed_area: string | null;
  glazed_type: string | null;
  walls_description: string | null;
  walls_energy_eff: string | null;
  roof_description: string | null;
  roof_energy_eff: string | null;
  floor_description: string | null;
  floor_energy_eff: string | null;
  lighting_description: string | null;
  lighting_energy_eff: string | null;
  sheating_energy_eff: string | null; // Corrected typo from 'sheating' if applicable in source
  wind_turbine_count: string | number | null;
  environmental_impact: EnvironmentalImpact | null;
  energy_efficiency: EnergyEfficiency | null;
  meta: EnergyPerformanceMeta | null;
}

export interface ConstructionMaterials {
  walls: string | null;
  roof: string | null;
  floor: string | null;
  windows: string | null;
  heating: string | null;
}

// --- New Energy Performance Types End ---

// --- New Mobile Service Coverage Types End ---

// --- New Education Types Start ---

export interface EducationLocation {
  coordinates: {
    longitude: number;
    latitude: number;
  };
  type: "property" | string | null; // Assuming 'property' or other strings
}

export interface School {
  name: string | null;
  location: EducationLocation | null;
  school_rating: string | null; // e.g., "Good", "Requires improvement", "Inadequate", "Outstanding"
  postcode: string | null;
  school_types: string[] | null; // e.g., ["Nursery", "Primary"], ["Secondary"]
  distance_in_metres: number | null;
}

export interface Education {
  nursery?: School[] | null;
  primary?: School[] | null;
  secondary?: School[] | null;
  post_16?: School[] | null;
  all_through?: School[] | null;
  pupil_referral_units?: School[] | null;
  special?: School[] | null;
  independent?: School[] | null;
  universities?: School[] | null;
}

export interface Transport {
  public?: PublicTransport | null;
  road_network?: RoadNetwork | null;
}

// Public Transport Categories
export interface PublicTransport {
  bus_coach?: TransportStop[] | null;
  rail?: TransportStop[] | null;
  taxi?: TransportStop[] | null;
  air?: TransportStop[] | null;
  tram_metro?: TransportStop[] | null;
  ferry?: TransportStop[] | null;
}

// Road Network Details
export interface RoadNetwork {
  closest_motorway_junction?: MotorwayJunction | null;
}

// Generic Transport Stop/Station
export interface TransportStop {
  atco_code: string | null;
  stop_name: string | null;
  location: TransportLocation | null;
  distance_in_metres: number | null;
}

// Motorway Junction Details
export interface MotorwayJunction {
  name: string | null;
  description: string | null;
  location: MotorwayJunctionLocation | null;
  distance_in_metres: number | null;
}

// Location for Transport Stops
export interface TransportLocation {
  coordinates: {
    longitude: number;
    latitude: number;
  };
  type: "property" | string | null;
}

// Location for Motorway Junction
export interface MotorwayJunctionLocation {
  coordinates: {
    longitude: number;
    latitude: number;
  };
}

// --- New Transport Types End ---

// --- New Legal/Risk Types Start ---

export interface RestrictiveCovenant {
  unique_identifier: string | null;
  associated_property_description: string | null;
}

export interface CoastalErosion {
  // Flag indicating if the property can have a coastal erosion plan.
  // If a property is located in an area where coastal erosion is a risk, this flag will be `true` regardless
  // of whether a plan is in place or not. This would include properties on or near a coastline.
  // If a property is not located in an area where coastal erosion is a risk, this flag will be `false`. This
  // would include properties located inland.
  can_have_erosion_plan: boolean | null;
  plans: CoastalErosionPlan[] | null; // List of coastal erosion plans associated with the property
}

export interface CoastalErosionPlan {
  feature_id: string | null; // The ID of the coastal feature
  feature_type: string | null; // The type of the coastal feature (e.g., Floodable/Erodible)
  defence_type: string | null; // The defence type if in-place
  floodable: boolean | null; // A flag indicating if the feature is floodable
  boundary: string | null; // The geographical boundary of the coastal feature in WKT (LINESTRING)
  mid_point: string | null; // The MidPoint of the geographical boundary in WKT (POINT)
  distance_from_point: number | null; // The closest distance in metres from the property to the coastal feature
  shore_management_plan: CoastalErosionShoreManagementPlan | null; // Coastal erosion estimates where a shore management plan is in place
  no_active_intervention: CoastalErosionNoActiveIntervention | null; // Coastal erosion estimates that would occur if no shore management plan is in place
  meta: {
    data_type: "actual" | "predicted";
    source?: string | null;
    attribution_string?: string | null;
  } | null;
}

export interface CoastalErosionShoreManagementPlan {
  name: string; // The name of the shore management plan
  id: string | null; // The ID of the shore management plan
  estimated_distance_lost: CoastalErosionEstimatedDistanceLost; // Estimated distances lost to coastal erosion with a shore management plan
}

export interface CoastalErosionNoActiveIntervention {
  estimated_distance_lost: CoastalErosionEstimatedDistanceLost; // Estimated distances lost to coastal erosion without a shore management plan in place
}

export interface CoastalErosionEstimatedDistanceLost {
  short_term: CoastalErosionEstimatedDistanceLostTerm | null; // Coastal erosion values for the short term (0-20 years)
  medium_term: CoastalErosionEstimatedDistanceLostTerm | null; // Coastal erosion values for the medium term (20-50 years)
  long_term: CoastalErosionEstimatedDistanceLostTerm | null; // Coastal erosion values for the long term (50-100 years)
}

export interface CoastalErosionEstimatedDistanceLostTerm {
  average_estimated_value: number | null; // The average estimated amount of coastal erosion in metres
  estimated_value_upper_bound: number | null; // The upper bound of average estimated amount of coastal erosion in metres
  estimated_value_lower_bound: number | null; // The lower bound of average estimated amount of coastal erosion in metres
  risk: CoastalErosionEstimatedDistanceLostTermRisk | null; // Information about the risk of coastal erosion on the property
}

export interface CoastalErosionEstimatedDistanceLostTermRisk {
  risk_value: number | null; // A measure indicating the level of risk of the property being affected by Coastal Erosion
  risk_rating: "no risk" | "low risk" | "medium risk" | "high risk" | null; // A description of the risk value as a rating
}

export interface RightOfWay {
  has_public_right_of_way: boolean | null;
  right_of_way_details: PublicRightOfWayDetails[] | null;
}

export type RightOfWayRowType = string | null;

export interface PublicRightOfWayDetails {
  distance: number | null;
  date_updated: string | null;
  parish: string | null;
  route_no: string | null;
  row_type: RightOfWayRowType;
}

// --- New Legal/Risk Types End ---

export interface PremiumStreetDataResponse {
  data: AddressMatchData;
  meta: AddressMatchMeta;
}

/**
 * Represents the user-modifiable state snapshotted alongside the premium data.
 * This context is saved to the database and restored to ensure consistency
 * when reloading premium data from the backend cache.
 */
export interface SnapshotContextData {
  confirmedAddress: PropertyAddress /** The exact address details confirmed by the user and used for the premium fetch. */;
  epc: EpcData;
}

/**
 * The payload sent from the frontend when requesting premium data.
 */
export interface PremiumFetchContext {
  /** The primary identifier for the property (e.g., Rightmove ID). */
  propertyId: string;

  /** The current user-modifiable context data to be saved if a new snapshot is created. */
  currentContext: SnapshotContextData;
}

/**
 * The expected response structure from the POST /getPremiumStreetData endpoint.
 */
export interface GetPremiumStreetDataResponse {
  /** The raw data returned from the external premium API. */
  premiumData: PremiumStreetDataResponse;
  /** The snapshot of user context, ONLY returned if data was served from the backend cache. */
  snapshotData?: SnapshotContextData;
  /** The user's remaining token count, returned with every successful response. */
  tokensRemaining: number;
  dataSource: "cache" | "api"; // Indicate the source of the premiumData
}

/**
 * Represents the potential shapes of error responses from the API.
 */
export interface ApiErrorResponse {
  message?: string; // For 400 errors
  error?: string; // For 401, 403, 404, 500, 503 errors
  tokensRemaining?: number; // For 403 and 503 errors
  tokensRestored?: boolean; // For 503 errors
}

export type ProcessedPremiumDataStatus = "loading" | "success" | "error" | "idle" | "pending";

export interface ProcessedPremiumStreetData {
  status: ProcessedPremiumDataStatus;
  estimatedSaleValue: number | null;
  estimatedRentalValue: number | null;
  estimatedAnnualRentalYield: number | null;
  propensityToSell: number | null;
  propensityToLet: number | null;
  outcodeMarketActivity: number | null; // Based on count_total_properties_sold_last_12_months
  premiumLeaseEndDate: string | null;
  formattedPremiumLeaseTerm: string | null;
  premiumLeaseTotalMonths: number | null;
  constructionMaterials: ConstructionMaterials | null;
  constructionAgeBand: string | null;
  conservationAreaDetails: {
    conservationAreaDataAvailable: boolean | null;
    conservationArea: string | null;
  };
  detailedFloodRiskAssessment: FloodRisk | null;
  airportNoiseAssessment: AirportNoise | null;
  mobileServiceCoverage: MobileServiceCoverageItem[] | null;
  propertyPlanningApplications: PlanningApplication[] | null;
  nearbyPlanningApplications: NearbyPlanningApplication[] | null;
  occupancyStatus: string | null;
  transport: Transport | null;
  schoolProximity: Education | null;
  outcodeAvgSalesPrice: number | null;
  outcodeTotalProperties: number | null;
  outcodeIdentifier: string | null;
  outcodeTurnoverRate: number | null;
  restrictiveCovenants: RestrictiveCovenant[] | null;
  coastalErosionRisk: CoastalErosion | null;
  publicRightOfWay: RightOfWay | null;
  askingVsEstimatePercentage: number | null;
  askingVsEstimateAbsolute: number | null;
  publicRightOfWayObligation: RightOfWayDetails | null;
  listedBuildingsOnPlot: ListedBuilding[] | null;
  tenure: string | null;
  propertyType: string | null;
  broadband: BroadbandAvailability[] | null | undefined;
  internalAreaInSquareMetres: number | null;
}

// --- New Plot Types Start ---

export interface PlotPolygon {
  polygon_id: string;
  date_polygon_created: string; // ISO date string
  date_polygon_updated: string; // ISO date string
  epsg_4326_polygon: PolygonModel | null;
  epsg_27700_polygon: OSGBPolygonModel | null;
  polygon_contains_property: boolean;
  boundary_area_square_metres: number;
  distance_from_property: number;
}

export interface PlotMeta {
  data_type: "actual" | "predicted" | string | null;
  source: string | null;
  attribution_string: string | null;
}

export interface Plot {
  total_plot_area_square_metres: number | null;
  polygons: PlotPolygon[] | null;
  meta: PlotMeta | null;
}

// --- New Point/MultiPoint Model Types Start ---

export interface PointModel {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

export interface MultiPointModel {
  type: "MultiPoint";
  coordinates: [number, number][]; // Array of [longitude, latitude]
}

// Define a generic Meta interface
export interface Meta {
  data_type: "actual" | "predicted" | string | null;
  source?: string | null;
  attribution_string?: string | null;
}

export interface ListedBuilding {
  id: string | null;
  name: string | null;
  grade: string | null;
  listed_date: string | null;
  amended_date: string | null;
  location: PointModel | MultiPointModel | null;
  distance_in_metres?: number | null;
}
