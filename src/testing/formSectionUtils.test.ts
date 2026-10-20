import { describe, expect, it } from "vitest";
import {
  type FormField,
  hasInvalidConfiguration,
  prepareSubmissionData,
} from "../library/shared/sectionSupport/form/formSectionUtils.ts";

describe("hasInvalidConfiguration", () => {
  it.each([
    {
      name: "all required fields and the entity exist",
      entityId: "location-1",
      fields: [
        { type: "preferredContactMethod", label: "Contact method" },
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        { type: "email", label: "Email" },
      ] as FormField[],
      expected: false,
    },
    {
      name: "the entity is missing",
      entityId: "",
      fields: [
        { type: "preferredContactMethod", label: "Contact method" },
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        { type: "email", label: "Email" },
      ] as FormField[],
      expected: true,
    },
    {
      name: "an offered contact method lacks its field",
      entityId: "location-1",
      fields: [
        { type: "preferredContactMethod", label: "Contact method" },
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
      ] as FormField[],
      expected: true,
    },
    {
      name: "a custom website key is configured",
      entityId: "location-1",
      fields: [
        { type: "preferredContactMethod", label: "Contact method" },
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        { type: "email", label: "Email" },
        { type: "text", label: "Website", key: "website_url" },
      ] as FormField[],
      expected: false,
    },
    {
      name: "a dropdown has no choices",
      entityId: "location-1",
      fields: [
        { type: "preferredContactMethod", label: "Contact method" },
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        { type: "email", label: "Email" },
        { type: "dropdown", label: "Time", key: "time", options: [] },
      ] as FormField[],
      expected: true,
    },
  ])(
    "when $name, then the setup result is $expected",
    ({ entityId, fields, expected }) => {
      expect(
        hasInvalidConfiguration(
          {
            fields,
            showPreferredContactMethod: true,
            defaultContactMethod: "PHONE",
          },
          { id: entityId }
        )
      ).toBe(expected);
    }
  );
});

describe("prepareSubmissionData", () => {
  it("when phone is preferred, then it maps every API field", () => {
    const values = new FormData();
    values.set("first_name", " Ada ");
    values.set("last_name", " Lovelace ");
    values.set("phone", " 5555555555 ");
    values.set("email", " ada@example.com ");
    values.set("message", " Hello ");
    values.set("relate_opt_in", "on");
    values.set("custom_data[website_url]", "");
    values.set("custom_data[role]", "  Agent  ");
    values.set("custom_data[time]", "morning");
    values.append("custom_data[reasons]", "home");
    values.append("custom_data[reasons]", "savings");

    expect(
      prepareSubmissionData(
        values,
        [
          { type: "firstName", label: "First name" },
          { type: "lastName", label: "Last name" },
          { type: "phone", label: "Phone" },
          { type: "email", label: "Email" },
          { type: "message", label: "Message" },
          { type: "phoneOptIn", label: "Consent" },
          { type: "text", label: "Role", key: " role " },
          {
            type: "dropdown",
            label: "Time",
            key: "time",
            options: [{ label: "Morning", value: "morning" }],
          },
          {
            type: "checkboxGroup",
            label: "Reasons",
            key: "reasons",
            options: [
              { label: "Home", value: "home" },
              { label: "Savings", value: "savings" },
            ],
          },
        ],
        "PHONE"
      )
    ).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      preferred_contact_method: "PHONE",
      phone: "5555555555",
      email: "ada@example.com",
      message: "Hello",
      relate_opt_in: true,
      custom_data: {
        role: "Agent",
        time: "morning",
        reasons: ["home", "savings"],
      },
    });
  });

  it("when email is preferred, then it omits phone consent", () => {
    const values = new FormData();
    values.set("first_name", "Ada");
    values.set("last_name", "Lovelace");
    values.set("email", "ada@example.com");
    values.set("relate_opt_in", "on");

    expect(
      prepareSubmissionData(
        values,
        [
          { type: "firstName", label: "First name" },
          { type: "lastName", label: "Last name" },
          { type: "email", label: "Email" },
          { type: "phoneOptIn", label: "Consent" },
        ],
        "EMAIL"
      )
    ).toEqual({
      first_name: "Ada",
      last_name: "Lovelace",
      preferred_contact_method: "EMAIL",
      email: "ada@example.com",
      custom_data: {},
    });
  });

  it.each([
    { name: "raw injected text", type: undefined, entries: ["  injected  "], expected: "  injected  " },
    { name: "injected whitespace", type: undefined, entries: ["   "], expected: "   " },
    { name: "empty injected values", type: undefined, entries: ["", ""], expected: undefined },
    { name: "one populated injected value", type: undefined, entries: ["", "one", ""], expected: "one" },
    { name: "repeated injected values", type: undefined, entries: ["one", "", " two "], expected: ["one", " two "] },
    { name: "empty configured text", type: "text", entries: ["   "], expected: undefined },
    { name: "trimmed dropdown", type: "dropdown", entries: [" morning "], expected: "morning" },
    { name: "empty dropdown", type: "dropdown", entries: ["   "], expected: undefined },
    { name: "one checkbox selection", type: "checkboxGroup", entries: ["home"], expected: ["home"] },
    { name: "raw checkbox values", type: "checkboxGroup", entries: [" home "], expected: [" home "] },
    { name: "configured and injected text sharing a key", type: "text", entries: [" Agent ", "injected"], expected: ["Agent", "injected"] },
    { name: "configured and injected dropdown sharing a key", type: "dropdown", entries: ["morning", "injected"], expected: ["morning", "injected"] },
    { name: "configured and injected checkboxes sharing a key", type: "checkboxGroup", entries: ["home", "injected"], expected: ["home", "injected"] },
    { name: "prototype property key", key: "__proto__", type: undefined, entries: ["value"], expected: "value" },
  ] as const)("serializes $name", ({ type, entries, expected, ...testCase }) => {
    const key = ("key" in testCase ? testCase.key : undefined) ?? "example";
    const values = new FormData();
    values.set("first_name", "Ada");
    values.set("last_name", "Lovelace");
    values.set("phone", "5555555555");
    entries.forEach((value) => values.append(`custom_data[${key}]`, value));
    values.set("unrelated", "ignored");
    values.set("custom_data[]", "ignored");
    values.set("custom_data[example]suffix", "ignored");
    const fields: FormField[] = type ? [{ type, label: "Example", key: ` ${key} ` }] : [];

    expect(prepareSubmissionData(values, fields, "PHONE")?.custom_data).toEqual(
      expected === undefined ? {} : { [key]: expected }
    );
  });

  it.each([
    {
      name: "first name is blank",
      contactMethod: "PHONE" as const,
      entries: [
        ["first_name", "   "],
        ["last_name", "Lovelace"],
        ["phone", "5555555555"],
      ],
      fields: [
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
      ] as FormField[],
    },
    {
      name: "the selected email is missing",
      contactMethod: "EMAIL" as const,
      entries: [
        ["first_name", "Ada"],
        ["last_name", "Lovelace"],
      ],
      fields: [
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "email", label: "Email" },
      ] as FormField[],
    },
    {
      name: "required custom text has only spaces",
      contactMethod: "PHONE" as const,
      entries: [
        ["first_name", "Ada"],
        ["last_name", "Lovelace"],
        ["phone", "5555555555"],
        ["custom_data[reason]", "   "],
      ],
      fields: [
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        { type: "text", label: "Reason", key: "reason", required: true },
      ] as FormField[],
    },
    {
      name: "required dropdown is empty",
      contactMethod: "PHONE" as const,
      entries: [
        ["first_name", "Ada"],
        ["last_name", "Lovelace"],
        ["phone", "5555555555"],
        ["custom_data[reason]", ""],
      ],
      fields: [{ type: "dropdown", label: "Reason", key: " reason ", required: true }] as FormField[],
    },
    {
      name: "required checkbox group is empty",
      contactMethod: "PHONE" as const,
      entries: [
        ["first_name", "Ada"],
        ["last_name", "Lovelace"],
        ["phone", "5555555555"],
      ],
      fields: [
        { type: "firstName", label: "First name" },
        { type: "lastName", label: "Last name" },
        { type: "phone", label: "Phone" },
        {
          type: "checkboxGroup",
          label: "Reason",
          key: "reason",
          required: true,
        },
      ] as FormField[],
    },
  ])(
    "when $name, then submission data is rejected",
    ({ contactMethod, entries, fields }) => {
      const values = new FormData();
      for (const [name, value] of entries) {
        values.append(name, value);
      }

      expect(prepareSubmissionData(values, fields, contactMethod)).toBeNull();
    }
  );
});
