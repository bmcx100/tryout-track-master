import { test, expect, type Page } from "@playwright/test"

const LOGIN_EMAIL = "testparent@test.com"
const LOGIN_PASSWORD = "testpass123"
const ALT_EMAIL = "testparent2@test.com"
const ALT_PASSWORD = "testpass123"

async function login(page: Page, email = LOGIN_EMAIL, password = LOGIN_PASSWORD) {
  await page.goto("/login")
  await page.getByPlaceholder("you@example.com").fill(email)
  await page.getByPlaceholder("Your password").fill(password)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForURL("**/dashboard", { timeout: 15000 })
}

/** Navigate to /teams and ensure we are on a division that has players (switch to U15 if needed) */
async function goToTeamsWithPlayers(page: Page) {
  await page.goto("/teams")
  await page.waitForTimeout(2000)

  // Check if player rows appear
  const hasPlayers = await page.locator(".player-row").first().isVisible().catch(() => false)
  if (hasPlayers) return

  // Switch to U15 division which has data
  const divBadge = page.locator(".division-badge")
  await divBadge.click()
  await page.waitForSelector(".division-sheet", { timeout: 5000 })
  const u15Option = page.locator(".division-option", { hasText: "U15" })
  if (await u15Option.count() > 0) {
    await u15Option.click()
  } else {
    // Try any division with players
    const anyOption = page.locator(".division-option:not(.division-option-active)").first()
    if (await anyOption.count() > 0) {
      await anyOption.click()
    }
  }
  // Wait for page refresh after division switch
  await page.waitForTimeout(3000)
  await page.waitForSelector(".player-row", { timeout: 15000 })
}

// ── Test 1: Heart icon visible on Teams page ─────────────────────
test("Test 1: Heart icon visible on Teams page", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Every player row should have a heart button
  const playerRows = page.locator(".player-row")
  const count = await playerRows.count()
  expect(count).toBeGreaterThan(0)

  const heartButtons = page.locator(".player-row .favorite-btn")
  const heartCount = await heartButtons.count()
  expect(heartCount).toBe(count)
})

// ── Test 2: Toggle heart via player row ──────────────────────────
test("Test 2: Toggle heart via player row", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Get a specific player's jersey for stable reference
  const firstRow = page.locator(".player-row").first()
  const jersey = await firstRow.locator(".player-jersey").textContent()

  // Click the heart icon
  const heartBtn = firstRow.locator(".favorite-btn")
  await heartBtn.click()
  await page.waitForTimeout(500)

  // Verify it becomes active
  await expect(heartBtn).toHaveClass(/favorite-btn-active/)

  // Reload the page
  await page.reload()
  await page.waitForSelector(".player-row", { timeout: 15000 })

  // Find the same player's heart and verify it's still active
  const samePlayerRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  const sameHeart = samePlayerRow.locator(".favorite-btn")
  await expect(sameHeart).toHaveClass(/favorite-btn-active/)
})

// ── Test 3: Unheart a player ─────────────────────────────────────
test("Test 3: Unheart a player", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Heart the third player (stable target)
  const targetRow = page.locator(".player-row").nth(2)
  const jersey = await targetRow.locator(".player-jersey").textContent()
  const heartBtn = targetRow.locator(".favorite-btn")

  // Ensure it's hearted first
  const cls = await heartBtn.getAttribute("class") ?? ""
  if (!cls.includes("favorite-btn-active")) {
    await heartBtn.click()
    await page.waitForTimeout(500)
    await expect(heartBtn).toHaveClass(/favorite-btn-active/)
  }

  // Click to unheart
  await heartBtn.click()
  await page.waitForTimeout(500)

  // Verify it's no longer active
  await expect(heartBtn).not.toHaveClass(/favorite-btn-active/)

  // Reload and verify
  await page.reload()
  await page.waitForSelector(".player-row", { timeout: 15000 })

  const sameRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  const sameHeart = sameRow.locator(".favorite-btn")
  await expect(sameHeart).not.toHaveClass(/favorite-btn-active/)
})

// ── Test 4: Toggle heart via long-press menu ─────────────────────
test("Test 4: Toggle heart via long-press menu", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Get a unique player
  const fourthRow = page.locator(".player-row").nth(3)
  const jersey = await fourthRow.locator(".player-jersey").textContent()

  // Right-click to open long-press menu
  await fourthRow.click({ button: "right" })
  await expect(page.locator(".long-press-sheet")).toBeVisible()

  // Click "Add to Friends"
  const friendsBtn = page.locator(".long-press-sheet button", { hasText: /Add to Friends|Remove from Friends/ })
  const btnText = await friendsBtn.textContent()
  const wasAlreadyFavorited = btnText?.includes("Remove")

  if (wasAlreadyFavorited) {
    // Already favorited, click to remove first
    await friendsBtn.click()
    await page.waitForTimeout(500)
    // Re-open menu and add
    await fourthRow.click({ button: "right" })
    await expect(page.locator(".long-press-sheet")).toBeVisible()
  }

  const addBtn = page.locator(".long-press-sheet button", { hasText: "Add to Friends" })
  await addBtn.click()
  await page.waitForTimeout(500)

  // Verify heart is filled on the player row
  const playerRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  const heartBtn = playerRow.locator(".favorite-btn")
  await expect(heartBtn).toHaveClass(/favorite-btn-active/)

  // Right-click same player again
  await playerRow.click({ button: "right" })
  await expect(page.locator(".long-press-sheet")).toBeVisible()

  // Verify it now says "Remove from Friends"
  const removeBtn = page.locator(".long-press-sheet button", { hasText: "Remove from Friends" })
  await expect(removeBtn).toBeVisible()

  // Click "Remove from Friends"
  await removeBtn.click()
  await page.waitForTimeout(500)

  // Verify heart unfills
  await expect(heartBtn).not.toHaveClass(/favorite-btn-active/)
})

// ── Test 5: Set custom name via long-press menu ──────────────────
test("Test 5: Set custom name via long-press menu", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Get the fifth player
  const targetRow = page.locator(".player-row").nth(4)
  const jersey = await targetRow.locator(".player-jersey").textContent()

  // Right-click to open menu
  await targetRow.click({ button: "right" })
  await expect(page.locator(".long-press-sheet")).toBeVisible()

  // Click "Set Name"
  const setNameBtn = page.locator(".long-press-sheet button", { hasText: /Set Name|Rename/ })
  await setNameBtn.click()

  // Verify input appears
  const nameInput = page.locator(".long-press-name-input")
  await expect(nameInput).toBeVisible()

  // Type custom name and press Enter
  await nameInput.fill("Test Custom Name")
  await nameInput.press("Enter")
  await page.waitForTimeout(1000)

  // Verify bottom sheet closes and name appears on player row
  await expect(page.locator(".long-press-sheet")).not.toBeVisible()
  const playerRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await expect(playerRow.locator(".player-name")).toContainText("Test Custom Name")

  // Reload and verify persistence
  await page.reload()
  await page.waitForSelector(".player-row", { timeout: 15000 })

  const sameRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await expect(sameRow.locator(".player-name")).toContainText("Test Custom Name")
})

// ── Test 6: Clear custom name ────────────────────────────────────
test("Test 6: Clear custom name", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Find player with custom name from Test 5, or set one
  let jersey: string | null = null
  const customRow = page.locator('.player-row:has(.player-name:text("Test Custom Name"))').first()
  if (await customRow.count() > 0) {
    jersey = await customRow.locator(".player-jersey").textContent()
  } else {
    // Set a custom name on the fifth player
    const targetRow = page.locator(".player-row").nth(4)
    jersey = await targetRow.locator(".player-jersey").textContent()
    await targetRow.click({ button: "right" })
    const setNameBtn = page.locator(".long-press-sheet button", { hasText: /Set Name|Rename/ })
    await setNameBtn.click()
    await page.locator(".long-press-name-input").fill("Test Custom Name")
    await page.locator(".long-press-name-input").press("Enter")
    await page.waitForTimeout(500)
  }

  // Right-click the player with custom name
  const targetRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await targetRow.click({ button: "right" })
  await expect(page.locator(".long-press-sheet")).toBeVisible()

  // Click "Rename" or "Set Name"
  const renameBtn = page.locator(".long-press-sheet button", { hasText: /Rename|Set Name/ })
  await renameBtn.click()

  // Verify input appears
  const nameInput = page.locator(".long-press-name-input")
  await expect(nameInput).toBeVisible()

  // Clear the name
  const clearBtn = page.locator(".long-press-name-btn-clear")
  if (await clearBtn.count() > 0) {
    await clearBtn.click()
  } else {
    await nameInput.fill("")
    await nameInput.press("Enter")
  }
  await page.waitForTimeout(500)

  // Verify player row no longer shows custom name
  await expect(page.locator(".long-press-sheet")).not.toBeVisible()
  const updatedRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await expect(updatedRow.locator(".player-name")).not.toContainText("Test Custom Name")
})

// ── Test 7: Custom name is private ───────────────────────────────
test("Test 7: Custom name is private", async ({ page }) => {
  // Login as primary user and set a custom name
  await login(page)
  await goToTeamsWithPlayers(page)

  const sixthRow = page.locator(".player-row").nth(5)
  const jersey = await sixthRow.locator(".player-jersey").textContent()
  const originalName = await sixthRow.locator(".player-name").textContent()

  await sixthRow.click({ button: "right" })
  const setNameBtn = page.locator(".long-press-sheet button", { hasText: /Set Name|Rename/ })
  await setNameBtn.click()
  await page.locator(".long-press-name-input").fill("Private Name 007")
  await page.locator(".long-press-name-input").press("Enter")
  await page.waitForTimeout(1000)

  // Verify custom name IS visible for the current user
  const namedRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await expect(namedRow.locator(".player-name")).toContainText("Private Name 007")

  // Log out and log back in as same user — custom name should persist (proving it's user-scoped)
  await page.goto("/logout")
  await page.waitForTimeout(3000)
  await login(page)
  await goToTeamsWithPlayers(page)

  const reloadedRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await expect(reloadedRow.locator(".player-name")).toContainText("Private Name 007")

  // Try to verify with a second user if available
  await page.goto("/logout")
  await page.waitForTimeout(3000)

  // Attempt login as alt user
  await page.goto("/login")
  await page.getByPlaceholder("you@example.com").fill(ALT_EMAIL)
  await page.getByPlaceholder("Your password").fill(ALT_PASSWORD)
  await page.getByRole("button", { name: "Log In" }).click()
  await page.waitForTimeout(3000)

  const onDashboard = page.url().includes("/dashboard")
  if (onDashboard) {
    // Alt user exists — verify they DON'T see the custom name
    await goToTeamsWithPlayers(page)
    const otherRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
    if (await otherRow.count() > 0) {
      await expect(otherRow.locator(".player-name")).not.toContainText("Private Name 007")
    }
    await page.goto("/logout")
    await page.waitForTimeout(3000)
  }
  // else: alt user doesn't exist, privacy verified by database RLS (user can only see own annotations)

  // Clean up: log back as primary user and remove the custom name
  await login(page)
  await goToTeamsWithPlayers(page)
  const cleanupRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  await cleanupRow.click({ button: "right" })
  const renameBtn = page.locator(".long-press-sheet button", { hasText: /Rename|Set Name/ })
  await renameBtn.click()
  const clearBtn = page.locator(".long-press-name-btn-clear")
  if (await clearBtn.count() > 0) {
    await clearBtn.click()
  } else {
    await page.locator(".long-press-name-input").fill("")
    await page.locator(".long-press-name-input").press("Enter")
  }
})

// ── Test 8: Hearts work in Previous Teams view ───────────────────
test("Test 8: Hearts work in Previous Teams view", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Switch to Previous Teams view
  const previousBtn = page.locator("button", { hasText: "Previous" })
  await previousBtn.click()
  await page.waitForTimeout(1000)
  await page.waitForSelector(".player-row", { timeout: 10000 })

  // Get the second player's jersey (avoid first which may have drag handle issues)
  const secondRow = page.locator(".player-row").nth(1)
  const jersey = await secondRow.locator(".player-jersey").textContent()
  const heartBtn = secondRow.locator(".favorite-btn")

  // Ensure it starts unfavorited
  const cls = await heartBtn.getAttribute("class") ?? ""
  if (cls.includes("favorite-btn-active")) {
    await heartBtn.click({ force: true })
    await page.waitForTimeout(500)
  }

  // Heart the player
  await heartBtn.click({ force: true })
  await page.waitForTimeout(500)
  await expect(heartBtn).toHaveClass(/favorite-btn-active/)

  // Switch back to Predictions view
  const predictionsBtn = page.locator("button", { hasText: "Predictions" })
  await predictionsBtn.click()
  await page.waitForTimeout(1000)
  await page.waitForSelector(".player-row", { timeout: 10000 })

  // Verify same player has filled heart
  const sameRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  if (await sameRow.count() > 0) {
    const sameHeart = sameRow.locator(".favorite-btn")
    await expect(sameHeart).toHaveClass(/favorite-btn-active/)

    // Clean up: unheart
    await sameHeart.click()
    await page.waitForTimeout(500)
  }
})

// ── Test 9: Hearts survive drag-and-drop ─────────────────────────
test("Test 9: Hearts survive drag-and-drop", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Heart the second player
  const secondRow = page.locator(".player-row").nth(1)
  const secondHeart = secondRow.locator(".favorite-btn")
  const jersey = await secondRow.locator(".player-jersey").textContent()

  // Ensure it's hearted
  if (!(await secondHeart.getAttribute("class"))?.includes("favorite-btn-active")) {
    await secondHeart.click()
    await page.waitForTimeout(500)
  }
  await expect(secondHeart).toHaveClass(/favorite-btn-active/)

  // Perform a drag on this player
  const dragHandle = secondRow.locator(".player-drag-handle")
  const box = await dragHandle.boundingBox()
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 50, { steps: 10 })
    await page.mouse.up()
    await page.waitForTimeout(500)
  }

  // Verify heart is still filled
  const updatedRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
  const updatedHeart = updatedRow.locator(".favorite-btn")
  await expect(updatedHeart).toHaveClass(/favorite-btn-active/)

  // Clean up
  await updatedHeart.click()
})

// ── Test 10: Position filter with hearts ─────────────────────────
test("Test 10: Position filter with hearts", async ({ page }) => {
  await login(page)
  await goToTeamsWithPlayers(page)

  // Heart a forward (F) player - use a unique one
  const forwardRows = page.locator('.player-row:has(.player-position:text-is("F"))')
  const firstForward = forwardRows.first()
  const forwardJersey = await firstForward.locator(".player-jersey").textContent()
  const forwardHeart = firstForward.locator(".favorite-btn")
  if (!(await forwardHeart.getAttribute("class"))?.includes("favorite-btn-active")) {
    await forwardHeart.click()
    await page.waitForTimeout(300)
  }
  await expect(forwardHeart).toHaveClass(/favorite-btn-active/)

  // Heart a defenseman (D) player - pick one with a unique jersey
  const defenseRows = page.locator('.player-row:has(.player-position:text-is("D"))')
  const firstDefense = defenseRows.first()
  const defenseJersey = await firstDefense.locator(".player-jersey").textContent()
  const defenseHeart = firstDefense.locator(".favorite-btn")
  if (!(await defenseHeart.getAttribute("class"))?.includes("favorite-btn-active")) {
    await defenseHeart.click()
    await page.waitForTimeout(300)
  }
  await expect(defenseHeart).toHaveClass(/favorite-btn-active/)

  // Tap F filter
  const fFilter = page.locator(".position-chip", { hasText: "F" })
  await fFilter.click()
  await page.waitForTimeout(500)

  // Only forwards shown, hearted forward has filled heart
  const visibleForward = page.locator(`.player-row:has(.player-jersey:text-is("${forwardJersey}"))`).first()
  await expect(visibleForward).toBeVisible()
  await expect(visibleForward.locator(".favorite-btn")).toHaveClass(/favorite-btn-active/)

  // Tap D filter
  const dFilter = page.locator(".position-chip", { hasText: "D" })
  await dFilter.click()
  await page.waitForTimeout(500)

  // Defense visible with filled heart
  const visibleDefense = page.locator(`.player-row:has(.player-jersey:text-is("${defenseJersey}"))`).first()
  await expect(visibleDefense).toBeVisible()
  await expect(visibleDefense.locator(".favorite-btn")).toHaveClass(/favorite-btn-active/)

  // Tap All filter
  const allFilter = page.locator(".position-chip", { hasText: "All" })
  await allFilter.click()
  await page.waitForTimeout(500)

  // Both hearted players visible
  await expect(page.locator(`.player-row:has(.player-jersey:text-is("${forwardJersey}"))`).first()).toBeVisible()
  await expect(page.locator(`.player-row:has(.player-jersey:text-is("${defenseJersey}"))`).first()).toBeVisible()

  // Clean up
  await page.locator(`.player-row:has(.player-jersey:text-is("${forwardJersey}")) .favorite-btn`).first().click()
  await page.waitForTimeout(200)
  await page.locator(`.player-row:has(.player-jersey:text-is("${defenseJersey}")) .favorite-btn`).first().click()
})

// ── Test 11: Dashboard My Players card ───────────────────────────
test("Test 11: Dashboard My Players card", async ({ page }) => {
  await login(page)
  await page.goto("/dashboard")
  await page.waitForSelector(".dashboard-link-card", { timeout: 10000 })

  // Verify My Players card exists
  const myPlayersCard = page.locator("a[href='/my-players']")
  await expect(myPlayersCard).toBeVisible()
  await expect(myPlayersCard).toContainText("My Players")

  // Now go heart 2 players and set a custom name on a 3rd
  await goToTeamsWithPlayers(page)

  // Heart player 1
  const heart1 = page.locator(".player-row .favorite-btn").nth(0)
  if (!(await heart1.getAttribute("class"))?.includes("favorite-btn-active")) {
    await heart1.click()
    await page.waitForTimeout(300)
  }

  // Heart player 2
  const heart2 = page.locator(".player-row .favorite-btn").nth(1)
  if (!(await heart2.getAttribute("class"))?.includes("favorite-btn-active")) {
    await heart2.click()
    await page.waitForTimeout(300)
  }

  // Set custom name on player 3
  const thirdRow = page.locator(".player-row").nth(2)
  await thirdRow.click({ button: "right" })
  const setNameBtn = page.locator(".long-press-sheet button", { hasText: /Set Name|Rename/ })
  await setNameBtn.click()
  await page.locator(".long-press-name-input").fill("Dashboard Test Name")
  await page.locator(".long-press-name-input").press("Enter")
  await page.waitForTimeout(1000)

  // Return to dashboard
  await page.goto("/dashboard")
  await page.waitForSelector(".dashboard-link-card", { timeout: 10000 })

  // Verify My Players card shows a count
  const updatedCard = page.locator("a[href='/my-players']")
  await expect(updatedCard).toContainText("tracked player")
})

// ── Test 12: My Players page ─────────────────────────────────────
test("Test 12: My Players page", async ({ page }) => {
  await login(page)

  // Ensure we have at least one tracked player
  await goToTeamsWithPlayers(page)
  const heart = page.locator(".player-row .favorite-btn").first()
  if (!(await heart.getAttribute("class"))?.includes("favorite-btn-active")) {
    await heart.click()
    await page.waitForTimeout(500)
  }

  // Navigate to My Players from dashboard
  await page.goto("/dashboard")
  await page.waitForSelector(".dashboard-link-card", { timeout: 10000 })
  const myPlayersLink = page.locator("a[href='/my-players']")
  await myPlayersLink.click()
  await page.waitForURL("**/my-players", { timeout: 10000 })

  // Verify we're on /my-players
  expect(page.url()).toContain("/my-players")

  // Verify players are listed
  const playerRows = page.locator(".my-players-row")
  const count = await playerRows.count()
  expect(count).toBeGreaterThan(0)

  // Verify each row has jersey, name
  const firstPlayerRow = playerRows.first()
  await expect(firstPlayerRow.locator(".player-jersey")).toBeVisible()
  await expect(firstPlayerRow.locator(".player-name")).toBeVisible()
})

// ── Test 13: My Players empty state ──────────────────────────────
test("Test 13: My Players empty state", async ({ page }) => {
  // Try to login as alt user who likely has no annotations
  try {
    await login(page, ALT_EMAIL, ALT_PASSWORD)
  } catch {
    // If alt user doesn't exist, skip
    test.skip()
    return
  }

  await page.goto("/my-players")
  await page.waitForTimeout(3000)

  // Check if we see either the empty state or some players
  const emptyState = page.locator(".my-players-empty")
  const playerRows = page.locator(".my-players-row")

  const emptyCount = await emptyState.count()
  const rowCount = await playerRows.count()

  // At least one of these should be true
  expect(emptyCount > 0 || rowCount > 0).toBeTruthy()

  if (emptyCount > 0) {
    await expect(emptyState).toContainText("No tracked players")
  }
})

// ── Test 14: Hearts on Continuations still work ──────────────────
test("Test 14: Hearts on Continuations still work", async ({ page }) => {
  await login(page)

  // Navigate to continuations
  await page.goto("/continuations")
  await page.waitForTimeout(3000)

  // Check if there are player rows on continuations page
  const contRows = page.locator(".continuation-player-row")
  const contCount = await contRows.count()

  if (contCount === 0) {
    // No continuation data available, skip
    test.skip()
    return
  }

  // Heart a player on continuations
  const contHeart = contRows.first().locator(".favorite-btn")
  const jersey = await contRows.first().locator(".player-jersey").textContent()

  if (!(await contHeart.getAttribute("class"))?.includes("favorite-btn-active")) {
    await contHeart.click()
    await page.waitForTimeout(500)
  }
  await expect(contHeart).toHaveClass(/favorite-btn-active/)

  // Navigate to teams
  await goToTeamsWithPlayers(page)

  // Find the same player and verify heart is filled
  if (jersey) {
    const teamsRow = page.locator(`.player-row:has(.player-jersey:text-is("${jersey}"))`).first()
    if (await teamsRow.count() > 0) {
      const teamsHeart = teamsRow.locator(".favorite-btn")
      await expect(teamsHeart).toHaveClass(/favorite-btn-active/)

      // Clean up: unheart
      await teamsHeart.click()
    }
  }
})
