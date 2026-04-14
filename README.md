# Bookkeeping Admin

Bookkeeping Admin is a local-first bookkeeping tool for independent professionals and small service businesses in the Netherlands. It covers billing profiles, invoices, expenses, receipts, and quarterly `BTW`/VAT summaries without requiring a subscription product or a hosted backend.

## Why I Built It

I started this project after beginning independent consulting work in the Netherlands and realizing that my bookkeeping workflow felt more complicated than it should. Existing tools were often capable products, but they did not match the experience I wanted: some felt too advanced, some too limited, some visually uninspiring, and many required an ongoing subscription.

I wanted something simpler, more focused, and more aligned with my own way of working. I also wanted to use the project to demonstrate a practical AI-assisted delivery workflow: as a PM, I used OpenAI and Codex to shape requirements, iterate on UX details, and ship a working product that I can continue improving.

## Product Positioning

This is intentionally not a full accounting platform.

The current version is designed around a narrower idea:

- local-first bookkeeping
- privacy-conscious by default
- no required account creation
- no hosted user database
- focused workflows for solo operators and small service businesses

That tradeoff keeps the product lightweight, inexpensive to run, and well scoped as a portfolio project.

## Features

- `Dashboard`: quick access to the main bookkeeping flows
- `Profiles`: save reusable sender and client billing details
- `Invoices`: create invoices from saved profiles and calculate VAT automatically
- `Expenses`: track costs, VAT, and receipt files locally
- `BTW Summary`: review deductible VAT and expense totals by quarter
- `Local persistence`: store everything in browser `localStorage`

## Project Structure

```text
.
├── app/
│   ├── btw-summary/page.tsx    Quarterly VAT summary page
│   ├── clients/page.tsx        Billing profile management
│   ├── expenses/page.tsx       Expense and receipt tracking
│   ├── invoices/page.tsx       Invoice builder and VAT calculation
│   ├── layout.tsx              Shared app shell and navigation
│   ├── page.tsx                Dashboard / landing page
│   └── globals.css             Global styles
├── lib/
│   ├── billing.ts              Shared billing types and helpers
│   └── local-storage.ts        Local storage state hook
├── public/                     Static assets
├── next.config.ts              Next.js configuration
├── package.json                Scripts and dependencies
└── README.md
```

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| App framework | `Next.js 16` | App shell, routing, build tooling |
| UI | `React 19` | Client-side UI and stateful forms |
| Language | `TypeScript` | Type safety across app logic |
| Styling | `Tailwind CSS 4` | Layout and visual styling |
| Persistence | `localStorage` | Local-first data storage in the browser |
| Tooling | `ESLint` | Basic code quality checks |

## Built With AI

This project is also a practical exploration of AI-assisted product development.

I used OpenAI and Codex to:

- turn rough bookkeeping pain points into product requirements
- define the page split and information architecture
- iterate on invoice, profile, and VAT workflows
- refine form behavior and reusable data models
- review product tradeoffs around privacy, local-first storage, validation, and security

The goal was not just to generate code, but to use AI as part of a real product delivery workflow: moving from a personal problem to a working, testable product.

## Privacy And Scope

This version does not use a backend database. Data is stored locally in the browser/device running the app.

That means:

- no central user data storage
- no authentication layer in the current version
- no multi-device sync
- no responsibility for hosting other users' bookkeeping data

For this stage of the project, that is a deliberate product choice rather than a missing feature.

## Running The Project

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Available scripts:

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Deployment

The simplest deployment path is Vercel. The app works well as a public demo because it does not depend on a backend database in its current form.

## Roadmap

Likely next improvements:

- stronger input validation and security hardening
- safer receipt upload constraints
- export/import for local backup
- PDF invoice export
- clearer settings and data portability controls
- optional PWA packaging

If the product ever grows beyond a local-first tool, the next step would be an optional backend for authentication, sync, and storage. That is intentionally out of scope for the current version.

## Portfolio Value

This project demonstrates:

- identifying a real user problem from personal experience
- scoping an MVP around a focused use case
- making explicit tradeoffs about privacy, complexity, and cost
- using AI tools to accelerate delivery
- shipping a working interface instead of stopping at a spec or concept

## Status

Bookkeeping Admin is an active portfolio and learning project. The current version is usable as a local-first bookkeeping tool and will continue to evolve through iterative improvements.
