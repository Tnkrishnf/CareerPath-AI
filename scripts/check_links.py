"""Checks that every course URL in the database/seed data responds: python scripts/check_links.py"""
import os, sys
import requests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from data.seed_data import COURSES

bad = 0
for c in COURSES:
    try:
        r = requests.get(c["url"], timeout=15, headers={"User-Agent": "Mozilla/5.0 link-check"}, allow_redirects=True)
        status = r.status_code
    except Exception as e:  # noqa: BLE001
        status = type(e).__name__
    flag = "OK " if status == 200 else "?? "
    bad += status != 200
    print(flag, status, c["url"])
print(f"{len(COURSES) - bad}/{len(COURSES)} reachable (403/429 can just mean the site blocks scripts; open those in a browser)")
