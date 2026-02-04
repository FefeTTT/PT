import React from 'react';

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    error?: string;
    options: { value: string | number; label: string }[];
}

export default function FormSelect({ label, error, options, children, className = '', ...props }: FormSelectProps) {
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
