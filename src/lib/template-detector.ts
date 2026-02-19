export type JsonValue = string | number | boolean | null | JsonObject | JsonArray;
export type JsonObject = { [key: string]: JsonValue };
export type JsonArray = JsonValue[];

export interface FieldSchema {
  type: string;
  required: boolean;
}

export interface Template {
  fields: Record<string, FieldSchema>;
  sampleSize: number;
}

export interface Violation {
  index: number;
  path: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  isValid: boolean;
  violations: Violation[];
}

function isObject(val: unknown): val is JsonObject {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isArray(val: unknown): val is JsonArray {
  return Array.isArray(val);
}

function getValueType(val: JsonValue): string {
  if (val === null) return "null";
  if (isArray(val)) return "array";
  if (isObject(val)) return "object";
  return typeof val;
}

function getAllKeys(objects: JsonObject[]): Set<string> {
  const keys = new Set<string>();
  for (const obj of objects) {
    for (const key of Object.keys(obj)) {
      keys.add(key);
    }
  }
  return keys;
}

export function detectTemplate(data: unknown): Template | null {
  if (!isArray(data)) {
    return null;
  }

  const objects = data.filter(isObject);

  if (objects.length === 0) {
    return null;
  }

  if (objects.length === 1) {
    const fields: Record<string, FieldSchema> = {};
    for (const [key, value] of Object.entries(objects[0])) {
      fields[key] = {
        type: getValueType(value),
        required: true,
      };
    }
    return { fields, sampleSize: 1 };
  }

  const keys = getAllKeys(objects);
  const fields: Record<string, FieldSchema> = {};

  for (const key of keys) {
    const valuesForKey = objects
      .map(obj => obj[key])
      .filter(val => val !== undefined);

    if (valuesForKey.length === 0) {
      continue;
    }

    const types = new Set(valuesForKey.map(getValueType));
    
    if (types.size > 1) {
      continue;
    }

    const presentCount = objects.filter(obj => key in obj).length;
    const required = presentCount === objects.length;

    fields[key] = {
      type: Array.from(types)[0],
      required,
    };
  }

  if (Object.keys(fields).length === 0) {
    return null;
  }

  return { fields, sampleSize: objects.length };
}

export function validateAgainstTemplate(data: unknown, template: Template): ValidationResult {
  const violations: Violation[] = [];

  if (!isArray(data)) {
    return { isValid: true, violations: [] };
  }

  for (let i = 0; i < data.length; i++) {
    const entry = data[i];

    if (!isObject(entry)) {
      violations.push({
        index: i,
        path: "",
        message: `Entry ${i} is not an object`,
        severity: "error",
      });
      continue;
    }

    for (const [key, schema] of Object.entries(template.fields)) {
      const value = (entry as JsonObject)[key];

      if (schema.required && value === undefined) {
        violations.push({
          index: i,
          path: key,
          message: `Missing required field "${key}"`,
          severity: "error",
        });
        continue;
      }

      if (value !== undefined) {
        const actualType = getValueType(value);
        if (actualType !== schema.type) {
          violations.push({
            index: i,
            path: key,
            message: `Field "${key}" has type ${actualType}, expected ${schema.type}`,
            severity: "error",
          });
        }
      }
    }

    const entryKeys = new Set(Object.keys(entry));
    const templateKeys = new Set(Object.keys(template.fields));

    for (const key of entryKeys) {
      if (!templateKeys.has(key)) {
        violations.push({
          index: i,
          path: key,
          message: `Unexpected field "${key}" not in template`,
          severity: "warning",
        });
      }
    }
  }

  return {
    isValid: violations.length === 0,
    violations,
  };
}

export function getViolationsByEntry(result: ValidationResult): Map<number, Violation[]> {
  const byEntry = new Map<number, Violation[]>();
  
  for (const violation of result.violations) {
    const existing = byEntry.get(violation.index) || [];
    existing.push(violation);
    byEntry.set(violation.index, existing);
  }
  
  return byEntry;
}
