import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';

/** Checkout (2.8) creates AffiliateEarning rows for attributed orders; payouts run through Finance (7.2). */
@Module({
  controllers: [AffiliateController],
  providers: [AffiliateService],
  exports: [AffiliateService],
})
export class AffiliateModule {}
