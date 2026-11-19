import { Body, Controller, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CheckoutService } from './checkout.service';
import { PaymentsService } from './payments.service';
import { CheckoutSessionDto, CreateOrderDto, MockPaymentDto, RazorpayOrderDto, ValidateCheckoutDto, VerifyPaymentDto } from './dto';
@Controller()
export class CheckoutController {
  constructor(private readonly checkout: CheckoutService, private readonly payments: PaymentsService) {}
  @Post('checkout/validate') @HttpCode(200) @UseGuards(JwtAuthGuard)
  validate(@CurrentUser() user: AuthUser, @Body() dto: ValidateCheckoutDto) { return this.checkout.validate(user.id, dto); }
  @Get('checkout/session') @UseGuards(JwtAuthGuard)
  getSession(@CurrentUser() user: AuthUser) { return this.checkout.session(user.id); }
  @Post('checkout/session') @HttpCode(200) @UseGuards(JwtAuthGuard)
  saveSession(@CurrentUser() user: AuthUser, @Body() dto: CheckoutSessionDto) { return this.checkout.session(user.id, dto); }
  @Post('orders') @UseGuards(JwtAuthGuard)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateOrderDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.checkout.create(user.id, { ...dto, checkoutKey: idempotencyKey ?? dto.checkoutKey });
  }
  @Post('payments/razorpay/order') @HttpCode(200) @UseGuards(JwtAuthGuard)
  order(@CurrentUser() user: AuthUser, @Body() dto: RazorpayOrderDto) { return this.payments.order(user.id, dto.orderId); }
  @Post('payments/razorpay/retry') @HttpCode(200) @UseGuards(JwtAuthGuard)
  retry(@CurrentUser() user: AuthUser, @Body() dto: RazorpayOrderDto) { return this.payments.retry(user.id, dto.orderId); }
  @Post('payments/razorpay/verify') @HttpCode(200) @UseGuards(JwtAuthGuard)
  verify(@CurrentUser() user: AuthUser, @Body() dto: VerifyPaymentDto) { return this.payments.verify(user.id, dto); }
  @Post('payments/mock/:orderId/succeed') @HttpCode(200) @UseGuards(JwtAuthGuard)
  mockSucceed(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string, @Body() dto: MockPaymentDto) { return this.payments.mockAction(user.id, orderId, 'succeed', dto.delayWebhook); }
  @Post('payments/mock/:orderId/fail') @HttpCode(200) @UseGuards(JwtAuthGuard)
  mockFail(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) { return this.payments.mockAction(user.id, orderId, 'fail'); }
  @Post('payments/mock/:orderId/cancel') @HttpCode(200) @UseGuards(JwtAuthGuard)
  mockCancel(@CurrentUser() user: AuthUser, @Param('orderId', ParseUUIDPipe) orderId: string) { return this.payments.mockAction(user.id, orderId, 'cancel'); }
  @Post('webhooks/razorpay') @HttpCode(200)
  webhook(@Req() request: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string, @Headers('x-razorpay-event-id') eventId?: string) { return this.payments.webhook(request.rawBody, signature ?? '', eventId); }
}
