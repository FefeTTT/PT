
export interface UserFunction {
    nombre: string;
}

export interface User {
    idUsuario?: number; // Sometimes returned, but not always consistent in legacy
    usuario: string;
    // Password is usually not returned in listings for security, but legacy might have it or we use it for updates
    contraseña?: string;
    contrasena?: string; // Handle legacy inconsistency
    password?: string;   // Handle legacy inconsistency
    [key: string]: any; // Allow other dynamic columns
}

export interface ApiResponse {
    ok: boolean;
    msg?: string;
    [key: string]: any;
}

export interface FunctionResponse extends ApiResponse {
    funciones: UserFunction[];
}
