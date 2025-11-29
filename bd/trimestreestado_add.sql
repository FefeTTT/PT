-- bd/trimestreestado_add.sql
-- Script para crear la tabla `trimestreestado`, poblarla con valores de ejemplo,
-- añadir la columna en `trimestre` (como NULL para seguridad), y crear el índice + FK.
-- Requisitos: ejecutarlo con un usuario que tenga privilegios ALTER/INSERT en la base `dbappcb`.

-- 1) Crear la tabla (id auto-incremental)
CREATE TABLE IF NOT EXISTS `dbappcb`.`trimestreestado` (
  `idTrimestreEstado` INT NOT NULL AUTO_INCREMENT,
  `estado` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`idTrimestreEstado`)
) ENGINE = InnoDB
  DEFAULT CHARACTER SET = utf8mb4
  COLLATE = utf8mb4_spanish_ci;

-- 2) Poblar con algunos estados ejemplares (uso INSERT IGNORE para no duplicar)
INSERT IGNORE INTO `dbappcb`.`trimestreestado` (`idTrimestreEstado`, `estado`)
VALUES
  (1, 'Terminado'),
  (2, 'En proceso'),
  (3, 'A programar');

-- 3) Añadir la columna a `trimestre` de forma segura (añadir como NULL primero)
-- Nota: MySQL 5.7 no soporta ADD COLUMN IF NOT EXISTS; revisa antes con
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS ... si lo deseas.
ALTER TABLE `dbappcb`.`trimestre`
  ADD COLUMN `trimestreestado_idTrimestreEstado` INT NULL AFTER `idTrimestre`;

-- 4) (Opcional/seguro) Actualizar filas existentes que no tengan valor para apuntar
-- al estado 'Activo' (si existe). Esto no generará cambios si no hay estado 'Activo'.
UPDATE `dbappcb`.`trimestre` t
JOIN (
  SELECT idTrimestreEstado FROM `dbappcb`.`trimestreestado` WHERE estado = 'Activo' LIMIT 1
) te ON 1=1
SET t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
WHERE t.trimestreestado_idTrimestreEstado IS NULL;

-- 5) Si quieres forzar NOT NULL después de haber rellenado valores válidos, descomenta
-- la siguiente línea y ejecútala solo cuando todas las filas tengan un value válido:
-- ALTER TABLE `dbappcb`.`trimestre` MODIFY COLUMN `trimestreestado_idTrimestreEstado` INT NOT NULL;

-- 6) Añadir índice y la constraint FOREIGN KEY
ALTER TABLE `dbappcb`.`trimestre`
  ADD INDEX `fk_trimestre_trimestreestado1_idx` (`trimestreestado_idTrimestreEstado` ASC);

ALTER TABLE `dbappcb`.`trimestre`
  ADD CONSTRAINT `fk_trimestre_trimestreestado1`
    FOREIGN KEY (`trimestreestado_idTrimestreEstado`)
    REFERENCES `dbappcb`.`trimestreestado` (`idTrimestreEstado`)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;

-- FIN del script

-- Recomendación:
-- 1) Ejecuta el script hasta la sección 3 (CREATE + INSERT + ADD COLUMN)
-- 2) Verifica que no haya valores huérfanos con la consulta:
--    SELECT DISTINCT t.trimestreestado_idTrimestreEstado
--    FROM `dbappcb`.`trimestre` t
--    LEFT JOIN `dbappcb`.`trimestreestado` te ON t.trimestreestado_idTrimestreEstado = te.idTrimestreEstado
--    WHERE te.idTrimestreEstado IS NULL;
-- 3) Si devuelve filas, corrígelas (INSERT ó UPDATE) antes de añadir la FK.
