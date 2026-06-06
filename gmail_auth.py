"""
Gmail OAuth2 Setup — run once to generate token.json
-----------------------------------------------------
Prerequisites:
1. Go to https://console.cloud.google.com/
2. Create / select a project
3. Enable: Gmail API, Google Sheets API, Google Drive API
4. OAuth consent screen → External → add your email as test user
5. Credentials → Create → OAuth 2.0 Client ID → Desktop app → Download JSON
6. Save that file as  credentials.json  in this folder
7. Run:  python gmail_auth.py
"""

import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
import json

SCOPES = [
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

TOKEN_FILE       = "token.json"
CREDENTIALS_FILE = "credentials.json"


def get_credentials() -> Credentials:
    creds = None

    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_FILE):
                raise FileNotFoundError(
                    f"'{CREDENTIALS_FILE}' not found.\n"
                    "Download it from Google Cloud Console → Credentials → "
                    "OAuth 2.0 Client IDs → Download JSON, then rename to credentials.json"
                )
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
            creds = flow.run_local_server(port=0)

        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())
        print(f"Token saved to {TOKEN_FILE}")

    return creds


if __name__ == "__main__":
    creds = get_credentials()
    info = json.loads(creds.to_json())
    print("\nAuthorization successful!")
    print(f"Scopes granted: {info.get('scopes', SCOPES)}")
    print(f"\ntoken.json saved — pipeline will auto-refresh when needed.")
