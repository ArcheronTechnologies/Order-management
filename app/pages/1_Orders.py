"""Orders page."""

import streamlit as st
from datetime import date, datetime
from components.api_client import api, get_orders, get_order, get_suppliers, get_customers

st.set_page_config(page_title="Orders - J2 Tracker", page_icon="📋", layout="wide")

ORDER_STATUSES = [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "partial_ship",
    "delivered",
    "cancelled",
    "on_hold",
]

STATUS_COLORS = {
    "pending": "🟡",
    "confirmed": "🟢",
    "processing": "🔵",
    "shipped": "📦",
    "partial_ship": "📦",
    "delivered": "✅",
    "cancelled": "❌",
    "on_hold": "⏸️",
}


def create_order_form():
    """Form for creating a new order."""
    st.subheader("Create New Order")

    with st.form("create_order"):
        col1, col2 = st.columns(2)

        with col1:
            order_number = st.text_input("Order Number*", key="new_order_number")
            customer_po = st.text_input("Customer PO")
            status = st.selectbox("Status", ORDER_STATUSES, index=0)

        with col2:
            suppliers = get_suppliers()
            supplier_options = {s["name"]: s["id"] for s in suppliers}
            supplier_name = st.selectbox(
                "Supplier",
                options=[""] + list(supplier_options.keys()),
            )

            customers = get_customers()
            customer_options = {c["name"]: c["id"] for c in customers}
            customer_name = st.selectbox(
                "Customer",
                options=[""] + list(customer_options.keys()),
            )

        col3, col4 = st.columns(2)

        with col3:
            expected_ship = st.date_input("Expected Ship Date", value=None)

        with col4:
            expected_delivery = st.date_input("Expected Delivery Date", value=None)

        notes = st.text_area("Notes")

        submitted = st.form_submit_button("Create Order", use_container_width=True)

        if submitted:
            if not order_number:
                st.error("Order number is required")
            else:
                data = {
                    "order_number": order_number,
                    "customer_po": customer_po or None,
                    "status": status,
                    "supplier_id": supplier_options.get(supplier_name),
                    "customer_id": customer_options.get(customer_name),
                    "expected_ship_date": str(expected_ship) if expected_ship else None,
                    "expected_delivery_date": str(expected_delivery) if expected_delivery else None,
                    "notes": notes or None,
                }

                result = api.post("/api/orders", data)
                if result:
                    st.success(f"Order {order_number} created!")
                    st.session_state.pop("create_order", None)
                    st.rerun()


def order_detail_view(order_id: str):
    """Detailed view of a single order."""
    order = get_order(order_id)

    if not order:
        st.error("Order not found")
        return

    # Header
    col1, col2, col3 = st.columns([2, 1, 1])

    with col1:
        st.title(f"Order: {order['order_number']}")
        if order.get("customer_po"):
            st.caption(f"Customer PO: {order['customer_po']}")

    with col2:
        status = order["status"]
        st.metric("Status", f"{STATUS_COLORS.get(status, '')} {status.title()}")

    with col3:
        if st.button("← Back to List"):
            st.session_state.pop("selected_order", None)
            st.rerun()

    st.markdown("---")

    # Info columns
    col1, col2, col3 = st.columns(3)

    with col1:
        st.subheader("📍 Parties")
        if order.get("supplier"):
            st.write(f"**Supplier:** {order['supplier']['name']}")
        else:
            st.write("**Supplier:** Not assigned")

        if order.get("customer"):
            st.write(f"**Customer:** {order['customer']['name']}")
        else:
            st.write("**Customer:** Not assigned")

    with col2:
        st.subheader("📅 Key Dates")
        st.write(f"**Expected Ship:** {order.get('expected_ship_date') or 'Not set'}")
        st.write(f"**Actual Ship:** {order.get('actual_ship_date') or 'Not shipped'}")
        st.write(f"**Expected Delivery:** {order.get('expected_delivery_date') or 'Not set'}")
        st.write(f"**Actual Delivery:** {order.get('actual_delivery_date') or 'Not delivered'}")

    with col3:
        st.subheader("⚡ Quick Actions")

        # Status update
        new_status = st.selectbox(
            "Update Status",
            ORDER_STATUSES,
            index=ORDER_STATUSES.index(order["status"]),
            key="status_select",
        )

        status_notes = st.text_input("Status Notes", key="status_notes")

        if st.button("Update Status", use_container_width=True):
            if new_status != order["status"]:
                result = api.post(
                    f"/api/orders/{order_id}/status",
                    {"status": new_status, "notes": status_notes or None},
                )
                if result:
                    st.success("Status updated!")
                    st.rerun()

    st.markdown("---")

    # Tabs for details
    tab1, tab2, tab3, tab4 = st.tabs(["📦 Line Items", "📜 Timeline", "📧 Emails", "💬 Communications"])

    with tab1:
        line_items = order.get("line_items", [])

        if line_items:
            for item in line_items:
                with st.expander(
                    f"{item.get('part_number', 'No Part#')} - {item.get('description', 'No description')[:50]}",
                    expanded=False,
                ):
                    cols = st.columns(4)
                    cols[0].write(f"**Qty Ordered:** {item['quantity_ordered']}")
                    cols[1].write(f"**Qty Shipped:** {item['quantity_shipped']}")
                    cols[2].write(f"**Qty Delivered:** {item['quantity_delivered']}")
                    cols[3].write(f"**Unit Price:** ${item.get('unit_price') or 0:.2f}")

                    if item.get("manufacturer"):
                        st.write(f"**Manufacturer:** {item['manufacturer']}")

                    if item.get("notes"):
                        st.write(f"**Notes:** {item['notes']}")

                    # Edit form
                    with st.form(f"edit_item_{item['id']}"):
                        st.subheader("Edit Line Item")
                        new_shipped = st.number_input(
                            "Qty Shipped", value=item["quantity_shipped"], min_value=0
                        )
                        new_delivered = st.number_input(
                            "Qty Delivered", value=item["quantity_delivered"], min_value=0
                        )

                        if st.form_submit_button("Update"):
                            result = api.patch(
                                f"/api/orders/{order_id}/line-items/{item['id']}",
                                {"quantity_shipped": new_shipped, "quantity_delivered": new_delivered},
                            )
                            if result:
                                st.success("Updated!")
                                st.rerun()
        else:
            st.info("No line items")

        # Add line item form
        with st.expander("➕ Add Line Item"):
            with st.form("add_line_item"):
                col1, col2 = st.columns(2)
                with col1:
                    part_number = st.text_input("Part Number")
                    manufacturer = st.text_input("Manufacturer")
                    qty_ordered = st.number_input("Quantity Ordered", min_value=1, value=1)
                with col2:
                    description = st.text_input("Description")
                    unit_price = st.number_input("Unit Price", min_value=0.0, value=0.0)

                if st.form_submit_button("Add Line Item"):
                    result = api.post(
                        f"/api/orders/{order_id}/line-items",
                        {
                            "part_number": part_number or None,
                            "manufacturer": manufacturer or None,
                            "description": description or None,
                            "quantity_ordered": qty_ordered,
                            "unit_price": unit_price if unit_price > 0 else None,
                        },
                    )
                    if result:
                        st.success("Line item added!")
                        st.rerun()

    with tab2:
        events = order.get("events", [])

        if events:
            for event in events:
                event_time = event["created_at"][:16].replace("T", " ")
                event_type = event["event_type"]
                event_data = event.get("event_data", {})

                icon = STATUS_COLORS.get(event_type, "📝")

                with st.expander(f"{icon} {event_type.replace('_', ' ').title()} - {event_time}"):
                    st.write(f"**Source:** {event.get('source', 'manual')}")
                    if event.get("created_by"):
                        st.write(f"**By:** {event['created_by']}")
                    if event_data:
                        st.json(event_data)
        else:
            st.info("No events recorded")

        # Add note
        with st.expander("➕ Add Note"):
            with st.form("add_note"):
                note_text = st.text_area("Note")
                if st.form_submit_button("Add Note"):
                    if note_text:
                        result = api.post(
                            f"/api/orders/{order_id}/events",
                            {
                                "event_type": "note_added",
                                "event_data": {"note": note_text},
                                "source": "manual",
                            },
                        )
                        if result:
                            st.success("Note added!")
                            st.rerun()

    with tab3:
        # Linked emails
        emails_result = api.get("/api/emails", params={"order_id": order_id})
        emails = emails_result.get("items", []) if emails_result else []

        if emails:
            for email in emails:
                received = email["received_at"][:16].replace("T", " ") if email.get("received_at") else "Unknown"
                with st.expander(f"📧 {email.get('subject', 'No subject')} - {received}"):
                    st.write(f"**From:** {email.get('sender_email', 'Unknown')}")
                    st.write(f"**Type:** {email.get('email_type', 'Not classified')}")
                    st.markdown("---")
                    st.write(email.get("body_preview", "No preview"))
        else:
            st.info("No linked emails")

    with tab4:
        # Communications
        comms_result = api.get("/api/communications", params={"order_id": order_id})
        comms = comms_result.get("items", []) if comms_result else []

        if comms:
            for comm in comms:
                sent = comm.get("sent_at", comm["created_at"])[:16].replace("T", " ")
                with st.expander(f"💬 {comm.get('subject', 'No subject')} - {sent}"):
                    st.write(f"**Type:** {comm.get('communication_type', 'N/A')}")
                    st.write(f"**Method:** {comm.get('method', 'N/A')}")
                    st.write(f"**To:** {comm.get('recipient_email', 'N/A')}")
                    st.markdown("---")
                    st.write(comm.get("body", "No content"))
        else:
            st.info("No communications logged")

        # Log communication
        with st.expander("➕ Log Communication"):
            with st.form("log_comm"):
                comm_type = st.selectbox(
                    "Type",
                    ["status_update", "delay_notice", "ship_confirm", "delivery_confirm", "inquiry", "other"],
                )
                method = st.selectbox("Method", ["email", "phone", "portal"])
                subject = st.text_input("Subject")
                body = st.text_area("Body")
                recipient = st.text_input("Recipient Email")

                if st.form_submit_button("Log Communication"):
                    result = api.post(
                        "/api/communications",
                        {
                            "order_id": order_id,
                            "customer_id": order.get("customer_id"),
                            "communication_type": comm_type,
                            "method": method,
                            "subject": subject or None,
                            "body": body or None,
                            "recipient_email": recipient or None,
                            "sent_at": datetime.now().isoformat(),
                        },
                    )
                    if result:
                        st.success("Communication logged!")
                        st.rerun()

    # Notes section
    st.markdown("---")
    st.subheader("📝 Notes")

    current_notes = order.get("notes", "") or ""
    new_notes = st.text_area("Order Notes", value=current_notes, key="order_notes")

    if st.button("Save Notes"):
        if new_notes != current_notes:
            result = api.patch(f"/api/orders/{order_id}", {"notes": new_notes})
            if result:
                st.success("Notes saved!")


def order_list_view():
    """List view of orders."""
    st.title("📋 Orders")

    # Check if we should show create form
    if st.session_state.get("create_order"):
        create_order_form()
        st.markdown("---")

    # Filters
    with st.expander("🔍 Filters", expanded=True):
        col1, col2, col3, col4 = st.columns(4)

        with col1:
            search = st.text_input("Search", placeholder="Order # or PO")

        with col2:
            status_filter = st.selectbox(
                "Status", options=["All"] + ORDER_STATUSES
            )

        with col3:
            suppliers = get_suppliers()
            supplier_options = {"All": None}
            supplier_options.update({s["name"]: s["id"] for s in suppliers})
            supplier_filter = st.selectbox("Supplier", options=list(supplier_options.keys()))

        with col4:
            customers = get_customers()
            customer_options = {"All": None}
            customer_options.update({c["name"]: c["id"] for c in customers})
            customer_filter = st.selectbox("Customer", options=list(customer_options.keys()))

    # Action buttons
    col1, col2 = st.columns([1, 5])
    with col1:
        if st.button("➕ New Order", use_container_width=True):
            st.session_state["create_order"] = True
            st.rerun()

    # Get orders
    orders = get_orders(
        status=status_filter if status_filter != "All" else None,
        supplier_id=supplier_options.get(supplier_filter),
        customer_id=customer_options.get(customer_filter),
        search=search if search else None,
    )

    if not orders:
        st.info("No orders found")
        return

    # Display orders as cards
    for order in orders:
        status = order["status"]
        status_icon = STATUS_COLORS.get(status, "")

        with st.container():
            col1, col2, col3, col4, col5 = st.columns([2, 2, 1, 2, 1])

            with col1:
                st.write(f"**{order['order_number']}**")
                if order.get("customer_po"):
                    st.caption(f"PO: {order['customer_po']}")

            with col2:
                supplier_name = order.get("supplier", {}).get("name", "No supplier")
                customer_name = order.get("customer", {}).get("name", "No customer")
                st.write(f"🏭 {supplier_name}")
                st.write(f"👤 {customer_name}")

            with col3:
                st.write(f"{status_icon} {status.title()}")

            with col4:
                exp_ship = order.get("expected_ship_date", "Not set")
                exp_del = order.get("expected_delivery_date", "Not set")
                st.write(f"📦 Ship: {exp_ship}")
                st.write(f"🚚 Deliver: {exp_del}")

            with col5:
                if st.button("View", key=f"view_{order['id']}", use_container_width=True):
                    st.session_state["selected_order"] = order["id"]
                    st.rerun()

            st.markdown("---")


# Main
def main():
    if st.session_state.get("selected_order"):
        order_detail_view(st.session_state["selected_order"])
    else:
        order_list_view()


if __name__ == "__main__":
    main()
