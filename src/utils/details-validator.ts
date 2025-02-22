import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

export function IsValidDetails(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDetails',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          // Regex to check for special characters
          const regex = /[^a-zA-Z0-9\s.,!?-]/;
          return typeof value === 'string' && !regex.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} contains invalid special characters`;
        },
      },
    });
  };
}
