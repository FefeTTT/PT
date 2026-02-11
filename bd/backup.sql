-- MariaDB dump 10.19  Distrib 10.4.27-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: dbappcb
-- ------------------------------------------------------
-- Server version	10.4.27-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `administrativo`
--

DROP TABLE IF EXISTS `administrativo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `administrativo` (
  `idAdministrativo` int(11) NOT NULL AUTO_INCREMENT,
  `administrativotipo_idAdministrativoTipo` int(11) NOT NULL,
  `numeroEconomico` int(11) NOT NULL,
  `nombre` varchar(125) NOT NULL,
  `gradoEstudios` varchar(80) NOT NULL,
  `celular` varchar(20) DEFAULT NULL,
  `correo_uam` varchar(70) NOT NULL,
  `correo_personal` varchar(70) DEFAULT NULL,
  `lugar` varchar(80) DEFAULT NULL,
  `extension` varchar(80) DEFAULT NULL,
  PRIMARY KEY (`idAdministrativo`),
  UNIQUE KEY `idAdmin` (`idAdministrativo`),
  KEY `fk_administrativo_administrativotipo1_idx` (`administrativotipo_idAdministrativoTipo`),
  CONSTRAINT `fk_administrativo_administrativotipo1` FOREIGN KEY (`administrativotipo_idAdministrativoTipo`) REFERENCES `administrativotipo` (`idAdministrativoTipo`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administrativo`
--

LOCK TABLES `administrativo` WRITE;
/*!40000 ALTER TABLE `administrativo` DISABLE KEYS */;
/*!40000 ALTER TABLE `administrativo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `administrativotipo`
--

DROP TABLE IF EXISTS `administrativotipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `administrativotipo` (
  `idAdministrativoTipo` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idAdministrativoTipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `administrativotipo`
--

LOCK TABLES `administrativotipo` WRITE;
/*!40000 ALTER TABLE `administrativotipo` DISABLE KEYS */;
/*!40000 ALTER TABLE `administrativotipo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `area`
--

DROP TABLE IF EXISTS `area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `area` (
  `idArea` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) NOT NULL,
  PRIMARY KEY (`idArea`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `area`
--

LOCK TABLES `area` WRITE;
/*!40000 ALTER TABLE `area` DISABLE KEYS */;
INSERT INTO `area` VALUES (1,'Matemáticas'),(2,'Física'),(3,'Química'),(4,'Tronco Inter y Multidisciplinar'),(5,'CSH');
/*!40000 ALTER TABLE `area` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areaacademica`
--

DROP TABLE IF EXISTS `areaacademica`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `areaacademica` (
  `idAreaAcademica` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(120) NOT NULL,
  PRIMARY KEY (`idAreaAcademica`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areaacademica`
--

LOCK TABLES `areaacademica` WRITE;
/*!40000 ALTER TABLE `areaacademica` DISABLE KEYS */;
INSERT INTO `areaacademica` VALUES (1,'Análisis Matemático y sus Aplicaciones'),(2,'Álgebra, Geometría y Computación Científica'),(3,'Combinatoria, Control y Optimización'),(4,'Enseñanza de las Ciencias Básicas'),(5,'Física Atómica Molecular Aplicada'),(6,'Física de Procesos Irreversibles'),(7,'Física Teórica y Materia Condensada'),(8,'Química'),(9,'Química Aplicada'),(10,'Ciencias Químicas y Sostenibilidad Ambiental'),(11,'Química de Materiales');
/*!40000 ALTER TABLE `areaacademica` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `areaacademica_has_profesor`
--

DROP TABLE IF EXISTS `areaacademica_has_profesor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `areaacademica_has_profesor` (
  `areaAcademica_idAreaAcademica` int(11) NOT NULL,
  `profesor_idProfesor` int(11) NOT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`areaAcademica_idAreaAcademica`,`profesor_numeroEconomico`),
  KEY `fk_areaAcademica_has_profesor_profesor1_idx` (`profesor_idProfesor`),
  KEY `fk_areaAcademica_has_profesor_areaAcademica1_idx` (`areaAcademica_idAreaAcademica`),
  CONSTRAINT `fk_areaAcademica_has_profesor_areaAcademica1` FOREIGN KEY (`areaAcademica_idAreaAcademica`) REFERENCES `areaacademica` (`idAreaAcademica`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `areaacademica_has_profesor`
--

LOCK TABLES `areaacademica_has_profesor` WRITE;
/*!40000 ALTER TABLE `areaacademica_has_profesor` DISABLE KEYS */;
INSERT INTO `areaacademica_has_profesor` VALUES (1,0,41339),(2,0,28650);
/*!40000 ALTER TABLE `areaacademica_has_profesor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `edificios`
--

DROP TABLE IF EXISTS `edificios`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `edificios` (
  `idEdificio` int(11) NOT NULL AUTO_INCREMENT,
  `nombreEdificio` varchar(50) NOT NULL,
  PRIMARY KEY (`idEdificio`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `edificios`
--

LOCK TABLES `edificios` WRITE;
/*!40000 ALTER TABLE `edificios` DISABLE KEYS */;
INSERT INTO `edificios` VALUES (1,'H'),(2,'H-O'),(3,'H-P');
/*!40000 ALTER TABLE `edificios` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `funcion`
--

DROP TABLE IF EXISTS `funcion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `funcion` (
  `idFuncion` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(500) DEFAULT NULL,
  PRIMARY KEY (`idFuncion`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `funcion`
--

LOCK TABLES `funcion` WRITE;
/*!40000 ALTER TABLE `funcion` DISABLE KEYS */;
INSERT INTO `funcion` VALUES (1,'Administrador',NULL),(2,'Coordinador',NULL),(3,'Docente',NULL);
/*!40000 ALTER TABLE `funcion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupo`
--

DROP TABLE IF EXISTS `grupo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `grupo` (
  `idGrupo` int(11) NOT NULL AUTO_INCREMENT,
  `trimestre_idTrimestre` int(11) NOT NULL,
  `uea_idUEA` int(11) NOT NULL,
  `claveGrupo` varchar(25) NOT NULL,
  `cupo` int(11) DEFAULT NULL,
  `inscritos` int(11) DEFAULT NULL,
  `salon` varchar(40) DEFAULT NULL,
  PRIMARY KEY (`idGrupo`,`trimestre_idTrimestre`),
  KEY `fk_Grupo_UEA1_idx` (`uea_idUEA`),
  KEY `fk_grupo_trimestre1_idx` (`trimestre_idTrimestre`),
  CONSTRAINT `fk_Grupo_UEA1` FOREIGN KEY (`uea_idUEA`) REFERENCES `uea` (`idUEA`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_grupo_trimestre1` FOREIGN KEY (`trimestre_idTrimestre`) REFERENCES `trimestre` (`idTrimestre`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupo`
--

LOCK TABLES `grupo` WRITE;
/*!40000 ALTER TABLE `grupo` DISABLE KEYS */;
/*!40000 ALTER TABLE `grupo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupo_has_horario`
--

DROP TABLE IF EXISTS `grupo_has_horario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `grupo_has_horario` (
  `grupo_idGrupo` int(11) NOT NULL,
  `horario_idHorario` int(11) NOT NULL,
  PRIMARY KEY (`grupo_idGrupo`,`horario_idHorario`),
  KEY `fk_Grupo_has_Horario_Horario1_idx` (`horario_idHorario`),
  KEY `fk_Grupo_has_Horario_Grupo1_idx` (`grupo_idGrupo`),
  CONSTRAINT `fk_Grupo_has_Horario_Grupo1` FOREIGN KEY (`grupo_idGrupo`) REFERENCES `grupo` (`idGrupo`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_Grupo_has_Horario_Horario1` FOREIGN KEY (`horario_idHorario`) REFERENCES `horario` (`idHorario`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupo_has_horario`
--

LOCK TABLES `grupo_has_horario` WRITE;
/*!40000 ALTER TABLE `grupo_has_horario` DISABLE KEYS */;
/*!40000 ALTER TABLE `grupo_has_horario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupotematico`
--

DROP TABLE IF EXISTS `grupotematico`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `grupotematico` (
  `idGrupoTematico` int(11) NOT NULL AUTO_INCREMENT,
  `nombreGrupo` varchar(120) NOT NULL,
  `puesto` varchar(150) NOT NULL,
  PRIMARY KEY (`idGrupoTematico`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupotematico`
--

LOCK TABLES `grupotematico` WRITE;
/*!40000 ALTER TABLE `grupotematico` DISABLE KEYS */;
/*!40000 ALTER TABLE `grupotematico` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `grupotematico_has_profesor`
--

DROP TABLE IF EXISTS `grupotematico_has_profesor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `grupotematico_has_profesor` (
  `grupoTematico_idGrupoTematico` int(11) NOT NULL,
  `profesor_idProfesor` int(11) NOT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`grupoTematico_idGrupoTematico`,`profesor_numeroEconomico`),
  KEY `fk_grupoTematico_has_profesor_profesor1_idx` (`profesor_idProfesor`),
  KEY `fk_grupoTematico_has_profesor_grupoTematico1_idx` (`grupoTematico_idGrupoTematico`),
  CONSTRAINT `fk_grupoTematico_has_profesor_grupoTematico1` FOREIGN KEY (`grupoTematico_idGrupoTematico`) REFERENCES `grupotematico` (`idGrupoTematico`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `grupotematico_has_profesor`
--

LOCK TABLES `grupotematico_has_profesor` WRITE;
/*!40000 ALTER TABLE `grupotematico_has_profesor` DISABLE KEYS */;
/*!40000 ALTER TABLE `grupotematico_has_profesor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `horario`
--

DROP TABLE IF EXISTS `horario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `horario` (
  `idHorario` int(11) NOT NULL AUTO_INCREMENT,
  `dia` varchar(25) NOT NULL,
  `horaInicio` time NOT NULL,
  `horaFin` time NOT NULL,
  PRIMARY KEY (`idHorario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `horario`
--

LOCK TABLES `horario` WRITE;
/*!40000 ALTER TABLE `horario` DISABLE KEYS */;
/*!40000 ALTER TABLE `horario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `lugar`
--

DROP TABLE IF EXISTS `lugar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `lugar` (
  `idLugar` int(11) NOT NULL AUTO_INCREMENT,
  `idPiso` int(11) NOT NULL,
  `nombre` varchar(50) NOT NULL,
  `notas` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idLugar`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `lugar`
--

LOCK TABLES `lugar` WRITE;
/*!40000 ALTER TABLE `lugar` DISABLE KEYS */;
INSERT INTO `lugar` VALUES (4,1,'128-A',NULL);
/*!40000 ALTER TABLE `lugar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `material`
--

DROP TABLE IF EXISTS `material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `material` (
  `idMaterial` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(80) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idMaterial`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `material`
--

LOCK TABLES `material` WRITE;
/*!40000 ALTER TABLE `material` DISABLE KEYS */;
/*!40000 ALTER TABLE `material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pisos`
--

DROP TABLE IF EXISTS `pisos`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `pisos` (
  `idPiso` int(11) NOT NULL AUTO_INCREMENT,
  `nombrePiso` varchar(20) NOT NULL,
  `idEdificio` int(11) NOT NULL,
  PRIMARY KEY (`idPiso`),
  KEY `idEdificio` (`idEdificio`),
  CONSTRAINT `pisos_ibfk_1` FOREIGN KEY (`idEdificio`) REFERENCES `edificios` (`idEdificio`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pisos`
--

LOCK TABLES `pisos` WRITE;
/*!40000 ALTER TABLE `pisos` DISABLE KEYS */;
INSERT INTO `pisos` VALUES (1,'1',1);
/*!40000 ALTER TABLE `pisos` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prestamo`
--

DROP TABLE IF EXISTS `prestamo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prestamo` (
  `idPrestamo` int(11) NOT NULL AUTO_INCREMENT,
  `horaInicio` time NOT NULL,
  `horaFin` time NOT NULL,
  `dia` date NOT NULL,
  `notas` varchar(999) DEFAULT NULL,
  `status` varchar(100) NOT NULL,
  `profesor_numeroEconomico` int(11) DEFAULT NULL,
  PRIMARY KEY (`idPrestamo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prestamo`
--

LOCK TABLES `prestamo` WRITE;
/*!40000 ALTER TABLE `prestamo` DISABLE KEYS */;
/*!40000 ALTER TABLE `prestamo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prestamo_has_material`
--

DROP TABLE IF EXISTS `prestamo_has_material`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `prestamo_has_material` (
  `prestamo_idPrestamo` int(11) NOT NULL,
  `material_idMaterial` int(11) NOT NULL,
  PRIMARY KEY (`prestamo_idPrestamo`,`material_idMaterial`),
  KEY `fk_prestamo_has_material_material1_idx` (`material_idMaterial`),
  KEY `fk_prestamo_has_material_prestamo1_idx` (`prestamo_idPrestamo`),
  CONSTRAINT `fk_prestamo_has_material_material1` FOREIGN KEY (`material_idMaterial`) REFERENCES `material` (`idMaterial`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_prestamo_has_material_prestamo1` FOREIGN KEY (`prestamo_idPrestamo`) REFERENCES `prestamo` (`idPrestamo`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prestamo_has_material`
--

LOCK TABLES `prestamo_has_material` WRITE;
/*!40000 ALTER TABLE `prestamo_has_material` DISABLE KEYS */;
/*!40000 ALTER TABLE `prestamo_has_material` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesor`
--

DROP TABLE IF EXISTS `profesor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesor` (
  `numeroEconomico` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(125) NOT NULL,
  `gradoEstudios` varchar(80) NOT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `correo_uam` varchar(70) NOT NULL,
  `correo_personal` varchar(70) DEFAULT NULL,
  PRIMARY KEY (`numeroEconomico`),
  UNIQUE KEY `numeroEconomico` (`numeroEconomico`)
) ENGINE=InnoDB AUTO_INCREMENT=47399 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesor`
--

LOCK TABLES `profesor` WRITE;
/*!40000 ALTER TABLE `profesor` DISABLE KEYS */;
INSERT INTO `profesor` VALUES (162,'Pérez Ricardez Alejandro Raymundo','Doctorado','5531333667','pra@azc.uam.mx',NULL),(310,'Holguin Quiñones Saul','Doctorado','5538833956','shq@azc.uam.mx',NULL),(446,'Alcantara Montes Samuel','Doctorado',NULL,'ficticio@azc.uam.mx','ocam@azc.uam'),(475,'Cervantes Cuevas Humberto','Doctorado','5512344347','hcc@azc.uam.mx',NULL),(479,'JIMENEZ OTAMENDI ADOLFO','por definir',NULL,'ficticio@azc.uam.mx','otamendi45@yahoo.com.mx'),(553,'Solis Correa Hugo Eduardo De Jesús','Doctorado',NULL,'hesc@azc.uam.mx',NULL),(657,'Barcelo Quintal Icela Dagmar','Doctorado',NULL,'idbq@azc.uam.mx',NULL),(939,'Espinosa Herrera Ernesto Javier','Maestria','5541337104','ejeh@azc.uam.mx',NULL),(940,'Maubert Franco Ana Marisela','Doctorado','5555606937','amf@azc.uam.mx',NULL),(941,'MEDA VIDAL MANUEL','por definir',NULL,'mmv@azc.uam.mx',NULL),(1307,'CASTRO PEÑA JOSE DE JESUS','por definir',NULL,'ficticio@azc.uam.mx','jjcastro_p@mail.com'),(1312,'Soto Tellez María De La Luz','Maestria','24988837','mlst@azc.uam.mx',NULL),(1313,'Flores Valverde Erasmo','Maestria',NULL,'efv@azc.uam.mx',NULL),(1358,'BECERRIL ESPINOSA ALFONSO CORNELIO','por definir',NULL,'acbe@azc.uam.mx',NULL),(1360,'Ulin Jimenez Carlos Antonio','Doctorado',NULL,'cauj@azc.uam.mx',NULL),(1750,'CORRAL LOPEZ ELPIDIO','por definir',NULL,'ecorral@azc.uam.mx',NULL),(1895,'Negron Silva Guillermo Enrique','Doctorado','5554017421','gns@azc.uam.mx',NULL),(2243,'RODRIGUEZ SORIA ABELARDO LUIS','por definir',NULL,'ficticio@azc.uam.mx','abelardoluis@prodigy.net.mx'),(2346,'Becerril Hernández Hugo Sergio','Maestria',NULL,'hsbh@azc.uam.mx',NULL),(2414,'Luna García Héctor Martín','Doctorado',NULL,'lghm@azc.uam.mx',NULL),(2470,'Fernández Sánchez Lilia','Doctorado','5585301384','lfs@azc.uam.mx',NULL),(2497,'Torres Rodriguez Miguel','Doctorado','36738588','trm@azc.uam.mx',NULL),(2620,'NAVARRETE GONZALEZ TOMAS DAVID','por definir',NULL,'ngtd@azc.uam.mx',NULL),(2639,'Vázquez Rojas Jorge Héctor','Maestria','10305983','jhvr@azc.uam.mx',NULL),(2642,'ROCHA MARTINEZ JOSE ANGEL','por definir',NULL,'jarm@azc.uam.mx',NULL),(2823,'GARCIA HERNANDEZ ANA ELIZABETH','por definir',NULL,'ficticio@azc.uam.mx','aelizagh@yahoo.com.mx'),(3359,'Falcon Hernández Nicolas','Licenciatura','2222939259','nfh@azc.uam.mx',NULL),(3641,'Zubieta Badillo Carlos','Maestria','5511322202','czb@azc.uam.mx',NULL),(3845,'Goñi Cedeño Hermilo Benito','Maestria','5539342074','gch@azc.uam.mx',NULL),(3876,'Ladino Luna Delfino','Doctorado','5545174062','dll@azc.uam.mx',NULL),(3880,'SANTARRIAGA RIVERA LILIA OFELIA','por definir',NULL,'ficticio@azc.uam.mx','lisi19@hotmail.com'),(3987,'Andreu Ibarra María Eugenia Guadalupe','Doctorado','5535159704','mai@azc.uam.mx',NULL),(4037,'Molnar De La Parra Rene','Maestria','5531152437','rmdp@azc.uam.mx',NULL),(4038,'Plata Pérez Erasmo Netzahualcoyotl','Doctorado','5553537738','ppe@azc.uam.mx',NULL),(4329,'Fuentes Villaseñor Ramón','Maestria','5540025038','rfv@azc.uam.mx',NULL),(4341,'Pavia Y Miller Carlos German','Licenciatura','5535785296','cgpm@azc.uam.mx',NULL),(4365,'CRUZ SAMPEDRO JAIME','por definir',NULL,'jacs@azc.uam.mx',NULL),(4377,'Grabinsky Steider Jaime','Maestria',NULL,'jags@azc.uam.mx',NULL),(4606,'Pereyra Padilla Pedro','Doctorado','5561119714','ppereyra@azc.uam.mx',NULL),(4681,'Vargas Estrada María Del Carmen','Licenciatura',NULL,'mcve@azc.uam.mx?',NULL),(4683,'FLORES RODRIGUEZ JULIO','por definir',NULL,'jfr@azc.uam.mx',NULL),(4684,'Castañeda Briones María Teresa','Doctorado','5537925759','tcb@azc.uam.mx',NULL),(4796,'Arenas Enriquez Luis','Licenciatura',NULL,'lae@azc.uam.mx',NULL),(4808,'Herrera Aguirre Rogelio','Maestria','5536603225','rha@azc.uam.mx',NULL),(4811,'Rodriguez Sánchez María Guadalupe','Doctorado','5591457758','rsmg@azc.uam.mx',NULL),(4812,'Salazar Velasco Francisco Ramón','Licenciatura','5530490473','frsv@azc.uam.mx',NULL),(4818,'Pulido Rodriguez Georgina María Guadalupe','Doctorado','5554044431','gpr@azc.uam.mx',NULL),(4828,'Álvarez García Arturo','Licenciatura','5527215950','aag@azc.uam.mx',NULL),(5438,'De La Portilla Maldonado Leandro Cesar','Maestria','5531293995','lcpm@azc.uam.mx',NULL),(5720,'Alcantara Moreno Felix','Licenciatura','5549718591','feam@azc.uam.mx',NULL),(6362,'Velazquez Arcos Juan Manuel','Doctorado','5548368256','jmva@azc.uam.mx',NULL),(6370,'Ovando Zuñiga Gerardo Antonio','Doctorado','5540603837','gaoz@azc.uam.mx',NULL),(6388,'Amezcua Gomez Raul','Licenciatura','5536445195','rag@azc.uam.mx',NULL),(6391,'BECERRIL ALBARRAN JOSEFINA PAZ','por definir',NULL,'ficticio@azc.uam.mx','josefinabecerril@hotmail.com'),(6530,'LOZANO MARTINEZ MARIANO','por definir',NULL,'lmm@azc.uam.mx',NULL),(6539,'Serrano Domínguez Víctor Gerardo','Maestria',NULL,'ficticio@azc.uam.mx','victorgserranod@gmail.com'),(6864,'Arellano Balderas Salvador','Doctorado','5532701249','sab@azc.uam.mx',NULL),(6865,'Becerril Espinosa José Ventura','Maestria',NULL,'jvbe@azc.uam.mx',NULL),(7194,'SALGADO RUIZ ENRIQUE','por definir',NULL,'ficticio@azc.uam.mx','esalgadomx@yahoo.com.mx'),(7295,'García Cruz Luz María','Doctorado','5539774479','lmgc@azc.uam.mx',NULL),(7322,'GASCA ALVAREZ EDUARDO','por definir',NULL,'ficticio@azc.uam.mx','gasca_eduardo@hotmail.com'),(7487,'VALLADARES RODRIGUEZ MARIA RITA','por definir',NULL,'vrmr@azc.uam.mx',NULL),(7689,'Morales Rivas Jesús','Doctorado','5539435067','jmr@azc.uam.mx',NULL),(8083,'Granados Samaniego Jaime Alejandro Paulino','Maestria','5591050567','jgs@azc.uam.mx',NULL),(8156,'CORONA CORONA GULMARO','por definir',NULL,'ccg@azc.uam.mx',NULL),(8181,'Roa Limas José Carlos Federico','Licenciatura','5554319029','jcfrl@azc.uam.mx',NULL),(8702,'Mugica Álvarez Violeta','Doctorado','5522718703','vma@azc.uam.mx',NULL),(9434,'Romero Melendez Cutberto Salvador','Doctorado','5534359640','cutberto@azc.uam.mx',NULL),(9608,'Hernández Martínez Leonardo','Maestria','54656923','hml@azc.uam.mx',NULL),(10345,'Huerta Flores José Luis','Maestria','5516913760','hfjl@azc.uam.mx',NULL),(10382,'Robledo Martínez Arturo','Doctorado','5535756233','arm@azc.uam.mx',NULL),(10494,'Guzmán Gomez Marisela','Doctorado','5520789707','mgg@azc.uam.mx',NULL),(10557,'Myszkowski Podkowka Andrzej','Doctorado',NULL,'mpa@azc.uam.mx',NULL),(10590,'TREJO RODRIGUEZ ARTURO','por definir',NULL,'ficticio@azc.uam.mx','atrejo@imp.mx'),(10883,'COELLO RAMIREZ RUBEN DANIEL','por definir',NULL,'ficticio@azc.uam.mx',NULL),(10906,'Mejia Huguet Virgilio Janitzio','Doctorado','5515109411','vjmh@azc.uam.mx',NULL),(10996,'Benitez Marquez Elia','Doctorado','5540119057','ebmarquez@azc.uam.mx',NULL),(11101,'Avila Jimenez Miguel','Maestria',NULL,'miaj@azc.uam.mx',NULL),(11294,'Bastien Montoya Gustavo Mauricio','Doctorado','5591975678','mbastien@azc.uam.mx',NULL),(11304,'RAMIREZ ANGULO JAVIER','por definir',NULL,'ficticio@azc.uam.mx','ramirezangulojavier@gmail.com'),(11423,'Ortiz Romero Vargas María Elba','Doctorado','5554168261','meorv@azc.uam.mx',NULL),(11582,'Omaña Pulido María Judith','Licenciatura',NULL,'mjop@azc.uam.mx',NULL),(11651,'Del Valle Díaz Muñoz Luisa Gabriela','Licenciatura','5554547845','ddg@azc.uam.mx',NULL),(11903,'Portilla Pineda Margarita','Maestria','5555026226','mpp@azc.uam.mx',NULL),(12035,'Pereyra Ramos Carlos Jesús','Licenciatura','5529694001','cpr@azc.uam.mx',NULL),(12143,'Aguilar Pliego Julia','Doctorado','5513533339','apj@azc.uam.mx',NULL),(12407,'Rivera Valladares Irene Leonor','Licenciatura',NULL,'ilrv@azc.uam.mx',NULL),(12501,'PADILLA FIGUEROA JOSE','por definir',NULL,'jpf@azc.uam.mx',NULL),(12535,'Salas Brito Alvaro Lorenzo','Doctorado','5555020530','asb@azc.uam.mx',NULL),(12583,'Coxtinica Aguilar Lucia','Maestria','5528904319','lca@azc.uam.mx',NULL),(12858,'Martínez Melendez Ángel','Doctorado',NULL,'amm@azc.uam.mx',NULL),(13030,'Hernández Morales María Guadalupe','Doctorado','5591897990','gpe@azc.uam.mx',NULL),(13047,'Mercado Reyes Santos','Doctorado','5514895263','mrs@azc.uam.mx',NULL),(13099,'Monroy Pérez Rafael Felipe','Doctorado',NULL,'fmp@azc.uam.mx',NULL),(13161,'PRADO PEREZ CARLOS DANIEL','por definir',NULL,'ficticio@azc.uam.mx','cprado@itesm.mx'),(13168,'Luevano Enriquez José Ruben','Doctorado',NULL,'jrle@azc.uam.mx',NULL),(13378,'Melendez Lira Miguel Ángel','Maestria',NULL,'maml@azc.uam.mx',NULL),(13398,'Elizarraraz Martínez David','Doctorado','5554557701','dem@azc.uam.mx',NULL),(13413,'Cruz Colin María Del Rocio','Maestria','5522129376','ccmr@azc.uam.mx',NULL),(13487,'García Martínez Cesareo','Maestria','5528517690','cgarcia@azc.uam.mx',NULL),(13665,'Portillo Díaz Pedro','Maestria','5554577339','ppd@azc.uam.mx',NULL),(13870,'Arellano Peraza Juan Salvador','Doctorado','5515801851','jsap@azc.uam.mx',NULL),(14177,'Martínez Hernández Guadalupe','Maestria','5518363278','gmh@azc.uam.mx',NULL),(14378,'Elorza Guerrero María Eugenia','Licenciatura',NULL,'melorza@azc.uam.mx',NULL),(14412,'Olvera Amador María De La Luz','Maestria',NULL,'molvera@azc.uam.mx',NULL),(14414,'ORTIZ RIVERA ALEJANDRO','por definir',NULL,'ora@azc.uam.mx',NULL),(14416,'Paez Hernández Ricardo Teodoro','Doctorado','5529419925','phrt@azc.uam.mx',NULL),(14417,'Merchand Hernández Teresa','Doctorado','5543775966','mht@azc.uam.mx',NULL),(14541,'Salazar Antunez Marina','Maestria','5541776191','msalazar@azc.uam.mx',NULL),(14562,'Hernández Pérez Isaias','Doctorado','5528896439','ihp@azc.uam.mx',NULL),(14717,'Ramirez Rojas Alejandro','Doctorado','5539998617','arr@azc.uam.mx',NULL),(14720,'Estrada Guerrero José María Daniel','Maestria',NULL,'jmdeg@azc.uam.mx',NULL),(14721,'Chavez Martínez Margarita','Maestria','5539196618','cmm@azc.uam.mx',NULL),(14877,'Vargas Carlos Alejandro','Maestria','5523255918','cvargas@azc.uam.mx',NULL),(15307,'Cid Reborido Alicia','Doctorado','5516880210','acr@azc.uam.mx',NULL),(15509,'García Martínez Cirilo','Doctorado','5539812810','gmc@azc.uam.mx',NULL),(15682,'VIVEROS TALAVERA JOSÉ GUADALUPE','por definir',NULL,'vtjg@azc.uam.mx, viveros.jose@gmail.com',NULL),(15898,'Aduna Espinosa Enrique','Doctorado','5513646859','eae@azc.uam.mx',NULL),(16082,'MEDINA OVANDO ABRAHAM','por definir',NULL,'ficticio@azc.uam.mx','abraham_medina_ovando@yahoo.com'),(16120,'Castro López Fidel','Maestria','5545567486','ficticio@azc.uam.mx','fidelcastrotese@hotmail.com'),(16283,'Resendis Ocampo Lino Feliciano','Doctorado',NULL,'lfro@azc.uam.mx',NULL),(16820,'RODRIGUEZ CRUZ MARTIN','por definir',NULL,'ficticio@azc.uam.mx',NULL),(16930,'Guillaumin España Elisa','Maestria','5554816244','ege@azc.uam.mx',NULL),(16966,'Barron Romero Carlos','Doctorado','5534551427','cbarron@azc.uam.mx',NULL),(17206,'Pérez Flores Rafael','Doctorado','23005789','pfr@azc.uam.mx',NULL),(17535,'MENA DELGADILLO JOSE DE JESUS','por definir',NULL,'ficticio@azc.uam.mx','pejemedel@yahoo.com'),(17755,'Cruz Galindo Hilarion Simon','Doctorado',NULL,'hscg@azc.uam.mx',NULL),(18140,'González Cortés María Del Carmen','Doctorado','5532498704','mcgc@azc.uam.mx',NULL),(18248,'Peña Gil José Juan','Doctorado','7731282008','jjpg@azc.uam.mx',NULL),(18384,'GARCÍA MARTÍNEZ ARMANDO','por definir',NULL,'armandog@azc.uam.mx',NULL),(18655,'PRADO BRAVO ESTEBAN','por definir',NULL,'ficticio@azc.uam.mx',NULL),(18677,'González Velez Virginia','Doctorado','5561116145','vgv@azc.uam.mx',NULL),(18681,'Cueto Hernández Arturo','Doctorado',NULL,'arch@azc.uam.mx',NULL),(19389,'KOJAKHMETOVA CEIDEJANOVA NOURLAN','por definir',NULL,'nkc@azc.uam.mx',NULL),(19560,'Roa Neri José Antonio Eduardo','Doctorado','5518230035','rnjae@azc.uam.mx',NULL),(19662,'LORETO GOMEZ CARMEN ESTELA','por definir',NULL,'lgce@azc.uam.mx',NULL),(19834,'Díaz Leal Guzmán Héctor','Doctorado','5528649329','hdlg@azc.uam.mx',NULL),(20427,'Baez Juarez María Gabriela','Doctorado','5532091669','gbaez@azc.uam.mx',NULL),(20889,'Basurto Uribe Eduardo','Doctorado','5523152490','ebasurto@azc.uam.mx',NULL),(21565,'Kunold Bello Alejandro','Doctorado','5515807293','akb@azc.uam.mx',NULL),(21569,'Hernández Saldaña Hugo','Doctorado','5540137505','hhs@azc.uam.mx',NULL),(21610,'PEREZ LOPEZ JUAN DOMINGO','por definir',NULL,'ficticio@azc.uam.mx','perezl.juandomingo@yahoo.com.mx'),(21735,'Cardoso Cortes José Luis','Doctorado','5540318214','jlcc@azc.uam.mx',NULL),(22644,'Soto Portas María Lidice','Doctorado','5522715458','masp@azc.uam.mx',NULL),(22668,'Flores Moreno Jorge Luis','Doctorado','5533812454','jflores@azc.uam.mx',NULL),(23041,'Navarro Fuentes Jaime','Doctorado','5535783280','jnfu@azc.uam.mx',NULL),(23069,'Martínez Delgadillo Sergio Alejandro','Doctorado','5542919332','samd@azc.uam.mx',NULL),(23083,'Anzaldo Meneses Alfonso Moises','Doctorado',NULL,'amam@azc.uam.mx',NULL),(23160,'García Albortante Julisa','Maestria','5527057513','jga@azc.uam.mx',NULL),(23462,'López Bautista Pedro Ricardo','Doctorado','5548220943','rlopez@azc.uam.mx',NULL),(23651,'Monroy Mendieta María Magdalena','Licenciatura','5519196332','mmm@azc.uam.mx',NULL),(24218,'Morales López Leopoldo','Curricular',NULL,'lmlopez@azc.uam.mx',NULL),(24351,'López Pérez Lidia','Doctorado','5539216887','llp@azc.uam.mx',NULL),(24865,'Ángeles Beltran Deyanira','Doctorado','5532071135','dab@azc.uam.mx',NULL),(25076,'Chavez Lomeli Laura Elena','Doctorado','5531251668','lelc@azc.uam.mx',NULL),(25234,'MORALES ALVAREZ FELICITAS','por definir',NULL,'ficticio@azc.uam.mx','fmorales.fcm@gmail.com'),(25485,'Noreña Franco Luis Enrique','Doctorado','5521285378','lnf@azc.uam.mx',NULL),(25795,'Esquivel Avila Jorge Alfredo','Doctorado','5532338570','jaea@azc.uam.mx',NULL),(25837,'Morales Guzmán Jacinto Dionisio','Doctorado','5535530257','jdmg@azc.uam.mx',NULL),(25979,'Olvera Neria Oscar','Doctorado','5575275738','oon@azc.uam.mx',NULL),(26155,'May Lozano Marcos','Doctorado','5535652131','mml@azc.uam.mx',NULL),(26274,'Rubio Ponce Alberto','Doctorado','31048290','arp@azc.uam.mx',NULL),(26426,'ESPINDOLA HEREDIA RODOLFO','por definir',NULL,'ficticio@azc.uam.mx','rodolfoespiher@yahoo.com.mx'),(27034,'Gutiérrez Arzaluz Mirella','Doctorado','5593544664','gam@azc.uam.mx',NULL),(27102,'Poulain García Enrique Gabriel','Doctorado','7223967023','enro@azc.uam.mx',NULL),(27516,'RADILLA CHAVEZ JUAN','por definir',NULL,'john@azc.uam.mx',NULL),(27609,'Martínez Jimenez Anatolio','Doctorado','5525211111','amartinez@azc.uam.mx',NULL),(27610,'UC ROSAS VICTOR HUGO','por definir',NULL,'vhur@azc.uam.mx',NULL),(27699,'Ramirez Quiros Yara','Doctorado','5514353717','yararq@azc.uam.mx',NULL),(27820,'Castillo Fernández David','Curricular',NULL,'decafe@azc.uam.mx',NULL),(27821,'Gavito Ticozzi Silvia Claudia','Doctorado','5519191848','sgt@azc.uam.mx',NULL),(28002,'LIMA MUÑOZ ENRIQUE','por definir',NULL,'ficticio@azc.uam.mx','lima@iim.unam.mx'),(28233,'CASTRO ORTEGA ALBERTO','por definir',NULL,'ficticio@azc.uam.mx','acospacy@ciencias.unam.mx'),(28343,'LOPEZ MEDINA RICARDO','por definir',NULL,'rilome@azc.uam.mx',NULL),(28344,'Palacios Grijalva Laura Nadxieli','Curricular',NULL,'lnpg@azc.uam.mx',NULL),(28447,'Gomez Vieyra Armando','Doctorado','5545670669','agvte@azc.uam.mx',NULL),(28650,'Aguilar Zavoznik Alejandro','Doctorado','5528564060','aaz@azc.uam.mx',NULL),(28938,'ROJAS GARCIA ELIZABETH','por definir',NULL,'ficticio@azc.uam.mx','elithroga@gmail.com'),(29040,'Navarrete López Alejandra Montserrat','Doctorado','5591393892','amnl@azc.uam.mx',NULL),(29366,'Domínguez Soria Victor Daniel','Doctorado','5530605734','vdds@azc.uam.mx',NULL),(29462,'Cruz Barriguete Víctor Alberto','Doctorado','9511487291','vacb@azc.uam.mx',NULL),(29577,'VELAZQUEZ CADENA ARIEL YRVING','por definir',NULL,'ayvc@azc.uam.mx',NULL),(29955,'COLIN RODRIGUEZ RICARDO','por definir',NULL,'ficticio@azc.uam.mx','colinrr@xanum.uam.mx'),(30232,'MEDINA MENDOZA ANA KARINA','por definir',NULL,'ficticio@azc.uam.mx','ak.medinamendoza@gmail.com'),(30711,'Alvarez García Caín','Curricular',NULL,'cag@azc.uam.mx',NULL),(31154,'MAGAÑA ZAPATA JANETH ANABELLE','por definir',NULL,'jamz@azc.uam.mx',NULL),(31193,'Pineda Calderón Inti','Doctorado',NULL,'inti@azc.uam.mx',NULL),(31356,'ARROYO GOMEZ MARICELA','por definir',NULL,'ficticio@azc.uam.mx','arroyomaricela511@gmail.com'),(31448,'FLORES MARQUEZ ELSA LETICIA','por definir',NULL,'ficticio@azc.uam.mx','leticia@geofisica.unam.mx'),(31449,'BELTRÁN CONDE HIRAM ISAAC','por definir',NULL,'hibc@azc.uam.mx, hbeltran75@gmail.com',NULL),(31456,'ALDANA GONZÁLEZ JORGE IVÁN','por definir',NULL,'ficticio@azc.uam.mx','ivn.algo@gmail.com'),(31575,'OLICON HERNANDEZ OSCAR','por definir',NULL,'ficticio@azc.uam.mx','osc.olic@gmail.com'),(31745,'MORALES LUNA MICHAEL','por definir',NULL,'ficticio@azc.uam.mx','mmorales@fis.cinvestav.mx, micmolun@gmail.com'),(32300,'IBARRA SIERRA VICTOR GUADALUPE','por definir',NULL,'vgis@azc.uam.mx',NULL),(32420,'Flores Olmedo Enrique','Curricular',NULL,'efo@azc.uam.mx',NULL),(32565,'VELEZ PEREZ JOSE ANTONIO','por definir',NULL,'joseavelez@azc.uam.mx',NULL),(32734,'MARTINEZ FLORES CESAR','por definir',NULL,'ficticio@azc.uam.mx','cesar@icf.unam.mx'),(32802,'DOMINGUEZ ROCHA VICTOR','por definir',NULL,'vdr@azc.uam.mx',NULL),(32858,'Chaparro Vega Francisco Javier','Curricular',NULL,'fjcv@azc.uam.mx',NULL),(33221,'Zenteno Gutiérrez Adrián','Curricular',NULL,'ficticio@azc.uam.mx','matematicazg@ciencias.unam.mx'),(33679,'RODRIGUEZ ÁLVAREZ GALOIS','por definir',NULL,'ficticio@azc.uam.mx',NULL),(34057,'GARCIA FRANCO FRANCISCO','por definir',NULL,'ficticio@azc.uam.mx',NULL),(34214,'Loera Serna Sandra','Doctorado','5533070711','sls@azc.uam.mx',NULL),(34355,'García Hernández Victor Cuauhtemoc','Doctorado','5521917411','vcgh@azc.uam.mx',NULL),(34375,'MIRANDA OLVERA ALMA DELIA','por definir',NULL,'admiranda@azc.uam.mx',NULL),(34592,'Santana Cruz Alejandra','Maestria',NULL,'sca@azc.uam.mx',NULL),(34786,'Haro Pérez Catalina Esther','Doctorado','5525383812','cehp@azc.uam.mx',NULL),(35032,'Hidalgo González Julio César','Doctorado',NULL,'jchg@azc.uam.mx',NULL),(35042,'MORENO TORRES LUCIA REBECA','por definir',NULL,'ficticio@azc.uam.mx','lumor2000@yahoo.com.mx'),(35464,'González Reyes Leonardo','Doctorado','5548837404','lgr@azc.uam.mx',NULL),(35550,'CABALLERO DORANTES CARLOS ALBERTO','por definir',NULL,'cacd@azc.uam.mx',NULL),(35716,'DOMINGUEZ MARIANI ELOISA','por definir',NULL,'dme@azc.uam.mx',NULL),(35986,'TANECO HERNANADEZ MARCO ANTONIO','por definir',NULL,'ficticio@azc.uam.mx','moodth@gmail.com'),(36082,'CHAVEZ ESQUIVEL GERARDO','por definir',NULL,'gce@azc.uam.mx',NULL),(36410,'MUCIÑO CRUZ DAMIAN','por definir',NULL,'ficticio@azc.uam.mx','da_eno@yahoo.com.mx'),(36563,'GONZALEZ OLVERA RODRIGO','por definir',NULL,'ficticio@azc.uam.mx','rodrigo_glezo@hotmail.com'),(36569,'PEREZ SANCHEZ GRETHELL GEORGINA','por definir',NULL,'ficticio@azc.uam.mx','gret_hell@hotmail.com'),(36992,'Salazar Pelaez Mónica Liliana','Doctorado','5550501566','monsalazar@azc.uam.mx',NULL),(36997,'SANCHEZ HERNANDEZ ANTONIO JESUS','por definir',NULL,'ficticio@azc.uam.mx',NULL),(37070,'RAMOS REYES GIOVANNI MANUEL','por definir',NULL,'gmrr@azc.uam.mx',NULL),(37084,'GARCÍA RUÍZ MISAEL','por definir',NULL,'migaru@azc.uam.mx',NULL),(37267,'LOPEZ MARTINEZ MARCOS ANTONIO','por definir',NULL,'ficticio@azc.uam.mx','malopmar@hotmail.com'),(37268,'CORTES ROMERO CARLOS MARTIN','por definir',NULL,'ficticio@azc.uam.mx',NULL),(37373,'Sandoval Santana Juan Carlos','Curricular',NULL,'jcss@azc.uam.mx',NULL),(37486,'LOPEZ RODRIGUEZ FRANCISCO JAVIER','por definir',NULL,'ficticio@azc.uam.mx','francisco.lopez@uaem.mx'),(37492,'Espínola Rocha Jesús Adrian','Doctorado','5591994045','jaer@azc.uam.mx',NULL),(37545,'GARCIA FONTES ADOLFO','por definir',NULL,'ficticio@azc.uam.mx','adolfo.fontes@alumni.manchester.ac.uk'),(37995,'MENDOZA ESPINOSA DANIEL','por definir',NULL,'ficticio@azc.uam.mx','danielme1982@gmail.com'),(38194,'VEGA PAZ ARACELI','por definir',NULL,'ficticio@azc.uam.mx',NULL),(38198,'MATLALCUATZI RUGERIO FRANCISCA DOLORES','por definir',NULL,'ficticio@azc.uam.mx','frandmr@gmail.com'),(38263,'Fernández Torres Gustavo','Curricular',NULL,'gusfer@azc.uam.mx',NULL),(38404,'Hernández Moreno Adolfo','Curricular',NULL,'aherm@azc.uam.mx',NULL),(38426,'ILLESCAS SALINAS JUAN','por definir',NULL,'jfis@azc.uam.mx',NULL),(38470,'CRUZ PEREGRINO FIDEL','por definir',NULL,'fcruz@azc.uam.mx',NULL),(38825,'MONTIEL SANCHEZ LUISA ELENA','por definir',NULL,'ficticio@azc.uam.mx',NULL),(38832,'Sigalotti Díaz Leonardo Di Girolamo','Doctorado','5521761287','ldgsd@azc.uam.mx',NULL),(38881,'LÓPEZ FLORES ELEAZAR','por definir',NULL,'elopezf@azc.uam.mx',NULL),(38956,'Espinoza Castañeda Marisol','Doctorado',NULL,'maesca@azc.uam.mx',NULL),(39198,'GODINEZ GARCIA ANDRES','por definir',NULL,'angg@azc.uam.mx',NULL),(39223,'HERNANDEZ GOMEZ GEOVANNI','por definir',NULL,'ficticio@azc.uam.mx',NULL),(39258,'CORONA FLORES ROSA MARIA','por definir',NULL,'ficticio@azc.uam.mx','coronafloresr@yahoo.com.mx'),(39375,'Odriozola Prego Gerardo Miguel','Doctorado','5535201538','godriozo@azc.uam.mx',NULL),(39762,'LEYVA CRUZ EDGAR OSWALDO','por definir',NULL,'eolc@azc.uam.mx',NULL),(39820,'GORDILLO MILLAN HENRY','por definir',NULL,'ficticio@azc.uam.mx','henrygor@gmail.com'),(40071,'CORTEZANO ARELLANO OMAR','por definir',NULL,'omarca@azc.uam.mx',NULL),(40123,'ZAMORA RODEA EMIGDIO GREGORIO','por definir',NULL,'egzr@azc.uam.mx',NULL),(40158,'García Villarreal Luis Ángel','Maestria','5522680496','lagv@azc.uam.mx',NULL),(40702,'PEREZ MARTINEZ DIEGO','por definir',NULL,'ficticio@azc.uam.mx',NULL),(40965,'LEDESMA MOTOLINIA MONICA','por definir',NULL,'ficticio@azc.uam.mx','moledesma@gmail.com'),(40970,'RAÚL GONZÁLEZ SILVA','por definir',NULL,'ficticio@azc.uam.mx','rulo65@ciencias.unam.mx'),(41006,'GARCIA MARTINEZ MAGDALENA','por definir',NULL,'ficticio@azc.uam.mx',NULL),(41011,'OSORNIO BERTHET LUIS JESUS','por definir',NULL,'ficticio@azc.uam.mx','osornioberthet@hotmail.com'),(41035,'Carmona Lomeli Luis Javier','Curricular',NULL,'ljcl@azc.uam.mx',NULL),(41218,'HIDALGO MORENO FRANCISCO JAVIER','por definir',NULL,'ficticio@azc.uam.mx','fhidalgo76@gmail.com'),(41236,'LUVIANO FLORES JOHANA','por definir',NULL,'jlf@azc.uam.mx',NULL),(41339,'Baisón Olmo Antonio Luis','Doctorado','5521312602','albo@azc.uam.mx',NULL),(41581,'García Cruz Raúl','Curricular',NULL,'ragc@azc.uam.mx',NULL),(41896,'ROJAS ZAMORA ULISES','por definir',NULL,'urz@azc.uam.mx',NULL),(41930,'Arreola Lucas Arturo','Curricular',NULL,'aal@azc.uam.mx',NULL),(42026,'Valle Hernández Brenda Liz','Doctorado','5549693105','blvh@azc.uam.mx',NULL),(42466,'González Torres Julio César','Curricular',NULL,'jcgt@azc.uam.mx',NULL),(42720,'SANCHEZ ELEUTERIO ALMA','por definir',NULL,'alsael@azc.uam.mx',NULL),(42729,'AGUILAR MARTINEZ OCTAVIO','por definir',NULL,'ocagma@azc.uam.mx',NULL),(43214,'HERNÁNDEZ MÉNDEZ RICARDO','por definir',NULL,'rhm@azc.uam.mx',NULL),(43221,'david','Ingeniería','9265708945','correo@azc.uam.mx','correo@correo.com'),(43332,'RAMIREZ DOMINGUEZ ELSIE','por definir',NULL,'elrd@azc.uam.mx',NULL),(43448,'MARTINEZ SALCEDO JEREMIAS','por definir',NULL,'ficticio@azc.uam.mx','salcedo20@hotmail.com'),(43513,'OTERO LOPEZ MARTHA LETICIA','por definir',NULL,'ficticio@azc.uam.mx','marthaot@gmail.com'),(44170,'SAN MARTIN JIMENEZ LUIS RENE','por definir',NULL,'majlr@azc.uam.mx',NULL),(44197,'Bueno Contreras José Jorge','Curricular',NULL,'jjbc@azc.uam.mx',NULL),(44198,'Pacheco Páez Juan Carlos','Curricular',NULL,'jcpacheco@azc.uam.mx',NULL),(44199,'Guzmán Rangel Georgina','Curricular','0','ficticio@azc.uam.mx','ginguza@hotmail.com'),(44471,'LOPEZ MONSALVO CESAR SIMON','por definir',NULL,'cslm@azc.uam.mx',NULL),(44472,'GOMEZ NAVARRO DANTE VIRGILIO','por definir',NULL,'ficticio@azc.uam.mx','dantegomezn@gmail.com'),(44493,'MARTINEZ PEREZ JOSE ARMANDO','por definir',NULL,'jamp@azc.uam.mx',NULL),(44506,'RODRIGUEZ CLEMENTE EDELMIRA','por definir',NULL,'edelmira@azc.uam.mx',NULL),(44554,'RENDON RODRIGUEZ OTTO GREGORIO','por definir',NULL,'ogrr@azc.uam.mx',NULL),(44827,'CHEN LIFANG','por definir',NULL,'ficticio@azc.uam.mx','chenlf2001@yahoo.com'),(44899,'IBARRA VILLALON HUGO ENRIQUE','por definir',NULL,'heiv@azc.uam.mx',NULL),(44900,'FLORES AGUILAR JOSE GABRIEL','por definir',NULL,'ficticio@azc.uam.mx','gabriel_flores_aguilar@hotmail.com'),(45849,'HERNÁNDEZ FYDRYCH VIANKA CELINA','por definir',NULL,'vchf@azc.uam.mx',NULL),(46108,'CANTO ESCAMILLA CARLOS EDUARDO','por definir',NULL,'cece@azc.uam.mx',NULL),(47174,'GONZÁLEZ HERNÁNDEZ SAUL','por definir',NULL,'sgh@azc.uam.mx',NULL),(47269,'RECHY GARCÍA JACKELINE SUZETT','por definir',NULL,'jsurega@azc.uam.mx',NULL),(47396,'MEDINA BAÑUELOS ESTEBAN FRANCISCO','por definir',NULL,'efmb@azc.uam.mx',NULL),(47398,'CHAMORRO ARENAS DELFINO','por definir',NULL,'dcha@azc.uam.mx',NULL);
/*!40000 ALTER TABLE `profesor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesor_has_area`
--

DROP TABLE IF EXISTS `profesor_has_area`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesor_has_area` (
  `profesor_idProfesor` int(11) NOT NULL,
  `area_idArea` int(11) NOT NULL,
  `profesorAreaTipo_idProfesorAreaTipo` int(11) NOT NULL,
  `descripcionInformal` varchar(255) DEFAULT NULL,
  `notas` varchar(255) DEFAULT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`profesor_numeroEconomico`,`area_idArea`,`profesorAreaTipo_idProfesorAreaTipo`),
  KEY `fk_profesor_has_area_area1_idx` (`area_idArea`),
  KEY `fk_profesor_has_area_profesor1_idx` (`profesor_idProfesor`),
  KEY `fk_profesor_has_area_profesorAreaTipo1_idx` (`profesorAreaTipo_idProfesorAreaTipo`),
  CONSTRAINT `fk_profesor_has_area_area1` FOREIGN KEY (`area_idArea`) REFERENCES `area` (`idArea`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_profesor_has_area_profesorAreaTipo1` FOREIGN KEY (`profesorAreaTipo_idProfesorAreaTipo`) REFERENCES `profesorareatipo` (`idProfesorAreaTipo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesor_has_area`
--

LOCK TABLES `profesor_has_area` WRITE;
/*!40000 ALTER TABLE `profesor_has_area` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesor_has_area` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesor_has_lugar`
--

DROP TABLE IF EXISTS `profesor_has_lugar`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesor_has_lugar` (
  `profesor_idProfesor` int(11) NOT NULL,
  `lugar_idLugar` int(11) NOT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`profesor_numeroEconomico`,`lugar_idLugar`),
  KEY `fk_profesor_has_lugar_lugar1_idx` (`lugar_idLugar`),
  KEY `fk_profesor_has_lugar_profesor1_idx` (`profesor_idProfesor`),
  CONSTRAINT `fk_profesor_has_lugar_lugar1` FOREIGN KEY (`lugar_idLugar`) REFERENCES `lugar` (`idLugar`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesor_has_lugar`
--

LOCK TABLES `profesor_has_lugar` WRITE;
/*!40000 ALTER TABLE `profesor_has_lugar` DISABLE KEYS */;
INSERT INTO `profesor_has_lugar` VALUES (0,4,28650);
/*!40000 ALTER TABLE `profesor_has_lugar` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesorareatipo`
--

DROP TABLE IF EXISTS `profesorareatipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesorareatipo` (
  `idProfesorAreaTipo` int(11) NOT NULL AUTO_INCREMENT,
  `descripcion` varchar(70) NOT NULL,
  PRIMARY KEY (`idProfesorAreaTipo`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesorareatipo`
--

LOCK TABLES `profesorareatipo` WRITE;
/*!40000 ALTER TABLE `profesorareatipo` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesorareatipo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesorcontrato`
--

DROP TABLE IF EXISTS `profesorcontrato`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesorcontrato` (
  `idProfesorContrato` int(11) NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` int(11) NOT NULL,
  `profesortipo_idProfesorTipo` int(11) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`idProfesorContrato`,`profesor_idProfesor`),
  KEY `fk_profesorcontrato_profesor1_idx` (`profesor_idProfesor`),
  KEY `fk_profesorcontrato_profesortipo1_idx` (`profesortipo_idProfesorTipo`),
  CONSTRAINT `fk_profesorcontrato_profesortipo1` FOREIGN KEY (`profesortipo_idProfesorTipo`) REFERENCES `profesortipo` (`idProfesorTipo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=288 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesorcontrato`
--

LOCK TABLES `profesorcontrato` WRITE;
/*!40000 ALTER TABLE `profesorcontrato` DISABLE KEYS */;
INSERT INTO `profesorcontrato` VALUES (1,0,1,'Generado automáticamente',43221),(2,0,1,'',15898),(3,0,1,'',42729),(4,0,1,'',12143),(5,0,1,'',28650),(6,0,1,'',446),(7,0,1,'',5720),(8,0,1,'',31456),(9,0,1,'',30711),(10,0,1,'',6388),(11,0,1,'',3987),(12,0,1,'',23083),(13,0,1,'',6864),(14,0,1,'',13870),(15,0,1,'',4796),(16,0,1,'',41930),(17,0,1,'',31356),(18,0,1,'',11101),(19,0,1,'',20427),(20,0,1,'',41339),(21,0,1,'',657),(22,0,1,'',16966),(23,0,1,'',11294),(24,0,1,'',20889),(25,0,1,'',6391),(26,0,1,'',1358),(27,0,1,'',6865),(28,0,1,'',2346),(29,0,1,'',31449),(30,0,1,'',10996),(31,0,1,'',44197),(32,0,1,'',35550),(33,0,1,'',46108),(34,0,1,'',21735),(35,0,1,'',41035),(36,0,1,'',4684),(37,0,1,'',27820),(38,0,1,'',16120),(39,0,1,'',28233),(40,0,1,'',1307),(41,0,1,'',475),(42,0,1,'',47398),(43,0,1,'',32858),(44,0,1,'',36082),(45,0,1,'',25076),(46,0,1,'',14721),(47,0,1,'',44827),(48,0,1,'',15307),(49,0,1,'',10883),(50,0,1,'',29955),(51,0,1,'',8156),(52,0,1,'',39258),(53,0,1,'',1750),(54,0,1,'',37268),(55,0,1,'',40071),(56,0,1,'',12583),(57,0,1,'',29462),(58,0,1,'',13413),(59,0,1,'',17755),(60,0,1,'',38470),(61,0,1,'',4365),(62,0,1,'',18681),(63,0,1,'',43221),(64,0,1,'',5438),(65,0,1,'',11651),(66,0,1,'',35716),(67,0,1,'',32802),(68,0,1,'',29366),(69,0,1,'',19834),(70,0,1,'',13398),(71,0,1,'',14378),(72,0,1,'',26426),(73,0,1,'',939),(74,0,1,'',38956),(75,0,1,'',37492),(76,0,1,'',25795),(77,0,1,'',14720),(78,0,1,'',3359),(79,0,1,'',2470),(80,0,1,'',38263),(81,0,1,'',44900),(82,0,1,'',31448),(83,0,1,'',22668),(84,0,1,'',32420),(85,0,1,'',4683),(86,0,1,'',1313),(87,0,1,'',4329),(88,0,1,'',37545),(89,0,1,'',34057),(90,0,1,'',2823),(91,0,1,'',41006),(92,0,1,'',23160),(93,0,1,'',7295),(94,0,1,'',41581),(95,0,1,'',34355),(96,0,1,'',18384),(97,0,1,'',13487),(98,0,1,'',15509),(99,0,1,'',37084),(100,0,1,'',40158),(101,0,1,'',7322),(102,0,1,'',27821),(103,0,1,'',39198),(104,0,1,'',44472),(105,0,1,'',28447),(106,0,1,'',36563),(107,0,1,'',18140),(108,0,1,'',47174),(109,0,1,'',35464),(110,0,1,'',42466),(111,0,1,'',18677),(112,0,1,'',39820),(113,0,1,'',3845),(114,0,1,'',4377),(115,0,1,'',8083),(116,0,1,'',16930),(117,0,1,'',27034),(118,0,1,'',10494),(119,0,1,'',44199),(120,0,1,'',34786),(121,0,1,'',39223),(122,0,1,'',45849),(123,0,1,'',9608),(124,0,1,'',13030),(125,0,1,'',38404),(126,0,1,'',43214),(127,0,1,'',14562),(128,0,1,'',21569),(129,0,1,'',4808),(130,0,1,'',35032),(131,0,1,'',41218),(132,0,1,'',310),(133,0,1,'',10345),(134,0,1,'',32300),(135,0,1,'',44899),(136,0,1,'',38426),(137,0,1,'',479),(138,0,1,'',19389),(139,0,1,'',21565),(140,0,1,'',3876),(141,0,1,'',40965),(142,0,1,'',39762),(143,0,1,'',28002),(144,0,1,'',34214),(145,0,1,'',37267),(146,0,1,'',28343),(147,0,1,'',44471),(148,0,1,'',37486),(149,0,1,'',19662),(150,0,1,'',6530),(151,0,1,'',13168),(152,0,1,'',2414),(153,0,1,'',41236),(154,0,1,'',23462),(155,0,1,'',38881),(156,0,1,'',24351),(157,0,1,'',31154),(158,0,1,'',32734),(159,0,1,'',44493),(160,0,1,'',43448),(161,0,1,'',23069),(162,0,1,'',14177),(163,0,1,'',27609),(164,0,1,'',12858),(165,0,1,'',38198),(166,0,1,'',940),(167,0,1,'',26155),(168,0,1,'',941),(169,0,1,'',47396),(170,0,1,'',30232),(171,0,1,'',16082),(172,0,1,'',10906),(173,0,1,'',13378),(174,0,1,'',17535),(175,0,1,'',37995),(176,0,1,'',13047),(177,0,1,'',14417),(178,0,1,'',34375),(179,0,1,'',4037),(180,0,1,'',23651),(181,0,1,'',13099),(182,0,1,'',38825),(183,0,1,'',25234),(184,0,1,'',25837),(185,0,1,'',31745),(186,0,1,'',24218),(187,0,1,'',7689),(188,0,1,'',35042),(189,0,1,'',36410),(190,0,1,'',8702),(191,0,1,'',10557),(192,0,1,'',2620),(193,0,1,'',29040),(194,0,1,'',23041),(195,0,1,'',1895),(196,0,1,'',25485),(197,0,1,'',39375),(198,0,1,'',31575),(199,0,1,'',14412),(200,0,1,'',25979),(201,0,1,'',11582),(202,0,1,'',14414),(203,0,1,'',11423),(204,0,1,'',41011),(205,0,1,'',43513),(206,0,1,'',6370),(207,0,1,'',44198),(208,0,1,'',12501),(209,0,1,'',14416),(210,0,1,'',28344),(211,0,1,'',4341),(212,0,1,'',4606),(213,0,1,'',12035),(214,0,1,'',21610),(215,0,1,'',40702),(216,0,1,'',36569),(217,0,1,'',18248),(218,0,1,'',31193),(219,0,1,'',4038),(220,0,1,'',11903),(221,0,1,'',13665),(222,0,1,'',27102),(223,0,1,'',18655),(224,0,1,'',13161),(225,0,1,'',4818),(226,0,1,'',17206),(227,0,1,'',162),(228,0,1,'',27516),(229,0,1,'',11304),(230,0,1,'',43332),(231,0,1,'',27699),(232,0,1,'',14717),(233,0,1,'',37070),(234,0,1,'',40970),(235,0,1,'',47269),(236,0,1,'',44554),(237,0,1,'',16283),(238,0,1,'',12407),(239,0,1,'',8181),(240,0,1,'',19560),(241,0,1,'',10382),(242,0,1,'',2642),(243,0,1,'',44506),(244,0,1,'',16820),(245,0,1,'',2243),(246,0,1,'',4811),(247,0,1,'',33679),(248,0,1,'',28938),(249,0,1,'',41896),(250,0,1,'',9434),(251,0,1,'',26274),(252,0,1,'',12535),(253,0,1,'',14541),(254,0,1,'',36992),(255,0,1,'',4812),(256,0,1,'',7194),(257,0,1,'',44170),(258,0,1,'',42720),(259,0,1,'',36997),(260,0,1,'',37373),(261,0,1,'',34592),(262,0,1,'',3880),(263,0,1,'',6539),(264,0,1,'',38832),(265,0,1,'',553),(266,0,1,'',22644),(267,0,1,'',1312),(268,0,1,'',35986),(269,0,1,'',2497),(270,0,1,'',10590),(271,0,1,'',27610),(272,0,1,'',1360),(273,0,1,'',7487),(274,0,1,'',42026),(275,0,1,'',14877),(276,0,1,'',4681),(277,0,1,'',38194),(278,0,1,'',6362),(279,0,1,'',29577),(280,0,1,'',32565),(281,0,1,'',15682),(282,0,1,'',2639),(283,0,1,'',40123),(284,0,1,'',33221),(285,0,1,'',3641),(286,0,1,'',4828),(287,0,1,'',24865);
/*!40000 ALTER TABLE `profesorcontrato` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesordisposicion`
--

DROP TABLE IF EXISTS `profesordisposicion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesordisposicion` (
  `idProfesorDisposicion` int(11) NOT NULL AUTO_INCREMENT,
  `trimestre_idTrimestre` int(11) NOT NULL,
  `estado` tinyint(4) NOT NULL DEFAULT 1,
  `notas` varchar(255) DEFAULT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`idProfesorDisposicion`,`trimestre_idTrimestre`),
  KEY `fk_profesordisposicion_trimestre1_idx` (`trimestre_idTrimestre`),
  CONSTRAINT `fk_profesordisposicion_trimestre1` FOREIGN KEY (`trimestre_idTrimestre`) REFERENCES `trimestre` (`idTrimestre`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesordisposicion`
--

LOCK TABLES `profesordisposicion` WRITE;
/*!40000 ALTER TABLE `profesordisposicion` DISABLE KEYS */;
INSERT INTO `profesordisposicion` VALUES (1,8,1,'Agregado automáticamente al crear el trimestre - Periodo: 25 Año: 2026 FechaLimite: 2026-01-23',0);
/*!40000 ALTER TABLE `profesordisposicion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesoremergencia`
--

DROP TABLE IF EXISTS `profesoremergencia`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesoremergencia` (
  `idProfesorEmergencia` int(11) NOT NULL AUTO_INCREMENT,
  `profesor_idProfesor` int(11) NOT NULL,
  `nombre` varchar(200) NOT NULL,
  `parentesco` varchar(255) NOT NULL,
  `celular` varchar(15) DEFAULT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`idProfesorEmergencia`,`profesor_idProfesor`),
  KEY `fk_profesoremergencia_profesor1_idx` (`profesor_idProfesor`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesoremergencia`
--

LOCK TABLES `profesoremergencia` WRITE;
/*!40000 ALTER TABLE `profesoremergencia` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesoremergencia` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesorpreferencia_has_horario`
--

DROP TABLE IF EXISTS `profesorpreferencia_has_horario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesorpreferencia_has_horario` (
  `horario_idHorario` int(11) NOT NULL,
  `profesorPreferencia_idProfesorPreferencias` int(11) NOT NULL,
  PRIMARY KEY (`horario_idHorario`,`profesorPreferencia_idProfesorPreferencias`),
  KEY `fk_Horario_has_profesorPreferencia_profesorPreferencia1_idx` (`profesorPreferencia_idProfesorPreferencias`),
  KEY `fk_Horario_has_profesorPreferencia_Horario1_idx` (`horario_idHorario`),
  CONSTRAINT `fk_Horario_has_profesorPreferencia_Horario1` FOREIGN KEY (`horario_idHorario`) REFERENCES `horario` (`idHorario`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_Horario_has_profesorPreferencia_profesorPreferencia1` FOREIGN KEY (`profesorPreferencia_idProfesorPreferencias`) REFERENCES `profesorpreferencias` (`idProfesorPreferencias`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesorpreferencia_has_horario`
--

LOCK TABLES `profesorpreferencia_has_horario` WRITE;
/*!40000 ALTER TABLE `profesorpreferencia_has_horario` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesorpreferencia_has_horario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesorpreferencia_has_uea`
--

DROP TABLE IF EXISTS `profesorpreferencia_has_uea`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesorpreferencia_has_uea` (
  `profesorPreferencia_idProfesorPreferencias` int(11) NOT NULL,
  `uea_idUEA` int(11) NOT NULL,
  `prioridad` int(11) NOT NULL,
  PRIMARY KEY (`profesorPreferencia_idProfesorPreferencias`,`uea_idUEA`),
  KEY `fk_profesorPreferencia_has_UEA_UEA1_idx` (`uea_idUEA`),
  KEY `fk_profesorPreferencia_has_UEA_profesorPreferencia1_idx` (`profesorPreferencia_idProfesorPreferencias`),
  CONSTRAINT `fk_profesorPreferencia_has_UEA_UEA1` FOREIGN KEY (`uea_idUEA`) REFERENCES `uea` (`idUEA`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_profesorPreferencia_has_UEA_profesorPreferencia1` FOREIGN KEY (`profesorPreferencia_idProfesorPreferencias`) REFERENCES `profesorpreferencias` (`idProfesorPreferencias`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesorpreferencia_has_uea`
--

LOCK TABLES `profesorpreferencia_has_uea` WRITE;
/*!40000 ALTER TABLE `profesorpreferencia_has_uea` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesorpreferencia_has_uea` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesorpreferencias`
--

DROP TABLE IF EXISTS `profesorpreferencias`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesorpreferencias` (
  `idProfesorPreferencias` int(11) NOT NULL AUTO_INCREMENT,
  `trimestre_idTrimestre` int(11) NOT NULL,
  `noGrupos` int(11) DEFAULT NULL,
  `observaciones` varchar(955) DEFAULT NULL,
  `profesor_numeroEconomico` int(11) NOT NULL,
  PRIMARY KEY (`idProfesorPreferencias`),
  KEY `fk_profesorPreferencia_trimestre1_idx` (`trimestre_idTrimestre`),
  CONSTRAINT `fk_profesorPreferencia_trimestre1` FOREIGN KEY (`trimestre_idTrimestre`) REFERENCES `trimestre` (`idTrimestre`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesorpreferencias`
--

LOCK TABLES `profesorpreferencias` WRITE;
/*!40000 ALTER TABLE `profesorpreferencias` DISABLE KEYS */;
/*!40000 ALTER TABLE `profesorpreferencias` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `profesortipo`
--

DROP TABLE IF EXISTS `profesortipo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `profesortipo` (
  `idProfesorTipo` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(150) NOT NULL,
  `descripcion` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`idProfesorTipo`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `profesortipo`
--

LOCK TABLES `profesortipo` WRITE;
/*!40000 ALTER TABLE `profesortipo` DISABLE KEYS */;
INSERT INTO `profesortipo` VALUES (1,'Investigador','');
/*!40000 ALTER TABLE `profesortipo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `programacion`
--

DROP TABLE IF EXISTS `programacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `programacion` (
  `grupo_trimestre_idTrimestre` int(11) NOT NULL,
  `grupo_idGrupo` int(11) NOT NULL,
  `profesordisposicion_idProfesorDisposicion` int(11) NOT NULL,
  PRIMARY KEY (`grupo_trimestre_idTrimestre`,`grupo_idGrupo`,`profesordisposicion_idProfesorDisposicion`),
  KEY `fk_profesor_has_grupo_grupo1_idx` (`grupo_idGrupo`,`grupo_trimestre_idTrimestre`),
  KEY `fk_programacion_profesordisposicion1_idx` (`profesordisposicion_idProfesorDisposicion`),
  CONSTRAINT `fk_profesor_has_grupo_grupo1` FOREIGN KEY (`grupo_idGrupo`, `grupo_trimestre_idTrimestre`) REFERENCES `grupo` (`idGrupo`, `trimestre_idTrimestre`) ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT `fk_programacion_profesordisposicion1` FOREIGN KEY (`profesordisposicion_idProfesorDisposicion`) REFERENCES `profesordisposicion` (`idProfesorDisposicion`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `programacion`
--

LOCK TABLES `programacion` WRITE;
/*!40000 ALTER TABLE `programacion` DISABLE KEYS */;
/*!40000 ALTER TABLE `programacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trim_ver_programacion`
--

DROP TABLE IF EXISTS `trim_ver_programacion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `trim_ver_programacion` (
  `idTrimestre` int(11) DEFAULT NULL,
  `añoTrimestre` int(11) DEFAULT NULL,
  `idUEA` int(11) DEFAULT NULL,
  `claveUEA` int(11) DEFAULT NULL,
  `idGrupo` int(11) DEFAULT NULL,
  `claveGrupo` int(11) DEFAULT NULL,
  `idHorario` int(11) DEFAULT NULL,
  `dia` int(11) DEFAULT NULL,
  `horaInicio` int(11) DEFAULT NULL,
  `horaFin` int(11) DEFAULT NULL,
  `idProfesor` int(11) DEFAULT NULL,
  `numeroEconomico` int(11) DEFAULT NULL,
  `nombreProfesor` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trim_ver_programacion`
--

LOCK TABLES `trim_ver_programacion` WRITE;
/*!40000 ALTER TABLE `trim_ver_programacion` DISABLE KEYS */;
/*!40000 ALTER TABLE `trim_ver_programacion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trimestre`
--

DROP TABLE IF EXISTS `trimestre`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `trimestre` (
  `idTrimestre` int(11) NOT NULL AUTO_INCREMENT,
  `trimestreestado_idTrimestreEstado` int(11) NOT NULL,
  `trimestreperiodo_idTrimestrePeriodo` int(11) NOT NULL,
  `año` int(11) NOT NULL,
  `fechaLimite` date NOT NULL,
  PRIMARY KEY (`idTrimestre`,`trimestreestado_idTrimestreEstado`),
  KEY `fk_trimestre_trimestreperiodo1_idx` (`trimestreperiodo_idTrimestrePeriodo`),
  KEY `fk_trimestre_trimestreestado1_idx` (`trimestreestado_idTrimestreEstado`),
  CONSTRAINT `fk_trimestre_trimestreestado1` FOREIGN KEY (`trimestreestado_idTrimestreEstado`) REFERENCES `trimestreestado` (`idTrimestreEstado`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_trimestre_trimestreperiodo1` FOREIGN KEY (`trimestreperiodo_idTrimestrePeriodo`) REFERENCES `trimestreperiodo` (`idTrimestrePeriodo`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trimestre`
--

LOCK TABLES `trimestre` WRITE;
/*!40000 ALTER TABLE `trimestre` DISABLE KEYS */;
INSERT INTO `trimestre` VALUES (8,2,1,2026,'2026-01-23');
/*!40000 ALTER TABLE `trimestre` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trimestreestado`
--

DROP TABLE IF EXISTS `trimestreestado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `trimestreestado` (
  `idTrimestreEstado` int(11) NOT NULL AUTO_INCREMENT,
  `estado` varchar(50) NOT NULL,
  PRIMARY KEY (`idTrimestreEstado`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trimestreestado`
--

LOCK TABLES `trimestreestado` WRITE;
/*!40000 ALTER TABLE `trimestreestado` DISABLE KEYS */;
INSERT INTO `trimestreestado` VALUES (1,'Activo'),(2,'Inactivo');
/*!40000 ALTER TABLE `trimestreestado` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `trimestreperiodo`
--

DROP TABLE IF EXISTS `trimestreperiodo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `trimestreperiodo` (
  `idTrimestrePeriodo` int(11) NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) NOT NULL,
  `sigla` varchar(1) NOT NULL,
  PRIMARY KEY (`idTrimestrePeriodo`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `trimestreperiodo`
--

LOCK TABLES `trimestreperiodo` WRITE;
/*!40000 ALTER TABLE `trimestreperiodo` DISABLE KEYS */;
INSERT INTO `trimestreperiodo` VALUES (1,'25','I');
/*!40000 ALTER TABLE `trimestreperiodo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `uea`
--

DROP TABLE IF EXISTS `uea`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `uea` (
  `idUEA` int(11) NOT NULL AUTO_INCREMENT,
  `area_idArea` int(11) NOT NULL,
  `claveUEA` int(11) DEFAULT NULL,
  `nombre` varchar(125) DEFAULT NULL,
  PRIMARY KEY (`idUEA`),
  UNIQUE KEY `idUEA` (`idUEA`),
  KEY `fk_UEA_area1_idx` (`area_idArea`),
  CONSTRAINT `fk_UEA_area1` FOREIGN KEY (`area_idArea`) REFERENCES `area` (`idArea`) ON DELETE NO ACTION ON UPDATE NO ACTION
) ENGINE=InnoDB AUTO_INCREMENT=102 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `uea`
--

LOCK TABLES `uea` WRITE;
/*!40000 ALTER TABLE `uea` DISABLE KEYS */;
INSERT INTO `uea` VALUES (1,1,1112005,'Cálculo de Varias Variables'),(2,1,1112043,'Cálculo Diferencial'),(3,1,1112029,'Cálculo Integral'),(4,1,1112041,'Cálculo Vectorial y sus Aplicaciones'),(5,1,1112035,'Combinatoria'),(6,1,1112013,'Complementos de Matemáticas'),(7,1,1112036,'Criptografía'),(8,1,1112030,'Ecuaciones Diferenciales Ordinarias'),(9,1,1112032,'Introducción a las Ecuaciones Diferenciales Parciales'),(10,1,1112017,'Introducción al Álgebra Lineal'),(11,1,1112042,'Introducción al Cálculo'),(12,1,1112034,'Lenguajes y Autómatas'),(13,1,1112022,'Lógica'),(14,1,1112015,'Matemáticas Aplicadas para Ingeniería'),(15,1,1112033,'Matemáticas Discretas'),(16,1,1112031,'Series, Transformadas y Ecuaciones Diferenciales'),(17,1,1112038,'Temas Selectos de Matemáticas Discretas'),(18,1,1112037,'Teoría de la Computación'),(19,1,1112040,'Transformada de Laplace y Análisis de Fourier'),(20,1,1112016,'Variable Compleja'),(21,2,1111053,'Acústica'),(22,2,1111085,'Análisis Vectorial'),(23,2,1111044,'Aplicaciones del Electromagnetismo'),(24,2,1111079,'Cinemática y Dinámica de Partículas'),(25,2,1111013,'Dinámica Aplicada'),(26,2,1111081,'Dinámica del Cuerpo Rígido'),(27,2,1111043,'Electromagnetismo'),(28,2,1111045,'Estática del Cuerpo Deformable'),(29,2,1111077,'Física Contemporánea'),(30,2,1111032,'Física del Estado Sólido'),(31,2,1111048,'Física Moderna'),(32,2,1111091,'Funciones Especiales'),(33,2,1111057,'Imágenes'),(34,2,1111090,'Inducción y Ondas Electromagnéticas'),(35,2,1111059,'Ingeniería Óptica'),(36,2,1111058,'Instrumentación y Equipo II'),(37,2,1111083,'Introducción a la Electrostática y Magnetostática'),(38,2,1111078,'Introducción a la Física'),(39,2,1111094,'Laboratorio de Electricidad y Magnetismo'),(40,2,1111088,'Laboratorio de Física Atómica y Molecular'),(41,2,1111087,'Laboratorio de Física Moderna'),(42,2,1111092,'Laboratorio de Movimiento de una Partícula'),(43,2,1111069,'Laboratorio de Óptica'),(44,2,1111093,'Laboratorio del Cuerpo Rígido y Oscilaciones'),(45,2,1111070,'Laboratorio Interdisciplinario'),(46,2,1111019,'Mecánica Estadística'),(47,2,1111055,'Óptica'),(48,2,1111095,'Optoelectrónica'),(49,2,1111060,'Principios de Diseño y Construcción de Equipos e Instrumentos'),(50,2,1111034,'Propiedades Eléctricas y Magnéticas de los Materiales'),(51,2,1111054,'Sensores, Transductores y Detectores'),(52,2,1111052,'Temas Selectos de Ingeniería Física I'),(53,2,1111066,'Temas Selectos de Ingeniería Física II'),(54,2,1111067,'Temas Selectos de Ingeniería Física III'),(55,3,1113088,'Aplicaciones Industriales de Catalizadores Heterogéneos'),(56,3,1113078,'Cinética y Catálisis'),(57,3,1113057,'Contaminación Ambiental'),(58,3,1113092,'Efecto Invernadero y Cambio Climático'),(59,3,1113097,'Electroquímica'),(60,3,1113099,'Equilibrio Químico'),(61,3,1113084,'Estructura Atómica y Enlace Químico'),(62,3,1113086,'Estructura y Propiedades de los Materiales en Ingeniería'),(63,3,1113091,'Fenómenos de Superficie'),(64,3,1113069,'Fisicoquímica de los Materiales'),(65,3,1113096,'Fundamentos de Química Orgánica y Bioquímica'),(66,3,1113090,'Introducción a la Bioquímica'),(67,3,1113093,'Inventarios de Emisiones Atmosféricas'),(68,3,1113079,'Laboratorio de Cinética y Catálisis'),(69,3,1113087,'Laboratorio de Estructura y Propiedades de los Materiales'),(70,3,1113070,'Laboratorio de Fisicoquímica de los Materiales'),(71,3,1113077,'Laboratorio de Microbiología Aplicada'),(72,3,1113073,'Laboratorio de Química Analítica'),(73,3,1113048,'Laboratorio de Química Inorgánica I'),(74,3,1113050,'Laboratorio de Química Inorgánica II'),(75,3,1113019,'Laboratorio de Química Orgánica I'),(76,3,1113021,'Laboratorio de Química Orgánica II'),(77,3,1113085,'Laboratorio de Reacciones Químicas'),(78,3,1113082,'Microbiología Aplicada'),(79,3,1113095,'Química Ambiental'),(80,3,1113071,'Química Física Aplicada'),(81,3,1113047,'Química Inorgánica I'),(82,3,1113049,'Química Inorgánica II'),(83,3,1113018,'Química Orgánica I'),(84,3,1113024,'Química Orgánica II'),(85,3,1113023,'Química Orgánica III'),(86,3,1113089,'Síntesis, Caracterización y Evaluación de Materiales Catalíticos'),(87,3,1113053,'Técnicas de Medición de Composición'),(88,3,1113080,'Temas Selectos de Química'),(89,3,1113046,'Termodinámica'),(90,4,1100038,'Introducción al Desarrollo Sustentable'),(91,4,1100041,'Retos del Desarrollo Nacional'),(92,4,1100096,'Taller de Expresión Oral y Escrita'),(93,5,1210056,'Estadística Aplicada a la Administración I'),(94,5,1210058,'Estadística Aplicada a la Administración II'),(95,5,1210072,'Métodos Cuantitativos Aplicados a la Administración I'),(96,5,1210053,'Métodos Cuantitativos Aplicados a la Administración II'),(97,5,1220084,'Lógica Simbólica I'),(98,5,1220086,'Lógica Simbólica II'),(99,5,1230112,'Algebra Lineal (CSH)'),(100,5,1230114,'Ecuaciones Diferenciales y en Diferencia'),(101,5,1230115,'Optimización Dinámica');
/*!40000 ALTER TABLE `uea` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuario` (
  `idUsuario` int(11) NOT NULL AUTO_INCREMENT,
  `usuario` varchar(50) NOT NULL,
  `contraseña` text NOT NULL,
  `intento` int(11) NOT NULL DEFAULT 0,
  PRIMARY KEY (`idUsuario`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (1,'ayudante_cb$$','$argon2id$v=19$m=1048576,t=3,p=1$b29qa3JzM2FqQ1cvdTZkdQ$YFSqR8Bsp+4L+0os2ReJDz/ZQPjJY3SwtKLaH8cbVAs',0),(6,'soporte','$argon2id$v=19$m=1048576,t=3,p=1$VFJaYmphUFpLSEJ3dmxVMA$ogpuw9PIc1mob58VJbiRXMeTDMcUncECCmt8Dz/Mx30',0);
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario_has_funcion`
--

DROP TABLE IF EXISTS `usuario_has_funcion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `usuario_has_funcion` (
  `usuario_idUsuario` int(11) NOT NULL,
  `funcion_idFuncion` int(11) NOT NULL,
  PRIMARY KEY (`usuario_idUsuario`,`funcion_idFuncion`),
  KEY `fk_usuario_has_funcion_funcion1_idx` (`funcion_idFuncion`),
  KEY `fk_usuario_has_funcion_usuario1_idx` (`usuario_idUsuario`),
  CONSTRAINT `fk_usuario_has_funcion_funcion1` FOREIGN KEY (`funcion_idFuncion`) REFERENCES `funcion` (`idFuncion`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_usuario_has_funcion_usuario1` FOREIGN KEY (`usuario_idUsuario`) REFERENCES `usuario` (`idUsuario`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario_has_funcion`
--

LOCK TABLES `usuario_has_funcion` WRITE;
/*!40000 ALTER TABLE `usuario_has_funcion` DISABLE KEYS */;
INSERT INTO `usuario_has_funcion` VALUES (1,1),(6,1);
/*!40000 ALTER TABLE `usuario_has_funcion` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-06 14:39:18
