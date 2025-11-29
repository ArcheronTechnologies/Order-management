"""API client for Streamlit components."""

import os
import requests
from typing import Optional, Dict, Any, List
import streamlit as st

# API URL - can be overridden by environment variable
API_URL = os.getenv("API_URL", "http://localhost:8000")

# Request timeout in seconds
REQUEST_TIMEOUT = 10


class APIClient:
    """Client for making API requests."""

    def __init__(self, base_url: str = API_URL, timeout: int = REQUEST_TIMEOUT):
        self.base_url = base_url
        self.timeout = timeout

    def _handle_response(self, response: requests.Response) -> Optional[Dict[str, Any]]:
        """Handle API response."""
        try:
            response.raise_for_status()
            # Handle empty responses (204 No Content)
            if response.status_code == 204 or not response.content:
                return {}
            return response.json()
        except requests.exceptions.HTTPError as e:
            if response.status_code == 404:
                return None
            # Try to get error detail from response
            try:
                detail = response.json().get("detail", str(e))
            except (ValueError, KeyError):
                detail = response.text[:200] if response.text else str(e)
            st.error(f"API Error ({response.status_code}): {detail}")
            return None
        except requests.exceptions.JSONDecodeError:
            st.error("API returned invalid JSON response")
            return None

    def get(self, endpoint: str, params: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Make GET request."""
        try:
            response = requests.get(
                f"{self.base_url}{endpoint}",
                params=params,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to API. Make sure the backend is running.")
            return None
        except requests.exceptions.Timeout:
            st.error("API request timed out. Please try again.")
            return None

    def post(self, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Make POST request."""
        try:
            response = requests.post(
                f"{self.base_url}{endpoint}",
                json=data,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to API.")
            return None
        except requests.exceptions.Timeout:
            st.error("API request timed out. Please try again.")
            return None

    def patch(self, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Make PATCH request."""
        try:
            response = requests.patch(
                f"{self.base_url}{endpoint}",
                json=data,
                timeout=self.timeout,
            )
            return self._handle_response(response)
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to API.")
            return None
        except requests.exceptions.Timeout:
            st.error("API request timed out. Please try again.")
            return None

    def delete(self, endpoint: str) -> bool:
        """Make DELETE request."""
        try:
            response = requests.delete(
                f"{self.base_url}{endpoint}",
                timeout=self.timeout,
            )
            if response.status_code == 204:
                return True
            if response.status_code == 404:
                st.warning("Resource not found")
                return False
            response.raise_for_status()
            return True
        except requests.exceptions.ConnectionError:
            st.error("Cannot connect to API.")
            return False
        except requests.exceptions.Timeout:
            st.error("API request timed out. Please try again.")
            return False
        except requests.exceptions.HTTPError as e:
            st.error(f"Delete failed: {e}")
            return False


# Shared client instance
api = APIClient()


# Convenience functions
def get_suppliers(search: Optional[str] = None) -> List[Dict]:
    """Get all suppliers."""
    params = {"search": search} if search else None
    result = api.get("/api/suppliers", params=params)
    return result.get("items", []) if result else []


def get_customers(search: Optional[str] = None) -> List[Dict]:
    """Get all customers."""
    params = {"search": search} if search else None
    result = api.get("/api/customers", params=params)
    return result.get("items", []) if result else []


def get_orders(
    status: Optional[str] = None,
    supplier_id: Optional[str] = None,
    customer_id: Optional[str] = None,
    search: Optional[str] = None,
) -> List[Dict]:
    """Get orders with filters."""
    params = {}
    if status:
        params["status"] = status
    if supplier_id:
        params["supplier_id"] = supplier_id
    if customer_id:
        params["customer_id"] = customer_id
    if search:
        params["search"] = search

    result = api.get("/api/orders", params=params if params else None)
    return result.get("items", []) if result else []


def get_order(order_id: str) -> Optional[Dict]:
    """Get a single order with details."""
    return api.get(f"/api/orders/{order_id}")


def get_emails(processed: Optional[bool] = None) -> List[Dict]:
    """Get emails."""
    params = {}
    if processed is not None:
        params["processed"] = processed
    result = api.get("/api/emails", params=params if params else None)
    return result.get("items", []) if result else []


def get_dashboard() -> Optional[Dict]:
    """Get dashboard data."""
    return api.get("/api/dashboard")
