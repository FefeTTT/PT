import React from 'react'
import ReactDOM from 'react-dom/client'
import MenuTrimestres from './trimestre-menu/MenuTrimestres'
import './main.module.css'

// Mount helper
const rootElement = document.getElementById('root');
if (rootElement) {
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <MenuTrimestres />
        </React.StrictMode>,
    )
}
