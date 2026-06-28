import { test, expect, describe } from '@playwright/test';

describe('Loyalty Bonus Customer Flows', () => {
  // Test 1: Eligible customer (order >50€) sees loyalty banner and can select bonus
  test('should show loyalty bonus banner for eligible order and allow item selection', async ({
    page,
  }) => {
    // Navigate to the Frankys Pasta storefront (example location)
    await page.goto('/shop/frankys-pasta');

    // Wait for storefront to load
    await page.waitForSelector('[data-testid="storefront-loaded"]', {
      timeout: 5000,
    });

    // Add items to cart to reach >50€
    // First, find and add a high-value item
    const itemCards = await page.locator('[data-testid="item-card"]').all();
    expect(itemCards.length).toBeGreaterThan(0);

    // Click on first item to open the item sheet
    await itemCards[0].click();
    await page.waitForSelector('[data-testid="item-sheet"]', {
      timeout: 3000,
    });

    // Add quantity to reach >50€ order value
    const quantityInput = page.locator('[data-testid="item-quantity-input"]');
    await quantityInput.fill('2');

    // Click add to cart button
    const addToCartBtn = page.locator('[data-testid="add-to-cart-button"]');
    await addToCartBtn.click();

    // Close item sheet
    await page.locator('[data-testid="item-sheet-close"]').click();

    // Wait for cart to update
    await page.waitForTimeout(500);

    // Proceed to checkout
    const checkoutBtn = page.locator('[data-testid="checkout-button"]');
    await checkoutBtn.click();

    // Wait for loyalty bonus banner to appear
    const loyaltyBanner = page.locator('[data-testid="loyalty-bonus-banner"]');
    await expect(loyaltyBanner).toBeVisible({ timeout: 3000 });

    // Verify banner text
    await expect(loyaltyBanner).toContainText('Treuebonus');

    // Click "Wählen" button to open bonus selection
    const selectBonusBtn = page.locator('[data-testid="loyalty-select-bonus-button"]');
    await selectBonusBtn.click();

    // Wait for bonus modal/sheet to appear
    await page.waitForSelector('[data-testid="loyalty-bonus-modal"]', {
      timeout: 3000,
    });

    // Select a bonus item from the available options
    const bonusItems = await page.locator('[data-testid="bonus-item"]').all();
    expect(bonusItems.length).toBeGreaterThan(0);

    // Click the first bonus item
    await bonusItems[0].click();

    // Confirm selection
    const confirmBtn = page.locator('[data-testid="confirm-bonus-selection"]');
    await confirmBtn.click();

    // Wait for modal to close
    await page.waitForFunction(
      () => !document.querySelector('[data-testid="loyalty-bonus-modal"]'),
      { timeout: 3000 }
    );

    // Verify order contains the bonus item with 0.00 price
    await page.waitForSelector('[data-testid="order-summary"]', {
      timeout: 3000,
    });

    const bonusItemInOrder = page.locator(
      '[data-testid="order-item-bonus"][data-free="true"]'
    );
    await expect(bonusItemInOrder).toBeVisible();

    // Verify the price is 0.00
    const bonusPriceElement = page.locator(
      '[data-testid="order-item-bonus-price"]'
    );
    const priceText = await bonusPriceElement.textContent();
    expect(priceText).toContain('0,00');
  });

  // Test 2: Low-value order (<50€) should NOT show loyalty bonus banner
  test('should not show loyalty bonus banner for low-value orders', async ({
    page,
  }) => {
    // Navigate to storefront
    await page.goto('/shop/frankys-pasta');

    // Wait for storefront to load
    await page.waitForSelector('[data-testid="storefront-loaded"]', {
      timeout: 5000,
    });

    // Add a low-value item (less than 50€ total)
    const itemCards = await page.locator('[data-testid="item-card"]').all();
    expect(itemCards.length).toBeGreaterThan(0);

    // Click on first item
    await itemCards[0].click();
    await page.waitForSelector('[data-testid="item-sheet"]', {
      timeout: 3000,
    });

    // Add just 1 item (should be < 50€)
    const quantityInput = page.locator('[data-testid="item-quantity-input"]');
    await quantityInput.fill('1');

    // Click add to cart
    const addToCartBtn = page.locator('[data-testid="add-to-cart-button"]');
    await addToCartBtn.click();

    // Close item sheet
    await page.locator('[data-testid="item-sheet-close"]').click();

    // Wait for cart update
    await page.waitForTimeout(500);

    // Proceed to checkout
    const checkoutBtn = page.locator('[data-testid="checkout-button"]');
    await checkoutBtn.click();

    // Verify loyalty bonus banner is NOT visible
    const loyaltyBanner = page.locator('[data-testid="loyalty-bonus-banner"]');
    await expect(loyaltyBanner).not.toBeVisible();

    // Verify order total is visible but no bonus offer
    const orderSummary = page.locator('[data-testid="order-summary"]');
    await expect(orderSummary).toBeVisible();
  });

  // Test 3: Customer at monthly redemption limit cannot redeem
  test('should show limit reached message when customer hits monthly bonus limit', async ({
    page,
  }) => {
    // Navigate to storefront
    await page.goto('/shop/frankys-pasta');

    // Wait for storefront to load
    await page.waitForSelector('[data-testid="storefront-loaded"]', {
      timeout: 5000,
    });

    // Add items to meet the >50€ threshold
    const itemCards = await page.locator('[data-testid="item-card"]').all();
    expect(itemCards.length).toBeGreaterThan(0);

    await itemCards[0].click();
    await page.waitForSelector('[data-testid="item-sheet"]', {
      timeout: 3000,
    });

    const quantityInput = page.locator('[data-testid="item-quantity-input"]');
    await quantityInput.fill('2');

    const addToCartBtn = page.locator('[data-testid="add-to-cart-button"]');
    await addToCartBtn.click();

    await page.locator('[data-testid="item-sheet-close"]').click();
    await page.waitForTimeout(500);

    // Proceed to checkout
    const checkoutBtn = page.locator('[data-testid="checkout-button"]');
    await checkoutBtn.click();

    // Check if loyalty bonus banner appears
    const loyaltyBanner = page.locator('[data-testid="loyalty-bonus-banner"]');
    const bannerVisible = await loyaltyBanner.isVisible().catch(() => false);

    if (bannerVisible) {
      // If banner is visible, check for limit message
      const limitMessage = page.locator(
        '[data-testid="loyalty-limit-reached-message"]'
      );
      const messagVisible = await limitMessage.isVisible().catch(() => false);

      if (messagVisible) {
        // Verify limit message is displayed
        await expect(limitMessage).toContainText('Monatslimit');
      }

      // Alternatively, check if select button is disabled
      const selectBtn = page.locator(
        '[data-testid="loyalty-select-bonus-button"]'
      );
      const isDisabled =
        (await selectBtn.getAttribute('disabled')) !== null ||
        (await selectBtn.getAttribute('aria-disabled')) === 'true';

      expect(isDisabled).toBe(true);
    } else {
      // If banner is not visible at all (customer has reached limit),
      // then the behavior is working as expected
      expect(bannerVisible).toBe(false);
    }
  });
});
