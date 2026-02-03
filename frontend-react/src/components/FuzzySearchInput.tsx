import React, { useState, useEffect } from 'react';
import styles from './FuzzySearchInput.module.css';

interface FuzzySearchInputProps {
    onSearch: (term: string) => void;
    placeholder?: string;
    className?: string;
    initialValue?: string;
    debounceTime?: number;
}

export default function FuzzySearchInput({
    onSearch,
    placeholder = 'Buscar por nombre o número económico',
    className = 'form-control mb-2',
    initialValue = '',
    debounceTime = 300
}: FuzzySearchInputProps) {
    const [inputValue, setInputValue] = useState(initialValue);

    useEffect(() => {
        const handler = setTimeout(() => {
            onSearch(inputValue);
        }, debounceTime);

        return () => {
            clearTimeout(handler);
        };
    }, [inputValue, onSearch, debounceTime]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInputValue(e.target.value);
    };

    return (
        <input
            type="text"
            className={`${styles.input} ${className}`}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleChange}
            id="dir-search-input-react"
        />
    );
}


