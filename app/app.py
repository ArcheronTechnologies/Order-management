"""J2 Order Tracker - Streamlit Main Application."""

import streamlit as st

# Page config must be first Streamlit command
st.set_page_config(
    page_title="J2 Order Tracker",
    page_icon="📦",
    layout="wide",
    initial_sidebar_state="expanded",
)

import os
import requests
from datetime import datetime

# API base URL - can be overridden by environment variable
API_URL = os.getenv("API_URL", "http://localhost:8000")


def get_api(endpoint: str, params: dict = None):
    """Make GET request to API."""
    try:
        response = requests.get(f"{API_URL}{endpoint}", params=params)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.ConnectionError:
        st.error("Cannot connect to API. Make sure the backend is running.")
        return None
    except Exception as e:
        st.error(f"API Error: {e}")
        return None


def main():
    """Main dashboard page."""
    st.title("📦 J2 Order Tracker")
    st.markdown("---")

    # Fetch dashboard data
    data = get_api("/api/dashboard")

    if not data:
        st.warning("Unable to load dashboard data. Please check API connection.")
        st.info(
            "To start the API server, run:\n\n"
            "```bash\ncd j2-tracker && python -m src.main\n```"
        )
        return

    # Stats row
    col1, col2, col3, col4 = st.columns(4)
    stats = data["stats"]

    with col1:
        st.metric("Open Orders", stats["total_open_orders"])
    with col2:
        st.metric("Updated Today", stats["orders_updated_today"])
    with col3:
        st.metric("Shipping This Week", stats["shipping_this_week"])
    with col4:
        st.metric("Delivering This Week", stats["delivering_this_week"])

    st.markdown("---")

    # Two column layout
    left_col, right_col = st.columns([2, 1])

    with left_col:
        st.subheader("⚠️ Attention Required")

        attention_items = data["attention_items"]
        if not attention_items:
            st.success("No items require immediate attention!")
        else:
            for item in attention_items:
                urgency_color = {
                    "high": "🔴",
                    "medium": "🟡",
                    "low": "🔵",
                }.get(item["urgency"], "⚪")

                with st.expander(f"{urgency_color} {item['title']}", expanded=False):
                    st.write(item["detail"])
                    st.caption(f"Type: {item['type']}")

                    if item["type"] in ["overdue_ship", "delivery_approaching", "stale_order"]:
                        if st.button("View Order", key=f"view_{item['id']}"):
                            st.session_state["selected_order"] = item["id"]
                            st.switch_page("pages/1_Orders.py")
                    elif item["type"] == "unprocessed_email":
                        if st.button("Process Email", key=f"process_{item['id']}"):
                            st.session_state["selected_email"] = item["id"]
                            st.switch_page("pages/2_Emails.py")

    with right_col:
        st.subheader("📊 Orders by Status")

        if stats["orders_by_status"]:
            for status_item in stats["orders_by_status"]:
                status = status_item["status"]
                count = status_item["count"]
                st.progress(
                    min(count / max(stats["total_open_orders"], 1), 1.0),
                    text=f"{status.title()}: {count}",
                )
        else:
            st.info("No open orders")

        st.markdown("---")

        st.subheader("📈 Today's Activity")
        st.write(f"📧 Emails processed: {stats['emails_processed_today']}")
        st.write(f"💬 Communications sent: {stats['communications_today']}")

    # Quick actions
    st.markdown("---")
    st.subheader("Quick Actions")

    qa_col1, qa_col2, qa_col3, qa_col4 = st.columns(4)

    with qa_col1:
        if st.button("➕ New Order", use_container_width=True):
            st.session_state["create_order"] = True
            st.switch_page("pages/1_Orders.py")

    with qa_col2:
        if st.button("📧 Process Emails", use_container_width=True):
            st.switch_page("pages/2_Emails.py")

    with qa_col3:
        if st.button("🏭 Manage Suppliers", use_container_width=True):
            st.switch_page("pages/3_Suppliers.py")

    with qa_col4:
        if st.button("👥 Manage Customers", use_container_width=True):
            st.switch_page("pages/4_Customers.py")


if __name__ == "__main__":
    main()
