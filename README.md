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

1.  **Property Identification:**

    - The background script (`background.ts`) monitors navigation to supported property listing pages (e.g., Rightmove).
    - Upon detecting a property page, it scrapes the initial data using the content script (`contentScript.ts`).
    - The background script determines the unique `propertyId` for the current page.

2.  **Data Propagation to UI:**

    - The `useBackgroundMessageHandler` hook in `App.tsx` listens for messages from the background script.
    - It receives the `currentPropertyId` and updates the React Query client when new property data is scraped and sent from the background. The background script directly populates the cache for the relevant `propertyId` using `queryClient.setQueryData([REACT_QUERY_KEYS.PROPERTY_DATA, propertyId], scrapedData)`.

3.  **React Query Data Hooks in `App.tsx`:**

    - **Base Property Data:** `App.tsx` uses `useQuery` with the key `[REACT_QUERY_KEYS.PROPERTY_DATA, currentPropertyId]` to retrieve the cached property data. This data includes scraped information and user confirmations (like address). React Query automatically provides the cached data if available, preventing unnecessary re-fetching or re-scraping when revisiting a property page within the cache's lifetime.
      User inputs handled in the UI, such as manual EPC value entry or address confirmation (via the structured address modal), directly update this base property data cache using `queryClient.setQueryData`. This ensures the primary data object immediately reflects user overrides before being passed to processing hooks.
    - **Supplementary Data:** Other hooks fetch additional data, managed internally by React Query for caching:
      - `usePremiumStreetData`: Fetches premium data (e.g., planning permissions) when activated via the flow described below. Results are cached via React Query using the key `[REACT_QUERY_KEYS.PREMIUM_DATA, propertyId]`.
      - `useCrimeScore`: Fetches crime scores based on coordinates, results are cached.
      - `useReverseGeocode`: Fetches address details based on listing coordinates. **Note:** This result is _not_ used to update the main property data cache automatically (as coordinates can be imprecise). Instead, it's passed as an informational hint to the address confirmation modal.
      - _(Note: EPC processing is also handled separately, potentially caching results based on the EPC document URL)._

4.  **Premium Feature Activation & Persistence Flow:** This flow ensures premium data is fetched, paid for, persisted, and restored correctly.

    - **Trigger:** The user clicks an "Unlock Premium Data" (or similar) button, likely managed within the `usePremiumFlow` hook or `App.tsx`.
    - **Pre-checks:** The flow checks authentication (`isAuthenticated`). If not authenticated, an `UpsellModal` is shown. If authenticated, it proceeds. It then checks if the address needs confirmation (`propertyData.address.isAddressConfirmedByUser`) and shows the `BuildingConfirmationDialog` if needed, updating the `PROPERTY_DATA` cache on confirmation.
    - **Confirmation:** If authenticated and address is confirmed, the `PremiumConfirmationModal` is shown.
    - **Frontend Request (on User Confirmation):**
      - The frontend gathers the current user-modified context data (confirmed address, user-provided EPC, etc. from the `PROPERTY_DATA` cache) along with the primary `propertyId`.
      - This information is packaged into a `PremiumFetchContext` object.
      - A `POST` request (likely triggered by a React Query `useMutation` hook) is sent to the `/getPremiumStreetData` backend endpoint with the `PremiumFetchContext` in the request body.
    - **Backend Lambda (`/getPremiumStreetData`):**
      - Receives the request, extracting `userId` (from authorizer), `propertyId`, and `currentContext` (containing `SnapshotContextData`).
      - **Cache Check:** Queries the `UserPropertySnapshots` DynamoDB table using `userId` (PK) and `propertyId` (SK).
      - **Cache Hit:** If a record exists:
        - Retrieves the stored `snapshotData` (the user context at the time of the original fetch) and `premiumData` (the result from the external API).
        - Returns `{ premiumData: ..., snapshotData: ... }` to the frontend. No external API call or token charge occurs.
      - **Cache Miss:** If no record exists:
        - Verifies the user has enough tokens/credits. Fails if insufficient.
        - Calls the **external premium data API** using the `confirmedAddress` from the request's `currentContext`. Fails if the API call is unsuccessful.
        - Decrements the user's token count. Fails if the update is unsuccessful.
        - Saves a new item to `UserPropertySnapshots` containing:
          - `userId`
          - `propertyId`
          - `snapshotData`: Populated directly from the `currentContext` received in the request.
          - `premiumData`: The raw JSON response from the external API call.
          - `fetchedAt`: Timestamp.
        - Returns only the newly fetched data: `{ premiumData: ... }` to the frontend.
    - **Frontend State Update (React Query Mutation `onSuccess`):**
      - The mutation handling the `POST` request receives the response from the backend (`GetPremiumStreetDataResponse`).
      - It **always** updates the React Query cache for `[REACT_QUERY_KEYS.PREMIUM_DATA, propertyId]` with the received `response.premiumData`.
      - **If `response.snapshotData` exists** (meaning it was a cache hit on the backend):
        - It updates the React Query cache for `[REACT_QUERY_KEYS.PROPERTY_DATA, propertyId]` with `response.snapshotData`. This restores the user's previous modifications (address, EPC) to ensure consistency with the loaded premium data.
      - If `response.snapshotData` does _not_ exist (cache miss), the `PROPERTY_DATA` cache is _not_ overwritten, as it already contains the latest user edits that were just sent to the backend.

5.  **Data Aggregation and Processing (`useChecklistAndDashboardData`):**

    - This crucial custom hook (`src/hooks/useChecklistAndDashboardData.ts`) receives the query results for `propertyData` (from `[REACT_QUERY_KEYS.PROPERTY_DATA, propertyId]`) and `premiumStreetDataQuery` (from `[REACT_QUERY_KEYS.PREMIUM_DATA, propertyId]`), and potentially `crimeScoreQuery` as inputs.
    - **Data Combination:** It intelligently combines these data sources. Premium data (`premiumStreetDataQuery.data`), if available, takes precedence over basic scraped data (`propertyData`) for relevant fields.
    - **Checklist Generation:** It calls `generatePropertyChecklist` (`src/sidepanel/propertychecklist/propertyChecklist.ts`) to transform the combined data into the `PropertyDataListItem[]` array required for the checklist UI.
    - **Calculation Data Preparation:** It prepares a `calculationData` object with specifically formatted values needed for scoring calculations.
    - **Score Calculation:** It invokes `calculateDashboardScores` (`src/utils/scoreCalculations.ts`).
    - **Return Value:** The hook returns the `propertyChecklistData`, `categoryScores`, `overallScore`, etc.

6.  **Rendering (`App.tsx`):**
    - `App.tsx` takes the processed data from `useChecklistAndDashboardData`.
    - It passes `propertyChecklistData` to the `ChecklistView` component.
    - It passes the calculated dashboard scores and `propertyChecklistData` to the `DashboardView` component.

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
