import Feedback from "@/components/Feedback";
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
export function useFeedbackAutoPrompt(propertyId: string | null) {
  const { toast } = useToast();

  // Create a unique dependency key from the propertyId to stop duplicate useeffect renders.
  const effectKey = useMemo(() => `${propertyId}`, [propertyId]);

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

    // Increment counts based on the current step
    reviewCount++;
    localStorage.setItem(StorageKeys.FIRST_STEP_INITIAL_REVIEW_COUNT, reviewCount.toString());

    // Condition 1: User has seen checklist on many rightmove pages
    if (reviewCount >= INITIAL_REVIEW_COUNT_THRESHOLD) {
      toast({
        description: React.createElement(Feedback),
        variant: "default",
        duration: 15000, // 15 seconds
      });
      localStorage.setItem(StorageKeys.HAS_FEEDBACK_PROMPT_ALREADY_SHOWN, "true");
      return;
    }

    // Condition 2: User has automated and sent to agent a few messages
    if (reviewCount >= FINAL_STEP_EMAIL_SENT_COUNT_THRESHOLD) {
      toast({
        description: React.createElement(Feedback),
        variant: "default",
        duration: 15000, // 15 seconds
      });
      localStorage.setItem(StorageKeys.HAS_FEEDBACK_PROMPT_ALREADY_SHOWN, "true");
    }
  }, [effectKey, toast]);
}
