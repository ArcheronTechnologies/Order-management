"""Settings page."""

import streamlit as st
from components.api_client import api

st.set_page_config(page_title="Settings - J2 Tracker", page_icon="⚙️", layout="wide")


def main():
    st.title("⚙️ Settings")

    # API Status
    st.subheader("🔌 System Status")

    col1, col2 = st.columns(2)

    with col1:
        st.write("**API Connection**")
        health = api.get("/health")
        if health and health.get("status") == "healthy":
            st.success("✅ API is running")
        else:
            st.error("❌ API is not responding")

    with col2:
        st.write("**Database**")
        # Try a simple query
        suppliers = api.get("/api/suppliers")
        if suppliers is not None:
            st.success("✅ Database connected")
        else:
            st.error("❌ Database connection failed")

    st.markdown("---")

    # Email Integration Status
    st.subheader("📧 Email Integration (Phase 1c)")

    st.info(
        """
        Email integration with Microsoft Graph API will be configured in Phase 1c.

        **Requirements:**
        1. Azure AD app registration with Mail.Read permission
        2. Configure the following environment variables:
           - `AZURE_TENANT_ID`
           - `AZURE_CLIENT_ID`
           - `AZURE_CLIENT_SECRET`
           - `GRAPH_USER_EMAIL`
           - `GRAPH_TARGET_FOLDER`
        """
    )

    st.markdown("---")

    # About
    st.subheader("ℹ️ About")

    st.write(
        """
        **J2 Order Tracker v1.0.0**

        A manual order tracking tool designed for Phase 1 operation.

        **Phase 1 Features:**
        - Central order registry
        - Email storage and linking
        - Status tracking with full history
        - Exception visibility
        - Customer communication logging

        **Future Phases:**
        - Phase 2: Assisted workflows (suggestions, drafts, flags)
        - Phase 3: Automation with human oversight
        """
    )

    st.markdown("---")

    # Quick Links
    st.subheader("🔗 Quick Links")

    col1, col2, col3 = st.columns(3)

    with col1:
        st.write("**API Documentation**")
        st.markdown("[Open API Docs](http://localhost:8000/docs)")

    with col2:
        st.write("**Health Check**")
        st.markdown("[API Health](http://localhost:8000/health)")

    with col3:
        st.write("**API Root**")
        st.markdown("[API Info](http://localhost:8000/)")


if __name__ == "__main__":
    main()
