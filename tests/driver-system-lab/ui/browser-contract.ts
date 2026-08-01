export type UiSelector =
  | { by: 'role'; role: string; name: string }
  | { by: 'label'; label: string }
  | { by: 'testId'; testId: string }

export interface UiLocator {
  click(): Promise<void>
  fill(value: string): Promise<void>
  isVisible(): Promise<boolean>
  count(): Promise<number>
  textContent(): Promise<string | null>
}

export interface BrowserPage {
  goto(url: string): Promise<unknown>
  getByRole(role: string, options: { name: string | RegExp; exact?: boolean }): UiLocator
  getByLabel(label: string, options?: { exact?: boolean }): UiLocator
  getByTestId(testId: string): UiLocator
  screenshot(options: { path: string; fullPage: boolean }): Promise<unknown>
  content(): Promise<string>
}

export interface BrowserContextControl {
  tracing?: {
    start(options: { screenshots: boolean; snapshots: boolean; sources: boolean }): Promise<void>
    stop(options: { path: string }): Promise<void>
  }
}

export interface UiEvidenceSink {
  ensureDirectory(path: string): Promise<void>
  writeText(path: string, value: string): Promise<void>
}

export interface ServerSnapshotProbe {
  readSnapshot(checkpoint: string): Promise<Readonly<Record<string, unknown>>>
}

export function locate(page: BrowserPage, selector: UiSelector): UiLocator {
  switch (selector.by) {
    case 'role':
      return page.getByRole(selector.role, { name: selector.name, exact: true })
    case 'label':
      return page.getByLabel(selector.label, { exact: true })
    case 'testId':
      return page.getByTestId(selector.testId)
  }
}

