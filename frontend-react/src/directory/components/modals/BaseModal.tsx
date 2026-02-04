import React, { useEffect } from 'react';

interface BaseModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
    loading?: boolean;
    error?: string | null;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    formId?: string; // To link external footer button to form submit
}

export const BaseModal: React.FC<BaseModalProps> = ({
    isOpen,
    onClose,
    title,
    children,
    footer,
    onConfirm,
    confirmText = 'Guardar',
    cancelText = 'Cancelar',
    loading = false,
    error,
    size = 'md',
    formId
}) => {
    // Handle Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClass = size === 'md' ? '' : `modal-${size}`;

    return (
        <>
            <div className="modal fade show" style={{ display: 'block' }} role="dialog" aria-hidden={!isOpen}>
                <div className={`modal-dialog ${sizeClass} modal-dialog-centered`}>
                    <div className="modal-content shadow">
                        <div className="modal-header">
                            <h5 className="modal-title">{title}</h5>
                            <button
                                type="button"
                                className="btn-close"
                                onClick={onClose}
                                aria-label="Close"
                                disabled={loading}
                            ></button>
                        </div>
                        <div className="modal-body">
                            {error && (
                                <div className="alert alert-danger d-flex align-items-center" role="alert">
                                    <i className="bi bi-exclamation-triangle-fill flex-shrink-0 me-2"></i>
                                    <div>{error}</div>
                                </div>
                            )}
                            {children}
                        </div>
                        <div className="modal-footer">
                            {footer ? footer : (
                                <>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={onClose}
                                        disabled={loading}
                                    >
                                        {cancelText}
                                    </button>

                                    {/* If formId is provided, render a submit button linked to the form. 
                                        Otherwise, render a button that calls onConfirm */}
                                    {formId ? (
                                        <button
                                            type="submit"
                                            form={formId}
                                            className="btn btn-primary"
                                            disabled={loading}
                                        >
                                            {loading ? (
                                                <>
                                                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                    Guardando...
                                                </>
                                            ) : confirmText}
                                        </button>
                                    ) : (
                                        onConfirm && (
                                            <button
                                                type="button"
                                                className="btn btn-primary"
                                                onClick={onConfirm}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <>
                                                        <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                                        Guardando...
                                                    </>
                                                ) : confirmText}
                                            </button>
                                        )
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop fade show"></div>
        </>
    );
};
