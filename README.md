# Vesta Property Search

## About

This is a chrome extension that has a feature-by-feature checklist that evaluates property listings for completeness or highlights missing critical information.

In doing so, it enhancees transparency and assists buyers in making more informed decisions about the biggest risk purchase of their lives.

## Setting up the project and running first time

1. Clone the repository
2. Run `npm install`
3. make .env.development and .env.production file in the root of the project containing the following
   MEASUREMENT_ID
   API_SECRET
   GA_ENDPOINT
   VESTA_PROPERTY_DATA_ENDPOINT
   USE_PREMIUM_DATA_MOCK_ON_FRONTEND
   USE_PREMIUM_DATA_MOCK_ON_BACKEND
4. Run `npm run build:dev` or `npm run build:prod` depending on which enviornment you want. Note: production strips out all console.logs
5. Open chrome and go to `chrome://extensions/`
6. Click on `Load unpacked`
7. Select the `dist` folder
8. Go to a rightmove property listing page.
9. Click the extension icon and the sidebar will open.

## Running the project ongoing

1. Run `npm run watch:dev or npm run watch:prod` -this will watch for changes and rebuild the project
2. Open chrome and go to `chrome://extensions/`
3. Click on `Update`
4. You can now see the update.

## Authentication with AWS Cognito

This extension uses AWS Cognito for secure authentication and user management. Here's how it works:

### Authentication Flow

1. **PKCE Authentication Flow**: We implement the OAuth 2.0 Authorization Code Flow with PKCE (Proof Key for Code Exchange) for maximum security:

   - The extension generates a random code verifier
   - A code challenge is derived from the verifier using SHA-256
   - The user is redirected to the Cognito Hosted UI with the code challenge
   - After successful authentication, Cognito returns an authorization code
   - The extension exchanges this code for ID, access, and refresh tokens

2. **Token Management**:
   - **ID Token**: Contains user identity information (email, user attributes)
   - **Access Token**: Used for API authorization
   - **Refresh Token**: Used to obtain new tokens without user re-authentication

### Token Storage and Security

We follow these security best practices for token storage:

1. **Secure Storage**: Tokens are stored in `chrome.storage.local`, which is:

   - Isolated from websites
   - Not accessible by other extensions
   - Protected by Chrome's security model

2. **Token Validation**:

   - Tokens are verified for proper JWT format
   - Expiration times are checked before tokens are used
   - Payloads are properly parsed and validated

3. **Token Refresh Mechanism**:

   - ID and access tokens expire after 1 hour
   - The refresh token is valid for 30 days
   - The extension automatically refreshes tokens when:
     - A token is within 5 minutes of expiry
     - A periodic refresh check runs (every 30 minutes)
     - An expired token is encountered but a refresh token is available

4. **Automatic Sign-Out**:
   - If token refresh fails (e.g., refresh token expired after 30 days)
   - The user is automatically signed out
   - Tokens are securely removed from storage
   - User must re-authenticate via Cognito

### Development and Testing Tools

When running in development mode, the extension includes a DevTools panel for testing authentication:

1. **Authentication Status**: View token expiry times and user information
2. **Testing Functions**:
   - Force token refresh
   - Artificially modify token expiry times
   - Simulate different auth scenarios

To use DevTools:

- Run the extension in development mode
- The panel appears at the bottom of the sidebar
- Use the provided buttons to test various auth scenarios

### Security Best Practices

- **Immutable Data Patterns**: We use immutable patterns when handling authentication data
- **PKCE Flow**: Protects against authorization code interception attacks
- **Secure Token Transport**: All token exchanges happen over HTTPS
- **Minimal Token Exposure**: Tokens are never exposed to web pages
- **Token Sanitization**: Tokens are properly validated before use
- **Error Handling**: Comprehensive error handling with Sentry integration

### Debugging Authentication

Common authentication issues can be debugged by:

1. Using the DevTools panel in development mode
2. Checking Chrome Extension background logs at `chrome://extensions/`
3. Monitoring token expiry and refresh events in the console

For production debugging:

- Check the Sentry dashboard for auth-related errors
- Use the Chrome DevTools storage inspector to verify token presence

## Architecture

The project uses the following technologies:

- **Chrome Extension Manifest V3:** For accessing the chrome API such as tabs.
- **React:** A JavaScript library for building user interfaces, used to create the extension's UI.
- **Tailwind CSS:** A utility-first CSS framework for styling the UI components.
- **React Query** for caching and background updates.
- **Shadcn:** A component library that provides pre-designed UI components to speed up development.
- **Sentry** for error handling.
- **Google Analytics** for reporting on how to improve the extension.

- **AWS Lambda, DynamoDB, API Gateway:** Not in this repo, but we have a serverless backend that is used to:
  - Handle API keys outside of client and providing crime API in free version.
  - Handle transactions securely.
  - Provide multi-device authentication and licensing
  - Enable premium features (such as enhanced data for property searches) for paid users.
  - Track and decrement user credits securely.

New developers joining the project should note:

## How Chrome Extensions Work & Debugging

Chrome extensions (Manifest V3) consist of several key components:

- **UI (App.tsx):** The React-based interface that renders the sidebar for user interaction.

  - _Debug by:_ Right-clicking on the sidebar (not the webpage) and selecting **Inspect**.

- **Background Script (background.ts):** Manages the extension lifecycle and mediates between the UI and content scripts via the Chrome API.

  - _Debug by:_ Navigating to `chrome://extensions/`, locating the extension, and checking the **Errors**.

- **Content Script (contentScript.ts):** Injected into web pages, this script interacts with the page's DOM and communicates with the extension framework.
  - _Debug by:_ Right-clicking on the webpage (not the sidebar) and selecting **Inspect**.

These components communicate using message passing, which enables complex interactivity between the UI, background, and content scripts.

## Data Flow and Caching with React Query

This extension leverages React Query (TanStack Query) for efficient data fetching, caching, and state management, replacing previous context-based approaches. This ensures optimal performance, minimizes redundant operations, and simplifies data handling across the application, particularly within `src/sidepanel/App.tsx`.

The core data flow operates as follows:

**Phase 1: Initial Scrape (Content Script Focus)**

1.  **Navigation Detection (Background Script -> Content Script Trigger):**

    - The background script (`background.ts`) monitors browser navigation.
    - Upon detecting a Rightmove property page, it signals the content script to begin scraping.

2.  \*\*Data Extraction (Content Script - `contentScript.ts`):

    - The content script (e.g., `propertyDataExtractor.ts`) activates on the live Rightmove property page.
    - It scrapes the page's DOM and `window.PAGE_MODEL` for raw data: `propertyId`, text details, media URLs, and inputs for background processing (like `nearbySoldPropertiesPath`, sales history, bedrooms).
    - This data is compiled into an `ExtractedPropertyScrapingData` object.

3.  \*\*Data Handoff (Content Script -> Background Script):
    - The content script sends the `ExtractedPropertyScrapingData` object to the background script (`background.ts`) via a Chrome runtime message.

**Phase 2: Data Enrichment and Processing (Background Script Focus - `background.ts`)**

4.  \*\*Receipt and Initial Setup (Background Script - `handlePropertyDataExtraction`):

    - The background script receives `ExtractedPropertyScrapingData`.
    - It loads any cached "authoritative" data for the `propertyId` from `chrome.storage.local`.
    - The fresh scrape is merged with cached data to form the initial `currentPropertyData` object.

5.  \*\*Sequential Enrichment Steps (Background Script - within `handlePropertyDataExtraction`):
    The background script attempts a series of lookups/processing steps on `currentPropertyData`:

    - **(A) House Prices Page Address Lookup (Primary Address Validation - `background.ts`):**

      - Here we are trying to confirm the precise location as it is never present in the listing (e.g. no building number).
        The most reliable method is this - comparing the sales history if present scraped from contentscript to the previous sold listing page on rightmove.
      - **Condition:** Always attempted if necessary inputs are present.
      - **Action (Background):** Calls `lookupAddressFromHousePricesPage` which `fetch`es and parses another Rightmove page's `PAGE_MODEL` for sales history comparison.
      - **Outcome:** If a match is found, `currentPropertyData.address` is updated with high confidence (`ConfidenceLevels.HIGH`, `AddressSourceType.HOUSE_PRICES_PAGE_MATCH`).

    - **(B) GOV.UK EPC Validation - `background.ts`:**
    - If we can use our address (precise or not) to check what the EPC is for the property based on the gov uk's epc site.

      - **Condition:** Proceeds if address from (A) is not high confidence OR EPC data is not yet high confidence.
      - **Action (Background):** Fetches from GOV.UK EPC register by postcode. Seeks strong or plausible matches.
      - **Outcome:** Updates `currentPropertyData.address` and `.epc` on strong match (e.g., `ConfidenceLevels.CONFIRMED_BY_GOV_EPC`, `AddressSourceType.GOV_EPC_CONFIRMED`). Stores plausible matches.

    - **(C) File EPC OCR (PDF or Image - `background.ts` => `contentScript.ts` => `background.ts`):**

      - **Condition:** Triggered if an EPC file URL (PDF or Image) exists in `currentPropertyData.epc.url` and the EPC confidence is still low after previous steps.
      - **Action Flow:**
        1. **Request (Background Script -> Content Script):** `background.ts` sends a message (`BACKGROUND_REQUESTS_CLIENT_PDF_OCR` for PDFs or `BACKGROUND_REQUESTS_CLIENT_IMAGE_OCR` for images) to `contentScript.ts` with the file URL and a unique request ID.
        2. **Processing (Content Script, using `src/lib/epcProcessing.ts`):**
           - `contentScript.ts` receives the request.
           - It invokes `processEpcData(fileUrl)` from `src/lib/epcProcessing.ts`.
           - For image URLs, `processImageUrl` (within `epcProcessing.ts`) sends a `FETCH_IMAGE_FOR_CANVAS` message back to `background.ts`. `background.ts` fetches the image (handling potential CORS issues) and returns it as a `dataUrl` to the content script.
           - `epcProcessing.ts` (still executing in the content script's context) then performs the actual OCR on the PDF data (using libraries like PDF.js) or on the image `dataUrl` (e.g., using Tesseract.js).
        3. **Result (Content Script -> Background Script):** `contentScript.ts` sends the structured `EpcProcessorResult` (containing the extracted EPC rating, any relevant text like an address from the document, confidence, etc.) back to `background.ts` using a `CLIENT_PDF_OCR_RESULT` message (this message type is currently reused for results from both PDF and image OCR).
      - **Outcome (Background Script):** `background.ts` receives the `EpcProcessorResult`. If successful, it merges the OCR-derived data (like EPC rating, and potentially address if found and of reasonable quality) into `currentPropertyData.epc` and `currentPropertyData.address`. It updates confidence levels (e.g., to `ConfidenceLevels.MEDIUM`) and sets the source (e.g., `EpcDataSourceType.PDF` or `EpcDataSourceType.IMAGE`).

    - **(D) Re-evaluation of GOV Suggestions & Auto-Confirmation:**
      - **Condition:** If plausible `govEpcRegisterSuggestions` exist and new EPC data from (C) is available.
      - **Action (Background):** Re-evaluates GOV suggestions against new file-derived EPC rating.
      - **Outcome:** Auto-confirms address/EPC if a unique match occurs (`EpcDataSourceType.GOV_EPC_AND_FILE_EPC_MATCH`). Updates `govEpcRegisterSuggestions`.

**Phase 3: Data Propagation to UI and React Query Integration (Background Script -> UI)**

6.  \*\*Final Data Packet to UI (`background.ts` -> UI - `App.tsx`):

    - After all background processing, the finalized `currentPropertyData` is sent to the UI (`App.tsx`) via a `PROPERTY_PAGE_OPENED` message.

7.  \*\*React Query Update and UI Render (UI - `App.tsx` & Components):
    - `App.tsx` (`useBackgroundMessageHandler`) receives the message.
    - It updates React Query cache for `[REACT_QUERY_KEYS.PROPERTY_DATA, propertyId]` with `currentPropertyData`.
    - React Query triggers UI re-renders. Components like `PropertyAddressDisplay.tsx` display the new data and confidence levels. User interactions (e.g., confirming an address) further update the cache via `queryClient.setQueryData`.

**Supplementary Data Fetches (UI-Initiated, React Query Managed):**

8.  The UI may trigger additional data fetches (e.g., `usePremiumStreetData`, `useCrimeScore`) managed by React Query. These results are combined with the main `propertyData` by hooks like `useChecklistAndDashboardData`.
9.  The premium data is a paid for servcie - usePremiumStreetData - this isn't cached clietn side as too large, but we do cache it on the database.

**Benefits of this React Query Approach:**

- **Automatic Caching:** Reduces redundant scraping and API calls, improving performance and user experience.
- **Server State Management:** Simplifies handling of asynchronous data fetching, loading states, and errors.
- **Data Freshness:** React Query handles background updates and cache invalidation.
- **Persistence:** The described premium flow ensures unlocked data and associated user context persist across sessions via backend storage.
- **Separation of Concerns:** Data fetching/caching logic resides within hooks, `useChecklistAndDashboardData` handles combination/processing, and `App` handles rendering.
- **Maintainability:** Clearer data flow makes the application easier to understand and modify.

**Supporting Premium Data Persistence:**

- **DynamoDB Table: `UserPropertySnapshots`**
  - **Primary Key:** `userId` (Partition Key), `propertyId` (Sort Key)
  - **Attributes:**
    - `snapshotData` (Map): Stores the `SnapshotContextData` (user-confirmed address, EPC state, etc.).
    - `premiumData` (Map): Stores the raw JSON response from the external premium API.
    - `fetchedAt` (String/Number): Timestamp.
- **Key Types:**
  - `PremiumFetchContext`: Contains `propertyId` and `currentContext` (`SnapshotContextData`). Sent from frontend to backend.
  - `SnapshotContextData`: Contains user-modifiable fields like `confirmedAddress`, `epc`. Used within `PremiumFetchContext` and stored in DB.
  - `GetPremiumStreetDataResponse`: Contains `premiumData` (always) and `snapshotData` (optional, on cache hit). Returned from backend to frontend.

## Publishing the extension to chrome web store

When publishing your extension to the Chrome Web Store, you only need to upload the production build – not your entire project. Typically, this means you should:

1.  Run your production build (using `npm run build:prod`) to generate the `dist` folder.
2.  Ensure that the `dist` folder contains all the necessary files (such as your `manifest.json`, built JavaScript files, HTML, icons, and any other assets required by your extension).
3.  Zip up the contents of the `dist` folder (making sure that the `manifest.json` is at the root of the zip file).
4.  Upload that zip file during the extension submission process.

## Gotchyas

1. Manifest is transformed to reduce host permissions for only the relevant enviornment in webpack.
2. Sentry temporarily removed for MVP to reduce permissions.
