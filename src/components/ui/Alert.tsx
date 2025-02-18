import React from 'react';

export interface AlertProps {
    type?: 'info' | 'warning' | 'error' | 'success';
    message: string;
}

const typeClasses: Record<'info' | 'warning' | 'error' | 'success', string> = {
    info: 'bg-blue-100 border-blue-400 text-blue-700',
    warning: 'bg-yellow-100 border-yellow-400 text-yellow-700',
    error: 'bg-red-100 border-red-400 text-red-700',
    success: 'bg-green-100 border-green-400 text-green-700',
};

const Alert: React.FC<AlertProps> = ({ type = 'info', message }) => {
    return (
        <div className={`border px-4 py-3 rounded relative ${typeClasses[type]}`} role="alert">
            <span className="block sm:inline">{message}</span>
        </div>
    );
};

export default Alert; 