export const StorageKeys = {
  SELECTED_WARNING_ITEMS: "vesta_selectedWarningItems",
  // FEEDBACK PROMPT
  FIRST_STEP_INITIAL_REVIEW_COUNT: "vesta_firstStepInitialReviewCount",
  FINAL_STEP_EMAIL_SENT_COUNT: "vesta_finalStepEmailSentCount",
  HAS_FEEDBACK_PROMPT_ALREADY_SHOWN: "vesta_hasFeedbackPromptAlreadyShown",

  // AUTHENTICATION RELATED KEYS
  AUTH_ID_TOKEN: "vesta_auth_id_token",
  AUTH_ACCESS_TOKEN: "vesta_auth_access_token",
  AUTH_REFRESH_TOKEN: "vesta_auth_refresh_token",
  AUTH_STATE: "vesta_auth_state",
  AUTH_CODE_VERIFIER: "vesta_auth_code_verifier",
  AUTH_IN_PROGRESS: "vesta_auth_in_progress",
  AUTH_SUCCESS: "vesta_auth_success",
  AUTH_ERROR: "vesta_auth_error",
  AUTH_START_TIME: "vesta_auth_start_time",
  AUTH_CLIENT_ID: "vesta_auth_clientId",

  // LOGOUT RELATED KEYS
  AUTH_LOGOUT_TAB_ID: "vesta_auth_logout_tab_id",
  AUTH_LOGOUT_START_TIME: "vesta_auth_logout_start_time",

  PROPERTY_DATA_CACHE_PREFIX: "vesta_prop_cache_",
} as const;
