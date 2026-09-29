-- pgcrypto gives SQL its own password hashing (crypt / gen_salt), so staff
-- accounts can be created and reset with plain SQL and the API can check
-- passwords in the database. It is a "trusted" extension: the database owner
-- may create it.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
