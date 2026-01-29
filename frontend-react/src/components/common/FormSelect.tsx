import React from 'react';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    options: { value: string | number; label: string }[];
}

const FormSelect: React.FC<FormSelectProps> = ({ label, error, options, children, className = '', ...props }) => {
    return (
        <div className="mb-3">
            <label className="form-label">{label}</label>
            <select className={`form-select ${className}`} {...props}>
                {children}
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
            {error && <small className="text-danger">{error}</small>}
        </div>
    );
};

export default FormSelect;
