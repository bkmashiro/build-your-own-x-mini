import { describe, expect, test } from "bun:test";

import {
  IsEmail,
  IsNumber,
  IsString,
  Max,
  Min,
  ValidateBy,
  ValidateNested,
  validate,
} from "../src/index";

class Address {
  @IsString()
  city!: string;

  @IsNumber()
  @Min(10000)
  @Max(99999)
  zip!: number;
}

class Profile {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsNumber()
  @Min(18)
  @Max(120)
  age!: number;

  @ValidateNested(() => Address)
  address!: Address;
}

class CustomUser {
  @ValidateBy({
    name: "starts_with_at",
    expected: "@",
    validate: (value) => typeof value === "string" && value.startsWith("@"),
    message: ({ path }) => `${path} must start with @`,
  })
  handle!: string;

  @ValidateBy({
    name: "not_reserved",
    validate: (value, context) =>
      typeof value === "string" && value !== context.object.forbiddenWord,
    message: ({ path, object }) => `${path} must not equal reserved word ${object.forbiddenWord}`,
  })
  nickname!: string;

  forbiddenWord!: string;
}

describe("29-mini-validator", () => {
  test("passes for valid objects", () => {
    const address = new Address();
    address.city = "London";
    address.zip = 12345;

    const profile = new Profile();
    profile.name = "Alice";
    profile.email = "alice@example.com";
    profile.age = 28;
    profile.address = address;

    expect(validate(profile)).toEqual([]);
  });

  test("returns detailed errors for scalar validation failures", () => {
    const profile = new Profile();
    profile.name = 123 as unknown as string;
    profile.email = "bad-email";
    profile.age = 10;
    profile.address = new Address();
    profile.address.city = "Paris";
    profile.address.zip = 75001;

    const errors = validate(profile);

    expect(errors).toEqual([
      {
        path: "name",
        property: "name",
        code: "is_string",
        message: "name must be a string",
        value: 123,
        expected: "string",
      },
      {
        path: "email",
        property: "email",
        code: "is_email",
        message: "email must be a valid email address",
        value: "bad-email",
        expected: "email",
      },
      {
        path: "age",
        property: "age",
        code: "min",
        message: "age must be greater than or equal to 18",
        value: 10,
        expected: 18,
      },
    ]);
  });

  test("validates nested objects and reports dotted paths", () => {
    const address = new Address();
    address.city = 42 as unknown as string;
    address.zip = 999999;

    const profile = new Profile();
    profile.name = "Alice";
    profile.email = "alice@example.com";
    profile.age = 28;
    profile.address = address;

    const errors = validate(profile);

    expect(errors).toEqual([
      {
        path: "address.city",
        property: "city",
        code: "is_string",
        message: "address.city must be a string",
        value: 42,
        expected: "string",
      },
      {
        path: "address.zip",
        property: "zip",
        code: "max",
        message: "address.zip must be less than or equal to 99999",
        value: 999999,
        expected: 99999,
      },
    ]);
  });

  test("supports custom validators with access to sibling fields", () => {
    const user = new CustomUser();
    user.handle = "alice";
    user.nickname = "admin";
    user.forbiddenWord = "admin";

    const errors = validate(user);

    expect(errors).toEqual([
      {
        path: "handle",
        property: "handle",
        code: "starts_with_at",
        message: "handle must start with @",
        value: "alice",
        expected: "@",
      },
      {
        path: "nickname",
        property: "nickname",
        code: "not_reserved",
        message: "nickname must not equal reserved word admin",
        value: "admin",
        expected: undefined,
      },
    ]);
  });

  test("returns a top-level error for non-object values", () => {
    expect(validate(null as unknown as object)).toEqual([
      {
        path: "",
        property: "",
        code: "invalid_object",
        message: "Value must be an object instance",
        value: null,
      },
    ]);
  });
});
