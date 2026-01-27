// js/services/apiService.js
// Wraps fetch logic in a global namespace to be used across the app

(function (global) {
    'use strict';

    const ApiService = {
        // Generic helper to post form data
        postForm: function (url, dataObj) {
            const body = new URLSearchParams(dataObj).toString();
            return fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: body
            }).then(async response => {
                const text = await response.text();
                let json = null;
                try {
                    json = text ? JSON.parse(text) : null;
                } catch (e) {
                    throw new Error('Invalid JSON response from ' + url + ': ' + e.message + ' \n' + text);
                }
                if (json && typeof json === 'object') json.__httpStatus = response.status;
                return json;
            });
        },

        // Fetch all users
        getUsers: function () {
            return fetch('controlador/recuperarUsuarioTodos.php')
                .then(response => {
                    if (!response.ok) throw new Error('HTTP error ' + response.status);
                    return response.json();
                });
        },

        // Delete user by name
        deleteUserByName: function (userName) {
            return this.postForm('controlador/eliminarUsuarioNombre.php', { usuario: userName });
        },

        // Update user password
        updatePassword: function (userName, newPassword) {
            return this.postForm('controlador/actualizarUsuarioContraseña.php', { 'usuario': userName, 'contraseña': newPassword });
        },

        // Get user functions
        getUserFunctions: function (userName) {
            return this.postForm('controlador/recuperaFuncionUsuarioNombre.php', { 'usuario': userName });
        },

        // Get all available functions
        getAllFunctions: function () {
            return fetch('controlador/recuperarTodasFunciones.php').then(r => {
                if (!r.ok) throw new Error('HTTP ' + r.status);
                return r.json();
            });
        },

        // Update user function
        updateUserFunction: function (userName, oldFunc, newFunc) {
            return this.postForm('controlador/actualizaFuncionUsuario.php', {
                usuario: userName,
                funcion_old: oldFunc || '',
                funcion_new: newFunc
            });
        }
    };

    // Expose to global scope
    global.ApiService = ApiService;
    // Legacy support
    global.postForm = ApiService.postForm;


})(window);
