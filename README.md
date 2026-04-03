# Freelancer Admin

Freelancer Admin is a local-first bookkeeping tool for freelancers in the Netherlands. It helps track billing profiles, invoices, expenses, receipts, and quarterly `BTW`/VAT summaries without relying on a subscription product or a backend database.

## Why I Built It

I started this project after beginning freelance work in the Netherlands and realizing that my bookkeeping workflow felt harder than it needed to be. Existing tools were often strong products, but they did not fit what I wanted in practice: some felt too advanced, some too limited, some visually uninspiring, and many required an ongoing subscription.

I wanted something simpler, more focused, and easier to use for my own workflow. I also wanted to use the project as a practical way to demonstrate AI-assisted product delivery: as a PM, I used OpenAI and Codex to shape the requirements, iterate on UX decisions, and ship a working product that I can keep improving.

## Product Positioning

This is intentionally not a full accounting platform.

The current version is designed around a narrower idea:
- local-first bookkeeping
- privacy-conscious by default
- no required account creation
- no hosted user database
- focused workflows for solo freelancers

That tradeoff keeps the product lightweight and makes the repository easier to evaluate as a portfolio project.

## Current Features

- `Dashboard`: quick navigation into the core workflows
- `Profiles`: save reusable business and client billing profiles
- `Invoices`: generate invoice totals from hours, rate, and VAT
- `Expenses`: track costs, VAT, and attach receipt files locally
- `BTW Summary`: review deductible VAT and totals by quarter
- `Local persistence`: all data is stored in the browser with `localStorage`

## Current App Structure

The app is split into a few focused pages so each workflow stays clear:

- `Dashboard`: overview and entry point
- `Profiles`: reusable sender and client invoice data
- `Invoices`: invoice creation and VAT calculation
- `Expenses`: receipt and expense logging
- `BTW Summary`: quarterly VAT reporting view

This split is deliberate. It mirrors the actual jobs a freelancer needs to do rather than trying to force everything into one large bookkeeping screen.

## Privacy And Scope

This version does not use a backend database. Data is stored locally in the browser/device running the app.

That means:
- no central user data storage
- no authentication layer in the current version
- no multi-device sync
- no responsibility for hosting other users' bookkeeping data

For this project stage, that is a product choice rather than a limitation. It keeps the app lightweight, inexpensive to deploy, and aligned with the goal of creating a credible, privacy-conscious portfolio project.

## Tech Stack

- `Next.js 16`
- `React 19`
- `TypeScript`
- `Tailwind CSS 4`
- `localStorage` for persistence

## AI-Assisted Workflow

This project is also an exploration of how a PM can use AI tools to move from idea to working software faster.

I used OpenAI and Codex to:
- turn rough needs into concrete product requirements
- iterate on the information architecture and page flows
- refine invoice and billing profile UX
- implement and adjust features in small increments
- review tradeoffs around local-first storage, validation, and security

The goal was not just to generate code, but to use AI as part of a practical product delivery workflow.

## Running The Project

Install dependencies and start the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Other useful commands:

```bash
npm run lint
npm run build
```

## Deployment

The simplest deployment path is Vercel. The app works well as a public demo because it does not depend on a backend database in its current form.

## Roadmap

Likely next improvements:

- stronger input validation and security hardening
- safer receipt upload constraints
- export/import for local backup
- PDF invoice export
- clearer data portability and settings controls
- optional PWA packaging

If the project ever grows beyond a local-first tool, the natural next step would be adding an optional backend for authentication, sync, and storage. That is intentionally out of scope for the current version.

## Portfolio Value

This project demonstrates:

- identifying a real user problem from personal experience
- scoping an MVP around a focused use case
- making explicit tradeoffs about privacy, complexity, and cost
- using AI tools to accelerate product development
- shipping a working interface instead of only writing a product spec

## Status

Freelancer Admin is an active portfolio and learning project. The current version is usable as a local-first bookkeeping tool and will continue to evolve through iterative improvements.
