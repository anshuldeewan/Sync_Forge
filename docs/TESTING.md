# Testing Strategy

## Philosophy
Test-Driven Development (TDD) via the *Prove-It Pattern*. Write tests before implementing logic.

## Types of Tests
1. **Unit Tests (Small):**
   - Zod validation schemas.
   - Utility functions (e.g., Zip Slip path verifier).
2. **Service / API Integration Tests (Medium):**
   - Supertest + in-memory Postgres (or isolated test DB schema).
   - Verify RBAC middleware (assert 403 Forbidden for incorrect roles).
   - Verify CRUD operations.
3. **Database Tests (Medium):**
   - Verify cascades and foreign key constraints.
4. **WebSocket / CRDT Tests:**
   - Test debounced persistence logic.
5. **E2E / Browser Tests (Large):**
   - Playwright or Cypress (or agent-driven DevTools testing).
   - Test Demo Mode workflows.

## CI/CD Expectations
- A commit cannot merge if coverage drops or tests fail.
- All builds must run linting and type-checking.
