CREATE TABLE IF NOT EXISTS edificios (
    idEdificio INT AUTO_INCREMENT PRIMARY KEY,
    nombreEdificio VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS pisos (
    idPiso INT AUTO_INCREMENT PRIMARY KEY,
    nombrePiso VARCHAR(20) NOT NULL,
    idEdificio INT NOT NULL,
    FOREIGN KEY (idEdificio) REFERENCES edificios(idEdificio)
);

CREATE TABLE IF NOT EXISTS lugar (
    idLugar INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    idPiso INT NOT NULL,
    FOREIGN KEY (idPiso) REFERENCES pisos(idPiso)
);