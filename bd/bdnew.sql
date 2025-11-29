-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema dbappcb
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema dbappcb
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `dbappcb` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci ;
USE `dbappcb` ;

-- -----------------------------------------------------
-- Table `dbappcb`.`area`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`area` (
  `idArea` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  PRIMARY KEY (`idArea`))
ENGINE = InnoDB
AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`uea`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`uea` (
  `idUEA` INT NOT NULL AUTO_INCREMENT,
  `area_idArea` INT NOT NULL,
  `claveUEA` INT NULL DEFAULT NULL,
  `nombre` VARCHAR(125) NULL DEFAULT NULL,
  PRIMARY KEY (`idUEA`),
  UNIQUE INDEX `idUEA` (`idUEA` ASC) ,
  INDEX `fk_UEA_area1_idx` (`area_idArea` ASC) ,
  CONSTRAINT `fk_UEA_area1`
    FOREIGN KEY (`area_idArea`)
    REFERENCES `dbappcb`.`area` (`idArea`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`trimestreperiodo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`trimestreperiodo` (
  `idTrimestrePeriodo` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(50) NOT NULL,
  `sigla` VARCHAR(1) NOT NULL,
  PRIMARY KEY (`idTrimestrePeriodo`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`trimestreestado`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`trimestreestado` (
  `idTrimestreEstado` INT NOT NULL AUTO_INCREMENT,
  `estado` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`idTrimestreEstado`))
ENGINE = InnoDB;
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`trimestre`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`trimestre` (
  `idTrimestre` INT NOT NULL AUTO_INCREMENT,
  `trimestreestado_idTrimestreEstado` INT NOT NULL,
  `trimestreperiodo_idTrimestrePeriodo` INT NOT NULL,
  `año` INT NOT NULL,
  `fechaLimite` DATE NOT NULL,
  PRIMARY KEY (`idTrimestre`, `trimestreestado_idTrimestreEstado`),
  INDEX `fk_trimestre_trimestreperiodo1_idx` (`trimestreperiodo_idTrimestrePeriodo` ASC) ,
  INDEX `fk_trimestre_trimestreestado1_idx` (`trimestreestado_idTrimestreEstado` ASC) ,
  CONSTRAINT `fk_trimestre_trimestreperiodo1`
    FOREIGN KEY (`trimestreperiodo_idTrimestrePeriodo`)
    REFERENCES `dbappcb`.`trimestreperiodo` (`idTrimestrePeriodo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_trimestre_trimestreestado1`
    FOREIGN KEY (`trimestreestado_idTrimestreEstado`)
    REFERENCES `dbappcb`.`trimestreestado` (`idTrimestreEstado`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`grupo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`grupo` (
  `idGrupo` INT NOT NULL AUTO_INCREMENT,
  `trimestre_idTrimestre` INT NOT NULL,
  `uea_idUEA` INT NOT NULL,
  `claveGrupo` VARCHAR(25) NOT NULL,
  `cupo` INT NULL DEFAULT NULL,
  `inscritos` INT NULL DEFAULT NULL,
  `salon` VARCHAR(40) DEFAULT NULL,
  PRIMARY KEY (`idGrupo`, `trimestre_idTrimestre`),
  INDEX `fk_Grupo_UEA1_idx` (`uea_idUEA` ASC) ,
  INDEX `fk_grupo_trimestre1_idx` (`trimestre_idTrimestre` ASC) ,
  CONSTRAINT `fk_Grupo_UEA1`
    FOREIGN KEY (`uea_idUEA`)
    REFERENCES `dbappcb`.`uea` (`idUEA`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_grupo_trimestre1`
    FOREIGN KEY (`trimestre_idTrimestre`)
    REFERENCES `dbappcb`.`trimestre` (`idTrimestre`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`horario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`horario` (
  `idHorario` INT NOT NULL AUTO_INCREMENT,
  `dia` VARCHAR(25) NOT NULL,
  `horaInicio` TIME NOT NULL,
  `horaFin` TIME NOT NULL,
  PRIMARY KEY (`idHorario`))
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesor` (
  `idProfesor` INT NOT NULL AUTO_INCREMENT,
  `numeroEconomico` INT NOT NULL,
  `nombre` VARCHAR(125) NOT NULL,
  `gradoEstudios` VARCHAR(80) NOT NULL,
  `celular` VARCHAR(15) NULL,
  `correo_uam` VARCHAR(70) NOT NULL,
  `correo_personal` VARCHAR(70) NULL,
  PRIMARY KEY (`idProfesor`),
  UNIQUE INDEX `idProf` (`idProfesor` ASC) )
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesorpreferencias`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesorpreferencias` (
  `idProfesorPreferencias` INT NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` INT NOT NULL,
  `trimestre_idTrimestre` INT NOT NULL,
  `noGrupos` INT NULL DEFAULT NULL,
  `observaciones` VARCHAR(955) NULL DEFAULT NULL,
  PRIMARY KEY (`idProfesorPreferencias`),
  INDEX `fk_profesorPreferencia_trimestre1_idx` (`trimestre_idTrimestre` ASC) ,
  INDEX `fk_profesorPreferencia_profesor1_idx` (`profesor_idProfesor` ASC) ,
  CONSTRAINT `fk_profesorPreferencia_trimestre1`
    FOREIGN KEY (`trimestre_idTrimestre`)
    REFERENCES `dbappcb`.`trimestre` (`idTrimestre`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesorPreferencia_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`usuario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`usuario` (
  `idUsuario` INT NOT NULL AUTO_INCREMENT,
  `usuario` VARCHAR(50) NOT NULL,
  `contraseña` VARCHAR(50) NOT NULL,
  `intento` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`idUsuario`))
  ENGINE = InnoDB
  AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`funcion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`funcion` (
  `idFuncion` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(500) NULL,
  PRIMARY KEY (`idFuncion`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`usuario_has_funcion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`usuario_has_funcion` (
  `usuario_idUsuario` INT NOT NULL,
  `funcion_idFuncion` INT NOT NULL,
  PRIMARY KEY (`usuario_idUsuario`, `funcion_idFuncion`),
  INDEX `fk_usuario_has_funcion_funcion1_idx` (`funcion_idFuncion` ASC) ,
  INDEX `fk_usuario_has_funcion_usuario1_idx` (`usuario_idUsuario` ASC) ,
  CONSTRAINT `fk_usuario_has_funcion_usuario1`
    FOREIGN KEY (`usuario_idUsuario`)
    REFERENCES `dbappcb`.`usuario` (`idUsuario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_usuario_has_funcion_funcion1`
    FOREIGN KEY (`funcion_idFuncion`)
    REFERENCES `dbappcb`.`funcion` (`idFuncion`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesortipo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesortipo` (
  `idProfesorTipo` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  PRIMARY KEY (`idProfesorTipo`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesoremergencia`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesoremergencia` (
  `idProfesorEmergencia` INT NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` INT NOT NULL,
  `nombre` VARCHAR(200) NOT NULL,
  `parentesco` VARCHAR(255) NOT NULL,
  `celular` VARCHAR(15) NULL,
  PRIMARY KEY (`idProfesorEmergencia`, `profesor_idProfesor`),
  INDEX `fk_profesoremergencia_profesor1_idx` (`profesor_idProfesor` ASC) ,
  CONSTRAINT `fk_profesoremergencia_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`lugar`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`lugar` (
  `idLugar` INT NOT NULL AUTO_INCREMENT,
  `edificio` VARCHAR(45) NOT NULL,
  `piso` INT NOT NULL,
  `cubiculo` VARCHAR(45) NULL,
  `nombre` VARCHAR(150) NULL,
  `notas` VARCHAR(255) NULL,
  PRIMARY KEY (`idLugar`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesordisposicion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesordisposicion` (
  `idProfesorDisposicion` INT NOT NULL AUTO_INCREMENT,
  `trimestre_idTrimestre` INT NOT NULL,
  `profesor_idProfesor` INT NOT NULL,
  `estado` TINYINT NOT NULL DEFAULT 1,
  `notas` VARCHAR(255) NULL,
  PRIMARY KEY (`idProfesorDisposicion`, `trimestre_idTrimestre`),
  INDEX `fk_profesordisposicion_trimestre1_idx` (`trimestre_idTrimestre` ASC) ,
  INDEX `fk_profesordisposicion_profesor1_idx` (`profesor_idProfesor` ASC) ,
  CONSTRAINT `fk_profesordisposicion_trimestre1`
    FOREIGN KEY (`trimestre_idTrimestre`)
    REFERENCES `dbappcb`.`trimestre` (`idTrimestre`)
    ON DELETE CASCADE
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesordisposicion_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesor_has_lugar`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesor_has_lugar` (
  `profesor_idProfesor` INT NOT NULL,
  `lugar_idLugar` INT NOT NULL,
  PRIMARY KEY (`profesor_idProfesor`, `lugar_idLugar`),
  INDEX `fk_profesor_has_lugar_lugar1_idx` (`lugar_idLugar` ASC) ,
  INDEX `fk_profesor_has_lugar_profesor1_idx` (`profesor_idProfesor` ASC) ,
  CONSTRAINT `fk_profesor_has_lugar_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesor_has_lugar_lugar1`
    FOREIGN KEY (`lugar_idLugar`)
    REFERENCES `dbappcb`.`lugar` (`idLugar`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesorcontrato`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesorcontrato` (
  `idProfesorContrato` INT NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` INT NOT NULL,
  `profesortipo_idProfesorTipo` INT NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  PRIMARY KEY (`idProfesorContrato`, `profesor_idProfesor`),
  INDEX `fk_profesorcontrato_profesor1_idx` (`profesor_idProfesor` ASC) ,
  INDEX `fk_profesorcontrato_profesortipo1_idx` (`profesortipo_idProfesorTipo` ASC) ,
  CONSTRAINT `fk_profesorcontrato_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesorcontrato_profesortipo1`
    FOREIGN KEY (`profesortipo_idProfesorTipo`)
    REFERENCES `dbappcb`.`profesortipo` (`idProfesorTipo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesorareatipo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesorareatipo` (
  `idProfesorAreaTipo` INT NOT NULL AUTO_INCREMENT,
  `descripcion` VARCHAR(70) NOT NULL,
  PRIMARY KEY (`idProfesorAreaTipo`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;

-- -----------------------------------------------------
-- Table `dbappcb`.`profesor_has_area`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesor_has_area` (
  `profesor_idProfesor` INT NOT NULL,
  `area_idArea` INT NOT NULL,
  `profesorAreaTipo_idProfesorAreaTipo` INT NOT NULL,
  `descripcionInformal` VARCHAR(255) NULL,
  `notas` VARCHAR(255) NULL,
  PRIMARY KEY (`profesor_idProfesor`, `area_idArea`, `profesorAreaTipo_idProfesorAreaTipo`),
  INDEX `fk_profesor_has_area_area1_idx` (`area_idArea` ASC) ,
  INDEX `fk_profesor_has_area_profesor1_idx` (`profesor_idProfesor` ASC) ,
  INDEX `fk_profesor_has_area_profesorAreaTipo1_idx` (`profesorAreaTipo_idProfesorAreaTipo` ASC) ,
  CONSTRAINT `fk_profesor_has_area_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesor_has_area_area1`
    FOREIGN KEY (`area_idArea`)
    REFERENCES `dbappcb`.`area` (`idArea`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesor_has_area_profesorAreaTipo1`
    FOREIGN KEY (`profesorAreaTipo_idProfesorAreaTipo`)
    REFERENCES `dbappcb`.`profesorareatipo` (`idProfesorAreaTipo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`prestamo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`prestamo` (
  `idPrestamo` INT NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` INT NOT NULL,
  `horaInicio` TIME NOT NULL,
  `horaFin` TIME NOT NULL,
  `dia` DATE NOT NULL,
  `notas` VARCHAR(999) NULL DEFAULT NULL,
  `status` VARCHAR(100) NOT NULL,
  PRIMARY KEY (`idPrestamo`),
  INDEX `fk_prestamo_profesor1_idx` (`profesor_idProfesor` ASC) ,
  CONSTRAINT `fk_prestamo_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;



-- -----------------------------------------------------
-- Table `dbappcb`.`administrativotipo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`administrativotipo` (
  `idAdministrativoTipo` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(150) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  PRIMARY KEY (`idAdministrativoTipo`))
ENGINE = InnoDB
AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;

-- -----------------------------------------------------
-- Table `dbappcb`.`administrativo`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`administrativo` (
  `idAdministrativo` INT NOT NULL AUTO_INCREMENT,
  `administrativotipo_idAdministrativoTipo` INT NOT NULL,
  `numeroEconomico` INT NOT NULL,
  `nombre` VARCHAR(125) CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_spanish_ci' NOT NULL,
  `gradoEstudios` VARCHAR(80) NOT NULL,
  `celular` VARCHAR(20) NULL,
  `correo_uam` VARCHAR(70) CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_spanish_ci' NOT NULL,
  `correo_personal` VARCHAR(70) CHARACTER SET 'utf8mb4' COLLATE 'utf8mb4_spanish_ci' NULL,
  `lugar` VARCHAR(80) NULL,
  `extension` VARCHAR(80) NULL,
  PRIMARY KEY (`idAdministrativo`),
  UNIQUE INDEX `idAdmin` (`idAdministrativo` ASC),
  INDEX `fk_administrativo_administrativotipo1_idx` (`administrativotipo_idAdministrativoTipo` ASC),
  CONSTRAINT `fk_administrativo_administrativotipo1`
    FOREIGN KEY (`administrativotipo_idAdministrativoTipo`)
    REFERENCES `dbappcb`.`administrativotipo` (`idAdministrativoTipo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
AUTO_INCREMENT = 1
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`grupo_has_horario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`grupo_has_horario` (
  `grupo_idGrupo` INT NOT NULL,
  `horario_idHorario` INT NOT NULL,
  PRIMARY KEY (`grupo_idGrupo`, `horario_idHorario`),
  INDEX `fk_Grupo_has_Horario_Horario1_idx` (`horario_idHorario` ASC) ,
  INDEX `fk_Grupo_has_Horario_Grupo1_idx` (`grupo_idGrupo` ASC) ,
  CONSTRAINT `fk_Grupo_has_Horario_Grupo1`
    FOREIGN KEY (`grupo_idGrupo`)
    REFERENCES `dbappcb`.`grupo` (`idGrupo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Grupo_has_Horario_Horario1`
    FOREIGN KEY (`horario_idHorario`)
    REFERENCES `dbappcb`.`horario` (`idHorario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesorpreferencia_has_uea`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesorpreferencia_has_uea` (
  `profesorPreferencia_idProfesorPreferencias` INT NOT NULL,
  `uea_idUEA` INT NOT NULL,
  `prioridad` INT NOT NULL,
  PRIMARY KEY (`profesorPreferencia_idProfesorPreferencias`, `uea_idUEA`),
  INDEX `fk_profesorPreferencia_has_UEA_UEA1_idx` (`uea_idUEA` ASC) ,
  INDEX `fk_profesorPreferencia_has_UEA_profesorPreferencia1_idx` (`profesorPreferencia_idProfesorPreferencias` ASC) ,
  CONSTRAINT `fk_profesorPreferencia_has_UEA_profesorPreferencia1`
    FOREIGN KEY (`profesorPreferencia_idProfesorPreferencias`)
    REFERENCES `dbappcb`.`profesorpreferencias` (`idProfesorPreferencias`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_profesorPreferencia_has_UEA_UEA1`
    FOREIGN KEY (`uea_idUEA`)
    REFERENCES `dbappcb`.`uea` (`idUEA`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`profesorpreferencia_has_horario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`profesorpreferencia_has_horario` (
  `horario_idHorario` INT NOT NULL,
  `profesorPreferencia_idProfesorPreferencias` INT NOT NULL,
  PRIMARY KEY (`horario_idHorario`, `profesorPreferencia_idProfesorPreferencias`),
  INDEX `fk_Horario_has_profesorPreferencia_profesorPreferencia1_idx` (`profesorPreferencia_idProfesorPreferencias` ASC) ,
  INDEX `fk_Horario_has_profesorPreferencia_Horario1_idx` (`horario_idHorario` ASC) ,
  CONSTRAINT `fk_Horario_has_profesorPreferencia_Horario1`
    FOREIGN KEY (`horario_idHorario`)
    REFERENCES `dbappcb`.`horario` (`idHorario`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_Horario_has_profesorPreferencia_profesorPreferencia1`
    FOREIGN KEY (`profesorPreferencia_idProfesorPreferencias`)
    REFERENCES `dbappcb`.`profesorpreferencias` (`idProfesorPreferencias`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`areaacademica`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`areaacademica` (
  `idAreaAcademica` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(120) NOT NULL,
  `puesto` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`idAreaAcademica`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`grupotematico`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`grupotematico` (
  `idGrupoTematico` INT NOT NULL AUTO_INCREMENT,
  `nombreGrupo` VARCHAR(120) NOT NULL,
  `puesto` VARCHAR(150) NOT NULL,
  PRIMARY KEY (`idGrupoTematico`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`areaacademica_has_profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`areaacademica_has_profesor` (
  `areaAcademica_idAreaAcademica` INT NOT NULL,
  `profesor_idProfesor` INT NOT NULL,
  PRIMARY KEY (`areaAcademica_idAreaAcademica`, `profesor_idProfesor`),
  INDEX `fk_areaAcademica_has_profesor_profesor1_idx` (`profesor_idProfesor` ASC) ,
  INDEX `fk_areaAcademica_has_profesor_areaAcademica1_idx` (`areaAcademica_idAreaAcademica` ASC) ,
  CONSTRAINT `fk_areaAcademica_has_profesor_areaAcademica1`
    FOREIGN KEY (`areaAcademica_idAreaAcademica`)
    REFERENCES `dbappcb`.`areaacademica` (`idAreaAcademica`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_areaAcademica_has_profesor_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`grupotematico_has_profesor`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`grupotematico_has_profesor` (
  `grupoTematico_idGrupoTematico` INT NOT NULL,
  `profesor_idProfesor` INT NOT NULL,
  PRIMARY KEY (`grupoTematico_idGrupoTematico`, `profesor_idProfesor`),
  INDEX `fk_grupoTematico_has_profesor_profesor1_idx` (`profesor_idProfesor` ASC) ,
  INDEX `fk_grupoTematico_has_profesor_grupoTematico1_idx` (`grupoTematico_idGrupoTematico` ASC) ,
  CONSTRAINT `fk_grupoTematico_has_profesor_grupoTematico1`
    FOREIGN KEY (`grupoTematico_idGrupoTematico`)
    REFERENCES `dbappcb`.`grupotematico` (`idGrupoTematico`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_grupoTematico_has_profesor_profesor1`
    FOREIGN KEY (`profesor_idProfesor`)
    REFERENCES `dbappcb`.`profesor` (`idProfesor`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`material`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`material` (
  `idMaterial` INT NOT NULL AUTO_INCREMENT,
  `nombre` VARCHAR(80) NOT NULL,
  `descripcion` VARCHAR(255) NULL,
  PRIMARY KEY (`idMaterial`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`prestamo_has_material`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`prestamo_has_material` (
  `prestamo_idPrestamo` INT NOT NULL,
  `material_idMaterial` INT NOT NULL,
  PRIMARY KEY (`prestamo_idPrestamo`, `material_idMaterial`),
  INDEX `fk_prestamo_has_material_material1_idx` (`material_idMaterial` ASC) ,
  INDEX `fk_prestamo_has_material_prestamo1_idx` (`prestamo_idPrestamo` ASC) ,
  CONSTRAINT `fk_prestamo_has_material_prestamo1`
    FOREIGN KEY (`prestamo_idPrestamo`)
    REFERENCES `dbappcb`.`prestamo` (`idPrestamo`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_prestamo_has_material_material1`
    FOREIGN KEY (`material_idMaterial`)
    REFERENCES `dbappcb`.`material` (`idMaterial`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Table `dbappcb`.`programacion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`programacion` (
  `grupo_trimestre_idTrimestre` INT NOT NULL,
  `grupo_idGrupo` INT NOT NULL,
  `profesordisposicion_idProfesorDisposicion` INT NOT NULL,
  PRIMARY KEY (`grupo_trimestre_idTrimestre`, `grupo_idGrupo`, `profesordisposicion_idProfesorDisposicion`),
  INDEX `fk_profesor_has_grupo_grupo1_idx` (`grupo_idGrupo` ASC, `grupo_trimestre_idTrimestre` ASC) ,
  INDEX `fk_programacion_profesordisposicion1_idx` (`profesordisposicion_idProfesorDisposicion` ASC) ,
  CONSTRAINT `fk_profesor_has_grupo_grupo1`
    FOREIGN KEY (`grupo_idGrupo` , `grupo_trimestre_idTrimestre`)
    REFERENCES `dbappcb`.`grupo` (`idGrupo` , `trimestre_idTrimestre`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT `fk_programacion_profesordisposicion1`
    FOREIGN KEY (`profesordisposicion_idProfesorDisposicion`)
    REFERENCES `dbappcb`.`profesordisposicion` (`idProfesorDisposicion`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_spanish_ci;


-- -----------------------------------------------------
-- Placeholder table for view `dbappcb`.`trim_ver_programacion`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `dbappcb`.`trim_ver_programacion` (`idTrimestre` INT, `añoTrimestre` INT, `idUEA` INT, `claveUEA` INT, `idGrupo` INT, `claveGrupo` INT, `idHorario` INT, `dia` INT, `horaInicio` INT, `horaFin` INT, `idProfesor` INT, `numeroEconomico` INT, `nombreProfesor` INT);

-- -----------------------------------------------------
-- procedure INSERTA_GRUPO
-- -----------------------------------------------------
DROP procedure IF EXISTS `dbappcb`.`INSERTA_GRUPO`;

DELIMITER $$
USE `dbappcb`$$
CREATE DEFINER=`usrdoccb`@`%` PROCEDURE `INSERTA_GRUPO`(_trimAño int, _trimPeriodo varchar(1), _claveUEA int, _grupo varchar(25), _dia varchar(25), _horaIni TIME, _horaFin TIME)
BEGIN
		DECLARE X INT;
        DECLARE Y INT;
        DECLARE Z INT;
        DECLARE W INT;
		SELECT idUEA INTO X FROM uea WHERE uea.claveUEA = _claveUEA;
        SELECT idTrimestre INTO Y FROM trimestre WHERE trimestre.año = _trimAño AND trimestre.periodo= _trimPeriodo;
        SELECT idGrupo INTO W FROM grupo WHERE grupo.uea_idUEA= X AND grupo.trimestre_idTrimestre= Y AND grupo.claveGrupo= _grupo;
        SELECT idHorario INTO Z FROM horario WHERE horario.dia= _dia AND horario.horaInicio= _horaIni AND horario.horaFin= _horaFin;
        
        INSERT INTO grupo_has_horario VALUES ( W, Z);
	END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_GRUPO_HORARIO  
-- -----------------------------------------------------
DROP procedure IF EXISTS `dbappcb`.`INSERTA_GRUPO_HORARIO`;

DELIMITER $$
USE `dbappcb`$$
CREATE DEFINER=`usrdoccb`@`%` PROCEDURE `INSERTA_GRUPO_HORARIO`( _claveGrupo varchar(20), _trimPeriodo varchar(1), _trimAño int, _claveUEA int, _Dia varchar(25),_horaInicio time,_horaFin time)
BEGIN
		DECLARE X INT;
        DECLARE Y INT;
        DECLARE Z INT;
        DECLARE W INT;
		SELECT idUEA INTO X FROM uea WHERE uea.claveUEA = _claveUEA;
        SELECT idTrimestre INTO Y FROM trimestre WHERE trimestre.año = _trimAño AND trimestre.periodo= _trimPeriodo;
        SELECT idGrupo INTO Z FROM grupo WHERE grupo.claveGrupo= _claveGrupo AND grupo.uea_idUEA= idUEA AND grupo.trimestre_idTrimestre= Y;
        
        SELECT idHorario INTO W FROM horario WHERE horario.horaInicio=_horaInicio AND horario.horaFin=_horaFin AND horario.dia=_Dia ORDER BY horaInicio;
        INSERT INTO grupo_has_horario VALUES ( Z, W);
	END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_PREFERENCIA_PROFESOR
-- -----------------------------------------------------
DROP procedure IF EXISTS `dbappcb`.`INSERTA_PREFERENCIA_PROFESOR`;

DELIMITER $$
USE `dbappcb`$$
CREATE DEFINER=`usrdoccb`@`%` PROCEDURE `INSERTA_PREFERENCIA_PROFESOR`( _trimPeriodo varchar(1), _trimAño int, _profesorEconomico int, _observaciones varchar(955), _grupos int)
BEGIN
		DECLARE X INT;
        DECLARE Z INT;
		SELECT idTrimestre INTO X FROM trimestre INNER JOIN trimestreperiodo ON trimestre.trimestreperiodo_idTrimestrePeriodo= trimestreperiodo.idTrimestrePeriodo
    WHERE trimestre.año= _trimAño AND trimestreperiodo.sigla= _trimPeriodo;
        SELECT idProfesor INTO Z FROM profesor WHERE profesor.numeroEconomico= _profesorEconomico;
        INSERT INTO profesorpreferencias VALUES ( null, Z, X, _grupos, _observaciones);
                
	END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_PREFERENCIA_PROFESOR_UEA
-- -----------------------------------------------------
DROP procedure IF EXISTS `dbappcb`.`INSERTA_PREFERENCIA_PROFESOR_UEA`;

DELIMITER $$
USE `dbappcb`$$
CREATE DEFINER=`usrdoccb`@`%` PROCEDURE `INSERTA_PREFERENCIA_PROFESOR_UEA`( _trimPeriodo varchar(1), _trimAño int, _profesorEconomico int, _uea int, _prioridad int)
BEGIN
		DECLARE X INT;
        DECLARE Z INT;
        DECLARE Y INT;
        DECLARE W INT;
		SELECT idTrimestre INTO X FROM trimestre INNER JOIN trimestreperiodo ON trimestre.trimestreperiodo_idTrimestrePeriodo= trimestreperiodo.idTrimestrePeriodo
    WHERE trimestre.año= _trimAño AND trimestreperiodo.sigla= _trimPeriodo;
        SELECT idProfesor INTO Z FROM profesor WHERE profesor.numeroEconomico= _profesorEconomico;
        SELECT idProfesorPreferencias INTO Y FROM profesorpreferencias WHERE profesorpreferencias.profesor_idProfesor= Z AND profesorpreferencias.trimestre_idTrimestre= X;
        SELECT idUEA INTO W FROM uea Where uea.claveUEA= _uea;
        INSERT INTO profesorpreferencia_has_uea VALUES ( Y, W, _prioridad);
                
	END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_PREFERENCIA_PROFESOR_HORARIO
-- -----------------------------------------------------
DROP procedure IF EXISTS `dbappcb`.`INSERTA_PREFERENCIA_PROFESOR_HORARIO`;

DELIMITER $$
USE `dbappcb`$$
CREATE DEFINER=`usrdoccb`@`%` PROCEDURE `INSERTA_PREFERENCIA_PROFESOR_HORARIO`( 
	_trimPeriodo varchar(1), 
	_trimAño int, 
    _profesorEconomico int, 
    _dia varchar(25), 
    _horaIni TIME, 
    _horaFin TIME
)
BEGIN
DECLARE X INT; -- idTrimestre
    DECLARE Z INT; -- idProfesor
    DECLARE Y INT; -- idProfesorPreferencias
    DECLARE W INT; -- idHorario original
    DECLARE uno INT; -- idHorario de una hora

    -- Obtener ids necesarios
    SELECT idTrimestre INTO X 
    FROM trimestre 
    INNER JOIN trimestreperiodo 
    ON trimestre.trimestreperiodo_idTrimestrePeriodo = trimestreperiodo.idTrimestrePeriodo 
    WHERE trimestre.año = _trimAño 
    AND trimestreperiodo.sigla = _trimPeriodo;

    SELECT idProfesor INTO Z 
    FROM profesor 
    WHERE profesor.numeroEconomico = _profesorEconomico;

    SELECT idProfesorPreferencias INTO Y 
    FROM profesorpreferencias 
    WHERE profesorpreferencias.profesor_idProfesor = Z 
    AND profesorpreferencias.trimestre_idTrimestre = X;

    -- Obtener id del horario original
    SELECT idHorario INTO W 
    FROM horario 
    WHERE horario.dia = _dia 
    AND horario.horaInicio = _horaIni 
    AND horario.horaFin = _horaFin;

    -- Obtener id del horario de una hora
    SELECT idHorario INTO uno 
    FROM horario 
    WHERE horario.dia = _dia
    AND horaInicio = _horaIni
    AND horaFin = ADDDATE(_horaIni, INTERVAL '1' hour);

    -- Insertar horario original
    INSERT INTO profesorpreferencia_has_horario 
    VALUES (W, Y);

    -- Insertar horario de una hora solo si existe
    IF uno IS NOT NULL THEN
        INSERT INTO profesorpreferencia_has_horario 
        VALUES (uno, Y);
    END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTAR_PROFESOR_GRUPO
-- -----------------------------------------------------

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `INSERTAR_PROFESOR_GRUPO` ( _idTrim int, _idGrupo int,_idProf int)
BEGIN
  DECLARE X, Y INT;
  SELECT profesordisposicion_idProfesorDisposicion INTO X FROM programacion WHERE grupo_idGrupo=_idGrupo AND grupo_trimestre_idTrimestre= _idTrim;
  SELECT IFNULL(X,0) INTO Y;
  IF (Y = 0) THEN
    INSERT INTO programacion ( grupo_trimestre_idTrimestre, grupo_idGrupo, profesordisposicion_idProfesorDisposicion) VALUES( _idTrim, _idGrupo, _idProf);
  ELSE
    UPDATE programacion SET profesordisposicion_idProfesorDisposicion = _idProf WHERE grupo_idGrupo = _idGrupo AND grupo_trimestre_idTrimestre= _idTrim;
  END IF;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure VER_HORARIO_UEA
-- -----------------------------------------------------

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `VER_HORARIO_UEA` ( IN _idUEA INT, IN _idTrimestre INT)
BEGIN
  SELECT t.idTrimestre        AS idTrimestre,
         t.año                AS añoTrimestre,
         u.idUEA              AS idUEA,
         u.claveUEA           AS claveUEA,
         g.idGrupo            AS idGrupo,
         g.claveGrupo         AS claveGrupo,
         h.idHorario          AS idHorario,
         h.dia                AS dia,
         h.horaInicio         AS horaInicio,
         h.horaFin            AS horaFin,
         p.idProfesor         AS idProfesor,
         p.numeroEconomico    AS numeroEconomico,
         p.nombre             AS nombreProfesor
  FROM grupo g
  JOIN uea u ON g.uea_idUEA = u.idUEA
  JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
  JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
  JOIN horario h ON gh.horario_idHorario = h.idHorario
  LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
  LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
  LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
  WHERE u.idUEA = _idUEA
    AND g.trimestre_idTrimestre = _idTrimestre
  ORDER BY t.idTrimestre, u.claveUEA, g.claveGrupo;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure BUSCAR_UEA_HORARIO
-- -----------------------------------------------------

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `BUSCAR_UEA_HORARIO` ( IN _idUEA INT, IN _idTrimestre INT)
BEGIN
  SELECT t.idTrimestre        AS idTrimestre,
         t.año                AS añoTrimestre,
         u.idUEA              AS idUEA,
         u.claveUEA           AS claveUEA,
         g.idGrupo            AS idGrupo,
         g.claveGrupo         AS claveGrupo,
         h.idHorario          AS idHorario,
         h.dia                AS dia,
         h.horaInicio         AS horaInicio,
         h.horaFin            AS horaFin,
         p.idProfesor         AS idProfesor,
         p.numeroEconomico    AS numeroEconomico,
         p.nombre             AS nombreProfesor
  FROM grupo g
  JOIN uea u ON g.uea_idUEA = u.idUEA
  JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
  JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
  JOIN horario h ON gh.horario_idHorario = h.idHorario
  LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
  LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
  LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
  WHERE u.idUEA = _idUEA
    AND g.trimestre_idTrimestre = _idTrimestre
  ORDER BY t.idTrimestre, u.claveUEA, g.claveGrupo;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure VER_TRIMESTRE
-- -----------------------------------------------------

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `VER_TRIMESTRE` ( IN _idTrimestre INT)
BEGIN
  SELECT t.idTrimestre        AS idTrimestre,
         t.año                AS añoTrimestre,
         u.idUEA              AS idUEA,
         u.claveUEA           AS claveUEA,
         g.idGrupo            AS idGrupo,
         g.claveGrupo         AS claveGrupo,
         h.idHorario          AS idHorario,
         h.dia                AS dia,
         h.horaInicio         AS horaInicio,
         h.horaFin            AS horaFin,
         p.idProfesor         AS idProfesor,
         p.numeroEconomico    AS numeroEconomico,
         p.nombre             AS nombreProfesor
  FROM grupo g
  JOIN uea u ON g.uea_idUEA = u.idUEA
  JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
  JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
  JOIN horario h ON gh.horario_idHorario = h.idHorario
  LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
  LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
  LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
  WHERE g.trimestre_idTrimestre = _idTrimestre
  ORDER BY u.claveUEA, g.claveGrupo;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL
-- -----------------------------------------------------
/*
  PROCEDIMIENTO: INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL

  Propósito:
    A partir de un horario base (identificado por _idHorarioUno) y el número
    económico del profesor (_noEco), busca la entrada de preferencias del
    profesor para el trimestre indicado (_idTrimestre) y registra en la
    tabla `profesorpreferencia_has_horario` todos los horarios candidatos
    que representen ventanas contiguas desde ese inicio hasta una ventana
    máximo de 3 horas (ventana de búsqueda base + 3:00), probando varias
    duraciones típicas.

  Parámetros:
    - _noEco INT: número económico del profesor (columna `numeroEconomico`)
    - _idHorarioUno INT: id del horario base en la tabla `horario`
    - _idTrimestre INT: id del trimestre (tabla `trimestre`) en cuyo contexto
      se debería localizar la fila de `profesorpreferencias`.

  Comportamiento:
    1. Resuelve `idProfesor` desde `profesor.numeroEconomico`.
    2. Resuelve `idProfesorPreferencias` (la preferencia concreta) para
       ese profesor y el `idTrimestre` pasado.
    3. Obtiene el `dia` y la `horaInicio` del `idHorarioUno`.
    4. Para offsets de 0, 30, 60 y 90 minutos desde la hora base calcula
       posibles intervalos (1:00, 1:30, 2:00, 2:15, 2:30, 3:00) y, si existe
       exactamente un registro en `horario` que coincida con `dia`,
       `horaInicio` y `horaFin` para cada candidato, lo inserta (INSERT IGNORE)
       en `profesorpreferencia_has_horario` enlazando con la preferencia
       encontrada.

  Efectos colaterales:
    - Inserta filas en `profesorpreferencia_has_horario` (uso de INSERT IGNORE
      para evitar duplicados).

  Retorno / Errores:
    - No devuelve resultado. Si no se encuentra el profesor, la preferencia
      para el trimestre, o el horario base, el procedimiento termina sin
      hacer inserciones.

  Observaciones / recomendaciones:
    - Este procedimiento asume que las filas de `horario` contienen
      combinaciones exactas de `dia`, `horaInicio` y `horaFin` que se
      corresponden con las duraciones buscadas. Si la malla de horarios no
      tiene entradas para ciertos pasos de 15/30 minutos, esos candidatos
      simplemente no se insertarán.
    - El parámetro `_idTrimestre` permite asegurar que las inserciones se
      asocien con la preferencia del trimestre correcto (evita ambigüedades
      si un profesor tiene registros en distintos trimestres).
*/

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL` (
  IN _noEco INT,
  IN _idHorarioUno INT,
  IN _idTrimestre INT
)
proc: BEGIN
  DECLARE v_idProfesor INT DEFAULT NULL;
  DECLARE v_idPref INT DEFAULT NULL;
  DECLARE v_dia VARCHAR(25);
  DECLARE v_baseStart TIME;
  DECLARE v_winEnd TIME;
  DECLARE v_offsetMin INT DEFAULT 0;
  DECLARE v_startCalc TIME;
  DECLARE v_endCalc TIME;
  DECLARE v_cand INT;

  -- resolver profesor a partir del numero economico
  SELECT idProfesor INTO v_idProfesor FROM profesor WHERE numeroEconomico = _noEco LIMIT 1;
  IF v_idProfesor IS NULL THEN
    LEAVE proc;
  END IF;

  -- resolver preferencia del profesor para el trimestre dado
  SELECT idProfesorPreferencias INTO v_idPref
  FROM profesorpreferencias
  WHERE profesor_idProfesor = v_idProfesor
    AND trimestre_idTrimestre = _idTrimestre
  LIMIT 1;

  IF v_idPref IS NULL THEN
    LEAVE proc;
  END IF;

  -- obtener dia y hora inicio del horario base
  SELECT horaInicio, dia INTO v_baseStart, v_dia FROM horario WHERE idHorario = _idHorarioUno LIMIT 1;
  IF v_baseStart IS NULL THEN
    LEAVE proc;
  END IF;

  -- fin de ventana: base + 3:00
  SET v_winEnd = ADDTIME(v_baseStart, '03:00:00');

  SET v_offsetMin = 0;
  WHILE v_offsetMin <= 90 DO
    SET v_startCalc = ADDTIME(v_baseStart, SEC_TO_TIME(v_offsetMin * 60));

    -- lista de duraciones a evaluar (1:00, 1:30, 2:00, 2:15, 2:30, 3:00)
    SET v_endCalc = ADDTIME(v_startCalc, '01:00:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_endCalc = ADDTIME(v_startCalc, '01:30:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_endCalc = ADDTIME(v_startCalc, '02:00:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_endCalc = ADDTIME(v_startCalc, '02:15:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_endCalc = ADDTIME(v_startCalc, '02:30:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_endCalc = ADDTIME(v_startCalc, '03:00:00');
    IF v_endCalc <= v_winEnd THEN
      SELECT idHorario INTO v_cand FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia)) AND horaInicio = v_startCalc AND horaFin = v_endCalc LIMIT 1;
      IF v_cand IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias) VALUES (v_cand, v_idPref);
      END IF;
    END IF;

    SET v_offsetMin = v_offsetMin + 30;
  END WHILE;

END proc$$

DELIMITER ;

-- -----------------------------------------------------
-- procedure INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS
-- -----------------------------------------------------

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS` ( _noEco INT, _idHorarioUno INT, _idTrimestre INT)
BEGIN
DECLARE X INT; -- idProfesor
    DECLARE Z VARCHAR(25); -- dia
    DECLARE Y TIME; -- horaInicio
    DECLARE mediaTres INT; -- idHorario a insertar
    DECLARE pref INT; -- idProfesorPreferencias

    trabajo: BEGIN
        -- resolver idProfesor desde numeroEconomico
        SELECT idProfesor INTO X FROM profesor WHERE numeroEconomico = _noEco LIMIT 1;
        IF X IS NULL THEN
            LEAVE trabajo;
        END IF;

        -- resolver idProfesorPreferencias por profesor y trimestre
        SELECT idProfesorPreferencias INTO pref 
        FROM profesorpreferencias 
        WHERE profesor_idProfesor = X 
          AND trimestre_idTrimestre = _idTrimestre 
        LIMIT 1;

        IF pref IS NULL THEN
            LEAVE trabajo;
        END IF;

        -- obtener horaInicio y dia del horario base
        SELECT horaInicio, dia INTO Y, Z FROM horario WHERE idHorario = _idHorarioUno LIMIT 1;

        -- buscar el horario "mediaTres" (inicio +00:30, fin +03:30) en el mismo dia
        SELECT idHorario INTO mediaTres
        FROM horario 
        WHERE horaInicio = (SELECT adddate(horaInicio, INTERVAL '0 30' hour_minute) 
                           FROM horario WHERE idHorario = _idHorarioUno)
          AND horaFin = (SELECT adddate(horaInicio, INTERVAL '3 30' hour_minute) 
                        FROM horario WHERE idHorario = _idHorarioUno)
          AND dia = Z
        LIMIT 1;

        -- insertar en profesorpreferencia_has_horario
        IF mediaTres IS NOT NULL THEN
            INSERT IGNORE INTO profesorpreferencia_has_horario 
                (horario_idHorario, profesorPreferencia_idProfesorPreferencias)
            VALUES (mediaTres, pref);
        END IF;
    END trabajo;
END$$

DELIMITER ;

-- -----------------------------------------------------
-- View `dbappcb`.`trim_ver_programacion`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `dbappcb`.`trim_ver_programacion`;
USE `dbappcb`;
CREATE  OR REPLACE VIEW `trim_ver_programacion` AS
SELECT t.idTrimestre        AS idTrimestre,
       t.año                AS añoTrimestre,
       u.idUEA              AS idUEA,
       u.claveUEA           AS claveUEA,
       g.idGrupo            AS idGrupo,
       g.claveGrupo         AS claveGrupo,
       h.idHorario          AS idHorario,
       h.dia                AS dia,
       h.horaInicio         AS horaInicio,
       h.horaFin            AS horaFin,
       p.idProfesor         AS idProfesor,
       p.numeroEconomico    AS numeroEconomico,
       p.nombre             AS nombreProfesor
FROM grupo g
JOIN uea u ON g.uea_idUEA = u.idUEA
JOIN trimestre t ON g.trimestre_idTrimestre = t.idTrimestre
JOIN grupo_has_horario gh ON g.idGrupo = gh.grupo_idGrupo
JOIN horario h ON gh.horario_idHorario = h.idHorario
LEFT JOIN programacion pr ON pr.grupo_idGrupo = g.idGrupo AND pr.grupo_trimestre_idTrimestre = g.trimestre_idTrimestre
LEFT JOIN profesordisposicion pd ON pr.profesordisposicion_idProfesorDisposicion = pd.idProfesorDisposicion
LEFT JOIN profesor p ON pd.profesor_idProfesor = p.idProfesor
ORDER BY t.idTrimestre, u.claveUEA, g.claveGrupo;

-- Crear usuario si no existe
CREATE USER IF NOT EXISTS 'usrdoccb'@'%' IDENTIFIED BY 'password';

-- Otorgar permisos si no los tiene
GRANT ALL PRIVILEGES ON `dbappcb`.* TO 'usrdoccb'@'%';
FLUSH PRIVILEGES;

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;

-- Redefinir procedimiento para 3 horarios contiguos
DROP PROCEDURE IF EXISTS `INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS`;

/*
  PROCEDIMIENTO: INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS

  Propósito:
    Buscar e insertar únicamente horarios de DURACIÓN EXACTA 3:00 horas
    que comiencen en una serie de offsets (0, 30, 60, 90 minutos) respecto
    de una hora base, siempre que el final (inicio + 3:00) no exceda la
    ventana máxima (base + 4:30). Diseñado para representar la preferencia
    por bloques contiguos de 3 horas (por ejemplo 07:00-10:00, 07:30-10:30, ...).

  Parámetros:
    - _noEco INT: número económico del profesor.
    - _idHorarioUno INT: id del horario de referencia (se usa su horaInicio y dia).
    - _idTrimestre INT: id del trimestre para localizar la fila de preferencia.

  Comportamiento:
    1. Resuelve idProfesor desde numeroEconomico.
    2. Resuelve idProfesorPreferencias para ese profesor y el trimestre
       (se toma la preferencia más reciente si hubiera varias).
    3. Calcula la ventana máxima (horaInicio base + 4:30).
    4. Para offsets 0,30,60,90 minutos calcula inicio candidato y fin = inicio + 3:00.
       Si existe un registro en `horario` para (dia, horaInicio=inicio, horaFin=fin)
       inserta esa relación en `profesorpreferencia_has_horario`.

  Efectos colaterales:
    - Inserta filas en `profesorpreferencia_has_horario` usando INSERT IGNORE.

  Notas:
    - Este procedimiento está pensado para asignar bloques de 3 horas en
      pasos de 30 minutos. Si la tabla `horario` no contiene entradas con
      horas exactas para esos rangos, no se insertará nada para ese candidato.
    - El uso de `_idTrimestre` evita mezclar preferencias entre trimestres.
*/

DELIMITER $$
USE `dbappcb`$$
CREATE PROCEDURE `INSERTA_PREFERENCIA_PROFESOR_HORARIO_ESPECIAL_DOS` (
  IN _noEco INT,
  IN _idHorarioUno INT,
  IN _idTrimestre INT
)
proc: BEGIN
  DECLARE v_idProfesor INT DEFAULT NULL;
  DECLARE v_idPref INT DEFAULT NULL;
  DECLARE v_dia VARCHAR(25);
  DECLARE v_horaIni TIME;
  DECLARE v_winEnd TIME;
  -- Resolver profesor e id de preferencia del trimestre
  SELECT p.idProfesor INTO v_idProfesor
  FROM profesor p
  WHERE p.numeroEconomico = _noEco
  LIMIT 1;

  IF v_idProfesor IS NULL THEN
    LEAVE proc;
  END IF;

  SELECT pp.idProfesorPreferencias INTO v_idPref
  FROM profesorpreferencias pp
  WHERE pp.profesor_idProfesor = v_idProfesor
    AND pp.trimestre_idTrimestre = _idTrimestre
  ORDER BY pp.idProfesorPreferencias DESC
  LIMIT 1;

  IF v_idPref IS NULL THEN
    LEAVE proc;
  END IF;

  -- Horario base (h1)
  SELECT h.dia, h.horaInicio INTO v_dia, v_horaIni
  FROM horario h
  WHERE h.idHorario = _idHorarioUno
  LIMIT 1;

  IF v_dia IS NULL THEN
    LEAVE proc;
  END IF;

  -- Fin de la ventana de 3 contiguos (4:30 desde el inicio base)
  SET v_winEnd = ADDTIME(v_horaIni, '04:30:00');

  /* Insertar únicamente los horarios de duración EXACTA 3:00 que comiencen
     en start = base + offset donde offset ∈ {0,30,60,90} minutos y tal que
     start + 3:00 <= base + 4:30. Esto genera ventanas en pasos de 30 minutos
     (ej.: 07:00-10:00, 07:30-10:30, 08:00-11:00, 08:30-11:30). */
  DECLARE v_offset INT DEFAULT 0; -- minutos
  DECLARE v_start TIME;
  DECLARE v_end TIME;
  DECLARE v_found INT;

  SET v_offset = 0;
  WHILE v_offset <= 90 DO
    -- calcular inicio candidato sumando v_offset minutos a la hora base
    SET v_start = ADDTIME(v_horaIni, SEC_TO_TIME(v_offset * 60));
    -- fin esperado para duración 3:00
    SET v_end = ADDTIME(v_start, '03:00:00');
    -- sólo insertar si el fin no sobrepasa la ventana máxima
    IF v_end <= v_winEnd THEN
      SELECT idHorario INTO v_found
      FROM horario
      WHERE LOWER(TRIM(dia)) = LOWER(TRIM(v_dia))
        AND horaInicio = v_start
        AND horaFin = v_end
      LIMIT 1;
      IF v_found IS NOT NULL THEN
        INSERT IGNORE INTO profesorpreferencia_has_horario (horario_idHorario, profesorPreferencia_idProfesorPreferencias)
        VALUES (v_found, v_idPref);
      END IF;
    END IF;
    SET v_offset = v_offset + 30;
  END WHILE;

END proc$$
DELIMITER ;

