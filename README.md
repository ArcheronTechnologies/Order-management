# J2 Order Tracker

A manual order tracking tool designed for Phase 1 operation with future automation in mind.

## Quick Start

### Using Docker (Recommended)

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **Run database migrations:**
   ```bash
   docker-compose exec api alembic upgrade head
   ```

3. **Access the application:**
   - Frontend: http://localhost:8501
   - API Docs: http://localhost:8000/docs

### Local Development

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Set up PostgreSQL:**
   ```bash
   # Create database
   createdb j2_tracker

   # Or use Docker for just the database
   docker-compose up -d db
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

4. **Run migrations:**
   ```bash
   alembic upgrade head
   ```

5. **Start the API:**
   ```bash
   python -m src.main
   ```

6. **Start Streamlit (in a new terminal):**
   ```bash
   streamlit run app/app.py
   ```

## Architecture

```
j2-tracker/
├── src/                    # FastAPI Backend
│   ├── api/               # API endpoints
│   ├── models/            # SQLAlchemy models
│   ├── schemas/           # Pydantic schemas
│   ├── services/          # Business logic
│   ├── main.py            # FastAPI app
│   └── database.py        # DB connection
├── app/                    # Streamlit Frontend
│   ├── pages/             # Streamlit pages
│   ├── components/        # Reusable components
│   └── app.py             # Main entry point
└── alembic/               # Database migrations
```

## Features (Phase 1)

- **Dashboard:** View attention items, stats, and quick actions
- **Orders:** Full CRUD with line items, events, and status tracking
- **Email Inbox:** View and process supplier emails (integration in Phase 1c)
- **Suppliers:** Manage supplier records
- **Customers:** Manage customer records
- **Communications:** Log customer communications

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Dashboard data |
| `GET /api/orders` | List orders |
| `POST /api/orders` | Create order |
| `GET /api/orders/{id}` | Get order details |
| `PATCH /api/orders/{id}` | Update order |
| `POST /api/orders/{id}/status` | Update status |
| `GET /api/suppliers` | List suppliers |
| `GET /api/customers` | List customers |
| `GET /api/emails` | List emails |

Full API documentation available at `/docs` when running.

## Development Phases

- **Phase 1a:** Foundation (Database, CRUD, Basic UI) ✅
- **Phase 1b:** Order Management (Advanced features)
- **Phase 1c:** Email Integration (Microsoft Graph API)
- **Phase 1d:** Dashboard & Polish

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://j2tracker:j2tracker@localhost:5432/j2_tracker` |
| `API_HOST` | API host | `localhost` |
| `API_PORT` | API port | `8000` |
| `AZURE_TENANT_ID` | Azure AD tenant (Phase 1c) | - |
| `AZURE_CLIENT_ID` | Azure AD client ID | - |
| `AZURE_CLIENT_SECRET` | Azure AD client secret | - |
| `GRAPH_USER_EMAIL` | Email to sync from | - |
| `GRAPH_TARGET_FOLDER` | Folder to sync | `Supplier Orders` |

## License

Internal use only.
