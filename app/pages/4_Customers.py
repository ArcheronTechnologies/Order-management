"""Customers management page."""

import streamlit as st
from components.api_client import api, get_customers

st.set_page_config(page_title="Customers - J2 Tracker", page_icon="👥", layout="wide")


def create_customer_form():
    """Form for creating a new customer."""
    with st.form("create_customer"):
        st.subheader("Add New Customer")

        name = st.text_input("Customer Name*")
        contact_name = st.text_input("Contact Name")
        contact_email = st.text_input("Contact Email")
        notes = st.text_area("Notes")

        submitted = st.form_submit_button("Create Customer", use_container_width=True)

        if submitted:
            if not name:
                st.error("Customer name is required")
            else:
                result = api.post(
                    "/api/customers",
                    {
                        "name": name,
                        "contact_name": contact_name or None,
                        "contact_email": contact_email or None,
                        "notes": notes or None,
                    },
                )
                if result:
                    st.success(f"Customer '{name}' created!")
                    st.session_state.pop("create_customer", None)
                    st.rerun()


def edit_customer_form(customer: dict):
    """Form for editing a customer."""
    with st.form(f"edit_customer_{customer['id']}"):
        st.subheader(f"Edit: {customer['name']}")

        name = st.text_input("Customer Name*", value=customer["name"])
        contact_name = st.text_input(
            "Contact Name", value=customer.get("contact_name") or ""
        )
        contact_email = st.text_input(
            "Contact Email", value=customer.get("contact_email") or ""
        )
        notes = st.text_area("Notes", value=customer.get("notes") or "")

        col1, col2 = st.columns(2)

        with col1:
            submitted = st.form_submit_button("Save Changes", use_container_width=True)

        if submitted:
            if not name:
                st.error("Customer name is required")
            else:
                result = api.patch(
                    f"/api/customers/{customer['id']}",
                    {
                        "name": name,
                        "contact_name": contact_name or None,
                        "contact_email": contact_email or None,
                        "notes": notes or None,
                    },
                )
                if result:
                    st.success("Customer updated!")
                    st.session_state.pop("editing_customer", None)
                    st.rerun()

    # Delete button outside form
    if st.button("🗑️ Delete Customer", key=f"delete_{customer['id']}", type="secondary"):
        st.session_state["confirm_delete"] = customer["id"]

    if st.session_state.get("confirm_delete") == customer["id"]:
        st.warning("Are you sure you want to delete this customer?")
        col1, col2 = st.columns(2)
        with col1:
            if st.button("Yes, Delete", key=f"confirm_{customer['id']}", type="primary"):
                if api.delete(f"/api/customers/{customer['id']}"):
                    st.success("Customer deleted!")
                    st.session_state.pop("confirm_delete", None)
                    st.session_state.pop("editing_customer", None)
                    st.rerun()
                else:
                    st.error("Cannot delete customer. It may have linked orders.")
        with col2:
            if st.button("Cancel", key=f"cancel_{customer['id']}"):
                st.session_state.pop("confirm_delete", None)
                st.rerun()


def main():
    st.title("👥 Customers")

    # Search and actions
    col1, col2 = st.columns([3, 1])

    with col1:
        search = st.text_input("🔍 Search customers", placeholder="Search by name...")

    with col2:
        st.write("")  # Spacing
        if st.button("➕ Add Customer", use_container_width=True):
            st.session_state["create_customer"] = True
            st.session_state.pop("editing_customer", None)

    st.markdown("---")

    # Create form
    if st.session_state.get("create_customer"):
        create_customer_form()
        st.markdown("---")

    # Edit form
    if st.session_state.get("editing_customer"):
        customer = api.get(f"/api/customers/{st.session_state['editing_customer']}")
        if customer:
            edit_customer_form(customer)
            st.markdown("---")

    # Customers list
    customers = get_customers(search=search if search else None)

    if not customers:
        if search:
            st.info(f"No customers found matching '{search}'")
        else:
            st.info("No customers yet. Click 'Add Customer' to create one.")
        return

    st.subheader(f"📋 Customers ({len(customers)})")

    for customer in customers:
        with st.container():
            col1, col2, col3, col4 = st.columns([3, 2, 2, 1])

            with col1:
                st.write(f"**{customer['name']}**")
                if customer.get("contact_name"):
                    st.caption(f"👤 {customer['contact_name']}")

            with col2:
                if customer.get("contact_email"):
                    st.write(f"📧 {customer['contact_email']}")

            with col3:
                # Get order count
                orders_result = api.get("/api/orders", params={"customer_id": customer["id"]})
                order_count = orders_result.get("total", 0) if orders_result else 0
                st.write(f"📦 {order_count} orders")

            with col4:
                if st.button("Edit", key=f"edit_{customer['id']}", use_container_width=True):
                    st.session_state["editing_customer"] = customer["id"]
                    st.session_state.pop("create_customer", None)
                    st.rerun()

            if customer.get("notes"):
                st.caption(f"📝 {customer['notes'][:100]}...")

            st.markdown("---")


if __name__ == "__main__":
    main()
