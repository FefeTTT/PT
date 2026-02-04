import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

export default function FormInput({ label, error, className = '', ...props }: FormInputProps) {
    return (
        <div className="mb-3">
            <label className="form-label">{label}</label>
            <input className={`form-control ${className}`} {...props} />
            {error && <small className="text-danger">{error}</small>}
        </div>
    );
};
