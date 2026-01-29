import React from 'react';


const TrimestreTableHeaders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <tr>
            {children}
        </tr>
    );
};

export default TrimestreTableHeaders;
