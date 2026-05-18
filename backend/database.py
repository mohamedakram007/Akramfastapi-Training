from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")

client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)

db = client["crud_db"]

collection = db["users"]
counters_collection = db["counters"]
