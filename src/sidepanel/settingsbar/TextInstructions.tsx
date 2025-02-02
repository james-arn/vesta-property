import { STEPS } from "@/constants/steps";
import { AgentDetails } from "@/types/property";
import DOMPurify from "dompurify";
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
    [STEPS.REVIEW_MESSAGE]: `3. Review the message in rightmove and fill in your details then click send email.`,
    [STEPS.EMAIL_SENT]: `4. Email sent! Return to the listing${agentDetails?.phoneNumber ? ` or if you'd prefer, call  ${agentDetails.name ?? "the agent"} now on <a href="tel:${agentDetails.phoneNumber}">${agentDetails.phoneNumber}</a>.` : "."}`,
  };

  const sanitizedHTML = DOMPurify.sanitize(textInstructions[currentStep]);

  return (
    <div className="w-64">
      <p
        dangerouslySetInnerHTML={{
          __html: sanitizedHTML,
        }}
      />
    </div>
  );
};

export default TextInstructions;
