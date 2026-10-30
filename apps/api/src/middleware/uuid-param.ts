import type { RequestParamHandler } from 'express';
import { z } from 'zod';
import { HttpError } from '../errors.js';

export const validateUuidParam: RequestParamHandler = (
  _request,
  _response,
  next,
  value,
) => {
  if (!z.uuid().safeParse(value).success) {
    next(new HttpError(400, 'Route identifier must be a valid UUID.'));
    return;
  }
  next();
};
