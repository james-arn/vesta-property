import Feedback from "@/components/Feedback";
import { STEPS } from "@/constants/steps";
import { StorageKeys } from "@/constants/storage";
import {
  FINAL_STEP_EMAIL_SENT_COUNT_THRESHOLD,
  INITIAL_REVIEW_COUNT_THRESHOLD,
} from "@/constants/thresholds";
import React, { useEffect, useMemo } from "react";
import { useToast } from "./use-toast";

/**
 * This hook checks the current step and, if a certain amount of checklist have been viewed or messages automated, triggers the feedback toast.
 * @param propertyId
 * @param currentStep
 */
export function useFeedbackAutoPrompt(
  propertyId: string | null,
  currentStep: (typeof STEPS)[keyof typeof STEPS]
) {
  const { toast } = useToast();

  // Create a unique dependency key from the propertyId and currentStep to stop duplicate useeffect renders.
  const effectKey = useMemo(() => `${propertyId}-${currentStep}`, [propertyId, currentStep]);

  useEffect(() => {
    console.log("useFeedbackAutoPrompt running");
    if (!propertyId) return;
    console.log("propertyId:", propertyId);

    // Don't prompt again if already shown in this persisted session
    const promptShown = localStorage.getItem(StorageKeys.HAS_FEEDBACK_PROMPT_ALREADY_SHOWN);
    console.log("promptShown:", promptShown);

    if (promptShown === "true") return;

    let reviewCount =
      Number(localStorage.getItem(StorageKeys.FIRST_STEP_INITIAL_REVIEW_COUNT)) || 0;
    let emailSentCount = Number(localStorage.getItem(StorageKeys.FINAL_STEP_EMAIL_SENT_COUNT)) || 0;

    // Increment counts based on the current step
    if (currentStep === STEPS.INITIAL_REVIEW) {
      reviewCount++;
      localStorage.setItem(StorageKeys.FIRST_STEP_INITIAL_REVIEW_COUNT, reviewCount.toString());
    } else if (currentStep === STEPS.EMAIL_SENT) {
      emailSentCount++;
      localStorage.setItem(StorageKeys.FINAL_STEP_EMAIL_SENT_COUNT, emailSentCount.toString());
    }

    // Condition 1: User has seen checklist on many rightmove pages
    if (reviewCount >= INITIAL_REVIEW_COUNT_THRESHOLD) {
      toast({
        description: React.createElement(Feedback),
        variant: "default",
        duration: 12000000, // 20 minutes
      });
      localStorage.setItem(StorageKeys.HAS_FEEDBACK_PROMPT_ALREADY_SHOWN, "true");
      return;
    }

    // Condition 2: User has automated and sent to agent a few messages
    if (reviewCount >= FINAL_STEP_EMAIL_SENT_COUNT_THRESHOLD) {
      toast({
        description: React.createElement(Feedback),
        variant: "default",
        duration: 12000000, // 20 minutes
      });
      localStorage.setItem(StorageKeys.HAS_FEEDBACK_PROMPT_ALREADY_SHOWN, "true");
    }
  }, [effectKey, toast]);
}
