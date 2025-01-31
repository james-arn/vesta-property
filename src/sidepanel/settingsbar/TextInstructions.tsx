import { STEPS } from '@/constants/steps';
import React from 'react';

const textInstructions = {
    [STEPS.INITIAL_REVIEW]: "1. Start by reviewing the below checklist.",
    [STEPS.SELECT_ISSUES]: "2. Click to remove any issues from your message.",
    [STEPS.REVIEW_MESSAGE]: "3. Review the message to the agent in rightmove.",

};

interface TextInstructionsProps {
    currentStep: keyof typeof STEPS;
}

const TextInstructions: React.FC<TextInstructionsProps> = ({ currentStep }) => {
    return (
        <div className="w-64">
            <p>{textInstructions[currentStep]}</p>
        </div>
    );
};

export default TextInstructions; 