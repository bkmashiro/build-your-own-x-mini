# 29-mini-validator

A small TypeScript validation library built with decorators.

## Features

- Decorator-based validation rules
- Built-in validators: `@IsString`, `@IsNumber`, `@IsEmail`, `@Min`, `@Max`
- Nested object validation with `@ValidateNested`
- Custom validators with `@ValidateBy`
- Detailed error output with `path`, `code`, `message`, `value`, and `expected`

## Usage

```ts
import {
  IsEmail,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
  validate,
} from "./src/index";

class Address {
  @IsString()
  city!: string;
}

class User {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsNumber()
  @Min(18)
  age!: number;

  @ValidateNested(() => Address)
  address!: Address;
}

const user = new User();
user.name = "Alice";
user.email = "alice@example.com";
user.age = 20;
user.address = Object.assign(new Address(), { city: "London" });

console.log(validate(user));
```

## Test

```bash
bun test
```
