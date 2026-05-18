from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from bson import ObjectId
from pymongo.errors import PyMongoError
from pymongo import ReturnDocument
from database import collection, counters_collection
from schemas import User
import re

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "age": user["age"]
    }


def database_error_response(error: Exception):
    raise HTTPException(
        status_code=503,
        detail=f"MongoDB connection failed: {error}"
    )


def get_login_count():
    try:
        counter = counters_collection.find_one({"name": "logins"})
        return counter["count"] if counter else 0
    except PyMongoError as error:
        database_error_response(error)


def normalize_email(email: str):
    return email.strip().lower()


def email_filter(email: str):
    return {
        "email": {
            "$regex": f"^{re.escape(normalize_email(email))}$",
            "$options": "i"
        }
    }


@app.get("/")
def home():
    return {"message": "FastAPI CRUD Running"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}


@app.get("/dashboard/stats")
def get_dashboard_stats():
    try:
        return {
            "signups": collection.count_documents({}),
            "logins": get_login_count(),
            "authenticationRequired": False
        }
    except PyMongoError as error:
        database_error_response(error)


@app.post("/login")
def login():
    try:
        result = counters_collection.find_one_and_update(
            {"name": "logins"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER
        )
    except PyMongoError as error:
        database_error_response(error)

    return {
        "message": "Login counted successfully",
        "logins": result["count"],
        "authenticationRequired": False
    }


@app.post("/users")
def create_user(user: User):
    normalized_email = normalize_email(user.email)

    try:
        if collection.find_one(email_filter(normalized_email)):
            raise HTTPException(
                status_code=409,
                detail="A user with this email already exists"
            )

        user_data = user.model_dump()
        user_data["email"] = normalized_email

        result = collection.insert_one(user_data)

        new_user = collection.find_one({"_id": result.inserted_id})
    except PyMongoError as error:
        database_error_response(error)

    return serialize_user(new_user)


@app.get("/users")
def get_users():

    try:
        users = []

        for user in collection.find():
            users.append(serialize_user(user))
    except PyMongoError as error:
        database_error_response(error)

    return users


@app.put("/users/{id}")
def update_user(id: str, user: User):

    try:
        user_id = ObjectId(id)
        normalized_email = normalize_email(user.email)

        duplicate_filter = email_filter(normalized_email)
        duplicate_filter["_id"] = {"$ne": user_id}
        duplicate_user = collection.find_one(duplicate_filter)

        if duplicate_user:
            raise HTTPException(
                status_code=409,
                detail="A user with this email already exists"
            )

        collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "name": user.name,
                    "email": normalized_email,
                    "age": user.age
                }
            }
        )

        updated_user = collection.find_one(
            {"_id": user_id}
        )

        if updated_user:
            return serialize_user(updated_user)

        return {"message": "User not found"}

    except Exception as e:
        return {"error": str(e)}

@app.delete("/users/{id}")
def delete_user(id: str):

    try:

        result = collection.delete_one(
            {"_id": ObjectId(id)}
        )

        if result.deleted_count == 1:
            return {"message": "User deleted successfully"}

        return {"message": "User not found"}

    except HTTPException:
        raise
    except Exception as e:
        return {"error": str(e)}
