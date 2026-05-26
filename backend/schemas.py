from pydantic import BaseModel, EmailStr

class User(BaseModel):
    name: str
    email: EmailStr
    age: int


class AdminLogin(BaseModel):
    email: EmailStr
    password: str
