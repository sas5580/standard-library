import {
  type StreamDocument,
  type TranslatableString,
} from "@yext/visual-editor";

export type FormField = {
  type:
    | "preferredContactMethod"
    | "firstName"
    | "lastName"
    | "phone"
    | "email"
    | "message"
    | "phoneOptIn"
    | "text"
    | "dropdown"
    | "checkboxGroup";
  label: TranslatableString;
  key?: string;
  required?: boolean;
  options?: { label: TranslatableString; value: string }[];
};

/** Check that the editor setup can supply every field required by the API. */
export function hasInvalidConfiguration(
  data: {
    fields: FormField[];
    showPreferredContactMethod: boolean;
    defaultContactMethod: "PHONE" | "EMAIL";
  },
  streamDocument: StreamDocument
): boolean {
  const fields = data.fields ?? [];
  const configuredTypes = fields.map((field) => field.type);
  const missingRequiredFields =
    !configuredTypes.includes("firstName") ||
    !configuredTypes.includes("lastName");
  const missingContactFields =
    (data.showPreferredContactMethod &&
      !configuredTypes.includes("preferredContactMethod")) ||
    !configuredTypes.includes(
      data.defaultContactMethod === "PHONE" ? "phone" : "email"
    ) ||
    (data.showPreferredContactMethod &&
      (!configuredTypes.includes("phone") ||
        !configuredTypes.includes("email")));
  const invalidOptions = fields.some((field) =>
    field.type === "dropdown" || field.type === "checkboxGroup"
      ? !field.options?.length ||
        field.options.some((option) => !option.value.trim())
      : false
  );
  const customKeys = fields
    .filter((field) =>
      ["text", "dropdown", "checkboxGroup"].includes(field.type)
    )
    .map((field) => field.key?.trim() ?? "");
  const invalidCustomKeys =
    customKeys.some((key) => !key) ||
    new Set(customKeys).size !== customKeys.length;
  const duplicateStandardFields = [
    "firstName",
    "lastName",
    "preferredContactMethod",
    "phone",
    "email",
    "message",
    "phoneOptIn",
  ].some(
    (type) =>
      configuredTypes.filter((configuredType) => configuredType === type)
        .length > 1
  );

  return (
    !streamDocument.id ||
    missingRequiredFields ||
    missingContactFields ||
    invalidOptions ||
    invalidCustomKeys ||
    duplicateStandardFields
  );
}

/**
 * Check entered values and build the API data object.
 * 1. Check required standard and custom values.
 * 2. Add custom values and phone consent.
 * 3. Return the API data, or null when a required value is missing.
 */
export function prepareSubmissionData(
  values: FormData,
  fields: FormField[],
  contactMethod: "PHONE" | "EMAIL"
): {
  first_name: string;
  last_name: string;
  preferred_contact_method: "PHONE" | "EMAIL";
  phone?: string;
  email?: string;
  message?: string;
  relate_opt_in?: boolean;
  custom_data: Record<string, string | string[]>;
} | null {
  // Normalize standard values and check required configured fields.
  const firstName = String(values.get("first_name") ?? "").trim();
  const lastName = String(values.get("last_name") ?? "").trim();
  const phone = String(values.get("phone") ?? "").trim();
  const email = String(values.get("email") ?? "").trim();
  const missingRequiredValue = fields.some(
    (field) =>
      field.required &&
      (field.type === "checkboxGroup"
        ? !values.getAll(`custom_data[${field.key?.trim()}]`).length
        : ["text", "dropdown", "message", "phone", "email"].includes(field.type) &&
          !String(
            values.get(
              field.type === "text" || field.type === "dropdown" ? `custom_data[${field.key?.trim()}]` : field.type
            ) ?? ""
          ).trim())
  );

  // Reject submissions missing names, the selected contact value, or required fields.
  if (
    !firstName ||
    !lastName ||
    !(contactMethod === "PHONE" ? phone : email) ||
    missingRequiredValue
  ) {
    return null;
  }

  // Index configured custom fields by key to preserve their value handling.
  const customFields = new Map(
    fields
      .filter((field) => ["text", "dropdown", "checkboxGroup"].includes(field.type))
      .map((field) => [field.key?.trim(), field])
  );

  // Collect populated custom_data[key] entries, including unconfigured inputs.
  const customValues = new Map<string, string[]>();
  values.forEach((value, name) => {
    const match = /^custom_data\[([^[\]]+)]$/.exec(name);
    if (!match || typeof value !== "string") {
      return;
    }
    const key = match[1];
    const field = customFields.get(key);
    // Trim configured text and dropdown values; preserve other strings verbatim.
    const populatedValue = field && field.type !== "checkboxGroup" ? value.trim() : value;
    if (populatedValue) {
      const entries = customValues.get(key) ?? [];
      entries.push(populatedValue);
      customValues.set(key, entries);
    }
  });

  // Keep checkbox groups and repeated values as arrays; use strings otherwise.
  const customData = Object.fromEntries(
    Array.from(customValues, ([key, entries]) => [
      key,
      customFields.get(key)?.type === "checkboxGroup" || entries.length > 1 ? entries : entries[0],
    ])
  );

  // Build the API payload with populated optional fields and applicable phone consent.
  return {
    first_name: firstName,
    last_name: lastName,
    preferred_contact_method: contactMethod,
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    ...(values.get("message")
      ? { message: String(values.get("message")).trim() }
      : {}),
    ...(fields.some((field) => field.type === "phoneOptIn") &&
    contactMethod === "PHONE"
      ? { relate_opt_in: values.has("relate_opt_in") }
      : {}),
    custom_data: customData,
  };
}
