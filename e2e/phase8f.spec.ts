import { test, expect } from '@playwright/test';
import { randomBytes } from 'crypto';

test('Phase 8F Browser QA', async ({ page }) => {
  test.setTimeout(180000); // 3 mins

  const email = `test_${randomBytes(4).toString('hex')}@test.com`;

  console.log('1. Open SyncForge');
  await page.goto('/signup');
  
  // Robust signup
  await page.getByLabel(/Email/i).fill(email);
  await page.getByLabel(/Password/i).fill('Password123!');
  await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

  console.log('2. Waiting for redirect to dashboard');
  // Wait for the Logout button to appear to ensure we are logged in and on the dashboard
  await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 15000 });
  
  // Wait for the loading state to disappear
  await expect(page.getByText('Loading...')).toBeHidden({ timeout: 10000 });
  await page.waitForTimeout(1000);

  // Check if we need to create a workspace
  const createWsBtn = page.getByRole('button', { name: /Create Workspace/i });
  const wsName = `QA Workspace ${randomBytes(2).toString('hex')}`;
  
  if (await createWsBtn.isVisible()) {
    console.log('3a. Creating Workspace from Empty Dashboard');
    await createWsBtn.click();
    await expect(page).toHaveURL(/.*\/workspaces\/new/);
    
    await page.getByLabel(/Workspace Name/i).fill(wsName);
    await page.getByRole('button', { name: /Create Workspace/i }).click();
    // Wait to return to dashboard
    await expect(page).toHaveURL('http://localhost:3000/', { timeout: 15000 });
    await expect(page.getByRole('heading', { name: new RegExp(`${wsName} Projects`, 'i') })).toBeVisible({ timeout: 15000 });
  }
  
  await page.screenshot({ path: 'e2e-results/1_dashboard.png' });

  console.log('3. Create Project');
  await page.getByRole('button', { name: /New Project/i }).click();
  await expect(page).toHaveURL(/.*\/projects\/new/);
  
  const projectName = `QA Project ${randomBytes(2).toString('hex')}`;
  await page.getByText('Project Name').locator('..').locator('input').fill(projectName);
  await page.getByRole('button', { name: 'Create Project' }).click();
  
  // Wait to return to dashboard
  await expect(page).toHaveURL('http://localhost:3000/', { timeout: 15000 });
  await page.waitForTimeout(3000); // Wait for React state to settle
  await page.reload(); // Force reload to ensure data is fresh
  await expect(page.getByText(projectName)).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: 'e2e-results/2_project_created.png' });

  console.log('4. Navigate to project');
  // Click on the project card
  await page.getByText(projectName).click();
  await expect(page).toHaveURL(/.*\/projects\/.+/);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e-results/3_project_dashboard.png' });

  console.log('5. Upload text/code file');
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /Upload File/i }).click()
  ]);
  await fileChooser.setFiles('e2e/test.txt');
  
  // Wait for the upload to complete
  await expect(page.getByText('test.txt')).toBeVisible({ timeout: 10000 });
  await page.screenshot({ path: 'e2e-results/4_file_uploaded.png' });
  
  console.log('6. Open text/code file');
  // Find the file in the project explorer
  await page.getByText('test.txt').click();

  console.log('7. Wait for editor');
  await page.waitForSelector('.monaco-editor');
  await page.screenshot({ path: 'e2e-results/4_editor_loaded.png' });

  console.log('8. Enter content and Save Version 1');
  await page.click('.monaco-editor');
  await page.keyboard.type('Hello World from QA\n');
  await page.getByRole('button', { name: /Save Version/i }).click();
  // It saves immediately and shows "Revision Saved!"
  await expect(page.getByText('Revision Saved!')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e-results/5_v1_saved.png' });

  console.log('9. Modify content and Save Version 2');
  await page.click('.monaco-editor');
  await page.keyboard.type('Second line of text\n');
  await page.getByRole('button', { name: /Save Version/i }).click();
  await expect(page.getByText('Revision Saved!')).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'e2e-results/6_v2_saved.png' });

  console.log('10. Open History and Verify Revisions');
  await page.getByRole('button', { name: /History/i }).click();
  // We have 2 Manual saves
  await expect(page.getByText('Manual save').first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'e2e-results/6_history_panel.png' });

  console.log('11. Open Diff Viewer');
  // Click on the first (oldest or newest? Let's just click the last Manual save)
  await page.getByText('Manual save').last().click();
  // Wait for diff viewer to appear (it should show "Version Diff")
  await expect(page.getByText(/Version Diff|Diff/i).first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: 'e2e-results/7_diff_viewer.png' });

  console.log('12. Restore an older version');
  await page.getByRole('button', { name: /Restore/i }).first().click();
  await page.waitForTimeout(2000); // Allow WebSocket to force reconnect
  await page.screenshot({ path: 'e2e-results/8_restored.png' });

  console.log('13. Verify UI remains functional');
  await page.waitForSelector('.monaco-editor');
  await page.click('.monaco-editor');
  await page.keyboard.type('Editing after restore\n');
  await page.screenshot({ path: 'e2e-results/9_functional_after_restore.png' });
});
