CREATE TABLE active_cook (
  id INTEGER PRIMARY KEY CHECK (id = 1), data TEXT NOT NULL,
  started_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE cook_history (
  id TEXT PRIMARY KEY, served_at INTEGER NOT NULL, pit_temp_f REAL NOT NULL,
  late_min INTEGER, notes TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);

CREATE TABLE cook_history_items (
  id INTEGER PRIMARY KEY, cook_id TEXT NOT NULL REFERENCES cook_history(id) ON DELETE CASCADE,
  position INTEGER NOT NULL, name TEXT NOT NULL, food_id TEXT NOT NULL, method_id TEXT NOT NULL,
  smoker_id TEXT NOT NULL, quantity REAL NOT NULL, pit_temp_f REAL NOT NULL,
  minutes_on_heat REAL NOT NULL, planned_min REAL NOT NULL, actual_min REAL NOT NULL,
  options TEXT,
  discarded INTEGER NOT NULL DEFAULT 0);

CREATE INDEX cook_history_items_learn ON cook_history_items(food_id, method_id, smoker_id);

CREATE TABLE cookers (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('smoker','griddle','oven')),
  profile TEXT NOT NULL,
  position INTEGER NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE kv (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL);

CREATE TABLE rate_overrides (
  food_id TEXT PRIMARY KEY, hr_per_lb REAL, total_hours REAL,
  locked INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL);
