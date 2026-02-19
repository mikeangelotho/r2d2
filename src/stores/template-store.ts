import { createSignal, createMemo } from "solid-js";
import {
  detectTemplate,
  validateAgainstTemplate,
  type Template,
  type ValidationResult,
  type JsonValue,
} from "~/lib/template-detector";

export type BlockMode = "warn" | "block";

const [currentTemplate, setCurrentTemplate] = createSignal<Template | null>(
  null,
);
const [validationResult, setValidationResult] = createSignal<ValidationResult>({
  isValid: true,
  violations: [],
});
const [blockMode, setBlockMode] = createSignal<BlockMode>("warn");
const [templateDetected, setTemplateDetected] = createSignal(false);

export function detectAndValidate(data: JsonValue): void {
  const template = detectTemplate(data);

  if (template) {
    setCurrentTemplate(template);
    const result = validateAgainstTemplate(data, template);
    setValidationResult(result);
    setTemplateDetected(true);
  } else {
    setCurrentTemplate(null);
    setValidationResult({ isValid: true, violations: [] });
    setTemplateDetected(false);
  }
}

export function clearTemplateState(): void {
  setCurrentTemplate(null);
  setValidationResult({ isValid: true, violations: [] });
  setTemplateDetected(false);
}

export function validateData(data: JsonValue): ValidationResult {
  const template = currentTemplate();
  if (!template) {
    return { isValid: true, violations: [] };
  }
  return validateAgainstTemplate(data, template);
}

export function canSave(): boolean {
  if (blockMode() === "warn") {
    return true;
  }
  return validationResult().isValid;
}

export const templateStore = {
  get template() {
    return currentTemplate();
  },
  validationResult() {
    return validationResult();
  },
  blockMode() {
    return blockMode();
  },
  setBlockMode,
  templateDetected() {
    return templateDetected();
  },
  errorCount() {
    return validationResult().violations.filter((v) => v.severity === "error")
      .length;
  },
  warningCount() {
    return validationResult().violations.filter((v) => v.severity === "warning")
      .length;
  },
  canSave() {
    if (blockMode() === "warn") {
      return true;
    }
    return validationResult().isValid;
  },
};
