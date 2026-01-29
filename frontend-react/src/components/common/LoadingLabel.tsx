import React from 'react';
import styles from './LoadingLabel.module.css';

const LoadingLabel: React.FC = () => {
    return (
        <div className={styles.loadingContainer}>
            <div className="text-center">Cargando...</div>
        </div>
    );
};

export default LoadingLabel;
