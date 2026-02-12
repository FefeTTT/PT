
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS area (
	idArea INT NOT NULL,
	nombre VARCHAR(120) NOT NULL,
	PRIMARY KEY (idArea)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grado_estudios (
	idGrado INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	nombre VARCHAR(60) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

ALTER TABLE profesor
	ADD COLUMN idArea INT NULL AFTER correo_personal,
	ADD COLUMN idGrado INT NULL AFTER idArea;

ALTER TABLE profesor
	ADD CONSTRAINT fk_profesor_area
		FOREIGN KEY (idArea) REFERENCES area(idArea)
		ON UPDATE CASCADE
		ON DELETE SET NULL,
	ADD CONSTRAINT fk_profesor_grado
		FOREIGN KEY (idGrado) REFERENCES grado_estudios(idGrado)
		ON UPDATE CASCADE
		ON DELETE SET NULL;


CREATE TABLE IF NOT EXISTS dias_de_trabajo (
	idDiasDeTrabajo INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	codigo_dias VARCHAR(20) NOT NULL,  -- "L-V", "M-J", "L-MI-V"
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS horarios_contratacion (
	idHorario INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	idDiasDeTrabajo INT NOT NULL,
	horaInicio TIME NOT NULL,
	horaFin TIME NOT NULL,
	UNIQUE KEY uq_horario (idDiasDeTrabajo, horaInicio, horaFin),
	CONSTRAINT chk_horario_rango CHECK (horaInicio < horaFin),
	CONSTRAINT fk_horario_dias
		FOREIGN KEY (idDiasDeTrabajo) REFERENCES dias_de_trabajo(idDiasDeTrabajo)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


CREATE TABLE IF NOT EXISTS profesor_has_horario_contratacion (
	numeroEconomico INT NOT NULL,
	idHorario INT NOT NULL,
	PRIMARY KEY (numeroEconomico, idHorario),
	INDEX idx_profHasHorCont_idHorario (idHorario),
    
	CONSTRAINT fk_profHasHorCont_profesor
		FOREIGN KEY (numeroEconomico) REFERENCES profesor(numeroEconomico)
		ON UPDATE CASCADE
		ON DELETE CASCADE,

	CONSTRAINT fk_profHasHorCont_horario
		FOREIGN KEY (idHorario) REFERENCES horarios_contratacion(idHorario)
		ON UPDATE CASCADE
		ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/* SQL PARA INSERTAR UN HORARIO
INSERT INTO dias_de_trabajo (codigo)
VALUES ('L-V')
ON DUPLICATE KEY UPDATE codigo = VALUES(codigo);

INSERT INTO horarios_contratacion (idDiasDeTrabajo, horaInicio, horaFin)
VALUES (
	(SELECT idDiasDeTrabajo FROM dias_de_trabajo WHERE codigo = 'L-V'),
	'10:00:00',
	'18:00:00'
);*/
SET FOREIGN_KEY_CHECKS = 1;