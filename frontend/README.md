# Frontend — Finance Coach LATAM

Placeholder for the React frontend. **Phase 2 deliverable.**

## Planned Stack

- React 18 + TypeScript + Vite
- TailwindCSS for styling
- Recharts for data visualization (spending by category, monthly trends)
- PapaParse for CSV import (bank statements)
- Cloudflare Pages for hosting (free tier, edge CDN)

## Planned Architecture — Atomic Design

Brad Frost's Atomic Design applied to finance UI. Strict folder hierarchy:

```
src/
├── components/
│   ├── atoms/          # Smallest units. Button, Input, Label, Badge, Spinner, Icon.
│   ├── molecules/      # Combinations of atoms. FormField, StatCard, CategoryPill, TransactionRow.
│   ├── organisms/      # Complex UI sections. TransactionTable, CategoryBreakdown, InsightCard, ImportWizard.
│   ├── templates/      # Page layouts. DashboardLayout, AuthLayout, AdminLayout.
│   └── pages/          # Routed views. DashboardPage, TransactionsPage, InsightsPage, AdminPage.
├── hooks/              # Custom React hooks. useTransactions, useCategories, useAuth.
├── services/           # API client, auth helpers. axios instance, Cognito JWT helpers.
├── stores/             # State management (Zustand or React Context for the initial release).
├── types/              # Shared TypeScript types (matching backend domain entities).
└── utils/              # Pure helpers. currencyFormat, dateFormat, classifyByAmount.
```

## Design Principles

- **Atoms** are presentational only. No state, no side effects, no API calls.
- **Molecules** wrap atoms with simple local state. Still no API calls.
- **Organisms** orchestrate data fetching via hooks. Compose molecules + atoms.
- **Templates** define layout structure. Receive content via props or children.
- **Pages** are the only ones that know about routes.

## Roles Visible in UI

- **user**: Dashboard, Transactions, Insights, Import.
- **admin**: All user views + User Management, Global Analytics.

## Current Scope

The health foundation is backend-only. The frontend builds on its hexagonal architecture in Phase 2.
