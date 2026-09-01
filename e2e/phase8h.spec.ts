import { test, expect } from '@playwright/test';
import path from 'path';
import { randomBytes } from 'crypto';

test.describe('Phase 8H: ZIP Upload & Extraction', () => {
  let projectId: string;
  let workspaceId: string;

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180000); // 3 mins

    const email = `test_${randomBytes(4).toString('hex')}@test.com`;
    await page.goto('/signup');
    await page.getByLabel(/Email/i).fill(email);
    await page.getByLabel(/Password/i).fill('Password123!');
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

    await expect(page.getByRole('button', { name: /Logout/i })).toBeVisible({ timeout: 30000 });
    
    // Create Workspace if needed
    const createWsBtn = page.getByRole('button', { name: /Create Workspace/i });
    const wsName = `QA Workspace 8H ${randomBytes(2).toString('hex')}`;
    if (await createWsBtn.isVisible()) {
      await createWsBtn.click();
      await page.getByLabel(/Workspace Name/i).fill(wsName);
      await page.getByRole('button', { name: /Create Workspace/i }).click();
      await expect(page).toHaveURL('http://localhost:3000/', { timeout: 15000 });
    }

    // Create new project for this test run
    await page.getByRole('button', { name: 'New Project' }).click();
    await expect(page).toHaveURL(/.*\/projects\/new/);
    await page.getByLabel('Project Name').fill('E2E ZIP Test Project');
    await page.getByRole('button', { name: 'Create Project' }).click();
    await expect(page).toHaveURL('http://localhost:3000/');
    await page.reload();
    await expect(page.getByText('E2E ZIP Test Project')).toBeVisible({ timeout: 15000 });
    
    // Navigate into the project
    await page.getByText('E2E ZIP Test Project').click();
    await expect(page.getByRole('heading', { name: 'EXPLORER' })).toBeVisible({ timeout: 15000 });
    
    // Explicitly wait for the upload file button to appear in the explorer
    await expect(page.getByTitle('Upload File')).toBeVisible({ timeout: 15000 });
  });

  test('should show ZipUploadModal and allow extraction into project', async ({ page }) => {
    // We generated test-extract.zip which contains root-extract.txt and nested-folder/nested-file.js
    
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTitle('Upload File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'test-extract.zip'));

    // Modal should appear
    await expect(page.getByText('ZIP File Detected')).toBeVisible();
    await expect(page.getByText('test-extract.zip')).toBeVisible();

    // Choose to extract
    await page.getByRole('button', { name: 'Extract into project' }).click();

    // Verify it disappears and resources load
    await expect(page.getByText('ZIP File Detected')).not.toBeVisible();

    // Wait for explorer to show new resources
    await expect(page.getByText('root-extract.txt')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('nested-folder')).toBeVisible();
    
    // Expand nested folder
    await page.getByText('nested-folder').click();
    await expect(page.getByText('nested-file.js')).toBeVisible();
    
    // Open the extracted text file
    await page.getByText('root-extract.txt').click();
    
    // Verify Monaco editor loads content
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 15000 });
  });

  test('should show ZipUploadModal and allow single file upload', async ({ page }) => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByTitle('Upload File').click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(__dirname, 'test-single.zip'));

    // Modal should appear
    await expect(page.getByText('ZIP File Detected')).toBeVisible();
    await expect(page.getByText('test-single.zip')).toBeVisible();

    // Choose to upload as single file
    await page.getByRole('button', { name: 'Upload as single .zip' }).click();

    // Verify it disappears and resource loads
    await expect(page.getByText('ZIP File Detected')).not.toBeVisible();

    // Should only see the zip file, NOT its contents (which is 'single-zip-file.txt')
    await expect(page.getByText('test-single.zip')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('single-zip-file.txt')).not.toBeVisible();
    
    // Open the ZIP file to verify Phase 8E ArchiveViewer still works
    await page.getByText('test-single.zip').click();
    
    // Verify the archive viewer renders its contents
    await expect(page.getByText('single-zip-file.txt')).toBeVisible({ timeout: 10000 });
  });
});
