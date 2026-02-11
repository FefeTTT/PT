USE dbappcb;
CREATE TABLE IF NOT EXISTS uea (
    clave INT PRIMARY KEY,
    nombre VARCHAR(255) NOT NULL,
    areaId INT NOT NULL,
    CONSTRAINT fk_uea_area 
        FOREIGN KEY (areaId) 
        REFERENCES area(idArea)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);
