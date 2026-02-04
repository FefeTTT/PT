import { User, ApiResponse, FunctionResponse, UserFunction } from './types';

const API_BASE = ''; // Relative to root served by PHP

const postForm = async (url: string, data: Record<string, string>): Promise<ApiResponse> => {
    const body = new URLSearchParams(data).toString();
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            console.error('Invalid JSON:', text);
            return { ok: false, msg: 'Invalid JSON response' };
        }
    } catch (e) {
        return { ok: false, msg: 'Network error' };
    }
};

export const getUsers = async (): Promise<User[]> => {
    try {
        const response = await fetch(`${API_BASE}controlador/recuperarUsuarioTodos.php`);
        if (!response.ok) throw new Error('HTTP error ' + response.status);
        return await response.json();
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const deleteUser = async (userName: string): Promise<ApiResponse> => {
    return postForm(`${API_BASE}controlador/eliminarUsuarioNombre.php`, { usuario: userName });
};

export const updatePassword = async (userName: string, newPassword: string): Promise<ApiResponse> => {
    return postForm(`${API_BASE}controlador/actualizarUsuarioContraseña.php`, { usuario: userName, contraseña: newPassword });
};

export const getUserFunctions = async (userName: string): Promise<FunctionResponse> => {
    return postForm(`${API_BASE}controlador/recuperaFuncionUsuarioNombre.php`, { usuario: userName }) as Promise<FunctionResponse>;
};

export const getAllFunctions = async (): Promise<FunctionResponse | UserFunction[]> => {
    const response = await fetch(`${API_BASE}controlador/recuperarTodasFunciones.php`);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    return await response.json();
};

export const updateUserFunction = async (userName: string, oldFunc: string, newFunc: string): Promise<ApiResponse> => {
    return postForm(`${API_BASE}controlador/actualizaFuncionUsuario.php`, {
        usuario: userName,
        funcion_old: oldFunc || '',
        funcion_new: newFunc
    });
};

export const addUser = async (user: User, initialFunction: string): Promise<ApiResponse> => {
    const payload: Record<string, string> = {
        usuario: user.usuario,
        contraseña: user.contraseña || '',
        funcion: initialFunction
    };
    return postForm(`${API_BASE}controlador/agregarUsuario.php`, payload);
};
