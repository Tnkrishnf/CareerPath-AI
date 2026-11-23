"""Regenerates database/schema.sql (MySQL DDL) from the SQLAlchemy models: python scripts/gen_schema.py"""
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from sqlalchemy.dialects import mysql
from sqlalchemy.schema import CreateIndex, CreateTable
from extensions import db
import models  # noqa: F401

out = ["-- CareerPath AI - MySQL 8 schema (generated from backend/models.py)",
       "CREATE DATABASE IF NOT EXISTS careerpath_ai CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;",
       "USE careerpath_ai;", "SET FOREIGN_KEY_CHECKS = 0;", ""]
d = mysql.dialect()
for t in db.metadata.sorted_tables:
    out.append(f"DROP TABLE IF EXISTS `{t.name}`;")
    out.append(str(CreateTable(t).compile(dialect=d)).strip() + " ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;")
    for ix in sorted(t.indexes, key=lambda i: i.name):
        out.append(str(CreateIndex(ix).compile(dialect=d)).strip() + ";")
    out.append("")
out.append("SET FOREIGN_KEY_CHECKS = 1;")
path = os.path.join(os.path.dirname(__file__), "..", "database", "schema.sql")
open(path, "w").write("\n".join(out) + "\n")
print("wrote", os.path.abspath(path), len(db.metadata.sorted_tables), "tables")
