export interface GovEpcCertificate {
  retrievedAddress: string; // Address as listed on the GOV EPC register
  retrievedRating: string | null;
  certificateUrl: string; // Full, absolute URL to the certificate
  validUntil: string | null;
  isExpired?: boolean;
}

export interface GovEpcValidationMatch extends GovEpcCertificate {
  addressMatchScore: number; // Score comparing retrievedAddress to listing's displayAddress (e.g., 0 to 1)
  isEpcRatingMatch: boolean; // Compares retrievedRating to listing's current EPC value
  overallMatchStrength?: "strong" | "medium" | "weak"; // A qualitative measure of the match
}
