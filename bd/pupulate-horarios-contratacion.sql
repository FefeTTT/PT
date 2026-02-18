INSERT INTO horarios_contratacion (idDiasDeTrabajo, horaInicio, horaFin)
VALUES (
    (SELECT idDiasDeTrabajo FROM dias_de_trabajo WHERE codigo_dias = 'L-V'),
    '10:00',
    '18:00'
);
