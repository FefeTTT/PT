SELECT gradoEstudios, 
       CASE 
           WHEN gradoEstudios = 'Doctorado' THEN 1
           WHEN gradoEstudios LIKE 'Maestr%a' THEN 2
           ELSE NULL 
       END as id_calculado
FROM profesor;

UPDATE profesor
SET idGrado = CASE 
    WHEN gradoEstudios = 'Doctorado' THEN 1
    WHEN gradoEstudios LIKE 'Maestr%a' THEN 2
    WHEN gradoEstudios = 'por definir' THEN NULL
    ELSE idGrado
END;