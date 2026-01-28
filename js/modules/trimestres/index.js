/**
 * Index module for Trimestres.
 * Entry point that exposes functionality to the global scope for compatibility.
 */

import { crearMenuTrimestres } from './menu.js';
import { nuevoTrimestre } from './actions.js';
import { historialProgramacion } from './programacion.js';
import { historialPreferencias } from './preferencias.js';
import { mostrarProfesoresTrimestre } from './profesores.js';
import { mostrarEditorGrupos } from './grupos.js';

// Expose to window for legacy support
window.crearMenuTrimestres = crearMenuTrimestres;
window.nuevoTrimestre = nuevoTrimestre;
window.historialProgramacion = historialProgramacion;
window.historialPreferencias = historialPreferencias;
// Exposed so they can be called by refreshes or other scripts
window.refrescarTrimestres = () => crearMenuTrimestres();
window.mostrarProfesoresTrimestre = mostrarProfesoresTrimestre;
window.mostrarEditorGrupos = mostrarEditorGrupos;

// Auto-init if container exists and we are likely on the page? 
// No, usually creating the menu is triggered by the main admin menu logic.
console.log('Trimestres module loaded.');
