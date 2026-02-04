export { };

declare global {
    interface Window {
        FUNCION_ID?: number;
        mountMenuTrimestres: (containerId: string) => void;
        unmountMenuTrimestres: () => void;
        mountDirectoryMenu: (containerId: string) => void;
        unmountDirectoryMenu: () => void;
        mountFuzzySearchInput: (containerId: string, onSearch: (term: string) => void, initialValue?: string) => void;
        unmountFuzzySearchInput: () => void;
        mountAdminApp: (containerId: string) => void;
        unmountAdminApp: () => void;
    }
}
