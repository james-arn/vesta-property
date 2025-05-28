28 May - **Explainer video addition**

20 May 2025 - GA Integration & Enhancements - Version 2.0.4

- **Google Analytics (GA4) Integration:**
  - Implemented comprehensive GA4 event tracking for the user journey, including:
    - `extension_install`: Tracks first-time installations.
    - `property_analysed`: Tracks viewing of property analysis (ensures uniqueness per session).
    - Established a mechanism to pass a unique `extension_client_id` from the extension to the static site and subsequently to Stripe Payment Links (`client_reference_id`). This enables server-side `purchase` events (sent from AWS Lambda via Stripe webhook) to be correctly attributed to the originating user session in GA4.
    - `upgrade_button_clicked`: Tracks clicks on upgrade prompts/buttons.
    - `token_used`: Tracks usage of premium features (token consumption).
  - Configured distinct GA4 properties for development and production environments.
- **URL Handling for Pricing Page:**
  - Refactored `navigateToPricingPageWithGaParams` to correctly handle URL fragments (e.g., `#pricing`) in conjunction with query parameters (`extension_client_id`), ensuring both scrolling to section and parameter passing work as expected.
- **Documentation:**
  - Created `docs/GOOGLEANALYTICS.md` detailing the complete GA4 setup, event flow, and instructions for related repositories (static site, Lambda).

19 May 2025 - Version 2.0.3

- Introduced a comprehensive address finder feature (free). This feature automatically determines the property's address using sold property prices. In the absence of a sold price listing history, it utilises the government EPC finder to match the EPC with the base address.
- Enhanced the user interface with a side tab for opening and closing.
