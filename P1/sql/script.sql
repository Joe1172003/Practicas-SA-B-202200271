CREATE TABLE Operational_requests(
	id_request UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	title VARCHAR(100) NOT NULL,
	area_request VARCHAR(100) NOT NULL,
	"priority" SMALLINT NOT NULL CHECK ("priority" BETWEEN 1 AND 5),
	estimated_cost NUMERIC(12, 2) NOT NULL CHECK (estimated_cost >= 0),
	"status" VARCHAR(50) NOT NULL DEFAULT 'registrada' CHECK ("status" in ('registrada', 'en_proceso', 'finalizada')),
	create_in TIMESTAMPTZ NOT NULL DEFAULT now(),
	update_in TIMESTAMPTZ NOT NULL DEFAULT now()
); 


