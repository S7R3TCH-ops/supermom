## What we're building

A modular, agentic, mobile-first **Solopreneur Operations Platform** — deployed here as **Supermom for Hire**, the flagship bespoke instance for Sandra's solo personal-life-operations business in Georgetown, ON (organizing, caregiving, decluttering, errands).

**Platform Architecture & Managed Service**:
- **Core Engine**: Generic, multi-tenant agentic OS for 1-person businesses. Highly customizable — features can be toggled, stripped, or augmented per solopreneur niche.
- **Flagship Tenant**: Sandra (Supermom) is Client #1 and live proof-of-concept.
- **Target Persona**: Non-technical solopreneurs (often ADHD/overwhelmed by corporate SaaS) who need simple, zero-friction automation delivered via a trusted implementation partner (Joel).

### Platform Hierarchy
- **Super Admin (Joel)**: `admin` role in DB. Not linked to any business. Switches "Viewpoints" to see any business.
- **Business Owners (Sandra, etc.)**: `owner` role, scoped to their `business_id`.
