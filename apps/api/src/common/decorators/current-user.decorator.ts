import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AdminJwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AdminJwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AdminJwtPayload;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
