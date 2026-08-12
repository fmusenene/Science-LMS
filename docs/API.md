# API reference

Base URL (local): `http://localhost:3000`

All `/api/lms/data` calls require a valid `lms_session` cookie unless noted.  
Use `credentials: 'include'` from the browser.

Responses that embed `LmsData` **never include password hashes** (password fields are empty strings).

---

## Auth

### `POST /api/lms/auth/login`

Sign in and set the session cookie.

**Body**

```json
{
  "email": "teacher@school.ac",
  "password": "password"
}
```

**Success `200`**

```json
{
  "ok": true,
  "userId": "u-tea-1",
  "roleId": "role-teacher",
  "data": { "...": "LmsData without secrets" }
}
```

Sets cookie: `lms_session` (httpOnly, SameSite=Strict, Secure in production).

**Errors**

| Status | Meaning |
|--------|---------|
| `400` | Missing email/password |
| `401` | Invalid credentials (generic message) |
| `429` | Rate limited (IP and/or account) |

---

### `POST /api/lms/auth/logout`

Clears the session cookie.

**Success `200`:** `{ "ok": true }`

---

### `GET /api/lms/auth/session`

Restore session for page load.

**Success `200`**

```json
{
  "authenticated": true,
  "userId": "u-admin-1",
  "roleId": "role-admin",
  "data": { "...": "LmsData" }
}
```

**Unauthorized `401`:** `{ "authenticated": false }`

---

## Shared database

### `GET /api/lms/data`

Returns the full shared LMS document (secrets stripped).

| Status | Meaning |
|--------|---------|
| `200` | OK |
| `401` | Missing/invalid/expired session |
| `500` | Read failure |

---

### `PUT /api/lms/data`

Merge client payload with on-disk DB and save.

**Body:** full `LmsData` JSON (`roles` and `users` arrays required).

**Server behaviour**

- Requires authenticated active user  
- Rate-limited per user/IP  
- Without `roles.manage`: incoming `roles` discarded; server roles kept  
- Without `users.manage`: only the actor’s profile fields (name, department, avatar, optional new plaintext password) may change  
- Blank passwords in the payload **preserve** existing hashes  
- Plaintext passwords are **hashed** with scrypt before write  
- Client-supplied foreign hashes are ignored  

**Success `200`:** saved `LmsData` (secrets stripped).

| Status | Meaning |
|--------|---------|
| `400` | Invalid payload |
| `401` | Not authenticated |
| `429` | Too many writes |
| `500` | Save failure |

---

## Example: login then read (curl)

```bash
# Login and store cookies
curl -c cookies.txt -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@school.ac\",\"password\":\"password\"}" \
  http://localhost:3000/api/lms/auth/login

# Authenticated read
curl -b cookies.txt http://localhost:3000/api/lms/data

# Logout
curl -b cookies.txt -X POST http://localhost:3000/api/lms/auth/logout
```

---

## Unauthenticated access

`GET` / `PUT` `/api/lms/data` without a valid cookie returns **401**.  
This is intentional — the shared DB must not be world-readable.
