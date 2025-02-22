import { registerDecorator, ValidationOptions } from 'class-validator';

export function ValidateAge(
  min: number,
  max: number,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'validateAge',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          const birthDate = new Date(value);
          const age = Math.floor(
            (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25),
          );
          return age >= min && age <= max;
        },
        defaultMessage() {
          return `Age must be between ${min} and ${max} years`;
        },
      },
    });
  };
}
