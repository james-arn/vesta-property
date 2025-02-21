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
}

export interface Address {
  royal_mail_format: RoyalMailFormat;
  street_group_format: StreetGroupFormat;
  simplified_format: SimplifiedFormat;
  is_none_residential: boolean;
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
  type: string;
  coordinates: number[][];
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
  outcode: string;
  local_authority: string;
  national: MarketStatisticsNational;
}

export interface MarketStatisticsNational {
  count_of_properties: number;
  country: string;
  // Additional market statistics fields may be added here.
}

export type PremiumStreetDataResponse = {
  data: AddressMatchData;
  meta: AddressMatchMeta;
};
