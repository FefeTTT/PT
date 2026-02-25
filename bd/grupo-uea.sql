CREATE TABLE IF NOT EXISTS grupo (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE -- ejemplo 'CDIV01', 'CCB01'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE IF NOT EXISTS uea_grupo (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    uea_clave INT(11) NOT NULL,
    idGrupo INT(11) NOT NULL,
    cupo_maximo INT(11) NOT NULL,
    
    CONSTRAINT fk_clase_uea FOREIGN KEY (uea_clave) REFERENCES uea(clave) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_clase_grupo FOREIGN KEY (idGrupo) REFERENCES grupo(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    
    CONSTRAINT uk_uea_grupo UNIQUE (uea_clave, idGrupo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE IF NOT EXISTS asignacion_uea_profesor (
    id_uea_grupo INT(11) PRIMARY KEY, -- PK y FK al mismo tiempo
    profesor_numeroEconomico INT(11) NOT NULL,
    
    CONSTRAINT fk_asignacion_uea_grupo FOREIGN KEY (id_uea_grupo) REFERENCES uea_grupo(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
    CONSTRAINT fk_asignacion_profesor FOREIGN KEY (profesor_numeroEconomico) REFERENCES profesor(numeroEconomico) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

CREATE TABLE horario_grupo_uea (
    id INT(11) AUTO_INCREMENT PRIMARY KEY,
    id_uea_grupo INT(11) NOT NULL,
    dia_semana TINYINT(1) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL, 
    aula VARCHAR(45),
    
    CONSTRAINT fk_horario_uea_grupo FOREIGN KEY (id_uea_grupo) REFERENCES uea_grupo(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
