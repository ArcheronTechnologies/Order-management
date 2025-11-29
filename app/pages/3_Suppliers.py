"""Suppliers management page."""

import streamlit as st
from components.api_client import api, get_suppliers

st.set_page_config(page_title="Suppliers - J2 Tracker", page_icon="🏭", layout="wide")


def create_supplier_form():
    """Form for creating a new supplier."""
    with st.form("create_supplier"):
        st.subheader("Add New Supplier")

        name = st.text_input("Supplier Name*")
        email_domains = st.text_input(
            "Email Domains",
            help="Comma-separated list of domains (e.g., supplier.com, supplier.co.uk)",
        )
        lead_time = st.number_input(
            "Default Lead Time (days)", min_value=0, value=0
        )
        notes = st.text_area("Notes")

        submitted = st.form_submit_button("Create Supplier", use_container_width=True)

        if submitted:
            if not name:
                st.error("Supplier name is required")
            else:
                domains = None
                if email_domains:
                    domains = [d.strip() for d in email_domains.split(",") if d.strip()]

                result = api.post(
                    "/api/suppliers",
                    {
                        "name": name,
                        "email_domains": domains,
                        "default_lead_time_days": lead_time if lead_time > 0 else None,
                        "notes": notes or None,
                    },
                )
                if result:
                    st.success(f"Supplier '{name}' created!")
                    st.session_state.pop("create_supplier", None)
                    st.rerun()


def edit_supplier_form(supplier: dict):
    """Form for editing a supplier."""
    with st.form(f"edit_supplier_{supplier['id']}"):
        st.subheader(f"Edit: {supplier['name']}")

        name = st.text_input("Supplier Name*", value=supplier["name"])

        current_domains = supplier.get("email_domains") or []
        email_domains = st.text_input(
            "Email Domains",
            value=", ".join(current_domains) if current_domains else "",
            help="Comma-separated list of domains",
        )

        lead_time = st.number_input(
            "Default Lead Time (days)",
            min_value=0,
            value=supplier.get("default_lead_time_days") or 0,
        )

        notes = st.text_area("Notes", value=supplier.get("notes") or "")

        col1, col2 = st.columns(2)

        with col1:
            submitted = st.form_submit_button("Save Changes", use_container_width=True)

        with col2:
            # Note: Form submit buttons can't conditionally delete, need separate button
            pass

        if submitted:
            if not name:
                st.error("Supplier name is required")
            else:
                domains = None
                if email_domains:
                    domains = [d.strip() for d in email_domains.split(",") if d.strip()]

                result = api.patch(
                    f"/api/suppliers/{supplier['id']}",
                    {
                        "name": name,
                        "email_domains": domains,
                        "default_lead_time_days": lead_time if lead_time > 0 else None,
                        "notes": notes or None,
                    },
                )
                if result:
                    st.success("Supplier updated!")
                    st.session_state.pop("editing_supplier", None)
                    st.rerun()

    # Delete button outside form
    if st.button("🗑️ Delete Supplier", key=f"delete_{supplier['id']}", type="secondary"):
        st.session_state["confirm_delete"] = supplier["id"]

    if st.session_state.get("confirm_delete") == supplier["id"]:
        st.warning("Are you sure you want to delete this supplier?")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Yes, Delete", key=f"confirm_{supplier['id']}", type="primary"):
                if api.delete(f"/api/suppliers/{supplier['id']}"):
                    st.success("Supplier deleted!")
                    st.session_state.pop("confirm_delete", None)
                    st.session_state.pop("editing_supplier", None)
                    st.rerun()
                else:
                    st.error("Cannot delete supplier. It may have linked orders.")
        with col2:
            if st.button("Cancel", key=f"cancel_{supplier['id']}"):
                st.session_state.pop("confirm_delete", None)
                st.rerun()


def main():
    st.title("🏭 Suppliers")

    # Search and actions
    col1, col2 = st.columns([3, 1])

    with col1:
        search = st.text_input("🔍 Search suppliers", placeholder="Search by name...")

    with col2:
        st.write("")  # Spacing
        if st.button("➕ Add Supplier", use_container_width=True):
            st.session_state["create_supplier"] = True
            st.session_state.pop("editing_supplier", None)

    st.markdown("---")

    # Create form
    if st.session_state.get("create_supplier"):
        create_supplier_form()
        st.markdown("---")

    # Edit form
    if st.session_state.get("editing_supplier"):
        supplier = api.get(f"/api/suppliers/{st.session_state['editing_supplier']}")
        if supplier:
            edit_supplier_form(supplier)
            st.markdown("---")

    # Suppliers list
    suppliers = get_suppliers(search=search if search else None)

    if not suppliers:
        if search:
            st.info(f"No suppliers found matching '{search}'")
        else:
            st.info("No suppliers yet. Click 'Add Supplier' to create one.")
        return

    st.subheader(f"📋 Suppliers ({len(suppliers)})")

    for supplier in suppliers:
        with st.container():
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])

            with col1:
                st.write(f"**{supplier['name']}**")
                domains = supplier.get("email_domains") or []
                if domains:
                    st.caption(", ".join(domains))

            with col2:
                lead_time = supplier.get("default_lead_time_days")
                if lead_time:
                    st.write(f"📅 {lead_time} days lead time")

            with col3:
                # Get order count
                orders_result = api.get("/api/orders", params={"supplier_id": supplier["id"]})
                order_count = orders_result.get("total", 0) if orders_result else 0
                st.write(f"📦 {order_count} orders")

            with col4:
                if st.button("Edit", key=f"edit_{supplier['id']}", use_container_width=True):
                    st.session_state["editing_supplier"] = supplier["id"]
                    st.session_state.pop("create_supplier", None)
                    st.rerun()

            if supplier.get("notes"):
                st.caption(f"📝 {supplier['notes'][:100]}...")

            st.markdown("---")


if __name__ == "__main__":
    main()
