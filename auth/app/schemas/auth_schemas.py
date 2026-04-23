from pydantic import BaseModel, EmailStr, HttpUrl

class LoginInitRequest(BaseModel):
    email: EmailStr

class LoginInitResponse(BaseModel):
    redirect_url: HttpUrl

class OIDCClaims(BaseModel):
    sub: str
    email: EmailStr
    email_verified: bool = False