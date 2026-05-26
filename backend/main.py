from base64 import urlsafe_b64decode, urlsafe_b64encode
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pymongo import ReturnDocument
from pymongo.errors import PyMongoError
from database import collection, counters_collection
from schemas import AdminLogin, User
import hashlib
import hmac
import json
import os
import re
import secrets
import time

app = FastAPI()


def get_allowed_origins():
    configured_origins = os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000",
    )
    return [origin.strip() for origin in configured_origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD")
ADMIN_TOKEN_SECRET = os.getenv("ADMIN_TOKEN_SECRET")
ADMIN_TOKEN_EXPIRES_SECONDS = int(os.getenv("ADMIN_TOKEN_EXPIRES_SECONDS", "43200"))

if not ADMIN_EMAIL or not ADMIN_PASSWORD or not ADMIN_TOKEN_SECRET:
    raise RuntimeError(
        "ADMIN_EMAIL, ADMIN_PASSWORD, and ADMIN_TOKEN_SECRET must be set in backend/.env."
    )

security = HTTPBearer(auto_error=False)


def serialize_user(user):
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "email": user["email"],
        "age": user["age"],
    }


def build_user_tree(users):
    children = []

    for user in sorted(users, key=lambda item: item["name"].lower()):
        children.append(
            {
                "id": str(user["_id"]),
                "label": user["name"],
                "email": user["email"],
                "age": user["age"],
                "type": "user",
            }
        )

    return {
        "id": "all-users",
        "label": "All Users",
        "type": "root",
        "count": len(users),
        "children": children,
    }


def database_error_response(error: Exception):
    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail=f"MongoDB connection failed: {error}",
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
            "$options": "i",
        }
    }


def encode_token_segment(data):
    encoded = urlsafe_b64encode(data.encode("utf-8")).decode("utf-8")
    return encoded.rstrip("=")


def decode_token_segment(data):
    padding = "=" * (-len(data) % 4)
    return urlsafe_b64decode(f"{data}{padding}").decode("utf-8")


def create_admin_token(email: str):
    payload = {
        "sub": normalize_email(email),
        "exp": int(time.time()) + ADMIN_TOKEN_EXPIRES_SECONDS,
    }
    payload_segment = encode_token_segment(json.dumps(payload, separators=(",", ":")))
    signature = hmac.new(
        ADMIN_TOKEN_SECRET.encode("utf-8"),
        payload_segment.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{payload_segment}.{signature}"


def verify_admin_token(token: str):
    try:
        payload_segment, provided_signature = token.split(".", 1)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from error

    expected_signature = hmac.new(
        ADMIN_TOKEN_SECRET.encode("utf-8"),
        payload_segment.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not secrets.compare_digest(provided_signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    try:
        payload = json.loads(decode_token_segment(payload_segment))
    except (json.JSONDecodeError, UnicodeDecodeError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        ) from error

    if payload.get("exp", 0) < int(time.time()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token has expired.",
        )

    if normalize_email(payload.get("sub", "")) != normalize_email(ADMIN_EMAIL):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
        )

    return payload


def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication is required.",
        )

    return verify_admin_token(credentials.credentials)


def parse_object_id(id: str):
    try:
        return ObjectId(id)
    except InvalidId as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user id.",
        ) from error


@app.get("/")
def home():
    return {"message": "FastAPI CRUD Running"}


@app.api_route("/health", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok"}


@app.get("/dashboard/stats")
def get_dashboard_stats(_admin=Depends(require_admin)):
    try:
        return {
            "signups": collection.count_documents({}),
            "logins": get_login_count(),
            "authenticationRequired": True,
        }
    except PyMongoError as error:
        database_error_response(error)


@app.post("/login")
def login(credentials: AdminLogin):
    normalized_admin_email = normalize_email(ADMIN_EMAIL)
    submitted_email = normalize_email(credentials.email)

    if submitted_email != normalized_admin_email or not secrets.compare_digest(
        credentials.password, ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin email or password.",
        )

    try:
        result = counters_collection.find_one_and_update(
            {"name": "logins"},
            {"$inc": {"count": 1}},
            upsert=True,
            return_document=ReturnDocument.AFTER,
        )
    except PyMongoError as error:
        database_error_response(error)

    return {
        "message": "Login counted successfully",
        "logins": result["count"],
        "authenticationRequired": True,
        "token": create_admin_token(submitted_email),
    }


@app.post("/users")
def create_user(user: User):
    normalized_email = normalize_email(user.email)

    try:
        if collection.find_one(email_filter(normalized_email)):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        user_data = user.model_dump()
        user_data["email"] = normalized_email

        result = collection.insert_one(user_data)
        new_user = collection.find_one({"_id": result.inserted_id})
    except HTTPException:
        raise
    except PyMongoError as error:
        database_error_response(error)

    return serialize_user(new_user)


@app.get("/users")
def get_users(_admin=Depends(require_admin)):
    try:
        users = []

        for user in collection.find():
            users.append(serialize_user(user))
    except PyMongoError as error:
        database_error_response(error)

    return users


@app.get("/users/tree")
def get_user_tree(_admin=Depends(require_admin)):
    try:
        users = list(collection.find())
    except PyMongoError as error:
        database_error_response(error)

    return build_user_tree(users)


@app.put("/users/{id}")
def update_user(id: str, user: User, _admin=Depends(require_admin)):
    user_id = parse_object_id(id)
    normalized_email = normalize_email(user.email)

    try:
        duplicate_filter = email_filter(normalized_email)
        duplicate_filter["_id"] = {"$ne": user_id}
        duplicate_user = collection.find_one(duplicate_filter)

        if duplicate_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        result = collection.update_one(
            {"_id": user_id},
            {
                "$set": {
                    "name": user.name,
                    "email": normalized_email,
                    "age": user.age,
                }
            },
        )

        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found.",
            )

        updated_user = collection.find_one({"_id": user_id})
    except HTTPException:
        raise
    except PyMongoError as error:
        database_error_response(error)

    return serialize_user(updated_user)


@app.delete("/users/{id}")
def delete_user(id: str, _admin=Depends(require_admin)):
    user_id = parse_object_id(id)

    try:
        result = collection.delete_one({"_id": user_id})
    except PyMongoError as error:
        database_error_response(error)

    if result.deleted_count == 1:
        return {"message": "User deleted successfully"}

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="User not found.",
    )
