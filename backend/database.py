from dotenv import load_dotenv
from pymongo import MongoClient
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL is not set. Add it to backend/.env before starting the API.")

_client = None
_db = None


def get_database():
    global _client, _db

    if _db is None:
        _client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
        _db = _client["crud_db"]

    return _db


class LazyCollection:
    def __init__(self, name: str):
        self.name = name

    def _collection(self):
        return get_database()[self.name]

    def __getattr__(self, item):
        return getattr(self._collection(), item)


collection = LazyCollection("users")
counters_collection = LazyCollection("counters")
