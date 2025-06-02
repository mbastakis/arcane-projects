import { derived } from "svelte/store";

import { app } from "./obsidian";

// Check if Dataview plugin is enabled and has a valid API
export function isDataviewPluginEnabled(app: any): boolean {
  try {
    // Check if the dataview plugin is loaded and has API
    const dataviewPlugin = app?.plugins?.plugins?.['dataview'] as any;
    return !!dataviewPlugin?.api;
  } catch {
    return false;
  }
}

export const capabilities = derived(app, ($app) => {
  return {
    dataview: isDataviewPluginEnabled($app),
  };
});
