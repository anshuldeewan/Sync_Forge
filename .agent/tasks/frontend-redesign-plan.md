# Frontend Redesign Plan

## 1. Current Frontend Architecture
- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS v4, basic global CSS
- **State/Data**: React Context API (`AuthContext`, `WorkspaceContext`), SWR for data fetching
- **Core Integrations**: Firebase Authentication, Monaco Editor, TipTap Editor, Yjs (Collaboration)

## 2. Dashboard Architecture & Routes
There are explicitly TWO levels of dashboard in SyncForge:

**1. GLOBAL DASHBOARD** (`/dashboard`)
- **Purpose**: User-level overview across their accessible workspaces.
- **Content**: Welcome, My Workspaces, Recent Projects, Recent Resources, Recent Issues, Recent Activity, Quick Actions. (Must use real data/API capabilities).

**2. WORKSPACE DASHBOARD** (`/workspaces/[workspaceId]`)
- **Purpose**: Detailed workspace-specific collaboration/product experience.

### All Preserved Routes
- `/` - Landing Page
- `/login` - Authentication (Login)
- `/signup` - Authentication (Signup)
- `/dashboard` - Global Personal Dashboard (NEW)
- `/admin` - Platform Admin Dashboard
- `/invite/[token]` - Invitations
- `/workspaces/new` - Workspace Creation
- `/workspaces/[workspaceId]` - Workspace Dashboard
- `/workspaces/[workspaceId]/projects` - Projects List
- `/workspaces/[workspaceId]/projects/new` - Project Creation
- `/workspaces/[workspaceId]/projects/[projectId]` - Project Detail
- `/workspaces/[workspaceId]/projects/[projectId]/issues` - Issues
- `/workspaces/[workspaceId]/projects/[projectId]/pages/[pageId]` - Collaborative Pages
- `/workspaces/[workspaceId]/settings` - Workspace Settings
- `/workspaces/[workspaceId]/settings/audit` - Workspace Audit Logs

## 3. UI/UX System & Components
One unified SyncForge design system will be implemented utilizing the `ui-ux-pro-max` skills (brand, design-system, ui-styling, design). This single language spans the cinematic Landing page through to the Admin dashboard.

**Component Strategy:**
- **Do not blindly replace working complex components.**
- **Preserve and carefully wrap**: Monaco, TipTap, Yjs, existing authentication, SWR, existing context/state architecture.
- **Inspect existing components**: Identify reusable components and improve them where appropriate.
- **shadcn/ui & Radix**: Introduce these primitives only where they provide a clear accessibility or interaction benefit (e.g., accessible modals, dropdowns).

## 4. Authentication Flow
- `Landing` → `Get Started` → `/login`
- After successful authentication → `/dashboard`
- **Rule**: Do NOT change the existing authentication backend, fake authentication, or create a second auth system.

## 5. Security Requirements
- **Frontend redesign must NEVER weaken backend security.**
- The frontend may: hide unavailable actions, show disabled states, show role-specific navigation, and show Demo Mode indicators.
- **Backend authorization remains authoritative**: Do not rely on frontend checks for Platform Admin, RBAC, IDOR protection, Demo restrictions, or Audit access.

## 6. Landing Page Architecture
- The landing page must use the installed MengTo skills (Three.js, GSAP, ScrollTrigger, Lenis).
- **Narrative**: Use existing product capabilities (Workspace → Projects → Resources → Pages → Issues → Audit → Admin → Demo Mode). Do NOT invent fake testimonials, statistics, pricing, or product claims.
- **3D Experience**: One continuous conceptual 3D experience. It must never interfere with navigation, text readability, CTA interaction, accessibility, or mobile usability.
- **Fallbacks**: Implement reduced-motion and mobile fallback strategies.

## 7. Dependency Strategy (Conservative)
Reuse existing dependencies whenever possible. Add only what is actually required.

- **Animation Architecture**:
  - Normal UI: CSS transitions / native browser animation.
  - Landing cinematic: GSAP + ScrollTrigger.
  - 3D: Three.js / React Three Fiber (only where genuinely useful).
  - Smooth scrolling: Lenis (only if compatible/beneficial).
  - *Rejected*: Framer Motion (unless a concrete requirement cannot be implemented otherwise).
- **Charts**: Only add Recharts (or similar) if the existing Admin UI genuinely requires visual charts after inspection.
- **Forms**: Reuse existing forms. Only introduce `react-hook-form`/`zod` if there is a concrete need.

## 8. Implementation Phases
- **Phase 0**: Audit + architecture plan (COMPLETED)
- **Phase 1**: Design tokens / typography / colors / spacing / global foundation
- **Phase 2**: Reusable UI primitives
- **Phase 3**: Application shell
- **Phase 4**: Authentication redesign
- **Phase 5**: NEW global `/dashboard`
- **Phase 6**: Workspace dashboard redesign
- **Phase 7**: Projects / Resources / Issues redesign
- **Phase 8**: Collaborative editor integration and visual shell
- **Phase 9**: Settings redesign
- **Phase 10**: Workspace Audit UI redesign
- **Phase 11**: Platform Admin redesign
- **Phase 12**: Demo Mode visual UX
- **Phase 13**: Landing page 3D + GSAP + ScrollTrigger + Lenis
- **Phase 14**: Responsive + accessibility + performance
- **Phase 15**: Playwright E2E + regression validation

## 9. Testing Requirements (Playwright Coverage)
- **Landing**: Loads, CTA navigates to `/login`, scroll storytelling works, reduced-motion fallback does not break page.
- **Authentication**: `/login` loads, form works, successful auth redirects to `/dashboard`.
- **Global Dashboard**: `/dashboard` loads, real user data renders, workspace navigation works, quick actions work (if available).
- **Workspace**: Existing workspace functionality remains intact.
- **Admin**: Authorized Platform Admin can access, unauthorized users receive Access Denied.
- **Audit**: Authorized users can access, unauthorized roles remain blocked.
- **Demo**: Demo indicator appears, sandbox functionality works, destructive restrictions remain enforced.
- **Responsive**: Validated across mobile, tablet, desktop.
- **Selectors**: Use semantic locators and stable `data-testid` attributes; avoid brittle CSS selectors.

## 10. Route Architecture Diagram

```text
/
 ↓
/login
 ↓
/dashboard
 ↓
/workspaces/[workspaceId]
 ↓
projects / resources / issues / pages / settings / audit

=============================
Platform Admin:
/admin

=============================
Invitations:
/invite/[token]
```
