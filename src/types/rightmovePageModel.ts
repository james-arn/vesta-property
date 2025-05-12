export interface RightmovePageModelType {
  propertyData: PropertyData;
  metadata: Metadata;
  isAuthenticated: boolean;
  analyticsInfo: AnalyticsInfo;
}

export interface PropertyData {
  id: string;
  status: {
    published: boolean;
    archived: boolean;
  };
  text: {
    description: string;
    propertyPhrase: string;
    disclaimer: string;
    auctionFeesDisclaimer: string | null;
    guidePriceDisclaimer: string | null;
    reservePriceDisclaimer: string | null;
    staticMapDisclaimerText: string;
    newHomesBrochureDisclaimer: string;
    shareText: string;
    shareDescription: string;
    pageTitle: string;
    shortDescription: string;
  };
  prices: {
    primaryPrice: string;
    secondaryPrice: string | null;
    displayPriceQualifier: string;
    pricePerSqFt: string;
    message: string | null;
    exchangeRate: string | null;
  };
  address: Address;
  keyFeatures: string[];
  images: Image[];
  floorplans: Floorplan[];
  virtualTours: any[];
  customer: {
    branchId: number;
    branchName: string;
    branchDisplayName: string;
    companyName: string;
    companyTradingName: string;
    displayAddress: string;
    logoPath: string;
    customerDescription: {
      truncatedDescriptionHTML: string;
      isTruncated: boolean;
      descriptionHTML: string;
    };
    bannerAd: string;
    mpuAd: string;
    customerProfileUrl: string;
    customerBannerAdProfileUrl: string;
    customerMpuAdProfileUrl: string;
    customerPropertiesUrl: string;
    isNewHomeDeveloper: boolean;
    spotlight: string | null;
    showBrochureLeadModal: boolean;
    developmentInfo: {
      sitePlanUri: string | null;
      micrositeFeatures: any[];
    };
    buildToRent: boolean;
    commercial: boolean;
    buildToRentBenefits: any[];
    videoUrl: string | null;
    videoEnabled: boolean;
    valuationFormUrl: string;
    products: {
      hasMicrosite: boolean;
    };
  };
  industryAffiliations: any[];
  rooms: any[];
  location: Location;
  streetView: {
    heading: number | null;
    pitch: number | null;
    zoom: number | null;
    latitude: number;
    longitude: number;
  };
  nearestAirports: any[];
  nearestStations: Station[];
  showSchoolInfo: boolean;
  countryGuide: string | null;
  channel: string;
  propertyUrls: {
    similarPropertiesUrl: string;
    nearbySoldPropertiesUrl: string;
  };
  sizings: {
    unit: string;
    displayUnit: string;
    minimumSize: number;
    maximumSize: number;
  }[];
  brochures: any[];
  epcGraphs?: EpcGraph[];
  bedrooms: number;
  bathrooms?: number;
  transactionType: string;
  tags: string[];
  misInfo: {
    branchId: number;
    offerAdvertStampTypeId: number | null;
    premiumDisplay: boolean;
    premiumDisplayStampId: number | null;
    brandPlus: boolean;
    featuredProperty: boolean;
  };
  dfpAdInfo: {
    channel: string;
    targeting: {
      key: string;
      value: string[];
    }[];
  };
  staticMapImgUrls: {
    staticMapImgUrlMobile: string;
    staticMapImgUrlTablet: string;
    staticMapImgUrlDesktopSmall: string;
    staticMapImgUrlDesktopLarge: string;
  };
  listingHistory: ListingHistory;
  feesApply: string | null;
  broadband: {
    disclaimer: string;
    broadbandCheckerUrl: string;
  };
  contactInfo: {
    contactMethod: string;
    telephoneNumbers: {
      localNumber: string;
      internationalNumber: string | null;
      disclaimerText: string | null;
      disclaimerTitle: string | null;
      disclaimerDescription: string | null;
    };
  };
  lettings: string | null;
  infoReelItems: {
    title: string;
    type: string;
    primaryText: string;
    secondaryText: string;
    tooltipText: string;
  }[];
  mortgageCalculator: {
    price: number;
    propertyTypeAlias: string;
  };
  tenure: {
    tenureType: string;
    yearsRemainingOnLease: number | null;
    message: string | null;
  };
  soldPropertyType: string;
  propertySubType: string;
  businessForSale: boolean;
  commercial: boolean;
  commercialUseClasses: any[];
  affordableBuyingScheme: boolean;
  sharedOwnership: {
    sharedOwnershipFlag: boolean;
    ownershipPercentage: number | null;
    rentPrice: number | null;
    rentFrequency: string;
  };
  livingCosts: {
    councilTaxExempt: boolean;
    councilTaxIncluded: boolean;
    annualGroundRent: number | null;
    groundRentReviewPeriodInYears: number | null;
    groundRentPercentageIncrease: number | null;
    annualServiceCharge: number | null;
    councilTaxBand: string | null;
    domesticRates: number | null;
  };
  termsOfUse: string;
  features: {
    electricity?: any[];
    broadband?: any[];
    water?: any[];
    sewerage?: any[];
    heating?: {
      alias: string;
      displayText: string;
    }[];
    accessibility?: any[];
    parking?: FeatureType[];
    garden?: FeatureType[];
    risks: {
      floodedInLastFiveYears: boolean | null;
      floodDefences: boolean | null;
      floodSources: string[];
    };
    obligations: {
      listed: boolean | null;
      restrictions: boolean | null;
      requiredAccess: boolean | null;
      rightsOfWay: boolean | null;
    };
  };
  entranceFloor: number | null;
  reviews: any | null;
  price?: PropertyPriceInfo;
}

export const AddressConfidence = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
} as const;

export interface Address {
  displayAddress: string;
  countryCode?: string;
  deliveryPointId?: number;
  ukCountry?: string;
  outcode?: string;
  incode?: string;
  postcode?: string;
  addressConfidence?: (typeof AddressConfidence)[keyof typeof AddressConfidence] | null;
  latitude?: number;
  longitude?: number;
}

export interface Location {
  latitude: number;
  longitude: number;
  circleRadiusOnMap?: number;
  zoomLevel?: number;
  pinType?: string;
  showMap?: boolean;
}

export interface Image {
  url: string;
  caption: string | null;
  resizedImageUrls?: {
    size135x100: string;
    size476x317: string;
    size656x437: string;
  };
}

export interface Floorplan {
  url: string;
}

export interface ListingHistory {
  listingUpdateReason: string;
}

export interface PropertyPriceInfo {
  displayPrices?: { displayPrice: string }[];
}

export interface SeoData {
  url?: string;
}

export interface EpcGraph {
  caption: string;
  url: string;
}

export interface ExtractedPropertyData {
  address: Address;
  bedrooms?: number | null;
  bathrooms?: number | null;
  description?: string;
  images?: string[];
  keyFeatures?: string[];
  listingHistory?: ListingHistory | null;
  location?: Location | null;
  price?: string | null;
  propertySubType?: string | null;
  propertyType?: string | null;
  tags?: string[] | null;
  url?: string | null;
  epcImageUrls?: string[] | null;
  floorPlanImageUrls?: string[] | null;
  lettings?: string | null;
}

export interface Metadata {
  publicsiteUrl: string;
  cookieDomain: string;
  currencyCode: string;
  emailAgentUrl: string;
  facebookShareUrl: string;
  twitterShareUrl: string;
  emailShareUrl: string;
  copyLinkUrl: string;
  whatsAppShareUrl: string;
  linkedInShareUrl: string;
  myRightmoveUrl: string;
  mediaServerUrl: string;
  serverTimestamp: number;
  deviceType: string;
  deviceTypeForLazyLoad: string;
  deviceOS: string;
  mvtInfo: {
    label: string;
    state: string;
    shouldLog: boolean;
  }[];
  featureMvts: {
    [key: string]: string;
  };
  featureSwitches: {
    [key: string]: boolean;
  };
  adUnitPath: {
    mpu1: string;
    trackingPixel: string;
    ukCreditCheckSponsorship: string;
    broadbandMpuPath: string;
    broadbandMpuId: string;
  };
  fuseId: {
    mpu1: string;
    trackingPixel: string;
    ukCreditCheckSponsorship: string;
    broadbandMpuId: string;
  };
  backLink: {
    url: string;
    text: string;
    operation: number;
  };
  shouldTrackGTMSuccessTracker: boolean;
  emailPreferences: {
    preferencesUrl: string;
    baseUrl: string;
    showModal: boolean;
    source: string;
  };
  staticAssetsPath: string;
  staticImagesAndFontsPath: string;
  correlationId: string;
  serveEs6Bundles: boolean;
  locationProductWebHost: string;
  locationSearchUrl: string;
  environment: string;
  rumTransactionSampleRate: number;
  isHybridPage: boolean;
  googleMapsApiKey: string;
  googleMapsMapId: string;
  mortgageCalculatorTracking: {
    mortgage_calculator_type: string;
  };
}

export interface AnalyticsInfo {
  analyticsBranch: {
    agentType: string;
    branchId: number;
    branchName: string;
    branchPostcode: string | null;
    brandName: string;
    companyName: string;
    companyTradingName: string;
    companyType: string;
    displayAddress: string;
    pageType: string;
  };
  analyticsProperty: {
    added: string;
    auctionOnly: boolean;
    beds: number;
    businessForSale: boolean;
    country: string;
    currency: string;
    floorplanCount: number;
    furnishedType: string;
    hasOnlineViewing: boolean;
    imageCount: number;
    latitude: number;
    longitude: number;
    letAgreed: boolean;
    lettingType: string;
    maxSizeAc: number;
    maxSizeFt: number;
    minSizeAc: number;
    minSizeFt: number;
    ownership: string;
    postcode: string;
    preOwned: string;
    price: number;
    priceQualifier: string;
    propertyId: number;
    propertySubType: string;
    propertyType: string;
    retirement: boolean;
    selectedCurrency: string | null;
    selectedPrice: number | null;
    soldSTC: boolean;
    videoProvider: string;
    viewType: string;
    customUri: string;
  };
}

export type FeatureType = {
  alias: string;
  displayText: string;
};

export interface Station {
  name: string;
  types: string[];
  distance: number;
  unit: string;
}
