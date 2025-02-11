import React from 'react';

export interface AlertProps {
    type?: 'info' | 'warning' | 'error' | 'success';
    message: string;
    onClose?: () => void;
}

const typeClasses: Record<'info' | 'warning' | 'error' | 'success', string> = {
    info: 'bg-blue-100 border-blue-400 text-blue-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
};

const Alert: React.FC<AlertProps> = ({ type = 'info', message, onClose }) => {
    return (
        <div className={`border px-4 py-3 rounded relative ${typeClasses[type]}`} role="alert">
            <span className="block sm:inline">{message}</span>
            {onClose && (
                <button
                    onClick={onClose}
                    className="absolute top-0 bottom-0 right-0 px-4 py-3"
                >
                    <svg
                        className="fill-current h-6 w-6 text-blue-500"
                        role="button"
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                    >
                        <title>Close</title>
                        <path d="M14.348 5.652a1 1 0 00-1.414 0L10 8.586 7.066 5.652a1 1 0 00-1.414 1.414L8.586 10l-2.934 2.934a1 1 0 101.414 1.414L10 11.414l2.934 2.934a1 1 0 001.414-1.414L11.414 10l2.934-2.934a1 1 0 000-1.414z" />
                    </svg>
                </button>
            )}
        </div>
    );
};

export default Alert; 