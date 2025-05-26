import { Browser, chromium } from "@playwright/test";


// Create a singleton instance of the browser and reuse across the application
// We can choose to implement a more sophisticated browser management system later, e.g browser pool,
// but for now, this will suffice to avoid launching multiple browser instances unnecessarily.
let browserInstance: Browser | null = null;

export async function getBrowserInstance(): Promise<Browser> {
    if (!browserInstance) {
        browserInstance = await chromium.launch();
    }
    return browserInstance;
}

export async function closeBrowserInstance() {
    if (browserInstance) {
        await browserInstance.close();
        browserInstance = null;
    }
}
