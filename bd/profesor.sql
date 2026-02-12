-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 12-02-2026 a las 21:29:16
-- Versión del servidor: 10.4.27-MariaDB
-- Versión de PHP: 7.4.33

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `dbappcb`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `profesor`
--
USE dbappcb;

CREATE TABLE `profesor` (
  `numeroEconomico` int(11) NOT NULL,
  `nombre` varchar(125) NOT NULL,
  `gradoEstudios` varchar(80) NOT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `correo_uam` varchar(70) NOT NULL,
  `correo_personal` varchar(70) DEFAULT NULL,
  `idArea` int(11) DEFAULT NULL,
  `idGrado` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;


--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `profesor`
--
ALTER TABLE `profesor`
  ADD PRIMARY KEY (`numeroEconomico`),
  ADD KEY `fk_profesor_area` (`idArea`),
  ADD KEY `fk_profesor_grado` (`idGrado`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `profesor`
--
ALTER TABLE `profesor`
  MODIFY `numeroEconomico` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=47399;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `profesor`
--
ALTER TABLE `profesor`
  ADD CONSTRAINT `fk_profesor_area` FOREIGN KEY (`idArea`) REFERENCES `area` (`idArea`) ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT `fk_profesor_grado` FOREIGN KEY (`idGrado`) REFERENCES `grado_estudios` (`idGrado`) ON DELETE SET NULL ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
