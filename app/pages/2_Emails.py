"""Emails page."""

import streamlit as st
from datetime import datetime
from components.api_client import api, get_emails, get_orders, get_suppliers

st.set_page_config(page_title="Emails - J2 Tracker", page_icon="📧", layout="wide")

EMAIL_TYPES = [
    "order_confirmation",
    "ship_notification",
    "delay_notice",
    "delivery_confirmation",
    "inquiry",
    "other",
]


def email_detail_panel(email: dict):
    """Display email details in right panel."""
    st.subheader(email.get("subject", "No Subject"))

    st.write(f"**From:** {email.get('sender_name', '')} <{email.get('sender_email', 'Unknown')}>")

    received = email.get("received_at")
    if received:
        received = received[:16].replace("T", " ")
    st.write(f"**Received:** {received or 'Unknown'}")

    if email.get("has_attachments"):
        st.write("📎 Has attachments")

    st.markdown("---")

    # Email body
    body = email.get("body_full") or email.get("body_preview") or "No content"
    st.text_area("Email Content", value=body, height=300, disabled=True)

    st.markdown("---")

    # Processing actions
    st.subheader("📝 Process Email")

    # Link to order
    orders = get_orders()
    order_options = {"Select order...": None}
    order_options.update({f"{o['order_number']} - {o.get('customer_po', 'No PO')}": o["id"] for o in orders})

    current_order = email.get("order_id")
    current_order_name = "Select order..."
    if current_order:
        for name, oid in order_options.items():
            if oid == current_order:
                current_order_name = name
                break

    selected_order = st.selectbox(
        "Link to Order",
        options=list(order_options.keys()),
        index=list(order_options.keys()).index(current_order_name) if current_order_name in order_options else 0,
        key=f"order_select_{email['id']}",
    )

    # Link to supplier
    suppliers = get_suppliers()
    supplier_options = {"Select supplier...": None}
    supplier_options.update({s["name"]: s["id"] for s in suppliers})

    current_supplier = email.get("supplier_id")
    current_supplier_name = "Select supplier..."
    if current_supplier:
        for name, sid in supplier_options.items():
            if sid == current_supplier:
                current_supplier_name = name
                break

    selected_supplier = st.selectbox(
        "Link to Supplier",
        options=list(supplier_options.keys()),
        index=list(supplier_options.keys()).index(current_supplier_name) if current_supplier_name in supplier_options else 0,
        key=f"supplier_select_{email['id']}",
    )

    # Email type
    current_type = email.get("email_type") or "other"
    email_type = st.selectbox(
        "Email Type",
        EMAIL_TYPES,
        index=EMAIL_TYPES.index(current_type) if current_type in EMAIL_TYPES else len(EMAIL_TYPES) - 1,
        key=f"type_select_{email['id']}",
    )

    col1, col2 = st.columns(2)

    with col1:
        if st.button("💾 Save & Mark Processed", use_container_width=True):
            result = api.patch(
                f"/api/emails/{email['id']}/process",
                {
                    "processed": True,
                    "order_id": order_options.get(selected_order),
                    "supplier_id": supplier_options.get(selected_supplier),
                    "email_type": email_type,
                },
            )
            if result:
                st.success("Email processed!")
                st.session_state.pop("selected_email", None)
                st.rerun()

    with col2:
        if st.button("🚫 Mark Irrelevant", use_container_width=True):
            result = api.patch(
                f"/api/emails/{email['id']}/process",
                {"processed": True, "email_type": "other"},
            )
            if result:
                st.success("Marked as irrelevant")
                st.session_state.pop("selected_email", None)
                st.rerun()

    # Create order from email
    st.markdown("---")
    with st.expander("🆕 Create New Order from Email"):
        with st.form("create_order_from_email"):
            order_number = st.text_input("Order Number")
            customer_po = st.text_input("Customer PO")

            if st.form_submit_button("Create Order"):
                if order_number:
                    # Create order
                    order_result = api.post(
                        "/api/orders",
                        {
                            "order_number": order_number,
                            "customer_po": customer_po or None,
                            "supplier_id": supplier_options.get(selected_supplier),
                            "status": "pending",
                        },
                    )
                    if order_result:
                        # Link email to new order
                        api.patch(
                            f"/api/emails/{email['id']}/link",
                            {"order_id": order_result["id"]},
                        )
                        st.success(f"Order {order_number} created and linked!")
                        st.rerun()
                else:
                    st.error("Order number is required")


def main():
    st.title("📧 Email Inbox")

    # Tabs for processed/unprocessed
    tab1, tab2 = st.tabs(["📥 Unprocessed", "✅ Processed"])

    # Get emails
    with tab1:
        unprocessed = get_emails(processed=False)

        if not unprocessed:
            st.success("No unprocessed emails! All caught up.")
        else:
            st.write(f"**{len(unprocessed)} emails** need processing")

            # Two column layout
            col1, col2 = st.columns([1, 2])

            with col1:
                st.subheader("Email List")
                for email in unprocessed:
                    received = email.get("received_at", "")[:10] if email.get("received_at") else ""
                    sender = email.get("sender_email", "Unknown")[:30]
                    subject = (email.get("subject") or "No subject")[:40]

                    is_selected = st.session_state.get("selected_email") == email["id"]
                    button_type = "primary" if is_selected else "secondary"

                    if st.button(
                        f"📧 {subject}\n{sender} • {received}",
                        key=f"email_{email['id']}",
                        use_container_width=True,
                        type=button_type,
                    ):
                        st.session_state["selected_email"] = email["id"]
                        st.rerun()

            with col2:
                if st.session_state.get("selected_email"):
                    # Find the selected email
                    selected = None
                    for email in unprocessed:
                        if email["id"] == st.session_state["selected_email"]:
                            selected = email
                            break

                    if selected:
                        email_detail_panel(selected)
                    else:
                        # Might be processed now, clear selection
                        st.session_state.pop("selected_email", None)
                        st.info("Select an email to view details")
                else:
                    st.info("Select an email from the list to view details and process")

    with tab2:
        processed = get_emails(processed=True)

        if not processed:
            st.info("No processed emails yet")
        else:
            st.write(f"**{len(processed)} emails** processed")

            for email in processed:
                received = email.get("received_at", "")[:16].replace("T", " ") if email.get("received_at") else ""
                sender = email.get("sender_email", "Unknown")
                subject = email.get("subject") or "No subject"
                email_type = email.get("email_type") or "N/A"

                with st.expander(f"📧 {subject} - {received}"):
                    st.write(f"**From:** {sender}")
                    st.write(f"**Type:** {email_type}")

                    if email.get("order_id"):
                        st.write(f"**Linked to order:** {email['order_id']}")

                    st.markdown("---")
                    body = email.get("body_preview") or "No preview"
                    st.text(body[:500])

                    if st.button("Mark as Unprocessed", key=f"unprocess_{email['id']}"):
                        api.patch(f"/api/emails/{email['id']}/process", {"processed": False})
                        st.rerun()


if __name__ == "__main__":
    main()
