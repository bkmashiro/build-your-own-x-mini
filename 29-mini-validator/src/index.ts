type Class<T = object> = new (...args: any[]) => T;

export interface ValidationError {
  path: string;
  property: string;
  code: string;
  message: string;
  value: unknown;
  expected?: unknown;
}

export interface ValidationContext {
  path: string;
  property: string;
  value: unknown;
  object: Record<string, unknown>;
  root: unknown;
}

interface ValidationRule {
  type: "rule" | "nested";
  code: string;
  expected?: unknown;
  validate?: (value: unknown, context: ValidationContext) => boolean;
  message: string | ((context: ValidationContext, expected?: unknown) => string);
  target?: () => Class;
}

const metadata = new WeakMap<Class, Map<string, ValidationRule[]>>();

function ensureRules(target: object, propertyKey: string | symbol): ValidationRule[] {
  const ctor = target.constructor as Class;
  let properties = metadata.get(ctor);
  if (!properties) {
    properties = new Map<string, ValidationRule[]>();
    metadata.set(ctor, properties);
  }

  const key = String(propertyKey);
  let rules = properties.get(key);
  if (!rules) {
    rules = [];
    properties.set(key, rules);
  }

  return rules;
}

function addRule(target: object, propertyKey: string | symbol, rule: ValidationRule): void {
  ensureRules(target, propertyKey).push(rule);
}

function formatMessage(rule: ValidationRule, context: ValidationContext): string {
  if (typeof rule.message === "function") {
    return rule.message(context, rule.expected);
  }
  return rule.message;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function joinPath(basePath: string, property: string): string {
  return basePath ? `${basePath}.${property}` : property;
}

function getRules(ctor: Class): Map<string, ValidationRule[]> {
  return metadata.get(ctor) ?? new Map<string, ValidationRule[]>();
}

function validateAgainstType(
  value: unknown,
  ctor: Class,
  basePath: string,
  root: unknown,
): ValidationError[] {
  if (!isRecord(value)) {
    return [];
  }

  const errors: ValidationError[] = [];
  const rulesByProperty = getRules(ctor);

  for (const [property, rules] of rulesByProperty.entries()) {
    const currentValue = value[property];
    const propertyPath = joinPath(basePath, property);
    const context: ValidationContext = {
      path: propertyPath,
      property,
      value: currentValue,
      object: value,
      root,
    };

    for (const rule of rules) {
      if (rule.type === "nested") {
        if (currentValue === undefined || currentValue === null) {
          continue;
        }
        const nestedCtor = rule.target?.();
        if (!nestedCtor) {
          continue;
        }
        errors.push(...validateAgainstType(currentValue, nestedCtor, propertyPath, root));
        continue;
      }

      if (!rule.validate?.(currentValue, context)) {
        errors.push({
          path: propertyPath,
          property,
          code: rule.code,
          message: formatMessage(rule, context),
          value: currentValue,
          expected: rule.expected,
        });
      }
    }
  }

  return errors;
}

export function validate<T extends object>(value: T): ValidationError[] {
  if (!isRecord(value)) {
    return [
      {
        path: "",
        property: "",
        code: "invalid_object",
        message: "Value must be an object instance",
        value,
      },
    ];
  }

  return validateAgainstType(value, value.constructor as Class, "", value);
}

function createDecorator(rule: Omit<ValidationRule, "type">): PropertyDecorator {
  return (target, propertyKey) => {
    addRule(target, propertyKey, { ...rule, type: "rule" });
  };
}

export function IsString(): PropertyDecorator {
  return createDecorator({
    code: "is_string",
    expected: "string",
    validate: (value) => typeof value === "string",
    message: ({ path }) => `${path} must be a string`,
  });
}

export function IsNumber(): PropertyDecorator {
  return createDecorator({
    code: "is_number",
    expected: "number",
    validate: (value) => typeof value === "number" && Number.isFinite(value),
    message: ({ path }) => `${path} must be a finite number`,
  });
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function IsEmail(): PropertyDecorator {
  return createDecorator({
    code: "is_email",
    expected: "email",
    validate: (value) => typeof value === "string" && EMAIL_RE.test(value),
    message: ({ path }) => `${path} must be a valid email address`,
  });
}

export function Min(min: number): PropertyDecorator {
  return createDecorator({
    code: "min",
    expected: min,
    validate: (value) => typeof value === "number" && Number.isFinite(value) && value >= min,
    message: ({ path }) => `${path} must be greater than or equal to ${min}`,
  });
}

export function Max(max: number): PropertyDecorator {
  return createDecorator({
    code: "max",
    expected: max,
    validate: (value) => typeof value === "number" && Number.isFinite(value) && value <= max,
    message: ({ path }) => `${path} must be less than or equal to ${max}`,
  });
}

export function ValidateNested(target: () => Class): PropertyDecorator {
  return (prototype, propertyKey) => {
    addRule(prototype, propertyKey, {
      type: "nested",
      code: "nested",
      message: "",
      target,
    });
  };
}

export interface CustomValidatorOptions {
  name: string;
  validate: (value: unknown, context: ValidationContext) => boolean;
  message?: string | ((context: ValidationContext) => string);
  expected?: unknown;
}

export function ValidateBy(options: CustomValidatorOptions): PropertyDecorator {
  return createDecorator({
    code: options.name,
    expected: options.expected,
    validate: options.validate,
    message: options.message ?? (({ path }) => `${path} failed ${options.name} validation`),
  });
}
