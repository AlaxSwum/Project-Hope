import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login form on initial visit', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
    
    // Should show login form elements
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Should show error message
    await expect(page.locator('[role="alert"]')).toBeVisible();
  });

  test('should redirect to dashboard after successful login', async ({ page }) => {
    await page.goto('/login');
    
    // Mock successful login (you'll need to set up test credentials)
    await page.fill('input[name="email"]', process.env.TEST_USER_EMAIL || 'test@example.com');
    await page.fill('input[name="password"]', process.env.TEST_USER_PASSWORD || 'testpassword');
    await page.click('button[type="submit"]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });

  test('should logout successfully', async ({ page }) => {
    // Assuming user is logged in
    await page.goto('/dashboard');
    
    // Click logout button
    await page.click('[data-testid="logout-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL('/login');
  });
}); 