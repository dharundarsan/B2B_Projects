 AND LOWER(r.id || ' ' || r.title || ' ' || r.property || ' ' || r.unit || ' ' || r.resident || ' ' || r.category) LIKE @search ESCAPE '!'
