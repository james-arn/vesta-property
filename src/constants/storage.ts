export const StorageKeys = {
  SELECTED_WARNING_ITEMS: "vesta_selectedWarningItems",
  // FEEDBACK PROMPT
  FIRST_STEP_INITIAL_REVIEW_COUNT: "vesta_firstStepInitialReviewCount",
  FINAL_STEP_EMAIL_SENT_COUNT: "vesta_finalStepEmailSentCount",
  HAS_FEEDBACK_PROMPT_ALREADY_SHOWN: "vesta_hasFeedbackPromptAlreadyShown",

  // AUTHENTICATION RELATED KEYS
  ID_TOKEN: "id_token",
  ACCESS_TOKEN: "access_token",
  REFRESH_TOKEN: "refresh_token",
  CODE_VERIFIER: "code_verifier",
  AUTH_IN_PROGRESS: "auth_in_progress",
  AUTH_SUCCESS: "auth_success",
  AUTH_ERROR: "auth_error",
  AUTH_START_TIME: "auth_start_time",
  CLIENT_ID: "clientId",

  // LOGOUT RELATED KEYS
  LOGOUT_TAB_ID: "logout_tab_id",
  LOGOUT_START_TIME: "logout_start_time",
} as const;
