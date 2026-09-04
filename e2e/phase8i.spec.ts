import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';
import { execSync } from 'child_process';
import path from 'path';

test.describe('Phase 8I: Audit Logging, Platform Admin & Demo Mode', () => {

  test.setTimeout(180000); // 3 mins

  test('Workspace Audit Flow', async ({ page, request }) => {
    // 1. Create/sign in a real test user.
    const email = `audit_${randomBytes(4).toString('hex')}@test.com`;
    await page.goto('/signup');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 30000 });

    // 2. Create/use a workspace.
    const createWsBtn = page.getByRole('button', { name: /Create Workspace/i });
    const wsName = `QA Audit WS ${randomBytes(2).toString('hex')}`;
    if (await createWsBtn.isVisible()) {
      await createWsBtn.click();
      await page.getByLabel(/Workspace Name/i).fill(wsName);
      await page.getByRole('button', { name: /Create Workspace/i }).click();
      await expect(page).not.toHaveURL(/.*\/workspaces\/new/, { timeout: 15000 });
    }

    // 3. Perform a mutation that generates an audit event (Project creation)
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page).toHaveURL(/.*\/projects\/new/);
    const projectName = `Audit Test Project ${randomBytes(2).toString('hex')}`;
    await page.getByLabel('Project Name').fill(projectName);
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(page).not.toHaveURL(/.*\/projects\/new/, { timeout: 15000 });
    await page.reload();
    await expect(page.getByText(projectName)).toBeVisible({ timeout: 15000 });

    // 4. Navigate to: /workspaces/[workspaceId]/settings/audit
    await page.getByText('Settings & Members').click();
    await page.getByRole('button', { name: 'View Audit Logs' }).click();

    // 5. Verify the audit UI loads.
    await expect(page.getByRole('heading', { name: 'Workspace Audit Logs' })).toBeVisible();

    // 6. Verify the expected PROJECT_CREATED event appears.
    await expect(page.getByText('PROJECT_CREATED')).toBeVisible();

    // 7. Verify relevant metadata is displayed.
    await expect(page.getByText(projectName)).toBeVisible(); // Depending on how metadata is rendered
  });

  test('Platform Admin Flow', async ({ page }) => {
    const email = `admin_${randomBytes(4).toString('hex')}@test.com`;
    await page.goto('/signup');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 30000 });

    // 2. Confirm /api/admin/stats returns 403.
    // Try to navigate to /admin - should redirect or show access denied
    await page.goto('/admin');
    await expect(page.getByText('Access Denied')).toBeVisible();
    await expect(page.getByText('You must be a platform administrator')).toBeVisible();

    // 3. Elevate user via Prisma
    const elevateScript = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function main() {
        await prisma.user.update({ where: { email: '${email}' }, data: { isPlatformAdmin: true } });
      }
      main().then(() => process.exit(0));
    `;
    const scriptPath = path.join(__dirname, 'elevate.js');
    require('fs').writeFileSync(scriptPath, elevateScript);
    execSync(`node ${scriptPath}`, { 
      cwd: path.join(__dirname, '../packages/db'),
      env: { ...process.env, DATABASE_URL: 'postgresql://syncforge:syncforge_secret@localhost:5432/syncforge_test?schema=public' }
    });

    // 4. Reload/authenticate as that same user
    await page.reload();
    
    // 5. Navigate to /admin
    await page.goto('/admin');
    
    // 6. Verify the dashboard loads.
    await expect(page.getByRole('heading', { name: 'Platform Admin' })).toBeVisible();

    // 7. Verify tabs load
    await expect(page.getByText('Total Users')).toBeVisible(); // Stats tab
    
    await page.getByRole('button', { name: 'Users' }).click();
    await expect(page.getByRole('cell', { name: email, exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Workspaces' }).click();
    // Assuming some workspaces exist globally
    await expect(page.locator('table')).toBeVisible();

    await page.getByRole('button', { name: 'Global Audit Logs' }).click();
    await expect(page.locator('table')).toBeVisible();
  });

  test('Demo Mode Flow & IDOR', async ({ page, request }) => {
    // 1. Enable Demo Mode (simulated backend config - we'll assume DEMO_MODE=true is set in playwright environment)
    const email = `user_${randomBytes(4).toString('hex')}@demo.syncforge.local`;
    await page.goto('/signup');
    
    // Intercept a request to get the Authorization header
    const tokenPromise = page.waitForRequest(req => req.url().includes('/api/auth/sync') && req.headers()['authorization'] !== undefined)
      .then(req => req.headers()['authorization']);

    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Password/i).fill('DemoPass123!');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 30000 });

    const authHeader = await tokenPromise;
    
    // 3. Call demo provisioning flow (via API)
    const provisionRes = await request.post('http://localhost:3001/api/demo/provision', {
      headers: {
        'Authorization': authHeader
      }
    });
    
    expect(provisionRes.status()).toBe(201);
    const provisionData = await provisionRes.json();
    const demoWorkspaceId = provisionData.workspace.id;
    const demoWorkspaceName = provisionData.workspace.name;

    // 4. Verify seeded project/resource data appears in UI
    await page.reload();
    await expect(page.getByRole('heading', { name: new RegExp(demoWorkspaceName) })).toBeVisible({ timeout: 15000 });
    
    // 6. Repeat provisioning and verify idempotency
    const provisionRes2 = await request.post('http://localhost:3001/api/demo/provision', {
      headers: {
        'Authorization': authHeader
      }
    });
    expect(provisionRes2.status()).toBe(200);
    const provisionData2 = await provisionRes2.json();
    expect(provisionData2.message).toBe('Existing demo workspace found.');
    expect(provisionData2.workspace.id).toBe(demoWorkspaceId);

    // 8. Verify a demo user cannot access another workspace.
    // Create a new normal user workspace
    const normalEmail = `normal_${randomBytes(4).toString('hex')}@test.com`;
    const elevateScript2 = `
      const { PrismaClient } = require('@prisma/client');
      const prisma = new PrismaClient();
      async function main() {
        const user = await prisma.user.create({ data: { id: 'u-${randomBytes(4).toString('hex')}', email: '${normalEmail}', displayName: 'Norm', isPlatformAdmin: false } });
        const ws = await prisma.workspace.create({ data: { name: 'Norm WS', members: { create: { userId: user.id, role: 'OWNER' } } } });
        console.log(ws.id);
      }
      main().then(() => process.exit(0));
    `;
    const scriptPath2 = path.join(__dirname, 'createWs.js');
    require('fs').writeFileSync(scriptPath2, elevateScript2);
    const otherWsId = execSync(`node ${scriptPath2}`, { 
      cwd: path.join(__dirname, '../packages/db'),
      env: { ...process.env, DATABASE_URL: 'postgresql://syncforge:syncforge_secret@localhost:5432/syncforge_test?schema=public' }
    }).toString().trim();

    // Demo tries to access otherWsId
    const idorRes = await request.get(`http://localhost:3001/api/workspaces/${otherWsId}`, {
      headers: { 'Authorization': authHeader }
    });
    expect(idorRes.status()).toBe(404);

    // 9. Verify a demo user cannot access /api/admin/*
    const adminRes = await request.get('http://localhost:3001/api/admin/stats', {
      headers: { 'Authorization': authHeader }
    });
    expect(adminRes.status()).toBe(403);

    // 10. Verify critical global destructive operations return 403
    const delRes = await request.delete(`http://localhost:3001/api/workspaces/${demoWorkspaceId}`, {
      headers: { 'Authorization': authHeader }
    });
    expect(delRes.status()).toBe(403);

    // 11. Verify demo project is accessible in the UI (sandbox not destroyed)
    await page.goto('/');
    await expect(page.getByRole('heading', { name: new RegExp(demoWorkspaceName) })).toBeVisible({ timeout: 15000 });
    await page.getByText('Demo Project').click();
    // Verify it loads explorer
    await expect(page.getByRole('heading', { name: 'EXPLORER' })).toBeVisible({ timeout: 15000 });
  });
});
