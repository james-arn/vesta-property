import { STEPS } from '@/constants/steps';
import React from 'react';

const buttonLabels = {
    [STEPS.INITIAL_REVIEW]: "Select Issues",
    [STEPS.SELECT_ISSUES]: "Create message",
    [STEPS.REVIEW_MESSAGE]: "Review message",
};

interface NextStepButtonProps {
    currentStep: keyof typeof STEPS;
    onNext: () => void;
}

const NextStepButton: React.FC<NextStepButtonProps> = ({ currentStep, onNext }) => {
    return (
        <button
            onClick={onNext}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
        >
            {buttonLabels[currentStep]}
        </button>
    );
};

export default NextStepButton; 