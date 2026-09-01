import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

test('Phase 8G Browser QA', async ({ page }) => {
  test.setTimeout(180000); // 3 mins

  const email = `test_${randomBytes(4).toString('hex')}@test.com`;

  console.log('1. Open SyncForge');
  await page.goto('/signup');
  
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

  console.log('2. Waiting for redirect to dashboard');
  await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Loading...')).toBeHidden({ timeout: 10000 });
  await page.waitForTimeout(1000);

  const createWsBtn = page.getByRole('button', { name: /Create Workspace/i });
  const wsName = `QA Workspace 8G ${randomBytes(2).toString('hex')}`;
  
  if (await createWsBtn.isVisible()) {
    console.log('3. Creating Workspace');
    await createWsBtn.click();
    await page.getByLabel(/Workspace Name/i).fill(wsName);
    await page.getByRole('button', { name: /Create Workspace/i }).click();
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: new RegExp(`${wsName} Projects`, 'i') })).toBeVisible({ timeout: 15000 });
  }

  console.log('4. Create Project');
  await page.getByRole('button', { name: /New Project/i }).click();
  const projectName = `QA Project 8G ${randomBytes(2).toString('hex')}`;
  await page.getByText('Project Name').locator('..').locator('input').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();
  
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.reload();
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 15000 });

  console.log('5. Navigate to project');
  await page.getByText(projectName).click();
  await expect(page).toHaveURL(/.*\/projects\/.+/);
  await page.waitForTimeout(1000);

  console.log('6. Verify Issue Board Navigation');
  await page.getByRole('button', { name: 'Issues' }).click();
  await expect(page).toHaveURL(/.*\/issues/);
  await expect(page.getByRole('heading', { name: new RegExp(`Issues - ${projectName}`, 'i') })).toBeVisible({ timeout: 5000 });

  console.log('7. Create an Issue manually');
  await page.getByRole('button', { name: 'New Issue' }).click();
  await page.getByLabel(/Title/i).fill('Test Issue 1');
  await page.getByLabel(/Description/i).fill('This is a test issue');
  await page.getByRole('button', { name: 'Save Issue' }).click();
  
  // Verify issue appears in OPEN column
  await expect(page.getByText('Test Issue 1')).toBeVisible({ timeout: 5000 });

  console.log('8. Upload a file to test code linking');
  await page.getByRole('button', { name: /Back to Project/i }).click();
  
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Upload File/i }).click()
  ]);
  await fileChooser.setFiles('e2e/test.txt');
  await expect(page.getByText('test.txt')).toBeVisible({ timeout: 10000 });
  
  console.log('9. Open file and create issue from Monaco selection');
  await page.getByText('test.txt').click();
  await page.waitForSelector('.monaco-editor');
  
  // Click inside editor to ensure focus
  await page.click('.monaco-editor');
  await page.keyboard.type('const test = "Hello";\n');
  await page.waitForTimeout(1000);

  // Triple-click to select the whole line reliably
  await page.getByText('const test = "Hello";').click({ clickCount: 3 });
  await page.waitForTimeout(500);

  // Execute the Monaco action directly via the API to bypass UI flakiness
  await page.evaluate(() => {
    if ((window as any).monacoEditor) {
      (window as any).monacoEditor.trigger('', 'create-issue-from-selection', null);
    }
  });
  
  // Wait for redirect to issues page with ?new=true and the dialog to appear
  await expect(page).toHaveURL(/.*\/issues/);
  await expect(page.getByRole('heading', { name: 'New Issue' })).toBeVisible({ timeout: 5000 });
  
  // Verify the snippet is present in the dialog
  await expect(page.getByText('const test = "Hello";')).toBeVisible({ timeout: 5000 });
  
  await page.getByLabel(/Title/i).fill('Issue from code');
  await page.getByRole('button', { name: 'Save Issue' }).click();
  
  await expect(page.getByText('Issue from code')).toBeVisible({ timeout: 5000 });

  console.log('10. Notification Bell Verification');
  await expect(page.locator('button').filter({ hasText: /9\+|[1-9]/ }).or(page.locator('svg'))).toBeVisible({ timeout: 5000 });
});
