import { STEPS } from "@/constants/steps";
import { AgentDetails } from "@/types/property";
import React from "react";

interface TextInstructionsProps {
  currentStep: keyof typeof STEPS;
  agentDetails: AgentDetails | null;
}

const TextInstructions: React.FC<TextInstructionsProps> = ({
  currentStep,
  agentDetails,
}) => {
  const textInstructions = {
    [STEPS.INITIAL_REVIEW]: "1. Start by reviewing the below checklist.",
    [STEPS.SELECT_ISSUES]: "2. Click to remove any issues from your message.",
    [STEPS.RIGHTMOVE_SIGN_IN]: "Sign in or continue as guest to Rightmove, then we can write the message to the agent.",
    [STEPS.REVIEW_MESSAGE]: `3. Review the message in rightmove and fill in your details then click send email in Rightmove.`,
    [STEPS.EMAIL_SENT]: `4. Email sent! Return to the listing${agentDetails?.phoneNumber ? ` or if you'd prefer, call  ${agentDetails.name ?? "the agent"} now on ${agentDetails.phoneNumber}.` : "."}`,
  };

  return (
    <div className="w-64">
      {textInstructions[currentStep]}
    </div>
  );
};

export default TextInstructions;
