import React from 'react';

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
}

const FormInput: React.FC<FormInputProps> = ({ label, error, className = '', ...props }) => {
    return (
        <div className="mb-3">
            <label className="form-label">{label}</label>
            <input className={`form-control ${className}`} {...props} />
            {error && <small className="text-danger">{error}</small>}
        </div>
    );
};

export default FormInput;
