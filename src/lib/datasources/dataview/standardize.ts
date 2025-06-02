import dayjs from "dayjs";
import type { DataValue, Optional } from "src/lib/dataframe/dataframe";

/**
 * standardizeValues converts a Dataview data structure of values to the common
 * DataValue format. Updated for modern Dataview API compatibility.
 */
export function standardizeValues(
  values: Record<string, any>
): Record<string, Optional<DataValue>> {
  const res: Record<string, Optional<DataValue>> = {};

  Object.keys(values).forEach((field) => {
    const value = values[field];

    if (value === null || value === undefined) {
      return;
    }

    if (Array.isArray(value)) {
      // Handle arrays by standardizing each element
      res[field] = value.map((v) => 
        typeof v === "object" ? standardizeObject(v) : v
      ).filter(v => v !== null && v !== undefined);
    } else if (typeof value === "object") {
      const standardized = standardizeObject(value);
      if (standardized !== null && standardized !== undefined) {
        res[field] = standardized;
      }
    } else {
      res[field] = value;
    }
  });

  return res;
}

function standardizeObject(value: any): any {
  if (!value || typeof value !== "object") {
    return value;
  }

  // Handle Dataview Link objects
  if ("path" in value && typeof value.path === "string") {
    // Modern Dataview links have path, display, and type properties
    return value.display || value.path;
  }

  // Handle Dataview DateTime objects
  if ("ts" in value && typeof value.ts === "number") {
    return dayjs(value.ts).format("YYYY-MM-DD");
  }

  // Handle Duration objects (Dataview duration type)
  if ("values" in value && typeof value.values === "object") {
    // Duration objects have a toString method for display
    return value.toString ? value.toString() : String(value);
  }

  // Handle HTML objects from Dataview
  if ("type" in value && value.type === "html") {
    return value.value || "";
  }

  // For other objects, return as-is or attempt to stringify
  return value;
}
