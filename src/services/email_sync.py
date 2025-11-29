"""Email sync service for Microsoft Graph API integration.

This service handles fetching emails from a designated Outlook folder
and storing them in the database for processing.

Note: Full implementation requires Azure AD app registration.
This is a placeholder for Phase 1c.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from dataclasses import dataclass
import httpx

from src.config import get_settings


@dataclass
class EmailMessage:
    """Represents an email message from Graph API."""

    message_id: str
    subject: str
    sender_email: str
    sender_name: str
    received_at: datetime
    body_preview: str
    body_content: str
    has_attachments: bool


class EmailSyncService:
    """Service for syncing emails from Microsoft Graph API.

    This is a placeholder implementation for Phase 1c.
    Requires Azure AD app registration with Mail.Read permission.
    """

    def __init__(self):
        self.settings = get_settings()
        self._access_token: Optional[str] = None
        self._token_expires: Optional[datetime] = None

    @property
    def is_configured(self) -> bool:
        """Check if Graph API is configured."""
        return bool(
            self.settings.azure_tenant_id
            and self.settings.azure_client_id
            and self.settings.azure_client_secret
            and self.settings.graph_user_email
        )

    async def get_access_token(self) -> str:
        """Get access token from Azure AD.

        Uses client credentials flow for daemon/service apps.
        """
        if not self.is_configured:
            raise ValueError("Microsoft Graph API not configured")

        # Check if we have a valid cached token
        if self._access_token and self._token_expires:
            if datetime.utcnow() < self._token_expires:
                return self._access_token

        token_url = (
            f"https://login.microsoftonline.com/"
            f"{self.settings.azure_tenant_id}/oauth2/v2.0/token"
        )

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data={
                    "client_id": self.settings.azure_client_id,
                    "client_secret": self.settings.azure_client_secret,
                    "scope": "https://graph.microsoft.com/.default",
                    "grant_type": "client_credentials",
                },
            )
            response.raise_for_status()
            data = response.json()

        self._access_token = data["access_token"]
        # Token typically expires in 3600 seconds, cache with buffer
        expires_in = data.get("expires_in", 3600) - 300
        self._token_expires = datetime.utcnow()

        return self._access_token

    async def get_folder_id(self, folder_name: str) -> Optional[str]:
        """Get the ID of a mail folder by name."""
        if not self.is_configured:
            return None

        token = await self.get_access_token()
        user_email = self.settings.graph_user_email

        url = (
            f"https://graph.microsoft.com/v1.0/users/{user_email}"
            f"/mailFolders?$filter=displayName eq '{folder_name}'"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            data = response.json()

        folders = data.get("value", [])
        if folders:
            return folders[0]["id"]
        return None

    async def fetch_emails(
        self,
        folder_id: Optional[str] = None,
        since: Optional[datetime] = None,
        limit: int = 50,
    ) -> List[EmailMessage]:
        """Fetch emails from the target folder.

        Args:
            folder_id: Optional folder ID. Uses configured folder if not provided.
            since: Optional datetime to filter emails received after this time.
            limit: Maximum number of emails to fetch.

        Returns:
            List of EmailMessage objects.
        """
        if not self.is_configured:
            return []

        token = await self.get_access_token()
        user_email = self.settings.graph_user_email

        # Get folder ID if not provided
        if not folder_id:
            folder_id = await self.get_folder_id(self.settings.graph_target_folder)
            if not folder_id:
                return []

        # Build query
        url = (
            f"https://graph.microsoft.com/v1.0/users/{user_email}"
            f"/mailFolders/{folder_id}/messages"
            f"?$top={limit}&$orderby=receivedDateTime desc"
            f"&$select=id,subject,from,receivedDateTime,bodyPreview,body,hasAttachments"
        )

        if since:
            since_str = since.isoformat() + "Z"
            url += f"&$filter=receivedDateTime ge {since_str}"

        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {token}"},
            )
            response.raise_for_status()
            data = response.json()

        emails = []
        for msg in data.get("value", []):
            sender = msg.get("from", {}).get("emailAddress", {})
            emails.append(
                EmailMessage(
                    message_id=msg["id"],
                    subject=msg.get("subject", ""),
                    sender_email=sender.get("address", ""),
                    sender_name=sender.get("name", ""),
                    received_at=datetime.fromisoformat(
                        msg["receivedDateTime"].replace("Z", "+00:00")
                    ),
                    body_preview=msg.get("bodyPreview", "")[:500],
                    body_content=msg.get("body", {}).get("content", ""),
                    has_attachments=msg.get("hasAttachments", False),
                )
            )

        return emails

    async def sync_to_database(self, db_session) -> Dict[str, Any]:
        """Sync emails from Graph API to database.

        Args:
            db_session: SQLAlchemy database session.

        Returns:
            Dict with sync results (new_count, skipped_count, errors).
        """
        from src.models.email import Email

        if not self.is_configured:
            return {
                "status": "not_configured",
                "message": "Microsoft Graph API not configured",
                "new_count": 0,
                "skipped_count": 0,
            }

        # Get the most recent email in the database
        latest = (
            db_session.query(Email)
            .filter(Email.graph_message_id.isnot(None))
            .order_by(Email.received_at.desc())
            .first()
        )
        since = latest.received_at if latest else None

        try:
            emails = await self.fetch_emails(since=since)
        except Exception as e:
            return {
                "status": "error",
                "message": str(e),
                "new_count": 0,
                "skipped_count": 0,
            }

        new_count = 0
        skipped_count = 0

        for email_msg in emails:
            # Check if email already exists
            existing = (
                db_session.query(Email)
                .filter(Email.graph_message_id == email_msg.message_id)
                .first()
            )
            if existing:
                skipped_count += 1
                continue

            # Create new email record
            email = Email(
                graph_message_id=email_msg.message_id,
                subject=email_msg.subject,
                sender_email=email_msg.sender_email,
                sender_name=email_msg.sender_name,
                received_at=email_msg.received_at,
                body_preview=email_msg.body_preview,
                body_full=email_msg.body_content,
                has_attachments=email_msg.has_attachments,
                processed=False,
            )
            db_session.add(email)
            new_count += 1

        db_session.commit()

        return {
            "status": "success",
            "new_count": new_count,
            "skipped_count": skipped_count,
        }
